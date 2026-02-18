import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Target, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

interface Props {
  userId: string;
}

interface GoalWithLink {
  id: string;
  title: string;
  status: string;
  progress_percentage: number | null;
  priority: string;
  score_at_creation: number | null;
  target_score: number | null;
  domain_name: string | null;
  assessment_name: string | null;
  rating_scale: number;
}

const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-red-100 text-red-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-green-100 text-green-700",
};

export function AssessmentGoalProgress({ userId }: Props) {
  const { data: goals = [], isLoading } = useQuery({
    queryKey: ["dev-profile-assessment-goals", userId],
    queryFn: async () => {
      // Fetch active goals that have assessment links
      const { data: goalData, error: goalError } = await supabase
        .from("goals")
        .select("id, title, status, progress_percentage, priority")
        .eq("user_id", userId)
        .in("status", ["active", "on_hold"])
        .order("created_at", { ascending: false });

      if (goalError) throw goalError;
      if (!goalData || goalData.length === 0) return [];

      // Fetch assessment links for these goals
      const goalIds = goalData.map((g) => g.id);
      const { data: links, error: linkError } = await supabase
        .from("goal_assessment_links" as string)
        .select(
          `
          goal_id, score_at_creation, target_score,
          capability_domains:capability_domain_id(name),
          capability_assessments:capability_assessment_id(name, rating_scale)
        `,
        )
        .in("goal_id", goalIds);

      if (linkError) throw linkError;

      // Build map of links
      const linkMap = new Map<string, (typeof links)[0]>();
      for (const link of links || []) {
        linkMap.set(link.goal_id, link);
      }

      // Merge goals with their assessment links — only include linked goals
      const results: GoalWithLink[] = [];
      for (const goal of goalData) {
        const link = linkMap.get(goal.id);
        if (!link) continue; // Only show goals with assessment links

        results.push({
          id: goal.id,
          title: goal.title,
          status: goal.status,
          progress_percentage: goal.progress_percentage,
          priority: goal.priority,
          score_at_creation: link.score_at_creation,
          target_score: link.target_score,
          domain_name: (link as any).capability_domains?.name ?? null,
          assessment_name: (link as any).capability_assessments?.name ?? null,
          rating_scale: (link as any).capability_assessments?.rating_scale ?? 10,
        });
      }

      return results;
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Assessment-Linked Goals
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Assessment-Linked Goals
          {goals.length > 0 && (
            <Badge variant="secondary" className="ml-auto">
              {goals.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {goals.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No goals linked to assessments yet.{" "}
            <Link to="/goals" className="text-primary hover:underline">
              Create a goal
            </Link>{" "}
            and link it to an assessment domain.
          </p>
        ) : (
          <div className="space-y-3">
            {goals.map((goal) => (
              <Link
                key={goal.id}
                to={`/goals/${goal.id}`}
                className="block p-3 rounded-lg border hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm truncate flex-1 mr-2">
                    {goal.title}
                  </span>
                  <Badge
                    variant="outline"
                    className={PRIORITY_COLORS[goal.priority] || ""}
                  >
                    {goal.priority}
                  </Badge>
                </div>

                {/* Progress bar */}
                <Progress
                  value={goal.progress_percentage || 0}
                  className="h-2 mb-2"
                />

                {/* Score journey */}
                {goal.domain_name && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {goal.domain_name}
                    </span>
                    {goal.score_at_creation != null && (
                      <>
                        <span>·</span>
                        <span>Started: {goal.score_at_creation}/{goal.rating_scale}</span>
                      </>
                    )}
                    {goal.target_score != null && (
                      <>
                        <ArrowRight className="h-3 w-3" />
                        <span>Target: {goal.target_score}/{goal.rating_scale}</span>
                      </>
                    )}
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
