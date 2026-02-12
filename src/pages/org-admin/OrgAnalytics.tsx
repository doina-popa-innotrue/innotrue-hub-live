import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  Users,
  GraduationCap,
  TrendingUp,
  BookOpen,
  CheckCircle2,
  Clock,
  AlertCircle,
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
} from "recharts";
import { format, subDays, startOfDay } from "date-fns";

interface OverviewStats {
  totalMembers: number;
  totalEnrollments: number;
  activeEnrollments: number;
  completedEnrollments: number;
  completionRate: number;
  activeLearnersLast30Days: number;
}

interface ProgramProgress {
  programId: string;
  programName: string;
  totalEnrolled: number;
  completed: number;
  active: number;
  completionRate: number;
}

interface MemberActivity {
  userId: string;
  name: string | null;
  enrollmentCount: number;
  completedCount: number;
  lastActivity: string | null;
  status: "active" | "inactive" | "new";
}

interface EnrollmentTrend {
  date: string;
  enrollments: number;
  completions: number;
}

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--secondary))",
  "hsl(var(--accent))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export default function OrgAnalytics() {
  const { organizationMembership } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<OverviewStats>({
    totalMembers: 0,
    totalEnrollments: 0,
    activeEnrollments: 0,
    completedEnrollments: 0,
    completionRate: 0,
    activeLearnersLast30Days: 0,
  });
  const [programProgress, setProgramProgress] = useState<ProgramProgress[]>([]);
  const [memberActivity, setMemberActivity] = useState<MemberActivity[]>([]);
  const [enrollmentTrends, setEnrollmentTrends] = useState<EnrollmentTrend[]>([]);

  useEffect(() => {
    if (organizationMembership?.organization_id) {
      loadAnalytics();
    }
  }, [organizationMembership?.organization_id]);

  const loadAnalytics = async () => {
    if (!organizationMembership?.organization_id) return;

    try {
      setLoading(true);

      // Get organization members
      const { data: members } = await supabase
        .from("organization_members")
        .select("user_id, created_at")
        .eq("organization_id", organizationMembership.organization_id ?? "")
        .eq("is_active", true);

      const memberUserIds = members?.map((m) => m.user_id) || [];
      const totalMembers = memberUserIds.length;

      if (memberUserIds.length === 0) {
        setStats({
          totalMembers: 0,
          totalEnrollments: 0,
          activeEnrollments: 0,
          completedEnrollments: 0,
          completionRate: 0,
          activeLearnersLast30Days: 0,
        });
        setProgramProgress([]);
        setMemberActivity([]);
        setEnrollmentTrends([]);
        setLoading(false);
        return;
      }

      // Get all enrollments for org members (using staff_enrollments view to exclude financial data)
      const { data: enrollments } = await supabase
        .from("staff_enrollments")
        .select(
          `
          id,
          client_user_id,
          program_id,
          status,
          created_at,
          updated_at,
          programs (id, name)
        `,
        )
        .in("client_user_id", memberUserIds);

      const allEnrollments = enrollments || [];
      const activeEnrollments = allEnrollments.filter((e) => e.status === "active");
      const completedEnrollments = allEnrollments.filter((e) => e.status === "completed");

      // Calculate completion rate
      const completionRate =
        allEnrollments.length > 0
          ? Math.round((completedEnrollments.length / allEnrollments.length) * 100)
          : 0;

      // Active learners in last 30 days (based on enrollment updates)
      const thirtyDaysAgo = subDays(new Date(), 30);
      const activeLearnersSet = new Set(
        allEnrollments
          .filter((e) => e.updated_at && new Date(e.updated_at) > thirtyDaysAgo)
          .map((e) => e.client_user_id),
      );

      setStats({
        totalMembers,
        totalEnrollments: allEnrollments.length,
        activeEnrollments: activeEnrollments.length,
        completedEnrollments: completedEnrollments.length,
        completionRate,
        activeLearnersLast30Days: activeLearnersSet.size,
      });

      // Program progress breakdown
      const programMap = new Map<string, ProgramProgress>();
      allEnrollments.forEach((enrollment) => {
        const program = enrollment.programs as any;
        if (!program) return;

        const existing = programMap.get(program.id) || {
          programId: program.id,
          programName: program.name,
          totalEnrolled: 0,
          completed: 0,
          active: 0,
          completionRate: 0,
        };

        existing.totalEnrolled++;
        if (enrollment.status === "completed") existing.completed++;
        if (enrollment.status === "active") existing.active++;
        existing.completionRate = Math.round((existing.completed / existing.totalEnrolled) * 100);

        programMap.set(program.id, existing);
      });

      setProgramProgress(
        Array.from(programMap.values()).sort((a, b) => b.totalEnrolled - a.totalEnrolled),
      );

      // Member activity
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name")
        .in("id", memberUserIds);

      const memberMap = new Map<string, MemberActivity>();
      memberUserIds.forEach((userId) => {
        const profile = profiles?.find((p) => p.id === userId);
        const userEnrollments = allEnrollments.filter((e) => e.client_user_id === userId);
        const completedCount = userEnrollments.filter((e) => e.status === "completed").length;

        // Get last activity date
        const lastActivity =
          userEnrollments.length > 0
            ? userEnrollments.reduce(
                (latest, e) =>
                  e.updated_at && new Date(e.updated_at) > new Date(latest) ? e.updated_at : latest,
                userEnrollments[0].updated_at ?? "",
              ) || null
            : null;

        // Determine status
        let status: "active" | "inactive" | "new" = "new";
        if (userEnrollments.length > 0) {
          const lastActivityDate = lastActivity ? new Date(lastActivity) : null;
          if (lastActivityDate && lastActivityDate > subDays(new Date(), 14)) {
            status = "active";
          } else {
            status = "inactive";
          }
        }

        memberMap.set(userId, {
          userId,
          name: profile?.name || null,
          enrollmentCount: userEnrollments.length,
          completedCount,
          lastActivity,
          status,
        });
      });

      setMemberActivity(
        Array.from(memberMap.values()).sort((a, b) => b.enrollmentCount - a.enrollmentCount),
      );

      // Enrollment trends (last 30 days)
      const trends: Map<string, EnrollmentTrend> = new Map();
      for (let i = 29; i >= 0; i--) {
        const date = format(subDays(new Date(), i), "MMM d");
        trends.set(date, { date, enrollments: 0, completions: 0 });
      }

      allEnrollments.forEach((enrollment) => {
        const createdDate = enrollment.created_at
          ? format(new Date(enrollment.created_at), "MMM d")
          : null;
        if (createdDate && trends.has(createdDate)) {
          trends.get(createdDate)!.enrollments++;
        }
        if (enrollment.status === "completed" && enrollment.updated_at) {
          const updatedDate = format(new Date(enrollment.updated_at), "MMM d");
          if (trends.has(updatedDate)) {
            trends.get(updatedDate)!.completions++;
          }
        }
      });

      setEnrollmentTrends(Array.from(trends.values()));
    } catch (error) {
      console.error("Error loading analytics:", error);
      toast({
        title: "Error",
        description: "Failed to load analytics",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: MemberActivity["status"]) => {
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
  };

  const pieData = [
    { name: "Completed", value: stats.completedEnrollments, color: "hsl(var(--chart-4))" },
    { name: "Active", value: stats.activeEnrollments, color: "hsl(var(--primary))" },
    {
      name: "Other",
      value: stats.totalEnrollments - stats.completedEnrollments - stats.activeEnrollments,
      color: "hsl(var(--muted))",
    },
  ].filter((d) => d.value > 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading analytics...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Analytics</h1>
        <p className="text-muted-foreground">Track your team's learning progress and engagement</p>
      </div>

      {/* Overview Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalMembers}</div>
            <p className="text-xs text-muted-foreground">
              {stats.activeLearnersLast30Days} active in last 30 days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Enrollments</CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalEnrollments}</div>
            <p className="text-xs text-muted-foreground">
              {stats.activeEnrollments} currently active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completedEnrollments}</div>
            <p className="text-xs text-muted-foreground">Programs completed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completionRate}%</div>
            <Progress value={stats.completionRate} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Enrollment Trends Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Enrollment Trends</CardTitle>
            <CardDescription>New enrollments and completions over the last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            {enrollmentTrends.some((t) => t.enrollments > 0 || t.completions > 0) ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={enrollmentTrends}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar
                    dataKey="enrollments"
                    name="Enrollments"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="completions"
                    name="Completions"
                    fill="hsl(var(--chart-4))"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                No enrollment activity in the last 30 days
              </div>
            )}
          </CardContent>
        </Card>

        {/* Enrollment Status Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Enrollment Status</CardTitle>
            <CardDescription>Distribution of enrollment statuses</CardDescription>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                No enrollments yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Program Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Program Progress
          </CardTitle>
          <CardDescription>Completion rates by program</CardDescription>
        </CardHeader>
        <CardContent>
          {programProgress.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No program enrollments yet</div>
          ) : (
            <div className="space-y-4">
              {programProgress.map((program) => (
                <div key={program.programId} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{program.programName}</span>
                    <span className="text-sm text-muted-foreground">
                      {program.completed}/{program.totalEnrolled} completed (
                      {program.completionRate}%)
                    </span>
                  </div>
                  <Progress value={program.completionRate} className="h-2" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Member Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Member Activity
          </CardTitle>
          <CardDescription>Individual member progress and engagement</CardDescription>
        </CardHeader>
        <CardContent>
          {memberActivity.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No members in your organization yet
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Enrollments</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead>Last Activity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {memberActivity.slice(0, 10).map((member) => (
                  <TableRow key={member.userId}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-sm font-medium text-primary">
                            {member.name?.[0]?.toUpperCase() || "?"}
                          </span>
                        </div>
                        <span className="font-medium">{member.name || "Unknown User"}</span>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(member.status)}</TableCell>
                    <TableCell>{member.enrollmentCount}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        {member.completedCount}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {member.lastActivity
                        ? format(new Date(member.lastActivity), "MMM d, yyyy")
                        : "No activity"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
