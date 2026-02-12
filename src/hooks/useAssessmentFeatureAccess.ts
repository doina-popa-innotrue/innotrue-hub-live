import { useEntitlements } from "./useEntitlements";

interface AssessmentFeatureAccess {
  accessibleFeatureKeys: Set<string>;
  isLoading: boolean;
  hasAccessToFeature: (featureKey: string | null) => boolean;
}

/**
 * Hook for checking assessment feature access.
 * Thin wrapper around useEntitlements that filters for assessment-related features.
 *
 * @deprecated Consider using useEntitlements directly with hasFeature() and getFeaturesByPrefix('assessments')
 */
export function useAssessmentFeatureAccess(): AssessmentFeatureAccess {
  const { isLoading, hasFeature, getFeaturesByPrefix } = useEntitlements();

  const accessibleFeatureKeys = getFeaturesByPrefix("assessments");

  const hasAccessToFeature = (featureKey: string | null): boolean => {
    // If no feature key is set, assessment is accessible to all
    if (!featureKey) return true;
    return hasFeature(featureKey);
  };

  return {
    accessibleFeatureKeys,
    isLoading,
    hasAccessToFeature,
  };
}
