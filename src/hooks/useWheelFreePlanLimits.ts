import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface WheelPlanLimits {
  isFreePlan: boolean;
  isLoading: boolean;
  maxGoals: number;
  maxReflections: number;
  currentGoalCount: number;
  currentReflectionCount: number;
  canAddGoal: boolean;
  canAddReflection: boolean;
  canViewHistory: boolean;
}

const FREE_PLAN_MAX_GOALS = 3;
const FREE_PLAN_MAX_REFLECTIONS = 3;

export function useWheelFreePlanLimits(): WheelPlanLimits {
  const { user } = useAuth();
  const [state, setState] = useState<WheelPlanLimits>({
    isFreePlan: true,
    isLoading: true,
    maxGoals: FREE_PLAN_MAX_GOALS,
    maxReflections: FREE_PLAN_MAX_REFLECTIONS,
    currentGoalCount: 0,
    currentReflectionCount: 0,
    canAddGoal: false,
    canAddReflection: false,
    canViewHistory: false,
  });

  useEffect(() => {
    if (!user) {
      setState(prev => ({ ...prev, isLoading: false }));
      return;
    }

    checkPlanAndUsage();
  }, [user]);

  const checkPlanAndUsage = async () => {
    if (!user) return;
    
    try {
      // Get user's subscription plan tier level
      const { data: profile } = await supabase
        .from('profiles')
        .select('plan_id, plans!profiles_plan_id_fkey(tier_level)')
        .eq('id', user.id)
        .single();

      const subscriptionTierLevel = (profile?.plans as any)?.tier_level ?? 0;

      // Also check program plan tier levels from active enrollments
      const programPlanTier = await getHighestProgramPlanTier(user.id);

      // User has access if they have any tier > 0 from either source
      const effectiveTier = Math.max(subscriptionTierLevel, programPlanTier);
      const isFreePlan = effectiveTier === 0;

      if (!isFreePlan) {
        // Paid users (via subscription OR program) have unlimited access
        setState({
          isFreePlan: false,
          isLoading: false,
          maxGoals: Infinity,
          maxReflections: Infinity,
          currentGoalCount: 0,
          currentReflectionCount: 0,
          canAddGoal: true,
          canAddReflection: true,
          canViewHistory: true,
        });
        return;
      }

      // Count goals with wheel_category (from Wheel of Life)
      const { count: goalCount } = await supabase
        .from('goals')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .not('wheel_category', 'is', null);

      // Count wheel domain reflections
      const { count: reflectionCount } = await supabase
        .from('wheel_domain_reflections' as any)
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      const currentGoalCount = goalCount ?? 0;
      const currentReflectionCount = reflectionCount ?? 0;

      setState({
        isFreePlan: true,
        isLoading: false,
        maxGoals: FREE_PLAN_MAX_GOALS,
        maxReflections: FREE_PLAN_MAX_REFLECTIONS,
        currentGoalCount,
        currentReflectionCount,
        canAddGoal: currentGoalCount < FREE_PLAN_MAX_GOALS,
        canAddReflection: currentReflectionCount < FREE_PLAN_MAX_REFLECTIONS,
        canViewHistory: false,
      });
    } catch (error) {
      console.error('Error checking wheel plan limits:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
      }));
    }
  };

  return state;
}

async function getHighestProgramPlanTier(userId: string): Promise<number> {
  try {
    // Get user's active enrollments with program plans and tier info
    const { data: enrollments } = await supabase
      .from('client_enrollments')
      .select(`
        program_plan_id,
        tier,
        programs!inner(default_program_plan_id)
      `)
      .eq('client_user_id', userId)
      .eq('status', 'active');

    if (!enrollments || enrollments.length === 0) return 0;

    // Collect all program plan IDs
    const programPlanIds = new Set<string>();
    const tierNames = new Set<string>();
    
    for (const enrollment of enrollments) {
      const planId = enrollment.program_plan_id || 
        (enrollment.programs as any)?.default_program_plan_id;
      if (planId) {
        programPlanIds.add(planId);
      }
      // Also track tier names from enrollment for fallback lookup
      if (enrollment.tier) {
        tierNames.add(enrollment.tier.toLowerCase());
      }
    }

    let highestTier = 0;

    // Get tier levels from explicit program plan IDs
    if (programPlanIds.size > 0) {
      const { data: programPlans } = await supabase
        .from('program_plans')
        .select('tier_level')
        .in('id', Array.from(programPlanIds))
        .eq('is_active', true);

      if (programPlans && programPlans.length > 0) {
        highestTier = Math.max(highestTier, ...programPlans.map(p => p.tier_level));
      }
    }

    // Also check by tier name (for enrollments where program_plan_id is NULL but tier is set)
    if (tierNames.size > 0) {
      const { data: plansByName } = await supabase
        .from('program_plans')
        .select('tier_level, name')
        .eq('is_active', true);

      if (plansByName) {
        for (const plan of plansByName) {
          if (tierNames.has(plan.name.toLowerCase())) {
            highestTier = Math.max(highestTier, plan.tier_level);
          }
        }
      }
    }

    return highestTier;
  } catch (error) {
    console.error('Error fetching program plan tier:', error);
    return 0;
  }
}
