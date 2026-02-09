import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Sparkles, Loader2, AlertCircle, Coins } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

interface AnalyticsData {
  total_events: number;
  unique_sessions: number;
  unique_users: number;
  events_by_category: Array<{ event_category: string; count: number }>;
  top_pages: Array<{ page_path: string; views: number; unique_sessions: number }>;
  feature_usage: Array<{ feature: string; usage_count: number; unique_sessions: number }>;
  events_by_day: Array<{ date: string; events: number; sessions: number; users: number }>;
  drop_off_analysis: Array<{ page: string; exit_count: number }>;
  error_summary: Array<{ error_message: string; occurrences: number }>;
}

interface AIInsightsPanelProps {
  analytics: AnalyticsData | null | undefined;
  isLoading: boolean;
}

type FocusArea = "comprehensive" | "engagement" | "drop-off" | "errors" | "growth";

export function AIInsightsPanel({ analytics, isLoading }: AIInsightsPanelProps) {
  const [focusArea, setFocusArea] = useState<FocusArea>("comprehensive");
  const [insights, setInsights] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateInsights = async () => {
    if (!analytics) {
      toast.error("No analytics data available");
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("analytics-ai-insights", {
        body: {
          analyticsData: analytics,
          focusArea,
        },
      });

      if (fnError) throw fnError;

      if (data.error) {
        setError(data.error);
        toast.error(data.error);
      } else {
        setInsights(data.insights);
        toast.success("AI insights generated successfully");
      }
    } catch (err) {
      console.error("Failed to generate insights:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to generate insights";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[400px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <CardTitle>AI-Powered Insights</CardTitle>
        </div>
        <CardDescription>
          Get intelligent analysis of your user behavior data. Each analysis uses AI credits.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Focus on:</span>
            <Select value={focusArea} onValueChange={(value) => setFocusArea(value as FocusArea)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="comprehensive">Comprehensive Overview</SelectItem>
                <SelectItem value="engagement">User Engagement</SelectItem>
                <SelectItem value="drop-off">Drop-off Analysis</SelectItem>
                <SelectItem value="errors">Error Patterns</SelectItem>
                <SelectItem value="growth">Growth Opportunities</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button 
            onClick={generateInsights} 
            disabled={isGenerating || !analytics}
            className="gap-2"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate Insights
              </>
            )}
          </Button>
        </div>

        {/* Cost Notice */}
        <Alert>
          <Coins className="h-4 w-4" />
          <AlertDescription>
            Each AI analysis uses credits from your workspace. Use on-demand to control costs.
          </AlertDescription>
        </Alert>

        {/* Error State */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Insights Display */}
        {insights ? (
          <div className="prose prose-sm dark:prose-invert max-w-none p-4 rounded-lg border bg-muted/30">
            <ReactMarkdown>{insights}</ReactMarkdown>
          </div>
        ) : !isGenerating && !error ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
            <Sparkles className="h-12 w-12 mb-4 text-muted-foreground/50" />
            <p className="font-medium text-foreground">No insights generated yet</p>
            <p className="text-sm mt-1 text-center max-w-md">
              Select a focus area and click "Generate Insights" to get AI-powered analysis of your user behavior data.
            </p>
          </div>
        ) : null}

        {/* Data Summary for context */}
        {analytics && (
          <div className="text-xs text-muted-foreground pt-4 border-t">
            <p>
              Analyzing: {analytics.total_events.toLocaleString()} events from{" "}
              {analytics.unique_users.toLocaleString()} users across{" "}
              {analytics.unique_sessions.toLocaleString()} sessions
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
