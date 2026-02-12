import { useEffect, useState } from "react";
import { useEntitlements } from "./useEntitlements";
import { supabase } from "@/integrations/supabase/client";
import { DecisionCapability } from "@/lib/decisionFeatureConfig";

interface DecisionFeatureAccess {
  isLoading: boolean;
  hasCapability: (capability: DecisionCapability) => boolean;
  hasBasicAccess: boolean;
  hasAdvancedAccess: boolean;
}

/**
 * Hook for checking decision toolkit feature access.
 * Uses useEntitlements for feature access checking, with additional
 * capability mapping from decision_capability_settings table.
 */
export function useDecisionFeatureAccess(): DecisionFeatureAccess {
  const { isLoading: entitlementsLoading, hasFeature } = useEntitlements();
  const [capabilityMappings, setCapabilityMappings] = useState<Record<string, string>>({});
  const [mappingsLoading, setMappingsLoading] = useState(true);

  useEffect(() => {
    async function fetchMappings() {
      try {
        const { data: settings, error } = await supabase
          .from("decision_capability_settings")
          .select("capability, feature_key");

        if (error) throw error;

        const mappings: Record<string, string> = {};
        settings?.forEach((s: { capability: string; feature_key: string }) => {
          mappings[s.capability] = s.feature_key;
        });
        setCapabilityMappings(mappings);
      } catch (error) {
        console.error("Error fetching capability mappings:", error);
      } finally {
        setMappingsLoading(false);
      }
    }

    fetchMappings();
  }, []);

  const hasCapability = (capability: DecisionCapability): boolean => {
    const requiredFeature = capabilityMappings[capability];
    if (!requiredFeature) return false;
    return hasFeature(requiredFeature);
  };

  const hasBasicAccess = hasFeature("decision_toolkit_basic");
  const hasAdvancedAccess = hasFeature("decision_toolkit_advanced");

  return {
    isLoading: entitlementsLoading || mappingsLoading,
    hasCapability,
    hasBasicAccess,
    hasAdvancedAccess,
  };
}
