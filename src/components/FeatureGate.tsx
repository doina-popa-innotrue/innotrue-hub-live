import { ReactNode } from "react";
import { useCombinedFeatureAccess } from "@/hooks/useCombinedFeatureAccess";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Lock, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

interface FeatureGateProps {
  featureKey: string;
  children: ReactNode;
  fallback?: ReactNode;
  showUpgrade?: boolean;
}

export function FeatureGate({
  featureKey,
  children,
  fallback,
  showUpgrade = true,
}: FeatureGateProps) {
  const { hasAccess, isLoading, remainingUsage } = useCombinedFeatureAccess(featureKey);
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!hasAccess || (remainingUsage !== null && remainingUsage <= 0)) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <Alert>
        <Lock className="h-4 w-4" />
        <AlertTitle>Premium Feature</AlertTitle>
        <AlertDescription className="mt-2 space-y-4">
          <p>
            {remainingUsage !== null && remainingUsage <= 0
              ? "You have reached your usage limit for this feature this month."
              : "This feature is not available on your current plan."}
          </p>
          {showUpgrade && (
            <Button onClick={() => navigate("/subscription")} size="sm">
              <Zap className="mr-2 h-4 w-4" />
              Upgrade Plan
            </Button>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  return <>{children}</>;
}
