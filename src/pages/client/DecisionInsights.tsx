import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Lightbulb, RefreshCw, ChevronRight } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useNavigate } from "react-router-dom";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { AIConsentGate } from "@/components/ai/AIConsentGate";
import { AIPrivacyNotice } from "@/components/ai/AIPrivacyNotice";
import { FeatureGate } from "@/components/FeatureGate";
import { useConsumableFeature } from "@/hooks/useConsumableFeature";
import { Badge } from "@/components/ui/badge";

export default function DecisionInsights() {
  const navigate = useNavigate();
  const [refreshKey, setRefreshKey] = useState(0);
  const [hasTriggered, setHasTriggered] = useState(false);

  const {
    canConsume,
    consume,
    remaining,
    isConsuming,
    isLoading: consumableLoading,
  } = useConsumableFeature("ai_insights");

  const { data, isLoading, error } = useQuery({
    queryKey: ["decision-insights", refreshKey],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("decision-insights");
      if (error) throw error;
      return data;
    },
    enabled: hasTriggered,
  });

  const handleGenerate = async () => {
    const success = await consume();
    if (!success) return;

    if (hasTriggered) {
      setRefreshKey((prev) => prev + 1);
    } else {
      setHasTriggered(true);
    }
  };

  return (
    <FeatureGate featureKey="ai_insights">
      <div className="space-y-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink onClick={() => navigate("/decisions")} className="cursor-pointer">
                Decisions
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator>
              <ChevronRight className="h-4 w-4" />
            </BreadcrumbSeparator>
            <BreadcrumbItem>
              <BreadcrumbPage>AI Insights</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <AIConsentGate
          feature="insights"
          title="Enable AI Decision Insights"
          description="Get personalized analysis of your decision-making patterns and actionable recommendations to improve your choices."
        >
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">AI Decision Insights</h1>
                <p className="text-muted-foreground">
                  Personalized analysis of your decision-making patterns
                </p>
              </div>
              <div className="flex items-center gap-3">
                {remaining !== null && (
                  <Badge variant="outline" className="text-sm">
                    {remaining} credit{remaining !== 1 ? "s" : ""} remaining
                  </Badge>
                )}
                <Button onClick={handleGenerate} disabled={isLoading || isConsuming || !canConsume}>
                  <RefreshCw
                    className={`h-4 w-4 mr-2 ${isLoading || isConsuming ? "animate-spin" : ""}`}
                  />
                  {data ? "Refresh Insights" : "Generate Insights"}
                </Button>
              </div>
            </div>

            <AIPrivacyNotice />

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-yellow-500" />
                  <CardTitle>Your Decision-Making Analysis</CardTitle>
                </div>
                <CardDescription>
                  AI-powered insights based on your decision history
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading && (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-center space-y-4">
                      <RefreshCw className="h-8 w-8 animate-spin mx-auto text-primary" />
                      <p className="text-muted-foreground">Analyzing your decisions...</p>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="text-center py-12 text-destructive">
                    <p>Failed to generate insights. Please try again.</p>
                  </div>
                )}

                {!data && !isLoading && !error && (
                  <div className="text-center py-12 text-muted-foreground">
                    <Lightbulb className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Click "Generate Insights" to analyze your decision-making patterns.</p>
                  </div>
                )}

                {data && !isLoading && (
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <ReactMarkdown>{data.insights}</ReactMarkdown>
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
