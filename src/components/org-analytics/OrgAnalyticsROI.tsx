import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Coins,
  TrendingUp,
  Clock,
  Target,
  Sparkles,
  UserCheck,
} from "lucide-react";
import type { ROIMetrics } from "@/hooks/useOrgAnalyticsAdvanced";

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

interface OrgAnalyticsROIProps {
  data: ROIMetrics;
}

export function OrgAnalyticsROI({ data }: OrgAnalyticsROIProps) {
  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Total Credit Investment"
          value={data.total_credit_investment}
          subtitle={`Across ${data.total_enrollments} enrollments`}
          icon={Coins}
          iconClassName="h-4 w-4 text-amber-500"
        />
        <StatCard
          title="Cost per Completion"
          value={data.cost_per_completion != null ? `${data.cost_per_completion} cr` : "—"}
          subtitle={`${data.total_completions} completed enrollments`}
          icon={Target}
          iconClassName="h-4 w-4 text-blue-500"
        />
        <StatCard
          title="Completion Efficiency"
          value={`${data.completion_efficiency}%`}
          subtitle="Of non-cancelled enrollments completed"
          icon={TrendingUp}
          iconClassName="h-4 w-4 text-green-500"
        />
        <StatCard
          title="Avg Completion Time"
          value={data.avg_enrollment_completion_days > 0 ? `${data.avg_enrollment_completion_days}d` : "—"}
          subtitle="Average days to complete an enrollment"
          icon={Clock}
        />
        <StatCard
          title="Cost per Active Learner"
          value={data.cost_per_active_learner != null ? `${data.cost_per_active_learner} cr` : "—"}
          subtitle={`${data.active_learners} active learners • ${data.credits_consumed_in_period} cr consumed in period`}
          icon={UserCheck}
          iconClassName="h-4 w-4 text-purple-500"
        />
        <StatCard
          title="Skills Acquired"
          value={data.skills_acquired_in_period}
          subtitle={
            data.credits_per_skill != null
              ? `${data.credits_per_skill} credits per skill`
              : "In selected period"
          }
          icon={Sparkles}
          iconClassName="h-4 w-4 text-orange-500"
        />
      </div>

      {/* Program ROI Table */}
      <Card>
        <CardHeader>
          <CardTitle>Program ROI Breakdown</CardTitle>
          <CardDescription>
            Credit investment, completions, and efficiency per program
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.program_roi.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No program enrollment data available
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Program</TableHead>
                    <TableHead className="text-right">Investment</TableHead>
                    <TableHead className="text-center">Enrolled</TableHead>
                    <TableHead className="text-center">Completed</TableHead>
                    <TableHead className="text-right">Cost / Completion</TableHead>
                    <TableHead className="text-right">Avg Days</TableHead>
                    <TableHead className="text-center">Skills</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.program_roi.map((prog) => (
                    <TableRow key={prog.program_id}>
                      <TableCell className="font-medium max-w-[200px] truncate">
                        {prog.program_name}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline">{prog.total_investment} cr</Badge>
                      </TableCell>
                      <TableCell className="text-center">{prog.total_enrolled}</TableCell>
                      <TableCell className="text-center">{prog.completions}</TableCell>
                      <TableCell className="text-right">
                        {prog.cost_per_completion != null
                          ? `${prog.cost_per_completion} cr`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {prog.avg_completion_days > 0
                          ? `${prog.avg_completion_days}d`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-center">{prog.skills_granted}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
