import { ReactNode } from "react";
import { useDecisionFeatureAccess } from "@/hooks/useDecisionFeatureAccess";
import { DecisionCapability, getFeatureKeyForCapability } from "@/lib/decisionFeatureConfig";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Lock, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

interface CapabilityGateProps {
  capability: DecisionCapability;
  children: ReactNode;
  fallback?: ReactNode;
  showUpgrade?: boolean;
  hideWhenLocked?: boolean;
}

/**
 * Gates content based on decision toolkit capabilities.
 * Uses the centralized config to determine which feature key is required.
 */
export function CapabilityGate({
  capability,
  children,
  fallback,
  showUpgrade = true,
  hideWhenLocked = false,
}: CapabilityGateProps) {
  const { hasCapability, isLoading } = useDecisionFeatureAccess();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!hasCapability(capability)) {
    if (hideWhenLocked) {
      return null;
    }

    if (fallback) {
      return <>{fallback}</>;
    }

    const featureKey = getFeatureKeyForCapability(capability);
    const tierName = featureKey === "decision_toolkit_advanced" ? "Advanced" : "Basic";

    return (
      <Alert>
        <Lock className="h-4 w-4" />
        <AlertTitle>{tierName} Feature</AlertTitle>
        <AlertDescription className="mt-2 space-y-4">
          <p>This feature requires the {tierName} Decision Toolkit.</p>
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
