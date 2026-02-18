import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Map, CheckCircle2, Circle, Clock } from "lucide-react";
import { Link } from "react-router-dom";

interface Props {
  userId: string;
}

interface PathInfo {
  surveyResponseId: string;
  templateId: string;
  templateName: string;
  completedAt: string;
  goalCount: number;
  completedGoals: number;
}

export function GuidedPathProgress({ userId }: Props) {
  const { data: paths = [], isLoading } = useQuery({
    queryKey: ["dev-profile-guided-paths", userId],
    queryFn: async () => {
      // Get user's guided path survey responses (these represent matched paths)
      const { data: responses, error } = await supabase
        .from("guided_path_survey_responses")
        .select(
          `
          id, completed_at, selected_template_ids,
          guided_path_surveys!inner(
            id, name,
            guided_path_templates!guided_path_surveys_template_id_fkey(id, name)
          )
        `,
        )
        .eq("user_id", userId)
        .order("completed_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      if (!responses || responses.length === 0) return [];

      // For each matched template, count goals created from it via instantiation
      // (For now, show the survey-selected templates as the active paths)
      const results: PathInfo[] = [];

      for (const resp of responses) {
        const templateIds: string[] =
          (resp.selected_template_ids as string[]) || [];

        if (templateIds.length === 0) continue;

        // Fetch template names for the selected template IDs
        const { data: templates } = await supabase
          .from("guided_path_templates")
          .select("id, name")
          .in("id", templateIds);

        for (const tmpl of templates || []) {
          // Count goals linked to this template via instantiation
          const { count: totalGoals } = await supabase
            .from("goals")
            .select("id", { count: "exact", head: true })
            .eq("user_id", userId)
            .eq("template_goal_id" as string, tmpl.id);

          const { count: completedGoals } = await supabase
            .from("goals")
            .select("id", { count: "exact", head: true })
            .eq("user_id", userId)
            .eq("template_goal_id" as string, tmpl.id)
            .eq("status", "completed");

          results.push({
            surveyResponseId: resp.id,
            templateId: tmpl.id,
            templateName: tmpl.name,
            completedAt: resp.completed_at || "",
            goalCount: totalGoals || 0,
            completedGoals: completedGoals || 0,
          });
        }
      }

      return results;
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Map className="h-5 w-5" />
            Guided Path Progress
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Map className="h-5 w-5" />
          Guided Path Progress
          {paths.length > 0 && (
            <Badge variant="secondary" className="ml-auto">
              {paths.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {paths.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No guided paths started yet.{" "}
            <Link to="/guided-paths" className="text-primary hover:underline">
              Explore guided paths
            </Link>{" "}
            to begin your development journey.
          </p>
        ) : (
          <div className="space-y-3">
            {paths.map((path) => {
              const progressPercent =
                path.goalCount > 0
                  ? Math.round((path.completedGoals / path.goalCount) * 100)
                  : 0;
              const isComplete = path.goalCount > 0 && path.completedGoals === path.goalCount;

              return (
                <Link
                  key={`${path.surveyResponseId}-${path.templateId}`}
                  to={`/guided-paths/${path.templateId}`}
                  className="block p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {isComplete ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                      ) : path.goalCount > 0 ? (
                        <Clock className="h-4 w-4 text-primary shrink-0" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <span className="font-medium text-sm truncate">
                        {path.templateName}
                      </span>
                    </div>
                    {path.goalCount > 0 && (
                      <span className="text-xs text-muted-foreground shrink-0 ml-2">
                        {path.completedGoals}/{path.goalCount} goals
                      </span>
                    )}
                  </div>

                  {path.goalCount > 0 ? (
                    <Progress value={progressPercent} className="h-2" />
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Matched — path not yet instantiated
                    </p>
                  )}

                  {/* Placeholder for DP3 gate indicators */}
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
