import { usePlanAccess } from "./usePlanAccess";
import { isMaxPlanTier } from "@/lib/planUtils";

interface MaxPlanState {
  /** True if user's effective plan tier >= highest purchasable plan tier */
  isMaxPlan: boolean;
  /** True while plan data is loading */
  isLoading: boolean;
  /** Name of the user's current plan, or null */
  planName: string | null;
}

/**
 * Detects if the user is on the highest available purchasable subscription plan.
 * Used to adjust messaging in FeatureGate/CapabilityGate — show "Contact administrator"
 * instead of "Upgrade Plan" when there's nothing to upgrade to.
 */
export function useIsMaxPlan(): MaxPlanState {
  const { userPlan, plans, isLoading } = usePlanAccess();

  if (isLoading) {
    return { isMaxPlan: false, isLoading: true, planName: null };
  }

  if (!userPlan) {
    return { isMaxPlan: false, isLoading: false, planName: null };
  }

  return {
    isMaxPlan: isMaxPlanTier(userPlan.tier_level, plans),
    isLoading: false,
    planName: userPlan.name,
  };
}
