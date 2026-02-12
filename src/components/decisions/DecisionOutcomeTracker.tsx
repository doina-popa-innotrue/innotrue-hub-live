import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Target, Award, Calendar } from "lucide-react";
import { format } from "date-fns";

export function DecisionOutcomeTracker() {
  const { data: decisions, isLoading } = useQuery({
    queryKey: ["decisions-with-outcomes"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("decisions")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "made")
        .not("expected_outcome", "is", null)
        .not("actual_outcome", "is", null)
        .order("decision_date", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Calculate accuracy using simple text similarity
  const calculateAccuracy = (expected: string, actual: string): number => {
    if (!expected || !actual) return 0;

    const exp = expected.toLowerCase().trim();
    const act = actual.toLowerCase().trim();

    // Simple keyword matching
    const expWords = new Set(exp.split(/\s+/).filter((w) => w.length > 3));
    const actWords = new Set(act.split(/\s+/).filter((w) => w.length > 3));

    if (expWords.size === 0 || actWords.size === 0) return 50;

    let matches = 0;
    expWords.forEach((word) => {
      if (actWords.has(word)) matches++;
    });

    return Math.round((matches / expWords.size) * 100);
  };

  const decisionsWithAccuracy =
    decisions?.map((d) => ({
      ...d,
      accuracy: calculateAccuracy(d.expected_outcome || "", d.actual_outcome || ""),
    })) || [];

  const overallAccuracy =
    decisionsWithAccuracy.length > 0
      ? Math.round(
          decisionsWithAccuracy.reduce((sum, d) => sum + d.accuracy, 0) /
            decisionsWithAccuracy.length,
        )
      : 0;

  const recentAccuracy =
    decisionsWithAccuracy.slice(0, 5).length > 0
      ? Math.round(
          decisionsWithAccuracy.slice(0, 5).reduce((sum, d) => sum + d.accuracy, 0) /
            Math.min(5, decisionsWithAccuracy.length),
        )
      : 0;

  const trend = recentAccuracy - overallAccuracy;

  // Group by importance
  const byImportance = decisionsWithAccuracy.reduce(
    (acc, d) => {
      const imp = d.importance || "medium";
      if (!acc[imp]) acc[imp] = [];
      acc[imp].push(d);
      return acc;
    },
    {} as Record<string, typeof decisionsWithAccuracy>,
  );

  const importanceAccuracy = Object.entries(byImportance)
    .map(([importance, decs]) => ({
      importance,
      accuracy: Math.round(decs.reduce((sum, d) => sum + d.accuracy, 0) / decs.length),
      count: decs.length,
    }))
    .sort((a, b) => b.accuracy - a.accuracy);

  if (isLoading) {
    return <div className="text-muted-foreground">Loading outcome data...</div>;
  }

  if (!decisions || decisions.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Target className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">No completed decisions with outcomes yet.</p>
          <p className="text-sm text-muted-foreground mt-2">
            Start tracking outcomes to build your decision accuracy score!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overall Metrics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Overall Accuracy</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              {overallAccuracy}%
              <Award className="h-6 w-6 text-yellow-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={overallAccuracy} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2">
              Based on {decisionsWithAccuracy.length} completed decisions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Recent Trend (Last 5)</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              {recentAccuracy}%
              {trend > 0 ? (
                <TrendingUp className="h-6 w-6 text-green-500" />
              ) : trend < 0 ? (
                <TrendingDown className="h-6 w-6 text-red-500" />
              ) : (
                <Target className="h-6 w-6 text-blue-500" />
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={recentAccuracy} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {trend > 0 ? `+${trend}% improvement` : trend < 0 ? `${trend}% decline` : "No change"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Tracked</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              {decisionsWithAccuracy.length}
              <Calendar className="h-6 w-6 text-primary" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Decisions with recorded outcomes</p>
          </CardContent>
        </Card>
      </div>

      {/* Accuracy by Importance */}
      <Card>
        <CardHeader>
          <CardTitle>Accuracy by Importance Level</CardTitle>
          <CardDescription>
            How well you predict outcomes for different decision types
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {importanceAccuracy.map(({ importance, accuracy, count }) => (
            <div key={importance} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      importance === "critical"
                        ? "destructive"
                        : importance === "high"
                          ? "default"
                          : importance === "medium"
                            ? "secondary"
                            : "outline"
                    }
                  >
                    {importance}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {count} decision{count !== 1 ? "s" : ""}
                  </span>
                </div>
                <span className="text-sm font-medium">{accuracy}%</span>
              </div>
              <Progress value={accuracy} className="h-2" />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Recent Decisions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Outcome Comparisons</CardTitle>
          <CardDescription>Expected vs actual outcomes for your latest decisions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {decisionsWithAccuracy.slice(0, 5).map((decision) => (
            <div key={decision.id} className="space-y-2 pb-4 border-b last:border-0">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <h4 className="font-medium">{decision.title}</h4>
                  {decision.decision_date && (
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(decision.decision_date), "PP")}
                    </p>
                  )}
                </div>
                <Badge
                  variant={
                    decision.accuracy >= 80
                      ? "default"
                      : decision.accuracy >= 60
                        ? "secondary"
                        : "outline"
                  }
                >
                  {decision.accuracy}% match
                </Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="space-y-1">
                  <p className="font-medium text-xs text-muted-foreground">Expected:</p>
                  <p className="text-sm">{decision.expected_outcome}</p>
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-xs text-muted-foreground">Actual:</p>
                  <p className="text-sm">{decision.actual_outcome}</p>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
