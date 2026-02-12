import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, BookOpen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import { AIConsentGate } from "@/components/ai/AIConsentGate";
import { AIPrivacyNotice } from "@/components/ai/AIPrivacyNotice";
import { FeatureGate } from "@/components/FeatureGate";
import { useConsumableFeature } from "@/hooks/useConsumableFeature";
import { Badge } from "@/components/ui/badge";

export default function CourseRecommendations() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<string>("");

  const { canConsume, consume, remaining, isConsuming } =
    useConsumableFeature("ai_recommendations");

  const generateRecommendations = async () => {
    if (!user) return;

    const success = await consume();
    if (!success) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("course-recommendations", {
        body: {},
      });

      if (error) {
        if (error.message?.includes("429")) {
          toast({
            title: "Rate limit exceeded",
            description: "Please try again in a few moments.",
            variant: "destructive",
          });
        } else if (error.message?.includes("402")) {
          toast({
            title: "Payment required",
            description: "AI service is temporarily unavailable. Please try again later.",
            variant: "destructive",
          });
        } else {
          throw error;
        }
        return;
      }

      setRecommendations(data.recommendations);
    } catch (error) {
      console.error("Error generating recommendations:", error);
      toast({
        title: "Failed to generate recommendations",
        description: "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <FeatureGate featureKey="ai_recommendations">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Course Recommendations</h1>
            <p className="text-muted-foreground">
              Get personalized AI-powered recommendations based on your learning history
            </p>
          </div>
          {remaining !== null && (
            <Badge variant="outline" className="text-sm">
              {remaining} credit{remaining !== 1 ? "s" : ""} remaining
            </Badge>
          )}
        </div>

        <AIConsentGate
          feature="recommendations"
          title="Enable AI Course Recommendations"
          description="Receive personalized learning path suggestions based on your completed programs, skills, and interests."
        >
          <div className="space-y-6">
            <AIPrivacyNotice />

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  AI-Powered Recommendations
                </CardTitle>
                <CardDescription>
                  Our AI analyzes your completed programs, acquired skills, and interests to suggest
                  relevant next steps in your learning journey.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!recommendations && (
                  <div className="text-center py-12">
                    <BookOpen className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground mb-4">
                      Click the button below to generate personalized course recommendations
                    </p>
                    <Button
                      onClick={generateRecommendations}
                      disabled={loading || isConsuming || !canConsume}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Generating Recommendations...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-2" />
                          Generate Recommendations
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {recommendations && (
                  <div className="space-y-4">
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      <ReactMarkdown>{recommendations}</ReactMarkdown>
                    </div>
                    <Button
                      onClick={generateRecommendations}
                      disabled={loading || isConsuming || !canConsume}
                      variant="outline"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Regenerating...
                        </>
                      ) : (
                        "Regenerate Recommendations"
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </AIConsentGate>
      </div>
    </FeatureGate>
  );
}
