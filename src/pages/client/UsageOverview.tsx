import { UsageDashboard } from "@/components/usage/UsageDashboard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Zap, TrendingUp } from "lucide-react";
import { FeatureGate } from "@/components/FeatureGate";

export default function UsageOverview() {
  const navigate = useNavigate();

  return (
    <FeatureGate featureKey="usage">
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Usage Overview</h1>
          <p className="text-muted-foreground">
            Track your AI credits and feature consumption
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate("/subscription")}>
          <Zap className="h-4 w-4 mr-2" />
          Manage Plan
        </Button>
      </div>

      <UsageDashboard />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            About AI Credits
          </CardTitle>
          <CardDescription>
            How your AI credits work
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            AI credits are consumed each time you use AI-powered features like Decision Insights 
            or Course Recommendations. Your credits reset at the beginning of each month.
          </p>
          <p>
            <strong>Tips to maximize your credits:</strong>
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>Review previous insights before generating new ones</li>
            <li>Make sure you have enough data for meaningful analysis</li>
            <li>Upgrade your plan for more monthly credits</li>
          </ul>
        </CardContent>
      </Card>
    </div>
    </FeatureGate>
  );
}
