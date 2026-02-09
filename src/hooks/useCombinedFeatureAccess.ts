import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useEntitlements, AccessSource, checkFeatureAccessAsync } from './useEntitlements';
import { supabase } from '@/integrations/supabase/client';

interface CombinedFeatureAccess {
  hasAccess: boolean;
  isLoading: boolean;
  limit: number | null;
  currentUsage: number;
  remainingUsage: number | null;
  accessSource: AccessSource | null;
}

/**
 * Combined hook that checks feature access from all sources.
 * Uses the unified useEntitlements hook internally.
 * 
 * @deprecated Consider using useEntitlements directly for simpler access patterns.
 * This hook is maintained for backward compatibility.
 */
export function useCombinedFeatureAccess(featureKey: string): CombinedFeatureAccess {
  const { user } = useAuth();
  const { isLoading: entitlementsLoading, hasFeature, getLimit, getAccessSource } = useEntitlements();
  const [currentUsage, setCurrentUsage] = useState(0);
  const [usageLoading, setUsageLoading] = useState(true);

  useEffect(() => {
    async function fetchUsage() {
      if (!user || entitlementsLoading) {
        setUsageLoading(false);
        return;
      }

      const limit = getLimit(featureKey);
      if (limit === null) {
        // No limit, no need to fetch usage
        setCurrentUsage(0);
        setUsageLoading(false);
        return;
      }

      try {
        const { data: usageData } = await supabase.rpc('get_current_usage', {
          _user_id: user.id,
          _feature_key: featureKey,
        });
        setCurrentUsage(usageData ?? 0);
      } catch (error) {
        console.error('Error fetching usage:', error);
      } finally {
        setUsageLoading(false);
      }
    }

    fetchUsage();
  }, [user, featureKey, entitlementsLoading, getLimit]);

  const hasAccess = hasFeature(featureKey);
  const limit = getLimit(featureKey);
  const accessSource = getAccessSource(featureKey);
  const isLoading = entitlementsLoading || usageLoading;

  return {
    hasAccess,
    isLoading,
    limit,
    currentUsage,
    remainingUsage: limit !== null ? Math.max(0, limit - currentUsage) : null,
    accessSource,
  };
}

// Re-export the async utility for non-hook contexts
export { checkFeatureAccessAsync };
