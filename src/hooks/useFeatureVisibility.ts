import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useEntitlements } from "./useEntitlements";
import { supabase } from "@/integrations/supabase/client";

export type FeatureVisibility = "hidden" | "locked" | "accessible";
export type AccessSourceType = "plan" | "track" | "add_on" | "program_plan" | null;

export interface FeatureVisibilityResult {
  visibility: FeatureVisibility;
  isLoading: boolean;
  /** Name of the lowest plan/track/add-on that grants access (for upsell messaging) */
  requiredPlan: string | null;
  /** Type of source that grants access */
  sourceType: AccessSourceType;
  /** Display name for the source type (e.g., "learning track", "add-on") - from database */
  sourceDisplayName: string | null;
  /** Reason why the feature is hidden (for admin debugging) */
  hiddenReason: "inactive" | "not_monetized" | null;
}

interface MonetizedFeature {
  featureKey: string;
  isActive: boolean;
  lowestPlanName: string | null;
  sourceType: AccessSourceType;
  sourceDisplayName: string | null;
}

interface FeatureRow {
  id: string;
  key: string;
  is_active: boolean;
}

/**
 * Hook to determine feature visibility with multi-tier logic:
 * 1. If feature.is_active = false → hidden (except for admins)
 * 2. If feature is active but not on ANY plan/track/add-on/program_plan → hidden (except for admins)
 * 3. If feature is monetized but user lacks entitlement → locked (show with upsell)
 * 4. If user has entitlement → accessible
 */
export function useFeatureVisibility(
  featureKey: string | null | undefined,
): FeatureVisibilityResult {
  const { userRoles } = useAuth();
  const { hasFeature, isLoading: entitlementsLoading } = useEntitlements();
  const isAdmin = userRoles.includes("admin");

  // Fetch feature metadata and monetization status
  const { data: featureData, isLoading: featureLoading } = useQuery({
    queryKey: ["feature-visibility", featureKey],
    queryFn: async (): Promise<MonetizedFeature | null> => {
      if (!featureKey) return null;

      // Get feature details including is_active
      const { data: feature, error: featureError } = await supabase
        .from("features")
        .select("id, key, is_active")
        .eq("key", featureKey)
        .maybeSingle();

      if (featureError || !feature) {
        return null;
      }

      const typedFeature = feature as unknown as FeatureRow;

      // Check if feature is monetized (assigned to any plan, track, add-on, or program_plan)
      const [planCheck, trackCheck, addOnCheck, programPlanCheck] = await Promise.all([
        supabase
          .from("plan_features")
          .select("plans!inner(name, tier_level, display_name)")
          .eq("feature_id", typedFeature.id)
          .eq("enabled", true)
          .order("plans(tier_level)", { ascending: true })
          .limit(1),
        supabase
          .from("track_features")
          .select("tracks!inner(name, display_name)")
          .eq("feature_id", typedFeature.id)
          .eq("is_enabled", true)
          .limit(1),
        supabase
          .from("add_on_features")
          .select("add_ons!inner(name, display_name)")
          .eq("feature_id", typedFeature.id)
          .limit(1),
        supabase
          .from("program_plan_features")
          .select("program_plans!inner(name, display_name)")
          .eq("feature_id", typedFeature.id)
          .eq("enabled", true)
          .limit(1),
      ]);

      const hasAnyMonetization =
        (planCheck.data && planCheck.data.length > 0) ||
        (trackCheck.data && trackCheck.data.length > 0) ||
        (addOnCheck.data && addOnCheck.data.length > 0) ||
        (programPlanCheck.data && programPlanCheck.data.length > 0);

      // Find the lowest tier plan name for upsell messaging
      let lowestPlanName: string | null = null;
      let sourceType: AccessSourceType = null;
      let sourceDisplayName: string | null = null;

      if (planCheck.data && planCheck.data.length > 0) {
        const plan = planCheck.data[0].plans as any;
        lowestPlanName = plan?.name || null;
        sourceDisplayName = plan?.display_name || "plan";
        sourceType = "plan";
      } else if (trackCheck.data && trackCheck.data.length > 0) {
        const track = trackCheck.data[0].tracks as any;
        lowestPlanName = track?.name || null;
        sourceDisplayName = track?.display_name || "learning track";
        sourceType = "track";
      } else if (addOnCheck.data && addOnCheck.data.length > 0) {
        const addOn = addOnCheck.data[0].add_ons as any;
        lowestPlanName = addOn?.name || null;
        sourceDisplayName = addOn?.display_name || "add-on";
        sourceType = "add_on";
      } else if (programPlanCheck.data && programPlanCheck.data.length > 0) {
        const programPlan = programPlanCheck.data[0].program_plans as any;
        lowestPlanName = programPlan?.name || null;
        sourceDisplayName = programPlan?.display_name || "program";
        sourceType = "program_plan";
      }

      return {
        featureKey: typedFeature.key,
        isActive: typedFeature.is_active,
        lowestPlanName: hasAnyMonetization ? lowestPlanName : null,
        sourceType: hasAnyMonetization ? sourceType : null,
        sourceDisplayName: hasAnyMonetization ? sourceDisplayName : null,
      };
    },
    enabled: !!featureKey,
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
    gcTime: 15 * 60 * 1000,
  });

  const isLoading = featureLoading || entitlementsLoading;

  // No feature key provided = always accessible (null means no gating)
  if (!featureKey) {
    return {
      visibility: "accessible",
      isLoading: false,
      requiredPlan: null,
      sourceType: null,
      sourceDisplayName: null,
      hiddenReason: null,
    };
  }

  // Still loading
  if (isLoading) {
    return {
      visibility: "hidden", // Default to hidden while loading
      isLoading: true,
      requiredPlan: null,
      sourceType: null,
      sourceDisplayName: null,
      hiddenReason: null,
    };
  }

  // Feature not found in DB = treat as accessible (legacy/unmigrated features)
  if (!featureData) {
    return {
      visibility: "accessible",
      isLoading: false,
      requiredPlan: null,
      sourceType: null,
      sourceDisplayName: null,
      hiddenReason: null,
    };
  }

  // Rule 1: Feature is inactive → hidden (admins can still see)
  if (!featureData.isActive) {
    return {
      visibility: isAdmin ? "locked" : "hidden", // Admins see it as locked, others don't see it
      isLoading: false,
      requiredPlan: null,
      sourceType: null,
      sourceDisplayName: null,
      hiddenReason: "inactive",
    };
  }

  // Rule 2: Feature is active but not monetized → hidden (admins can still see)
  if (!featureData.lowestPlanName) {
    return {
      visibility: isAdmin ? "locked" : "hidden", // Admins see it as locked, others don't see it
      isLoading: false,
      requiredPlan: null,
      sourceType: null,
      sourceDisplayName: null,
      hiddenReason: "not_monetized",
    };
  }

  // Rule 3: Feature is monetized, check user entitlement
  if (hasFeature(featureKey)) {
    return {
      visibility: "accessible",
      isLoading: false,
      requiredPlan: null,
      sourceType: null,
      sourceDisplayName: null,
      hiddenReason: null,
    };
  }

  // Rule 4: User lacks entitlement → locked (show with upsell)
  return {
    visibility: "locked",
    isLoading: false,
    requiredPlan: featureData.lowestPlanName,
    sourceType: featureData.sourceType,
    sourceDisplayName: featureData.sourceDisplayName,
    hiddenReason: null,
  };
}

/**
 * Batch version for checking multiple features at once (more efficient)
 */
export function useMultipleFeatureVisibility(featureKeys: (string | null | undefined)[]): {
  getVisibility: (featureKey: string | null | undefined) => FeatureVisibilityResult;
  isLoading: boolean;
} {
  const { userRoles } = useAuth();
  const { hasFeature, isLoading: entitlementsLoading } = useEntitlements();
  const isAdmin = userRoles.includes("admin");

  // Filter to unique non-null keys
  const uniqueKeys = [...new Set(featureKeys.filter((k): k is string => !!k))];

  // Fetch all features at once
  const { data: featuresData, isLoading: featuresLoading } = useQuery({
    queryKey: ["features-visibility-batch", uniqueKeys.sort().join(",")],
    queryFn: async (): Promise<Map<string, MonetizedFeature>> => {
      if (uniqueKeys.length === 0) return new Map();

      // Get all features
      const { data: features } = await supabase
        .from("features")
        .select("id, key, is_active")
        .in("key", uniqueKeys);

      if (!features || features.length === 0) return new Map();

      const typedFeatures = features as unknown as FeatureRow[];
      const featureIds = typedFeatures.map((f) => f.id);

      // Check monetization for all features at once
      const [planFeatures, trackFeatures, addOnFeatures, programPlanFeatures] = await Promise.all([
        supabase
          .from("plan_features")
          .select("feature_id, plans!inner(name, tier_level, display_name)")
          .in("feature_id", featureIds)
          .eq("enabled", true),
        supabase
          .from("track_features")
          .select("feature_id, tracks!inner(name, display_name)")
          .in("feature_id", featureIds)
          .eq("is_enabled", true),
        supabase
          .from("add_on_features")
          .select("feature_id, add_ons!inner(name, display_name)")
          .in("feature_id", featureIds),
        supabase
          .from("program_plan_features")
          .select("feature_id, program_plans!inner(name, display_name)")
          .in("feature_id", featureIds)
          .eq("enabled", true),
      ]);

      // Build result map
      const result = new Map<string, MonetizedFeature>();

      for (const feature of typedFeatures) {
        // Find monetization sources
        const planSource = planFeatures.data?.find((pf) => pf.feature_id === feature.id);
        const trackSource = trackFeatures.data?.find((tf) => tf.feature_id === feature.id);
        const addOnSource = addOnFeatures.data?.find((af) => af.feature_id === feature.id);
        const programPlanSource = programPlanFeatures.data?.find(
          (ppf) => ppf.feature_id === feature.id,
        );

        const hasAnyMonetization = !!(
          planSource ||
          trackSource ||
          addOnSource ||
          programPlanSource
        );

        let lowestPlanName: string | null = null;
        let sourceType: AccessSourceType = null;
        let sourceDisplayName: string | null = null;

        if (planSource) {
          const plan = planSource.plans as any;
          lowestPlanName = plan?.name || null;
          sourceDisplayName = plan?.display_name || "plan";
          sourceType = "plan";
        } else if (trackSource) {
          const track = trackSource.tracks as any;
          lowestPlanName = track?.name || null;
          sourceDisplayName = track?.display_name || "learning track";
          sourceType = "track";
        } else if (addOnSource) {
          const addOn = addOnSource.add_ons as any;
          lowestPlanName = addOn?.name || null;
          sourceDisplayName = addOn?.display_name || "add-on";
          sourceType = "add_on";
        } else if (programPlanSource) {
          const programPlan = programPlanSource.program_plans as any;
          lowestPlanName = programPlan?.name || null;
          sourceDisplayName = programPlan?.display_name || "program";
          sourceType = "program_plan";
        }

        result.set(feature.key, {
          featureKey: feature.key,
          isActive: feature.is_active,
          lowestPlanName: hasAnyMonetization ? lowestPlanName : null,
          sourceType: hasAnyMonetization ? sourceType : null,
          sourceDisplayName: hasAnyMonetization ? sourceDisplayName : null,
        });
      }

      return result;
    },
    enabled: uniqueKeys.length > 0,
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  const isLoading = featuresLoading || entitlementsLoading;

  const getVisibility = (featureKey: string | null | undefined): FeatureVisibilityResult => {
    // No feature key = always accessible
    if (!featureKey) {
      return {
        visibility: "accessible",
        isLoading: false,
        requiredPlan: null,
        sourceType: null,
        sourceDisplayName: null,
        hiddenReason: null,
      };
    }

    if (isLoading) {
      return {
        visibility: "hidden",
        isLoading: true,
        requiredPlan: null,
        sourceType: null,
        sourceDisplayName: null,
        hiddenReason: null,
      };
    }

    const featureData = featuresData?.get(featureKey);

    // Feature not found = accessible (legacy)
    if (!featureData) {
      return {
        visibility: "accessible",
        isLoading: false,
        requiredPlan: null,
        sourceType: null,
        sourceDisplayName: null,
        hiddenReason: null,
      };
    }

    // Inactive
    if (!featureData.isActive) {
      return {
        visibility: isAdmin ? "locked" : "hidden",
        isLoading: false,
        requiredPlan: null,
        sourceType: null,
        sourceDisplayName: null,
        hiddenReason: "inactive",
      };
    }

    // Not monetized
    if (!featureData.lowestPlanName) {
      return {
        visibility: isAdmin ? "locked" : "hidden",
        isLoading: false,
        requiredPlan: null,
        sourceType: null,
        sourceDisplayName: null,
        hiddenReason: "not_monetized",
      };
    }

    // Check entitlement
    if (hasFeature(featureKey)) {
      return {
        visibility: "accessible",
        isLoading: false,
        requiredPlan: null,
        sourceType: null,
        sourceDisplayName: null,
        hiddenReason: null,
      };
    }

    // Locked
    return {
      visibility: "locked",
      isLoading: false,
      requiredPlan: featureData.lowestPlanName,
      sourceType: featureData.sourceType,
      sourceDisplayName: featureData.sourceDisplayName,
      hiddenReason: null,
    };
  };

  return {
    getVisibility,
    isLoading,
  };
}
