import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface ProgramPlan {
  id: string;
  name: string;
  tier_level: number;
}

interface ProgramPlanFeature {
  feature_id: string;
  enabled: boolean;
  limit_value: number | null;
}

interface ProgramPlanAccessState {
  isLoading: boolean;
  userProgramPlans: { programId: string; programPlanId: string; tierLevel: number; enrollmentTier?: string }[];
  allProgramPlans: ProgramPlan[];
}

/**
 * Hook to check feature access based on program plan enrollments.
 * This is separate from subscription plans - it's based on which programs the user is enrolled in.
 * 
 * Program plan resolution order:
 * 1. Enrollment's explicit program_plan_id
 * 2. Per-tier mapping from program_tier_plans (based on enrollment tier)
 * 3. Program's default_program_plan_id
 */
export function useProgramPlanAccess() {
  const { user } = useAuth();
  const [state, setState] = useState<ProgramPlanAccessState>({
    isLoading: true,
    userProgramPlans: [],
    allProgramPlans: [],
  });
  const [featureCache, setFeatureCache] = useState<Map<string, ProgramPlanFeature[]>>(new Map());

  useEffect(() => {
    async function fetchData() {
      if (!user) {
        setState({ isLoading: false, userProgramPlans: [], allProgramPlans: [] });
        return;
      }

      try {
        // Fetch all program plans
        const { data: programPlansData } = await supabase
          .from('program_plans')
          .select('id, name, tier_level')
          .eq('is_active', true)
          .order('tier_level');

        // Fetch user's enrollments with program plans and tier
        const { data: enrollmentsData } = await supabase
          .from('client_enrollments')
          .select(`
            program_id,
            program_plan_id,
            tier,
            programs!inner(default_program_plan_id)
          `)
          .eq('client_user_id', user.id)
          .eq('status', 'active');

        // Fetch all per-tier program plan mappings for enrolled programs
        const programIds = enrollmentsData?.map(e => e.program_id) || [];
        const { data: tierPlansData } = programIds.length > 0 
          ? await supabase
              .from('program_tier_plans')
              .select('program_id, tier_name, program_plan_id')
              .in('program_id', programIds)
          : { data: [] };

        const userProgramPlans: { programId: string; programPlanId: string; tierLevel: number; enrollmentTier?: string }[] = [];

        if (enrollmentsData && programPlansData) {
          for (const enrollment of enrollmentsData) {
            // Resolution order:
            // 1. Enrollment's explicit program_plan_id
            // 2. Per-tier mapping from program_tier_plans (based on enrollment tier)
            // 3. Program's default_program_plan_id
            
            let programPlanId = enrollment.program_plan_id;
            
            if (!programPlanId && enrollment.tier && tierPlansData) {
              // Look up per-tier mapping
              const tierPlan = tierPlansData.find(
                tp => tp.program_id === enrollment.program_id && tp.tier_name === enrollment.tier
              );
              programPlanId = tierPlan?.program_plan_id || null;
            }
            
            if (!programPlanId) {
              // Fall back to program's default
              programPlanId = (enrollment.programs as any)?.default_program_plan_id;
            }
            
            if (programPlanId) {
              const plan = programPlansData.find(p => p.id === programPlanId);
              if (plan) {
                userProgramPlans.push({
                  programId: enrollment.program_id,
                  programPlanId: plan.id,
                  tierLevel: plan.tier_level,
                  enrollmentTier: enrollment.tier || undefined,
                });
              }
            }
          }
        }

        setState({
          isLoading: false,
          userProgramPlans,
          allProgramPlans: programPlansData || [],
        });
      } catch (error) {
        console.error('Error fetching program plan data:', error);
        setState({ isLoading: false, userProgramPlans: [], allProgramPlans: [] });
      }
    }

    fetchData();
  }, [user]);

  /**
   * Get the highest tier level from user's program plan enrollments
   */
  const getHighestProgramPlanTier = useCallback((): number => {
    if (state.userProgramPlans.length === 0) return 0;
    return Math.max(...state.userProgramPlans.map(p => p.tierLevel));
  }, [state.userProgramPlans]);

  /**
   * Check if user has access to a feature via any of their program plans
   */
  const hasFeatureViaProgram = useCallback(async (featureKey: string): Promise<boolean> => {
    if (state.userProgramPlans.length === 0) return false;

    // Get the feature ID
    const { data: featureData } = await supabase
      .from('features')
      .select('id')
      .eq('key', featureKey)
      .single();

    if (!featureData) return false;

    // Check each program plan for this feature
    for (const userPlan of state.userProgramPlans) {
      // Check cache first
      let planFeatures = featureCache.get(userPlan.programPlanId);
      
      if (!planFeatures) {
        const { data: featuresData } = await supabase
          .from('program_plan_features')
          .select('feature_id, enabled, limit_value')
          .eq('program_plan_id', userPlan.programPlanId);
        
        planFeatures = featuresData || [];
        setFeatureCache(prev => new Map(prev).set(userPlan.programPlanId, planFeatures!));
      }

      const feature = planFeatures.find(f => f.feature_id === featureData.id);
      if (feature?.enabled) {
        return true;
      }
    }

    return false;
  }, [state.userProgramPlans, featureCache]);

  /**
   * Get the feature limit from user's highest tier program plan
   */
  const getFeatureLimitViaProgram = useCallback(async (featureKey: string): Promise<number | null> => {
    if (state.userProgramPlans.length === 0) return null;

    // Get the feature ID
    const { data: featureData } = await supabase
      .from('features')
      .select('id')
      .eq('key', featureKey)
      .single();

    if (!featureData) return null;

    // Sort by tier level descending to check highest tier first
    const sortedPlans = [...state.userProgramPlans].sort((a, b) => b.tierLevel - a.tierLevel);

    for (const userPlan of sortedPlans) {
      let planFeatures = featureCache.get(userPlan.programPlanId);
      
      if (!planFeatures) {
        const { data: featuresData } = await supabase
          .from('program_plan_features')
          .select('feature_id, enabled, limit_value')
          .eq('program_plan_id', userPlan.programPlanId);
        
        planFeatures = featuresData || [];
        setFeatureCache(prev => new Map(prev).set(userPlan.programPlanId, planFeatures!));
      }

      const feature = planFeatures.find(f => f.feature_id === featureData.id);
      if (feature?.enabled && feature.limit_value !== null) {
        return feature.limit_value;
      }
    }

    return null;
  }, [state.userProgramPlans, featureCache]);

  /**
   * Get all enabled features for the user from their program plans
   */
  const getEnabledProgramFeatures = useCallback(async (): Promise<string[]> => {
    if (state.userProgramPlans.length === 0) return [];

    const enabledFeatureIds = new Set<string>();

    for (const userPlan of state.userProgramPlans) {
      let planFeatures = featureCache.get(userPlan.programPlanId);
      
      if (!planFeatures) {
        const { data: featuresData } = await supabase
          .from('program_plan_features')
          .select('feature_id, enabled, limit_value')
          .eq('program_plan_id', userPlan.programPlanId);
        
        planFeatures = featuresData || [];
        setFeatureCache(prev => new Map(prev).set(userPlan.programPlanId, planFeatures!));
      }

      for (const feature of planFeatures) {
        if (feature.enabled) {
          enabledFeatureIds.add(feature.feature_id);
        }
      }
    }

    // Get feature keys from IDs
    if (enabledFeatureIds.size === 0) return [];

    const { data: features } = await supabase
      .from('features')
      .select('key')
      .in('id', Array.from(enabledFeatureIds));

    return features?.map(f => f.key) || [];
  }, [state.userProgramPlans, featureCache]);

  return {
    ...state,
    getHighestProgramPlanTier,
    hasFeatureViaProgram,
    getFeatureLimitViaProgram,
    getEnabledProgramFeatures,
  };
}
