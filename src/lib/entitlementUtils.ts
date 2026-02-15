/**
 * Pure utilities for merging feature entitlements from multiple sources.
 * Mirrors the merge logic in useEntitlements (subscription, program_plan, add_on, track, org_sponsored).
 */

export type AccessSource =
  | "subscription"
  | "program_plan"
  | "add_on"
  | "track"
  | "org_sponsored";

export interface FeatureEntitlement {
  enabled: boolean;
  limit: number | null;
  source: AccessSource;
}

export interface MergedEntitlements {
  features: Record<string, FeatureEntitlement>;
  featuresByPrefix: Record<string, Set<string>>;
}

const SOURCE_PRIORITY: AccessSource[] = [
  "add_on",
  "track",
  "org_sponsored",
  "subscription",
  "program_plan",
];

/**
 * Merge per-key entitlement lists into a single record.
 * - Only features with at least one enabled entitlement are included.
 * - Limit = max of all enabled limits; null (unlimited) wins.
 * - Source = highest priority source that has the feature enabled.
 */
export function mergeFeatureEntitlements(
  entitlementsByKey: Record<string, FeatureEntitlement[]>,
): MergedEntitlements {
  const finalFeatures: Record<string, FeatureEntitlement> = {};
  const featuresByPrefix: Record<string, Set<string>> = {};

  for (const [key, entitlementList] of Object.entries(entitlementsByKey)) {
    const enabled = entitlementList.filter((e) => e.enabled);
    if (enabled.length === 0) continue;

    const limits = enabled.map((e) => e.limit);
    let maxLimit: number | null = null;
    if (limits.includes(null)) {
      maxLimit = null;
    } else {
      const numericLimits = limits.filter((l): l is number => l !== null);
      maxLimit = numericLimits.length > 0 ? Math.max(...numericLimits) : null;
    }

    let source: AccessSource = "program_plan";
    for (const s of SOURCE_PRIORITY) {
      if (enabled.some((e) => e.source === s)) {
        source = s;
        break;
      }
    }

    finalFeatures[key] = { enabled: true, limit: maxLimit, source };

    const prefix = key.split("_")[0];
    if (!featuresByPrefix[prefix]) {
      featuresByPrefix[prefix] = new Set();
    }
    featuresByPrefix[prefix].add(key);
  }

  return { features: finalFeatures, featuresByPrefix };
}

/**
 * Check if a feature is enabled in merged entitlements.
 * Missing features are not accessible (not in map => false).
 */
export function hasFeature(
  merged: MergedEntitlements,
  featureKey: string,
): boolean {
  return merged.features[featureKey]?.enabled ?? false;
}

/**
 * Get limit for a feature; null means unlimited.
 */
export function getLimit(
  merged: MergedEntitlements,
  featureKey: string,
): number | null {
  return merged.features[featureKey]?.limit ?? null;
}

/**
 * Get access source for a feature.
 */
export function getAccessSource(
  merged: MergedEntitlements,
  featureKey: string,
): AccessSource | null {
  return merged.features[featureKey]?.source ?? null;
}
