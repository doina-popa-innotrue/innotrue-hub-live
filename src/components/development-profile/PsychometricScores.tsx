import { useState } from "react";
import { useLatestPsychometricResults } from "@/hooks/usePsychometricResults";
import type { PsychometricResult } from "@/hooks/usePsychometricResults";
import type { SchemaDimension } from "@/hooks/usePsychometricSchemas";
import { PsychometricScoreEntryDialog } from "@/components/assessments/PsychometricScoreEntryDialog";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Brain, TrendingUp, TrendingDown, Minus, Pencil } from "lucide-react";

interface Props {
  userId: string;
  /** If true, show "Enter Scores" action (for coaches viewing student profile) */
  allowEntry?: boolean;
}

function getScoreColor(percent: number) {
  if (percent >= 80) return "text-green-600 bg-green-50 border-green-200";
  if (percent >= 50) return "text-amber-600 bg-amber-50 border-amber-200";
  return "text-red-600 bg-red-50 border-red-200";
}

function getBarColor(percent: number) {
  if (percent >= 80) return "bg-green-500";
  if (percent >= 50) return "bg-amber-500";
  return "bg-red-500";
}

function normalizeScore(dim: SchemaDimension, value: number): number {
  const range = dim.max - dim.min;
  if (range === 0) return 0;
  return ((value - dim.min) / range) * 100;
}

export function PsychometricScores({ userId, allowEntry = false }: Props) {
  const { latestResults, previousResults, isLoading } =
    useLatestPsychometricResults(userId);

  const [editResult, setEditResult] = useState<PsychometricResult | null>(null);
  const [editAssessmentId, setEditAssessmentId] = useState("");
  const [editAssessmentName, setEditAssessmentName] = useState("");

  const openEdit = (result: PsychometricResult) => {
    setEditResult(result);
    setEditAssessmentId(result.assessment_id);
    setEditAssessmentName(result.assessment_name || "Assessment");
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Psychometric Scores
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (latestResults.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Psychometric Scores
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No structured psychometric scores yet. Scores can be entered after
            completing an external assessment.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Psychometric Scores
            <Badge variant="secondary" className="ml-auto">
              {latestResults.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {latestResults.map((result) => {
            const previous = previousResults.get(result.assessment_id);
            const dimensions = result.dimensions || [];

            return (
              <div key={result.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm">
                    {result.assessment_name || "Assessment"}
                  </h4>
                  <div className="flex items-center gap-2">
                    {result.assessed_at && (
                      <span className="text-xs text-muted-foreground">
                        {new Date(result.assessed_at).toLocaleDateString()}
                      </span>
                    )}
                    {allowEntry && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => openEdit(result)}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  {dimensions.map((dim) => {
                    const score = result.scores[dim.key];
                    if (score == null) return null;

                    const percent = normalizeScore(dim, score);
                    const prevScore = previous?.scores[dim.key];
                    const prevPercent =
                      prevScore != null ? normalizeScore(dim, prevScore) : null;
                    const trend =
                      prevPercent != null ? percent - prevPercent : null;

                    return (
                      <div
                        key={dim.key}
                        className="flex items-center gap-3 p-2 rounded-lg border"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm truncate">
                              {dim.label}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {score}/{dim.max}
                            </span>
                          </div>
                          <div className="mt-1 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${getBarColor(percent)}`}
                              style={{
                                width: `${Math.min(100, percent)}%`,
                              }}
                            />
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className={`shrink-0 ${getScoreColor(percent)}`}
                        >
                          {Math.round(percent)}%
                        </Badge>
                        {trend != null && (
                          <div className="shrink-0">
                            {trend > 2 ? (
                              <TrendingUp className="h-4 w-4 text-green-500" />
                            ) : trend < -2 ? (
                              <TrendingDown className="h-4 w-4 text-red-500" />
                            ) : (
                              <Minus className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {result.source_description && (
                  <p className="text-xs text-muted-foreground">
                    {result.source_description}
                  </p>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <PsychometricScoreEntryDialog
        open={!!editResult}
        onOpenChange={(open) => {
          if (!open) setEditResult(null);
        }}
        userId={userId}
        assessmentId={editAssessmentId}
        assessmentName={editAssessmentName}
        existingResult={editResult}
      />
    </>
  );
}
