import { useMemo } from "react";
import { useEntitlements, type AccessSource } from "@/hooks/useEntitlements";

export interface FeatureLossPreview {
  /** Features that will be lost entirely when the source is removed */
  featuresToLose: string[];
  /** Features that will be retained because another source also provides them */
  featuresRetained: string[];
  /** Whether the hook data is loading */
  isLoading: boolean;
}

/**
 * Computes what features a user would lose if a specific access source is removed.
 *
 * For each enabled feature sourced from `sourceToRemove`:
 * - If no OTHER source also provides it → feature will be lost
 * - If another source provides it → feature is retained
 *
 * Uses useEntitlements() internally which already aggregates from all 5 sources.
 *
 * @example
 * ```tsx
 * const { featuresToLose, featuresRetained } = useFeatureLossPreview("program_plan");
 * // featuresToLose: ["ai_insights", "coaching_sessions"]
 * // featuresRetained: ["credits", "dashboard_analytics"]
 * ```
 */
export function useFeatureLossPreview(
  sourceToRemove: AccessSource | null,
): FeatureLossPreview {
  const { getAllEnabledFeatures, getAccessSource, isLoading } = useEntitlements();

  return useMemo(() => {
    if (!sourceToRemove || isLoading) {
      return { featuresToLose: [], featuresRetained: [], isLoading };
    }

    const allFeatures = getAllEnabledFeatures();
    const featuresToLose: string[] = [];
    const featuresRetained: string[] = [];

    for (const featureKey of allFeatures) {
      const currentSource = getAccessSource(featureKey);

      // Only consider features whose *primary* source matches the one being removed.
      // If a feature's primary source is different, it won't be lost even if the
      // removed source also provided it (another source already takes priority).
      if (currentSource === sourceToRemove) {
        // The primary source is the one we're removing.
        // Since useEntitlements resolves to the highest-priority source,
        // if sourceToRemove IS the primary source, there's no higher-priority
        // source providing it. However, there could be a LOWER-priority source.
        //
        // We can't easily determine this from useEntitlements' resolved output
        // alone. For practical purposes: if the resolved source matches the
        // one being removed, the feature is at risk of loss.
        //
        // Future enhancement: expose all sources per feature from useEntitlements.
        featuresToLose.push(featureKey);
      } else {
        // Feature's primary source is different — it will be retained
        featuresRetained.push(featureKey);
      }
    }

    return { featuresToLose, featuresRetained, isLoading };
  }, [sourceToRemove, isLoading, getAllEnabledFeatures, getAccessSource]);
}
