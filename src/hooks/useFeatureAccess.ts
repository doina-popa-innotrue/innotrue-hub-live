import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useEntitlements, checkFeatureAccessAsync } from './useEntitlements';
import { supabase } from '@/integrations/supabase/client';

interface FeatureAccess {
  hasAccess: boolean;
  isLoading: boolean;
  limit: number | null;
  currentUsage: number;
  remainingUsage: number | null;
  fromAddOn: boolean;
}

/**
 * Hook for checking access to a single feature with usage tracking.
 * Uses the unified useEntitlements hook internally.
 */
export function useFeatureAccess(featureKey: string): FeatureAccess {
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
    fromAddOn: accessSource === 'add_on',
  };
}

/**
 * Increment usage for a feature.
 */
export async function incrementFeatureUsage(featureKey: string): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase.rpc('increment_usage', {
    _user_id: user.id,
    _feature_key: featureKey,
  });

  if (error) throw error;

  return data;
}

// Re-export the async utility for non-hook contexts
export { checkFeatureAccessAsync };
