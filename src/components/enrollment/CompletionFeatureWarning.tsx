import { Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useFeatureLossPreview } from "@/hooks/useFeatureLossPreview";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface CompletionFeatureWarningProps {
  /** How far through the program (0-100) */
  progressPercent: number;
  /** Only show when progress exceeds this threshold */
  showAfterPercent?: number;
  className?: string;
}

/** Fetch alumni grace period from system_settings */
function useGracePeriodDays() {
  return useQuery({
    queryKey: ["system-setting", "alumni_grace_period_days"],
    queryFn: async () => {
      const { data } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "alumni_grace_period_days")
        .single();
      return data?.value ? parseInt(data.value, 10) : 90;
    },
    staleTime: 300000,
  });
}

/**
 * Pre-completion warning shown on enrollment progress pages
 * when the user is near program completion (e.g., >80% modules done).
 *
 * Tells the user what features they'll keep during the grace period
 * and which ones they may lose if not covered by their subscription.
 */
export function CompletionFeatureWarning({
  progressPercent,
  showAfterPercent = 80,
  className,
}: CompletionFeatureWarningProps) {
  const { featuresToLose, featuresRetained, isLoading } =
    useFeatureLossPreview("program_plan");
  const { data: gracePeriodDays } = useGracePeriodDays();

  // Don't show until progress threshold is met
  if (progressPercent < showAfterPercent) return null;
  if (isLoading) return null;
  // Only show if there are features that would be lost
  if (featuresToLose.length === 0) return null;

  const graceDays = gracePeriodDays ?? 90;

  return (
    <Alert variant="default" className={`border-blue-500/50 bg-blue-50 dark:bg-blue-950/20 ${className ?? ""}`}>
      <Info className="h-4 w-4 text-blue-600" />
      <AlertTitle className="text-blue-800 dark:text-blue-400">
        Approaching Program Completion
      </AlertTitle>
      <AlertDescription className="space-y-2 text-blue-700 dark:text-blue-300 text-sm">
        <p>
          When you complete this program, you'll transition to alumni access
          with read-only access for {graceDays} days.
        </p>

        {featuresRetained.length > 0 && (
          <div>
            <span className="font-medium">Features you'll keep (via your plan):</span>{" "}
            {featuresRetained
              .slice(0, 5)
              .map((f) => f.replace(/_/g, " "))
              .join(", ")}
            {featuresRetained.length > 5 && ` +${featuresRetained.length - 5} more`}
          </div>
        )}

        <div>
          <span className="font-medium">Features you may lose without a plan:</span>{" "}
          {featuresToLose
            .slice(0, 5)
            .map((f) => f.replace(/_/g, " "))
            .join(", ")}
          {featuresToLose.length > 5 && ` +${featuresToLose.length - 5} more`}
        </div>
      </AlertDescription>
    </Alert>
  );
}
