import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

/**
 * Access source priority: add_on > track > org_sponsored > subscription > program_plan
 */
export type AccessSource = "subscription" | "program_plan" | "add_on" | "track" | "org_sponsored";

export interface FeatureEntitlement {
  enabled: boolean;
  limit: number | null;
  source: AccessSource;
  /** When true, this feature is explicitly denied (e.g., by org policy). Overrides all grants. */
  isDenied?: boolean;
}

export interface EntitlementsData {
  features: Record<string, FeatureEntitlement>;
  featuresByPrefix: Record<string, Set<string>>;
}

interface UseEntitlementsResult {
  isLoading: boolean;
  hasFeature: (featureKey: string) => boolean;
  getLimit: (featureKey: string) => number | null;
  getAccessSource: (featureKey: string) => AccessSource | null;
  getFeaturesByPrefix: (prefix: string) => Set<string>;
  getAllEnabledFeatures: () => string[];
  refetch: () => void;
}

/**
 * Unified entitlements hook that fetches all feature access once and caches it.
 * Consolidates logic from useFeatureAccess, useCombinedFeatureAccess,
 * useAssessmentFeatureAccess, and useDecisionFeatureAccess.
 *
 * Checks access from:
 * 1. Subscription plans (via profiles.plan_id)
 * 2. Program plans (via client_enrollments.program_plan_id)
 * 3. Add-ons (via user_add_ons)
 * 4. Tracks (via user_tracks + track_features)
 * 5. Org-sponsored plans (via organization_members.sponsored_plan_id)
 *
 * For overlapping features, takes the HIGHEST limit and prioritizes source:
 * add_on > track > org_sponsored > subscription > program_plan
 *
 * Hybrid model: effective tier = MAX(personal_plan, highest_org_sponsored_tier)
 */
export function useEntitlements(): UseEntitlementsResult {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["user-entitlements", user?.id],
    queryFn: async (): Promise<EntitlementsData> => {
      if (!user) {
        return { features: {}, featuresByPrefix: {} };
      }

      const entitlements: Record<string, FeatureEntitlement[]> = {};

      // Fetch all data in parallel for performance
      const [
        subscriptionFeatures,
        programPlanFeatures,
        addOnFeatures,
        trackFeatures,
        orgSponsoredFeatures,
      ] = await Promise.all([
        fetchSubscriptionFeatures(user.id),
        fetchProgramPlanFeatures(user.id),
        fetchAddOnFeatures(user.id),
        fetchTrackFeatures(user.id),
        fetchOrgSponsoredFeatures(user.id),
      ]);

      // Merge all features
      const mergeFeatures = (features: Record<string, FeatureEntitlement>) => {
        for (const [key, entitlement] of Object.entries(features)) {
          if (!entitlements[key]) {
            entitlements[key] = [];
          }
          entitlements[key].push(entitlement);
        }
      };

      mergeFeatures(subscriptionFeatures);
      mergeFeatures(programPlanFeatures);
      mergeFeatures(addOnFeatures);
      mergeFeatures(trackFeatures);
      mergeFeatures(orgSponsoredFeatures);

      // Resolve final entitlements (highest limit, prioritized source)
      // Deny entries (isDenied=true) override ALL grants for that feature.
      const finalFeatures: Record<string, FeatureEntitlement> = {};
      const featuresByPrefix: Record<string, Set<string>> = {};

      for (const [key, entitlementList] of Object.entries(entitlements)) {
        // Check for explicit deny — if ANY source denies, the feature is blocked
        const denied = entitlementList.find((e) => e.isDenied);
        if (denied) {
          finalFeatures[key] = {
            enabled: false,
            limit: 0,
            source: denied.source,
            isDenied: true,
          };
          continue;
        }

        const enabled = entitlementList.filter((e) => e.enabled);
        if (enabled.length === 0) continue;

        // Get max limit (null = unlimited)
        const limits = enabled.map((e) => e.limit);
        let maxLimit: number | null = null;
        if (limits.includes(null)) {
          maxLimit = null;
        } else {
          const numericLimits = limits.filter((l): l is number => l !== null);
          maxLimit = numericLimits.length > 0 ? Math.max(...numericLimits) : null;
        }

        // Determine source by priority
        const sourcePriority: AccessSource[] = [
          "add_on",
          "track",
          "org_sponsored",
          "subscription",
          "program_plan",
        ];
        let source: AccessSource = "program_plan";
        for (const s of sourcePriority) {
          if (enabled.some((e) => e.source === s)) {
            source = s;
            break;
          }
        }

        finalFeatures[key] = { enabled: true, limit: maxLimit, source };

        // Group by prefix for quick lookup
        const prefix = key.split("_")[0];
        if (!featuresByPrefix[prefix]) {
          featuresByPrefix[prefix] = new Set();
        }
        featuresByPrefix[prefix].add(key);
      }

      return { features: finalFeatures, featuresByPrefix };
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    gcTime: 10 * 60 * 1000,
  });

  const hasFeature = (featureKey: string): boolean => {
    return data?.features[featureKey]?.enabled ?? false;
  };

  const getLimit = (featureKey: string): number | null => {
    return data?.features[featureKey]?.limit ?? null;
  };

  const getAccessSource = (featureKey: string): AccessSource | null => {
    return data?.features[featureKey]?.source ?? null;
  };

  const getFeaturesByPrefix = (prefix: string): Set<string> => {
    return data?.featuresByPrefix[prefix] ?? new Set();
  };

  const getAllEnabledFeatures = (): string[] => {
    return Object.keys(data?.features ?? {});
  };

  const refetch = () => {
    queryClient.invalidateQueries({ queryKey: ["user-entitlements", user?.id] });
  };

  return {
    isLoading,
    hasFeature,
    getLimit,
    getAccessSource,
    getFeaturesByPrefix,
    getAllEnabledFeatures,
    refetch,
  };
}

// ============ Helper Functions ============

async function fetchSubscriptionFeatures(
  userId: string,
): Promise<Record<string, FeatureEntitlement>> {
  const features: Record<string, FeatureEntitlement> = {};

  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan_id")
      .eq("id", userId)
      .single();

    if (!profile?.plan_id) return features;

    const { data: planFeatures } = await supabase
      .from("plan_features")
      .select(
        `
        enabled,
        limit_value,
        features!inner (key)
      `,
      )
      .eq("plan_id", profile.plan_id)
      .eq("enabled", true);

    planFeatures?.forEach((pf: any) => {
      if (pf.features?.key) {
        features[pf.features.key] = {
          enabled: true,
          limit: pf.limit_value,
          source: "subscription",
        };
      }
    });
  } catch (error) {
    console.error("Error fetching subscription features:", error);
  }

  return features;
}

function getTierLevel(tier: string | null): number | null {
  if (!tier) return null;
  const tierMap: Record<string, number> = {
    essentials: 0,
    base: 0,
    premium: 1,
    professional: 1,
    enterprise: 2,
  };
  return tierMap[tier.toLowerCase()] ?? null;
}

async function fetchProgramPlanFeatures(
  userId: string,
): Promise<Record<string, FeatureEntitlement>> {
  const features: Record<string, FeatureEntitlement> = {};

  try {
    const { data: enrollments } = await supabase
      .from("client_enrollments")
      .select(
        `
        program_plan_id,
        tier,
        programs!inner(default_program_plan_id)
      `,
      )
      .eq("client_user_id", userId)
      .eq("status", "active");

    if (!enrollments || enrollments.length === 0) return features;

    const directPlanIds = new Set<string>();
    const tierLevelsToCheck = new Set<number>();

    for (const enrollment of enrollments) {
      if (enrollment.program_plan_id) {
        directPlanIds.add(enrollment.program_plan_id);
      } else {
        const tierLevel = getTierLevel((enrollment as any).tier);
        if (tierLevel !== null) {
          tierLevelsToCheck.add(tierLevel);
        } else {
          const defaultPlanId = (enrollment.programs as any)?.default_program_plan_id;
          if (defaultPlanId) {
            directPlanIds.add(defaultPlanId);
          }
        }
      }
    }

    let tierBasedPlanIds: string[] = [];
    if (tierLevelsToCheck.size > 0) {
      const { data: matchingPlans } = await supabase
        .from("program_plans")
        .select("id")
        .in("tier_level", Array.from(tierLevelsToCheck))
        .eq("is_active", true);

      if (matchingPlans) {
        tierBasedPlanIds = matchingPlans.map((p) => p.id);
      }
    }

    const allPlanIds = [...directPlanIds, ...tierBasedPlanIds];
    if (allPlanIds.length === 0) return features;

    const { data: planFeatures } = await supabase
      .from("program_plan_features")
      .select(
        `
        enabled,
        limit_value,
        features!inner (key)
      `,
      )
      .in("program_plan_id", allPlanIds)
      .eq("enabled", true);

    planFeatures?.forEach((pf: any) => {
      if (pf.features?.key) {
        const existing = features[pf.features.key];
        const newLimit = pf.limit_value;

        // Keep highest limit
        if (
          !existing ||
          newLimit === null ||
          (existing.limit !== null && newLimit > existing.limit)
        ) {
          features[pf.features.key] = {
            enabled: true,
            limit: newLimit,
            source: "program_plan",
          };
        }
      }
    });
  } catch (error) {
    console.error("Error fetching program plan features:", error);
  }

  return features;
}

async function fetchAddOnFeatures(userId: string): Promise<Record<string, FeatureEntitlement>> {
  const features: Record<string, FeatureEntitlement> = {};

  try {
    const { data: userAddOns } = await supabase
      .from("user_add_ons")
      .select("add_on_id, expires_at")
      .eq("user_id", userId);

    if (!userAddOns || userAddOns.length === 0) return features;

    const activeAddOnIds = userAddOns
      .filter((ua) => !ua.expires_at || new Date(ua.expires_at) > new Date())
      .map((ua) => ua.add_on_id);

    if (activeAddOnIds.length === 0) return features;

    const { data: addOnFeatures } = await supabase
      .from("add_on_features")
      .select(
        `
        features!inner (key)
      `,
      )
      .in("add_on_id", activeAddOnIds);

    addOnFeatures?.forEach((af: any) => {
      if (af.features?.key) {
        features[af.features.key] = {
          enabled: true,
          limit: null, // Add-ons typically unlimited
          source: "add_on",
        };
      }
    });
  } catch (error) {
    console.error("Error fetching add-on features:", error);
  }

  return features;
}

async function fetchTrackFeatures(userId: string): Promise<Record<string, FeatureEntitlement>> {
  const features: Record<string, FeatureEntitlement> = {};

  try {
    const { data: userTracks } = await supabase
      .from("user_tracks")
      .select(
        `
        track_id,
        is_active,
        tracks!inner (is_active)
      `,
      )
      .eq("user_id", userId)
      .eq("is_active", true);

    if (!userTracks || userTracks.length === 0) return features;

    const activeTrackIds = userTracks
      .filter((ut: any) => ut.tracks?.is_active)
      .map((ut) => ut.track_id);

    if (activeTrackIds.length === 0) return features;

    const { data: trackFeatures } = await supabase
      .from("track_features")
      .select(
        `
        is_enabled,
        limit_value,
        features!inner (key)
      `,
      )
      .in("track_id", activeTrackIds)
      .eq("is_enabled", true);

    trackFeatures?.forEach((tf: any) => {
      if (tf.features?.key) {
        const existing = features[tf.features.key];
        const newLimit = tf.limit_value;

        if (
          !existing ||
          newLimit === null ||
          (existing.limit !== null && newLimit > existing.limit)
        ) {
          features[tf.features.key] = {
            enabled: true,
            limit: newLimit,
            source: "track",
          };
        }
      }
    });
  } catch (error) {
    console.error("Error fetching track features:", error);
  }

  return features;
}

/**
 * Fetch features from org-sponsored plans (highest tier from all active org memberships)
 * Hybrid model: user gets features from their highest org-sponsored tier
 */
async function fetchOrgSponsoredFeatures(
  userId: string,
): Promise<Record<string, FeatureEntitlement>> {
  const features: Record<string, FeatureEntitlement> = {};

  try {
    // Get all active org memberships with sponsored plans
    const { data: memberships } = await supabase
      .from("organization_members")
      .select(
        `
        sponsored_plan_id,
        plans:sponsored_plan_id (
          id,
          tier_level
        )
      `,
      )
      .eq("user_id", userId)
      .eq("is_active", true)
      .not("sponsored_plan_id", "is", null);

    if (!memberships || memberships.length === 0) return features;

    // Find the highest tier sponsored plan
    let highestPlanId: string | null = null;
    let highestTierLevel = -1;

    for (const membership of memberships) {
      const plan = membership.plans as any;
      if (plan && plan.tier_level > highestTierLevel) {
        highestTierLevel = plan.tier_level;
        highestPlanId = plan.id;
      }
    }

    if (!highestPlanId) return features;

    // Fetch features for the highest tier plan
    // Include restrictive entries (is_restrictive=true) which explicitly deny features
    const { data: planFeatures } = await supabase
      .from("plan_features")
      .select(
        `
        enabled,
        limit_value,
        is_restrictive,
        features!inner (key)
      `,
      )
      .eq("plan_id", highestPlanId);

    planFeatures?.forEach((pf: any) => {
      if (pf.features?.key) {
        if (pf.is_restrictive) {
          // Explicit deny — overrides all other sources
          features[pf.features.key] = {
            enabled: false,
            limit: 0,
            source: "org_sponsored",
            isDenied: true,
          };
        } else if (pf.enabled) {
          features[pf.features.key] = {
            enabled: true,
            limit: pf.limit_value,
            source: "org_sponsored",
          };
        }
      }
    });
  } catch (error) {
    console.error("Error fetching org-sponsored features:", error);
  }

  return features;
}

// ============ Utility for non-hook contexts ============

export async function checkFeatureAccessAsync(
  userId: string,
  featureKey: string,
): Promise<{ hasAccess: boolean; limit: number | null; source: AccessSource | null }> {
  try {
    const [
      subscriptionFeatures,
      programPlanFeatures,
      addOnFeatures,
      trackFeatures,
      orgSponsoredFeatures,
    ] = await Promise.all([
      fetchSubscriptionFeatures(userId),
      fetchProgramPlanFeatures(userId),
      fetchAddOnFeatures(userId),
      fetchTrackFeatures(userId),
      fetchOrgSponsoredFeatures(userId),
    ]);

    // Check for explicit deny from any source
    const allSources = [
      subscriptionFeatures,
      programPlanFeatures,
      orgSponsoredFeatures,
      addOnFeatures,
      trackFeatures,
    ];
    for (const source of allSources) {
      if (source[featureKey]?.isDenied) {
        return { hasAccess: false, limit: 0, source: source[featureKey].source };
      }
    }

    const allFeatures = {
      ...programPlanFeatures,
      ...subscriptionFeatures,
      ...orgSponsoredFeatures,
      ...trackFeatures,
      ...addOnFeatures, // Add-on wins for source
    };

    const feature = allFeatures[featureKey];
    if (!feature?.enabled) {
      return { hasAccess: false, limit: null, source: null };
    }

    // Recalculate max limit
    const allEntitlements = [
      subscriptionFeatures[featureKey],
      programPlanFeatures[featureKey],
      orgSponsoredFeatures[featureKey],
      addOnFeatures[featureKey],
      trackFeatures[featureKey],
    ].filter(Boolean);

    const limits = allEntitlements.map((e) => e.limit);
    let maxLimit: number | null = null;
    if (limits.includes(null)) {
      maxLimit = null;
    } else {
      const numericLimits = limits.filter((l): l is number => l !== null);
      maxLimit = numericLimits.length > 0 ? Math.max(...numericLimits) : null;
    }

    return { hasAccess: true, limit: maxLimit, source: feature.source };
  } catch (error) {
    console.error("Error checking feature access:", error);
    return { hasAccess: false, limit: null, source: null };
  }
}
