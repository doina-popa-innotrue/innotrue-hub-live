import { AlertTriangle, Coins, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useCreditBatches } from "@/hooks/useCreditBatches";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface LowBalanceAlertProps {
  /** Override threshold (if not provided, uses system setting) */
  threshold?: number;
  /** Whether to show the top-up button */
  showTopUp?: boolean;
  /** Custom class name */
  className?: string;
  /** Variant: inline (small) or banner (prominent) */
  variant?: "inline" | "banner";
}

/** Hook to fetch the system-configured low balance threshold */
function useLowBalanceThreshold() {
  return useQuery({
    queryKey: ["system-setting", "low_balance_threshold"],
    queryFn: async () => {
      const { data } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "low_balance_threshold")
        .single();
      return data?.value ? parseInt(data.value, 10) : 10;
    },
    staleTime: 300000, // 5 minutes
  });
}

export function LowBalanceAlert({
  threshold: thresholdProp,
  showTopUp = true,
  className,
  variant = "banner",
}: LowBalanceAlertProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { summary, isLoading } = useCreditBatches();
  const { data: systemThreshold } = useLowBalanceThreshold();

  // Use prop if provided, otherwise use system setting
  const threshold = thresholdProp ?? systemThreshold ?? 10;

  if (!user || isLoading) return null;

  const balance = summary?.total_available ?? 0;
  const isLow = balance < threshold && balance > 0;
  const isEmpty = balance === 0;

  if (!isLow && !isEmpty) return null;

  if (variant === "inline") {
    return (
      <div
        className={`flex items-center gap-2 text-sm ${isEmpty ? "text-destructive" : "text-amber-600 dark:text-amber-500"} ${className}`}
      >
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>{isEmpty ? "No credits remaining" : `Low balance: ${balance} credits`}</span>
        {showTopUp && (
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0 text-primary"
            onClick={() => navigate("/credits")}
          >
            Top up
          </Button>
        )}
      </div>
    );
  }

  return (
    <Alert
      variant={isEmpty ? "destructive" : "default"}
      className={`${isEmpty ? "" : "border-amber-500/50 bg-amber-50 dark:bg-amber-950/20"} ${className}`}
    >
      <AlertTriangle className={`h-4 w-4 ${isEmpty ? "" : "text-amber-600"}`} />
      <AlertTitle className={isEmpty ? "" : "text-amber-800 dark:text-amber-400"}>
        {isEmpty ? "No Credits Remaining" : "Low Credit Balance"}
      </AlertTitle>
      <AlertDescription
        className={`flex items-center justify-between gap-4 ${isEmpty ? "" : "text-amber-700 dark:text-amber-300"}`}
      >
        <span>
          {isEmpty
            ? "You've used all your credits. Top up to continue using premium features."
            : `You have ${balance} credits remaining. Consider topping up to avoid interruptions.`}
        </span>
        {showTopUp && (
          <Button
            variant={isEmpty ? "default" : "outline"}
            size="sm"
            onClick={() => navigate("/credits")}
            className={
              isEmpty
                ? ""
                : "border-amber-600 text-amber-700 hover:bg-amber-100 dark:border-amber-500 dark:text-amber-400 dark:hover:bg-amber-950"
            }
          >
            <Coins className="h-4 w-4 mr-1" />
            Top Up
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

/**
 * Hook to check if user has low balance.
 * Uses system setting for threshold if not provided.
 */
export function useLowBalance(thresholdOverride?: number) {
  const { user } = useAuth();
  const { summary, isLoading: creditsLoading } = useCreditBatches();
  const { data: systemThreshold, isLoading: thresholdLoading } = useLowBalanceThreshold();

  const threshold = thresholdOverride ?? systemThreshold ?? 10;
  const balance = summary?.total_available ?? 0;
  const isLow = balance < threshold && balance > 0;
  const isEmpty = balance === 0;
  const isLoading = creditsLoading || thresholdLoading;

  return {
    balance,
    threshold,
    isLow,
    isEmpty,
    isLoading,
    isAuthenticated: !!user,
    needsAttention: isLow || isEmpty,
  };
}
