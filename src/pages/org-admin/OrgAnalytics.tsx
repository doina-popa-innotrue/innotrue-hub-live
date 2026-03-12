import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Users,
  GraduationCap,
  TrendingUp,
  BookOpen,
  CheckCircle2,
  CalendarIcon,
  Coins,
  FileText,
  ClipboardCheck,
  Layers,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { format, subDays } from "date-fns";
import { PageLoadingState } from "@/components/ui/page-loading-state";
import { useOrgAnalyticsSummary, type OrgAnalyticsSummary } from "@/hooks/useOrgAnalyticsSummary";

// ---------- Date range helpers ----------

interface DateRange {
  from: Date;
  to: Date;
}

const DATE_PRESETS = [
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
  { label: "Last 6 months", days: 180 },
  { label: "Last 12 months", days: 365 },
] as const;

function toISODate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

// ---------- Stat card component ----------

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconClassName,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  iconClassName?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={iconClassName ?? "h-4 w-4 text-muted-foreground"} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

// ---------- Chart colours ----------

const PIE_COLORS = [
  "hsl(var(--chart-4))",
  "hsl(var(--primary))",
  "hsl(var(--chart-5))",
  "hsl(var(--muted))",
];

// ---------- Main component ----------

export default function OrgAnalytics() {
  const { organizationMembership } = useAuth();
  const orgId = organizationMembership?.organization_id ?? undefined;

  // Date range state
  const [dateRange, setDateRange] = useState<DateRange>({
    from: subDays(new Date(), 90),
    to: new Date(),
  });

  const queryOptions = useMemo(
    () => ({
      dateFrom: toISODate(dateRange.from),
      dateTo: toISODate(dateRange.to),
    }),
    [dateRange],
  );

  // Main analytics query via server RPC
  const { data: analytics, isLoading, error } = useOrgAnalyticsSummary(orgId, queryOptions);

  // Batch-fetch profile names for member engagement table
  const [profileMap, setProfileMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (!analytics?.member_engagement?.length) return;

    const userIds = analytics.member_engagement.map((m) => m.user_id);
    if (userIds.length === 0) return;

    supabase
      .from("profiles")
      .select("id, name")
      .in("id", userIds)
      .then(({ data }) => {
        const map = new Map<string, string>();
        data?.forEach((p) => map.set(p.id, p.name ?? "Unknown"));
        setProfileMap(map);
      });
  }, [analytics?.member_engagement]);

  // Derived chart data
  const enrollmentPieData = useMemo(() => {
    if (!analytics) return [];
    const s = analytics.enrollment_stats;
    return [
      { name: "Completed", value: s.completed, color: PIE_COLORS[0] },
      { name: "Active", value: s.active, color: PIE_COLORS[1] },
      { name: "Paused", value: s.paused, color: PIE_COLORS[2] },
      { name: "Cancelled", value: s.cancelled, color: PIE_COLORS[3] },
    ].filter((d) => d.value > 0);
  }, [analytics]);

  const trendChartData = useMemo(() => {
    if (!analytics?.enrollment_trends?.length) return [];
    return analytics.enrollment_trends.map((t) => ({
      week: format(new Date(t.week_start), "MMM d"),
      "New Enrollments": t.new_enrollments,
      Completions: t.completions,
    }));
  }, [analytics]);

  // ---------- Loading / Error states ----------

  if (isLoading) {
    return <PageLoadingState message="Loading analytics..." />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
        <p>Failed to load analytics. Please try again later.</p>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
        <p>No analytics data available.</p>
      </div>
    );
  }

  const { enrollment_stats: es, module_stats: ms, scenario_stats: ss, capability_stats: cs, credit_stats: cr } = analytics;

  // ---------- Member activity helpers ----------

  function getMemberStatus(lastActivity: string | null): "active" | "inactive" | "new" {
    if (!lastActivity) return "new";
    const lastDate = new Date(lastActivity);
    return lastDate > subDays(new Date(), 14) ? "active" : "inactive";
  }

  function getStatusBadge(status: "active" | "inactive" | "new") {
    switch (status) {
      case "active":
        return (
          <Badge variant="default" className="bg-chart-4 text-chart-4-foreground">
            Active
          </Badge>
        );
      case "inactive":
        return <Badge variant="secondary">Inactive</Badge>;
      case "new":
        return <Badge variant="outline">New</Badge>;
    }
  }

  // ---------- Render ----------

  return (
    <div className="space-y-6">
      {/* Header with date range picker */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Analytics</h1>
          <p className="text-muted-foreground">
            Track your team&apos;s learning progress and engagement
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {DATE_PRESETS.map((preset) => (
            <Button
              key={preset.days}
              variant="ghost"
              size="sm"
              className={
                Math.round(
                  (dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24),
                ) === preset.days
                  ? "bg-accent"
                  : ""
              }
              onClick={() =>
                setDateRange({ from: subDays(new Date(), preset.days), to: new Date() })
              }
            >
              {preset.label}
            </Button>
          ))}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-auto justify-start text-left font-normal"
              >
                <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                <span className="truncate">
                  {format(dateRange.from, "MMM d, yyyy")} &ndash;{" "}
                  {format(dateRange.to, "MMM d, yyyy")}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="range"
                selected={{ from: dateRange.from, to: dateRange.to }}
                onSelect={(range) => {
                  if (range?.from && range?.to) {
                    setDateRange({ from: range.from, to: range.to });
                  }
                }}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* ---- Overview KPI Cards ---- */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Members"
          value={analytics.total_members}
          subtitle={`${es.unique_learners} enrolled in programs`}
          icon={Users}
        />
        <StatCard
          title="Total Enrollments"
          value={es.total}
          subtitle={`${es.new_in_period} new in period`}
          icon={GraduationCap}
        />
        <StatCard
          title="Completion Rate"
          value={`${es.completion_rate}%`}
          subtitle={`${es.completed} of ${es.total} completed`}
          icon={TrendingUp}
        />
        <StatCard
          title="Credits Available"
          value={cr.available}
          subtitle={`${cr.total_consumed} consumed total`}
          icon={Coins}
          iconClassName="h-4 w-4 text-amber-500"
        />
      </div>

      {/* ---- Period Activity Row ---- */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Modules Completed"
          value={ms.completed_in_period}
          subtitle={`${ms.completion_rate}% overall module completion`}
          icon={Layers}
        />
        <StatCard
          title="Scenarios Evaluated"
          value={ss.evaluated_in_period}
          subtitle={`${ss.unique_participants} unique participants`}
          icon={FileText}
        />
        <StatCard
          title="Assessments Completed"
          value={cs.completed_in_period}
          subtitle={`${cs.unique_assessed} members assessed`}
          icon={ClipboardCheck}
        />
        <StatCard
          title="Avg Module Time"
          value={ms.avg_completion_days > 0 ? `${ms.avg_completion_days}d` : "—"}
          subtitle="Average days to complete a module"
          icon={CheckCircle2}
          iconClassName="h-4 w-4 text-green-500"
        />
      </div>

      {/* ---- Charts Row ---- */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Enrollment Trends Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Enrollment Trends</CardTitle>
            <CardDescription>Weekly new enrollments and completions</CardDescription>
          </CardHeader>
          <CardContent>
            {trendChartData.length > 0 &&
            trendChartData.some(
              (t) => t["New Enrollments"] > 0 || t.Completions > 0,
            ) ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={trendChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="week" tick={{ fontSize: 12 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend />
                  <Bar
                    dataKey="New Enrollments"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="Completions"
                    fill="hsl(var(--chart-4))"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[280px] text-muted-foreground">
                No enrollment activity in this period
              </div>
            )}
          </CardContent>
        </Card>

        {/* Enrollment Status Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Enrollment Status</CardTitle>
            <CardDescription>Distribution of all enrollment statuses</CardDescription>
          </CardHeader>
          <CardContent>
            {enrollmentPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={enrollmentPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {enrollmentPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[280px] text-muted-foreground">
                No enrollments yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ---- Program Progress ---- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Program Progress
          </CardTitle>
          <CardDescription>
            Enrollment and module completion rates by program
          </CardDescription>
        </CardHeader>
        <CardContent>
          {analytics.program_breakdown.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No program enrollments yet
            </div>
          ) : (
            <div className="space-y-5">
              {analytics.program_breakdown.map((program) => (
                <div key={program.program_id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{program.program_name}</span>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span>
                        {program.completed}/{program.total_enrolled} completed ({program.completion_rate}%)
                      </span>
                      <Badge variant="outline" className="text-xs">
                        Modules: {program.module_completion_rate}%
                      </Badge>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Progress value={program.completion_rate} className="h-2" />
                    </div>
                  </div>
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span>{program.active} active</span>
                    <span>{program.completed} completed</span>
                    <span>{program.total_enrolled} total enrolled</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ---- Credit Usage ---- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-amber-500" />
            Credit Usage
          </CardTitle>
          <CardDescription>Organisation credit balance and consumption</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border p-3">
              <p className="text-sm text-muted-foreground">Available</p>
              <p className="text-2xl font-bold">{cr.available}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-sm text-muted-foreground">Total Purchased</p>
              <p className="text-2xl font-bold">{cr.total_purchased}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-sm text-muted-foreground">Total Consumed</p>
              <p className="text-2xl font-bold">{cr.total_consumed}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-sm text-muted-foreground">Consumed in Period</p>
              <p className="text-2xl font-bold">{cr.consumed_in_period}</p>
            </div>
          </div>
          {cr.recent_transactions.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium mb-2">Recent Transactions</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cr.recent_transactions.map((tx, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Badge variant={tx.amount > 0 ? "default" : "secondary"}>
                          {tx.type}
                        </Badge>
                      </TableCell>
                      <TableCell
                        className={tx.amount > 0 ? "text-green-600 font-medium" : "text-muted-foreground"}
                      >
                        {tx.amount > 0 ? "+" : ""}
                        {tx.amount}
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-[200px] truncate">
                        {tx.description || "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {tx.created_at ? format(new Date(tx.created_at), "MMM d, yyyy") : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ---- Member Engagement ---- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Member Engagement
          </CardTitle>
          <CardDescription>
            Individual member progress across enrollments, modules, scenarios, and assessments (top 20)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {analytics.member_engagement.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No members in your organisation yet
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">Enrollments</TableHead>
                    <TableHead className="text-center">Completed</TableHead>
                    <TableHead className="text-center">Modules</TableHead>
                    <TableHead className="text-center">Scenarios</TableHead>
                    <TableHead className="text-center">Assessments</TableHead>
                    <TableHead>Last Activity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analytics.member_engagement.map((member) => {
                    const name = profileMap.get(member.user_id) ?? "Loading...";
                    const status = getMemberStatus(member.last_activity);
                    return (
                      <TableRow key={member.user_id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              <span className="text-sm font-medium text-primary">
                                {name[0]?.toUpperCase() ?? "?"}
                              </span>
                            </div>
                            <span className="font-medium truncate max-w-[150px]">{name}</span>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(status)}</TableCell>
                        <TableCell className="text-center">{member.enrollment_count}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                            {member.completed_enrollments}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">{member.modules_completed}</TableCell>
                        <TableCell className="text-center">{member.scenarios_evaluated}</TableCell>
                        <TableCell className="text-center">{member.assessments_completed}</TableCell>
                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          {member.last_activity
                            ? format(new Date(member.last_activity), "MMM d, yyyy")
                            : "No activity"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
