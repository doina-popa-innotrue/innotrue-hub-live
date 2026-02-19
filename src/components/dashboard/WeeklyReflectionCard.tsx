import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  ChevronRight,
  Loader2,
  RefreshCw,
  Check,
  PenLine,
  Clock,
  FileText,
  AlertCircle,
  Zap,
} from "lucide-react";
import { useReflectionPrompt } from "@/hooks/useReflectionPrompt";
import { useConsumableFeature } from "@/hooks/useConsumableFeature";
import { useIsMaxPlan } from "@/hooks/useIsMaxPlan";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useNavigate, Link } from "react-router-dom";
import { differenceInDays, format } from "date-fns";

export function WeeklyReflectionCard() {
  const { prompt, isLoading, isGenerating, error, generatePrompt, answerPrompt } =
    useReflectionPrompt();
  const {
    canConsume,
    consume,
    remaining,
    isConsuming,
    effectiveCost,
    isLoading: creditsLoading,
  } = useConsumableFeature("ai_insights");
  const { isMaxPlan } = useIsMaxPlan();
  const [isExpanded, setIsExpanded] = useState(false);
  const [reflectionContent, setReflectionContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [reflectionCount, setReflectionCount] = useState<number>(0);
  const { user } = useAuth();
  const navigate = useNavigate();

  // Fetch reflection count
  useEffect(() => {
    const fetchReflectionCount = async () => {
      if (!user) return;
      const { count } = await supabase
        .from("development_items")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("item_type", "reflection");
      setReflectionCount(count || 0);
    };
    fetchReflectionCount();
  }, [user]);

  const handleGeneratePrompt = async () => {
    // Consume a credit before generating
    const success = await consume();
    if (!success) return;

    await generatePrompt("weekly", true); // Force generate new prompt
  };

  const promptAge = prompt?.generated_at
    ? differenceInDays(new Date(), new Date(prompt.generated_at))
    : 0;

  const isPromptOld = promptAge > 7;

  const handleSubmitReflection = async () => {
    if (!user || !reflectionContent.trim() || !prompt) return;

    setIsSaving(true);
    try {
      // Create the development item
      const { data: newItem, error: insertError } = await supabase
        .from("development_items")
        .insert({
          user_id: user.id,
          item_type: "reflection",
          content: reflectionContent.trim(),
          prompt_id: prompt.id,
        })
        .select()
        .single();

      if (insertError) {
        console.error("Error saving reflection:", insertError);
        toast.error("Failed to save reflection");
        return;
      }

      // Mark prompt as answered
      await answerPrompt(newItem.id);

      toast.success("Reflection saved!");
      setReflectionContent("");
      setIsExpanded(false);
    } catch (err) {
      console.error("Error submitting reflection:", err);
      toast.error("Failed to save reflection");
    } finally {
      setIsSaving(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <Card className="border-dashed border-primary/30 bg-primary/5">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Loading your reflection prompt...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    const isCreditsError =
      error.toLowerCase().includes("credit") || error.toLowerCase().includes("usage limit");
    const isRateLimit =
      error.toLowerCase().includes("busy") || error.toLowerCase().includes("rate");

    return (
      <Card className="border-dashed border-destructive/30 bg-destructive/5">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1 space-y-2">
              <p className="text-sm text-destructive">{error}</p>
              <div className="flex gap-2">
                {isRateLimit && (
                  <Button variant="outline" size="sm" onClick={handleGeneratePrompt} disabled={isGenerating || isConsuming}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Retry
                  </Button>
                )}
                {isCreditsError && !isMaxPlan && (
                  <Button variant="outline" size="sm" onClick={() => navigate("/subscription")}>
                    <Zap className="h-4 w-4 mr-2" />
                    Upgrade Plan
                  </Button>
                )}
                {!isRateLimit && !isCreditsError && (
                  <Button variant="outline" size="sm" onClick={handleGeneratePrompt} disabled={isGenerating || isConsuming}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Retry
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Reflection count summary component
  const ReflectionSummary = () => (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <FileText className="h-4 w-4" />
      <span>
        {reflectionCount} self reflection{reflectionCount !== 1 ? "s" : ""} added
      </span>
      <Link
        to="/development-items?type=reflection"
        className="text-primary hover:underline font-medium"
      >
        View all
      </Link>
    </div>
  );

  // No prompt yet - offer to generate one
  if (!prompt) {
    const generateDisabled = isGenerating || isConsuming || !canConsume;

    return (
      <Card className="border-dashed border-secondary/30 dark:border-secondary/20 bg-gradient-to-br from-secondary/5 to-secondary/10 dark:from-secondary/10 dark:to-secondary/15 hover:border-secondary/50 transition-colors">
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-secondary/15 dark:bg-secondary/25 shrink-0">
                <Sparkles className="h-5 w-5 text-secondary" />
              </div>
              <div className="min-w-0">
                <p className="font-medium">This Week's Reflection</p>
                <p className="text-sm text-muted-foreground">
                  Get a personalized prompt based on your recent activity
                </p>
                {!canConsume && !creditsLoading && (
                  <p className="text-xs text-destructive mt-1">
                    {isMaxPlan
                      ? "No credits remaining. Contact your administrator."
                      : "No credits remaining."}
                    {!isMaxPlan && (
                      <Link to="/subscription" className="ml-1 underline font-medium">
                        Upgrade
                      </Link>
                    )}
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <Button
                onClick={handleGeneratePrompt}
                disabled={generateDisabled}
                className="gap-2 w-full sm:w-auto bg-secondary hover:bg-secondary/90 text-secondary-foreground"
              >
                {isGenerating || isConsuming ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Generate Prompt
                  </>
                )}
              </Button>
              {remaining !== null && canConsume && (
                <span className="text-xs text-muted-foreground">
                  {remaining} credit{remaining !== 1 ? "s" : ""} remaining
                </span>
              )}
            </div>
          </div>
          <ReflectionSummary />
        </CardContent>
      </Card>
    );
  }

  // Show the prompt (whether pending or answered)
  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">This Week's Reflection</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {prompt.status === "answered" && (
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                <Check className="h-3 w-3 mr-1" />
                Answered
              </Badge>
            )}
            {isPromptOld && (
              <Badge
                variant="outline"
                className="bg-amber-500/10 text-amber-600 border-amber-500/30"
              >
                <Clock className="h-3 w-3 mr-1" />
                {promptAge} days old
              </Badge>
            )}
          </div>
        </div>
        <CardDescription className="text-base font-medium text-foreground mt-2">
          {prompt.prompt_text}
        </CardDescription>
        {prompt.generated_at && (
          <p className="text-xs text-muted-foreground mt-1">
            Generated on {format(new Date(prompt.generated_at), "MMM d, yyyy")}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {!isExpanded ? (
          <div className="flex flex-col sm:flex-row gap-2">
            <Button onClick={() => setIsExpanded(true)} className="flex-1 gap-2" variant="default">
              <PenLine className="h-4 w-4" />
              Add Self Reflection
            </Button>
            <Button
              onClick={handleGeneratePrompt}
              disabled={isGenerating || isConsuming || !canConsume}
              variant="outline"
              className="flex-1 gap-2"
            >
              {isGenerating || isConsuming ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Generate New Prompt
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Textarea
              placeholder="Take a moment to reflect..."
              value={reflectionContent}
              onChange={(e) => setReflectionContent(e.target.value)}
              rows={4}
              className="resize-none"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setIsExpanded(false);
                  setReflectionContent("");
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmitReflection}
                disabled={!reflectionContent.trim() || isSaving}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  "Save Reflection"
                )}
              </Button>
            </div>
          </div>
        )}
        <ReflectionSummary />
      </CardContent>
    </Card>
  );
}
