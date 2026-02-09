import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface UserAddOnAccess {
  featureKeys: Set<string>;
  isLoading: boolean;
  hasFeatureFromAddOn: (featureKey: string) => boolean;
}

export function useUserAddOns(): UserAddOnAccess {
  const { user } = useAuth();
  const [featureKeys, setFeatureKeys] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setFeatureKeys(new Set());
      setIsLoading(false);
      return;
    }

    fetchUserAddOnFeatures();
  }, [user]);

  const fetchUserAddOnFeatures = async () => {
    if (!user) return;
    
    try {
      // Get user's active add-ons (not expired)
      const { data: userAddOns, error: userAddOnsError } = await supabase
        .from('user_add_ons')
        .select('add_on_id, expires_at')
        .eq('user_id', user.id);

      if (userAddOnsError) throw userAddOnsError;

      // Filter out expired add-ons
      const activeAddOnIds = userAddOns
        ?.filter((ua) => !ua.expires_at || new Date(ua.expires_at) > new Date())
        .map((ua) => ua.add_on_id) || [];

      if (activeAddOnIds.length === 0) {
        setFeatureKeys(new Set());
        setIsLoading(false);
        return;
      }

      // Get features for those add-ons
      const { data: addOnFeatures, error: featuresError } = await supabase
        .from('add_on_features')
        .select(`
          feature_id,
          features!inner (
            key
          )
        `)
        .in('add_on_id', activeAddOnIds);

      if (featuresError) throw featuresError;

      const keys = new Set<string>();
      addOnFeatures?.forEach((af: any) => {
        if (af.features?.key) {
          keys.add(af.features.key);
        }
      });

      setFeatureKeys(keys);
    } catch (error) {
      console.error('Error fetching user add-on features:', error);
      setFeatureKeys(new Set());
    } finally {
      setIsLoading(false);
    }
  };

  const hasFeatureFromAddOn = (featureKey: string): boolean => {
    return featureKeys.has(featureKey);
  };

  return {
    featureKeys,
    isLoading,
    hasFeatureFromAddOn,
  };
}
