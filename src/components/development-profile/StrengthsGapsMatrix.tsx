import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Minus, BarChart3 } from "lucide-react";
import { calculateDomainScore, parseQuestionTypes } from "@/lib/assessmentScoring";
import type { ScoredQuestion } from "@/lib/assessmentScoring";

interface Props {
  userId: string;
}

interface DomainResult {
  domainId: string;
  domainName: string;
  assessmentName: string;
  scorePercent: number;
  previousPercent: number | null;
  source: "capability" | "definition";
}

function getScoreColor(percent: number) {
  if (percent >= 80) return "text-green-600 bg-green-50 border-green-200";
  if (percent >= 50) return "text-amber-600 bg-amber-50 border-amber-200";
  return "text-red-600 bg-red-50 border-red-200";
}

function getScoreBarColor(percent: number) {
  if (percent >= 80) return "bg-green-500";
  if (percent >= 50) return "bg-amber-500";
  return "bg-red-500";
}

export function StrengthsGapsMatrix({ userId }: Props) {
  // Fetch capability assessment data
  const { data: capabilityData, isLoading: capLoading } = useQuery({
    queryKey: ["dev-profile-capabilities", userId],
    queryFn: async () => {
      // Get user's latest 2 snapshots per assessment for trend comparison
      const { data: snapshots, error } = await supabase
        .from("capability_snapshots")
        .select(
          `
          id, assessment_id, completed_at,
          capability_snapshot_ratings(question_id, rating),
          capability_assessments!inner(
            id, name, rating_scale, question_types,
            capability_domains(
              id, name,
              capability_domain_questions(id, question_type)
            )
          )
        `,
        )
        .eq("user_id", userId)
        .not("completed_at", "is", null)
        .order("completed_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      return snapshots || [];
    },
  });

  // Fetch assessment definition scores
  const { data: definitionData, isLoading: defLoading } = useQuery({
    queryKey: ["dev-profile-definitions", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessment_responses")
        .select(
          `
          id, assessment_id, dimension_scores, completed_at,
          assessment_definitions!inner(id, name)
        `,
        )
        .eq("user_id", userId)
        .order("completed_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      return data || [];
    },
  });

  const isLoading = capLoading || defLoading;

  // Process capability data into domain results
  const domainResults: DomainResult[] = [];

  if (capabilityData) {
    // Group snapshots by assessment
    const byAssessment = new Map<string, typeof capabilityData>();
    for (const snap of capabilityData) {
      const assessId = snap.assessment_id;
      if (!byAssessment.has(assessId)) byAssessment.set(assessId, []);
      byAssessment.get(assessId)!.push(snap);
    }

    for (const [, snaps] of byAssessment) {
      const latest = snaps[0];
      const previous = snaps.length > 1 ? snaps[1] : null;
      const assessment = latest.capability_assessments as any;
      if (!assessment) continue;

      const ratingScale = assessment.rating_scale || 10;
      const questionTypes = parseQuestionTypes(assessment.question_types);
      const domains = assessment.capability_domains || [];
      const ratings = (latest.capability_snapshot_ratings || []) as any[];
      const prevRatings = previous
        ? ((previous.capability_snapshot_ratings || []) as any[])
        : [];

      for (const domain of domains) {
        const domainQuestions = domain.capability_domain_questions || [];
        const questionIds = new Set(domainQuestions.map((q: any) => q.id));

        // Build scored questions for latest
        const scored: ScoredQuestion[] = ratings
          .filter((r: any) => questionIds.has(r.question_id))
          .map((r: any) => {
            const q = domainQuestions.find((dq: any) => dq.id === r.question_id);
            return {
              questionId: r.question_id,
              rating: r.rating,
              questionType: q?.question_type || null,
              typeWeight: null,
            };
          });

        if (scored.length === 0) continue;

        const result = calculateDomainScore(scored, questionTypes);
        const score = result.weightedAverage ?? result.simpleAverage;
        const scorePercent = (score / ratingScale) * 100;

        // Calculate previous score for trend
        let previousPercent: number | null = null;
        if (prevRatings.length > 0) {
          const prevScored: ScoredQuestion[] = prevRatings
            .filter((r: any) => questionIds.has(r.question_id))
            .map((r: any) => {
              const q = domainQuestions.find((dq: any) => dq.id === r.question_id);
              return {
                questionId: r.question_id,
                rating: r.rating,
                questionType: q?.question_type || null,
                typeWeight: null,
              };
            });
          if (prevScored.length > 0) {
            const prevResult = calculateDomainScore(prevScored, questionTypes);
            const prevScore = prevResult.weightedAverage ?? prevResult.simpleAverage;
            previousPercent = (prevScore / ratingScale) * 100;
          }
        }

        domainResults.push({
          domainId: domain.id,
          domainName: domain.name,
          assessmentName: assessment.name,
          scorePercent,
          previousPercent,
          source: "capability",
        });
      }
    }
  }

  // Process assessment definition dimension scores
  if (definitionData) {
    const byAssessment = new Map<string, typeof definitionData>();
    for (const resp of definitionData) {
      const assessId = resp.assessment_id;
      if (!byAssessment.has(assessId)) byAssessment.set(assessId, []);
      byAssessment.get(assessId)!.push(resp);
    }

    for (const [, resps] of byAssessment) {
      const latest = resps[0];
      const previous = resps.length > 1 ? resps[1] : null;
      const dimScores = latest.dimension_scores as Record<string, number> | null;
      if (!dimScores || typeof dimScores !== "object") continue;

      const prevDimScores = previous?.dimension_scores as Record<string, number> | null;
      const assessName = (latest.assessment_definitions as any)?.name || "Assessment";

      for (const [dimName, score] of Object.entries(dimScores)) {
        if (typeof score !== "number") continue;
        // Assume definition scores are already percentages or 0-100
        const scorePercent = score > 1 ? score : score * 100;
        const previousPercent =
          prevDimScores && typeof prevDimScores[dimName] === "number"
            ? prevDimScores[dimName] > 1
              ? prevDimScores[dimName]
              : prevDimScores[dimName] * 100
            : null;

        domainResults.push({
          domainId: `def-${dimName}`,
          domainName: dimName,
          assessmentName: assessName,
          scorePercent,
          previousPercent,
          source: "definition",
        });
      }
    }
  }

  // Sort by score ascending (gaps first)
  domainResults.sort((a, b) => a.scorePercent - b.scorePercent);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Strengths & Gaps
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Strengths & Gaps
        </CardTitle>
      </CardHeader>
      <CardContent>
        {domainResults.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Complete an assessment to see your strengths and gaps
          </p>
        ) : (
          <div className="space-y-3">
            {domainResults.map((domain) => {
              const trend =
                domain.previousPercent != null
                  ? domain.scorePercent - domain.previousPercent
                  : null;
              return (
                <div
                  key={domain.domainId}
                  className="flex items-center gap-3 p-2 rounded-lg border"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">
                        {domain.domainName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {domain.assessmentName}
                      </span>
                    </div>
                    <div className="mt-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${getScoreBarColor(domain.scorePercent)}`}
                        style={{ width: `${Math.min(100, domain.scorePercent)}%` }}
                      />
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={`shrink-0 ${getScoreColor(domain.scorePercent)}`}
                  >
                    {Math.round(domain.scorePercent)}%
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
        )}
      </CardContent>
    </Card>
  );
}
