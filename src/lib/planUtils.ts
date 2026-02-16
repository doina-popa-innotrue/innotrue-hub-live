/**
 * Pure utilities for plan filtering (is_purchasable), tier level comparisons, and fallback plan resolution.
 */

export interface PlanLike {
  id: string;
  is_purchasable?: boolean;
  tier_level: number;
  fallback_plan_id?: string | null;
}

/**
 * Whether a plan is purchasable (default true when not set).
 */
export function isPlanPurchasable(plan: { is_purchasable?: boolean }): boolean {
  return plan.is_purchasable !== false;
}

/**
 * Filter plans to those that are purchasable.
 */
export function filterPurchasablePlans<T extends { is_purchasable?: boolean }>(
  plans: T[],
): T[] {
  return plans.filter((p) => isPlanPurchasable(p));
}

/**
 * Check if user's tier level meets or exceeds the required tier level.
 */
export function hasTierLevelAccess(
  userTierLevel: number,
  requiredTierLevel: number,
): boolean {
  return userTierLevel >= requiredTierLevel;
}

/**
 * Resolve fallback plan: given a plan and a map of id -> plan, return the fallback plan if set and present.
 */
export function resolveFallbackPlan<T extends PlanLike>(
  plan: T,
  plansById: Map<string, T> | Record<string, T>,
): T | null {
  const id = plan.fallback_plan_id ?? null;
  if (!id) return null;
  const map = plansById instanceof Map ? plansById : new Map(Object.entries(plansById));
  return map.get(id) ?? null;
}

/**
 * Get the effective tier level from a plan (for comparison).
 */
export function getPlanTierLevel(plan: { tier_level: number }): number {
  return plan.tier_level;
}

/**
 * Check if a user's tier level is at or above the highest purchasable plan tier.
 * Returns true when the user is on the max plan (no upgrade possible).
 * Returns true if no purchasable plans exist (safe default — nothing to upgrade to).
 */
export function isMaxPlanTier(
  userTier: number | null,
  plans: { tier_level: number; is_purchasable?: boolean }[],
): boolean {
  if (userTier === null) return false;
  const purchasable = filterPurchasablePlans(plans);
  if (purchasable.length === 0) return true;
  const maxTier = Math.max(...purchasable.map((p) => p.tier_level));
  return userTier >= maxTier;
}
