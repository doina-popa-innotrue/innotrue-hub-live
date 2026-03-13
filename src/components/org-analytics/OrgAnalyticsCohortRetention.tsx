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
import { UsersRound } from "lucide-react";
import { format } from "date-fns";
import type { CohortRetentionData } from "@/hooks/useOrgAnalyticsAdvanced";

function RateBadge({ value, invert = false }: { value: number; invert?: boolean }) {
  // For dropout rate, lower is better (invert thresholds)
  const good = invert ? value <= 15 : value >= 70;
  const ok = invert ? value <= 30 : value >= 40;

  const variant = good ? "default" : ok ? "secondary" : "destructive";
  return <Badge variant={variant}>{value}%</Badge>;
}

interface OrgAnalyticsCohortRetentionProps {
  data: CohortRetentionData;
}

export function OrgAnalyticsCohortRetention({ data }: OrgAnalyticsCohortRetentionProps) {
  const { cohorts, overall } = data;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Cohorts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overall.total_cohorts}</div>
            <p className="text-xs text-muted-foreground">With org member enrollments</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg Completion Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overall.avg_completion_rate}%</div>
            <p className="text-xs text-muted-foreground">Across all cohorts</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg Attendance Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overall.avg_attendance_rate}%</div>
            <p className="text-xs text-muted-foreground">Session attendance</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg Dropout Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overall.avg_dropout_rate}%</div>
            <p className="text-xs text-muted-foreground">Cancelled or paused</p>
          </CardContent>
        </Card>
      </div>

      {/* Cohort comparison table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UsersRound className="h-5 w-5" />
            Cohort Comparison
          </CardTitle>
          <CardDescription>
            Retention and engagement metrics across cohorts with your organisation members
          </CardDescription>
        </CardHeader>
        <CardContent>
          {cohorts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No cohort enrollments found for your members
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cohort</TableHead>
                    <TableHead>Program</TableHead>
                    <TableHead>Dates</TableHead>
                    <TableHead className="text-center">Enrolled</TableHead>
                    <TableHead className="text-center">Sessions</TableHead>
                    <TableHead className="text-center">Completion</TableHead>
                    <TableHead className="text-center">Attendance</TableHead>
                    <TableHead className="text-center">Modules</TableHead>
                    <TableHead className="text-center">Dropout</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cohorts.map((c) => (
                    <TableRow key={c.cohort_id}>
                      <TableCell>
                        <div>
                          <span className="font-medium">{c.cohort_name}</span>
                          <Badge variant="outline" className="ml-2 text-xs">
                            {c.cohort_status}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[150px] truncate text-muted-foreground">
                        {c.program_name}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {c.start_date ? format(new Date(c.start_date), "MMM d, yy") : "—"}
                        {" – "}
                        {c.end_date ? format(new Date(c.end_date), "MMM d, yy") : "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        {c.total_enrolled}
                        {c.capacity ? (
                          <span className="text-muted-foreground text-xs">/{c.capacity}</span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-center">{c.total_sessions}</TableCell>
                      <TableCell className="text-center">
                        <RateBadge value={c.completion_rate} />
                      </TableCell>
                      <TableCell className="text-center">
                        <RateBadge value={c.attendance_rate} />
                      </TableCell>
                      <TableCell className="text-center">
                        <RateBadge value={c.module_completion_rate} />
                      </TableCell>
                      <TableCell className="text-center">
                        <RateBadge value={c.dropout_rate} invert />
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Overall averages row */}
                  {cohorts.length > 1 && (
                    <TableRow className="bg-muted/50 font-medium">
                      <TableCell colSpan={5} className="text-right">
                        Average across cohorts
                      </TableCell>
                      <TableCell className="text-center">
                        <RateBadge value={overall.avg_completion_rate} />
                      </TableCell>
                      <TableCell className="text-center">
                        <RateBadge value={overall.avg_attendance_rate} />
                      </TableCell>
                      <TableCell className="text-center">
                        <RateBadge value={overall.avg_module_completion_rate} />
                      </TableCell>
                      <TableCell className="text-center">
                        <RateBadge value={overall.avg_dropout_rate} invert />
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
