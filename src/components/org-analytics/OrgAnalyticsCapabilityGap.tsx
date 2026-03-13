import { useState } from "react";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { ChevronDown, ChevronRight, Brain, Puzzle } from "lucide-react";
import type { CapabilityGapData } from "@/hooks/useOrgAnalyticsAdvanced";

interface OrgAnalyticsCapabilityGapProps {
  data: CapabilityGapData;
  totalMembers: number;
}

function GapIndicator({ gap }: { gap: number | null }) {
  if (gap == null) return <span className="text-muted-foreground text-xs">N/A</span>;
  const absGap = Math.abs(gap);
  const color =
    absGap <= 0.5 ? "text-green-600" : absGap <= 1.0 ? "text-amber-600" : "text-red-600";
  const label = gap > 0 ? `+${gap}` : `${gap}`;
  return <span className={`text-xs font-medium ${color}`}>{label}</span>;
}

function getBarColor(score: number, scale: number): string {
  const pct = score / scale;
  if (pct >= 0.7) return "hsl(var(--chart-4))";
  if (pct >= 0.4) return "hsl(var(--chart-5))";
  return "hsl(var(--destructive))";
}

export function OrgAnalyticsCapabilityGap({ data, totalMembers }: OrgAnalyticsCapabilityGapProps) {
  const [openAssessments, setOpenAssessments] = useState<Set<string>>(new Set());

  function toggleAssessment(id: string) {
    setOpenAssessments((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const { assessments, skills_coverage: sc } = data;

  return (
    <div className="space-y-6">
      {/* Assessment Domain Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Capability Assessment Analysis
          </CardTitle>
          <CardDescription>
            Organisation-wide scores by assessment and domain.
            Expand each assessment to see domain-level gaps.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {assessments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No completed capability assessments found for your members
            </div>
          ) : (
            <div className="space-y-3">
              {assessments.map((assessment) => {
                const isOpen = openAssessments.has(assessment.assessment_id);
                const chartData = assessment.domains.map((d) => ({
                  name: d.domain_name,
                  score: d.org_avg_score,
                  selfAvg: d.self_avg,
                  evaluatorAvg: d.evaluator_avg,
                  gap: d.self_evaluator_gap,
                  scale: assessment.rating_scale,
                }));

                return (
                  <Collapsible
                    key={assessment.assessment_id}
                    open={isOpen}
                    onOpenChange={() => toggleAssessment(assessment.assessment_id)}
                  >
                    <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border p-4 hover:bg-accent/50 transition-colors">
                      <div className="flex items-center gap-3">
                        {isOpen ? (
                          <ChevronDown className="h-4 w-4 shrink-0" />
                        ) : (
                          <ChevronRight className="h-4 w-4 shrink-0" />
                        )}
                        <div className="text-left">
                          <span className="font-medium">{assessment.assessment_name}</span>
                          <p className="text-xs text-muted-foreground">
                            {assessment.domains.length} domains
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">
                          {assessment.members_assessed}/{totalMembers} assessed
                        </Badge>
                        <Badge
                          variant="secondary"
                          className="tabular-nums"
                        >
                          Avg: {assessment.org_avg_score}/{assessment.rating_scale}
                        </Badge>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="border border-t-0 rounded-b-lg p-4 space-y-4">
                        {/* Horizontal bar chart */}
                        {chartData.length > 0 && (
                          <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 50)}>
                            <BarChart
                              data={chartData}
                              layout="vertical"
                              margin={{ left: 0, right: 20 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                              <XAxis
                                type="number"
                                domain={[0, assessment.rating_scale]}
                                tick={{ fontSize: 12 }}
                              />
                              <YAxis
                                type="category"
                                dataKey="name"
                                width={160}
                                tick={{ fontSize: 12 }}
                              />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: "hsl(var(--background))",
                                  border: "1px solid hsl(var(--border))",
                                  borderRadius: "8px",
                                }}
                                formatter={(value: number, name: string) => [
                                  `${value}/${assessment.rating_scale}`,
                                  name === "score" ? "Org Average" : name,
                                ]}
                              />
                              <Bar dataKey="score" radius={[0, 4, 4, 0]} maxBarSize={30}>
                                {chartData.map((entry, i) => (
                                  <Cell
                                    key={i}
                                    fill={getBarColor(entry.score, entry.scale)}
                                  />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        )}

                        {/* Self vs Evaluator table */}
                        {assessment.domains.some((d) => d.evaluator_avg != null) && (
                          <div>
                            <h4 className="text-sm font-medium mb-2">Self vs Evaluator Gap</h4>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Domain</TableHead>
                                  <TableHead className="text-center">Self Avg</TableHead>
                                  <TableHead className="text-center">Evaluator Avg</TableHead>
                                  <TableHead className="text-center">Gap</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {assessment.domains.map((d) => (
                                  <TableRow key={d.domain_id}>
                                    <TableCell className="font-medium">{d.domain_name}</TableCell>
                                    <TableCell className="text-center">
                                      {d.self_avg != null ? d.self_avg : "—"}
                                    </TableCell>
                                    <TableCell className="text-center">
                                      {d.evaluator_avg != null ? d.evaluator_avg : "—"}
                                    </TableCell>
                                    <TableCell className="text-center">
                                      <GapIndicator gap={d.self_evaluator_gap} />
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                            <p className="text-xs text-muted-foreground mt-1">
                              Positive gap = self-assessment higher than evaluator. Green (&le;0.5), Amber (0.5–1.0), Red (&gt;1.0).
                            </p>
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Skills Coverage */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Puzzle className="h-5 w-5" />
            Skills Coverage
          </CardTitle>
          <CardDescription>
            Skills required by enrolled programs vs skills acquired by members
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sc.total_program_skills === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No program-linked skills defined yet
            </div>
          ) : (
            <div className="space-y-4">
              {/* Summary */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>
                    {sc.total_acquired} of {sc.total_program_skills} skills acquired
                  </span>
                  <span className="font-medium">{sc.coverage_pct}%</span>
                </div>
                <Progress value={sc.coverage_pct} className="h-3" />
              </div>

              {/* Top gaps */}
              {sc.top_gaps.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Biggest Skill Gaps</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Skill</TableHead>
                        <TableHead className="text-center">Programs Requiring</TableHead>
                        <TableHead className="text-center">Members Acquired</TableHead>
                        <TableHead className="text-center">Members Enrolled</TableHead>
                        <TableHead className="text-center">Acquisition %</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sc.top_gaps.map((gap) => (
                        <TableRow key={gap.skill_id}>
                          <TableCell className="font-medium">{gap.skill_name}</TableCell>
                          <TableCell className="text-center">{gap.required_by_programs}</TableCell>
                          <TableCell className="text-center">{gap.members_acquired}</TableCell>
                          <TableCell className="text-center">{gap.members_enrolled}</TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant={
                                gap.acquisition_pct >= 70
                                  ? "default"
                                  : gap.acquisition_pct >= 40
                                    ? "secondary"
                                    : "destructive"
                              }
                            >
                              {gap.acquisition_pct}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
