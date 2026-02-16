import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface Plan {
  id: string;
  name: string;
  tier_level: number;
  is_purchasable: boolean;
}

interface PlanAccessState {
  isLoading: boolean;
  userPlan: Plan | null;
  plans: Plan[];
}

interface ProgramPlanAccess {
  hasAccess: boolean;
  isLocked: boolean;
  reason: "plan_required" | "payment_outstanding" | "separate_purchase_required" | null;
  requiredPlanTier: number;
  userPlanTier: number;
  requiresSeparatePurchase?: boolean;
}

export function usePlanAccess() {
  const { user } = useAuth();
  const [state, setState] = useState<PlanAccessState>({
    isLoading: true,
    userPlan: null,
    plans: [],
  });

  useEffect(() => {
    async function fetchPlanData() {
      if (!user) {
        setState({ isLoading: false, userPlan: null, plans: [] });
        return;
      }

      try {
        // Fetch all plans
        const { data: plansData } = await supabase
          .from("plans")
          .select("id, name, tier_level, is_purchasable")
          .eq("is_active", true)
          .order("tier_level");

        // Fetch user's profile to get their personal plan
        const { data: profile } = await supabase
          .from("profiles")
          .select("plan_id")
          .eq("id", user.id)
          .single();

        // Fetch org-sponsored plans (highest tier from all active org memberships)
        const { data: orgMemberships } = await supabase
          .from("organization_members")
          .select(
            `
            sponsored_plan_id,
            plans:sponsored_plan_id (id, name, tier_level)
          `,
          )
          .eq("user_id", user.id)
          .eq("is_active", true)
          .not("sponsored_plan_id", "is", null);

        // Find personal plan
        let personalPlan: Plan | null = null;
        if (profile?.plan_id && plansData) {
          personalPlan = plansData.find((p) => p.id === profile.plan_id) || null;
        }

        // Find highest org-sponsored plan
        let orgSponsoredPlan: Plan | null = null;
        if (orgMemberships && orgMemberships.length > 0) {
          for (const membership of orgMemberships) {
            const plan = membership.plans as any;
            if (plan && (!orgSponsoredPlan || plan.tier_level > orgSponsoredPlan.tier_level)) {
              orgSponsoredPlan = plan;
            }
          }
        }

        // Hybrid model: effective plan = MAX(personal_plan, org_sponsored_plan)
        let effectivePlan: Plan | null = personalPlan;
        if (orgSponsoredPlan) {
          if (!effectivePlan || orgSponsoredPlan.tier_level > effectivePlan.tier_level) {
            effectivePlan = orgSponsoredPlan;
          }
        }

        setState({
          isLoading: false,
          userPlan: effectivePlan,
          plans: plansData || [],
        });
      } catch (error) {
        console.error("Error fetching plan data:", error);
        setState({ isLoading: false, userPlan: null, plans: [] });
      }
    }

    fetchPlanData();
  }, [user]);

  /**
   * Check if user has plan-based access to a program
   * @param requiresSeparatePurchase - If true, program requires separate purchase regardless of plan
   */
  const checkProgramAccess = useCallback(
    async (
      programId: string,
      programPlanId: string | null,
      programMinTier: number,
      requiresSeparatePurchase: boolean = false,
    ): Promise<ProgramPlanAccess> => {
      if (!user) {
        return {
          hasAccess: false,
          isLocked: true,
          reason: requiresSeparatePurchase ? "separate_purchase_required" : "plan_required",
          requiredPlanTier: programMinTier,
          userPlanTier: 0,
          requiresSeparatePurchase,
        };
      }

      // Check for existing enrollment first - enrolled users always have access
      const { data: enrollment } = await supabase
        .from("client_enrollments")
        .select("payment_type, payment_status, status")
        .eq("client_user_id", user.id)
        .eq("program_id", programId)
        .eq("status", "active")
        .maybeSingle();

      if (enrollment) {
        // Upfront paid = always has access
        if (enrollment.payment_type === "upfront") {
          return {
            hasAccess: true,
            isLocked: false,
            reason: null,
            requiredPlanTier: programMinTier,
            userPlanTier: state.userPlan?.tier_level || 0,
            requiresSeparatePurchase,
          };
        }

        // Payment plan with outstanding payments = locked
        if (enrollment.payment_type === "payment_plan" && enrollment.payment_status !== "paid") {
          return {
            hasAccess: false,
            isLocked: true,
            reason: "payment_outstanding",
            requiredPlanTier: programMinTier,
            userPlanTier: state.userPlan?.tier_level || 0,
            requiresSeparatePurchase,
          };
        }

        // Payment plan that's current = has access
        if (enrollment.payment_type === "payment_plan" && enrollment.payment_status === "paid") {
          return {
            hasAccess: true,
            isLocked: false,
            reason: null,
            requiredPlanTier: programMinTier,
            userPlanTier: state.userPlan?.tier_level || 0,
            requiresSeparatePurchase,
          };
        }

        // Any other active enrollment = has access
        return {
          hasAccess: true,
          isLocked: false,
          reason: null,
          requiredPlanTier: programMinTier,
          userPlanTier: state.userPlan?.tier_level || 0,
          requiresSeparatePurchase,
        };
      }

      // If program requires separate purchase and user is not enrolled, lock it
      if (requiresSeparatePurchase) {
        // Check if user is assigned as instructor or coach (they should still have access)
        const { data: instructorAssignment } = await supabase
          .from("program_instructors")
          .select("id")
          .eq("program_id", programId)
          .eq("instructor_id", user.id)
          .maybeSingle();

        const { data: coachAssignment } = await supabase
          .from("program_coaches")
          .select("id")
          .eq("program_id", programId)
          .eq("coach_id", user.id)
          .maybeSingle();

        if (instructorAssignment || coachAssignment) {
          return {
            hasAccess: true,
            isLocked: false,
            reason: null,
            requiredPlanTier: programMinTier,
            userPlanTier: state.userPlan?.tier_level || 0,
            requiresSeparatePurchase,
          };
        }

        return {
          hasAccess: false,
          isLocked: true,
          reason: "separate_purchase_required",
          requiredPlanTier: programMinTier,
          userPlanTier: state.userPlan?.tier_level || 0,
          requiresSeparatePurchase,
        };
      }

      // If no plan restriction, allow access
      if (programMinTier === 0 && !programPlanId) {
        return {
          hasAccess: true,
          isLocked: false,
          reason: null,
          requiredPlanTier: 0,
          userPlanTier: state.userPlan?.tier_level || 0,
          requiresSeparatePurchase,
        };
      }

      // Check if user is assigned as instructor or coach to this program
      const { data: instructorAssignment } = await supabase
        .from("program_instructors")
        .select("id")
        .eq("program_id", programId)
        .eq("instructor_id", user.id)
        .maybeSingle();

      const { data: coachAssignment } = await supabase
        .from("program_coaches")
        .select("id")
        .eq("program_id", programId)
        .eq("coach_id", user.id)
        .maybeSingle();

      // Instructors and coaches always have access to assigned programs
      if (instructorAssignment || coachAssignment) {
        return {
          hasAccess: true,
          isLocked: false,
          reason: null,
          requiredPlanTier: programMinTier,
          userPlanTier: state.userPlan?.tier_level || 0,
          requiresSeparatePurchase,
        };
      }

      // Check user's plan tier
      const userTier = state.userPlan?.tier_level || 0;

      if (programMinTier > 0 && userTier < programMinTier) {
        return {
          hasAccess: false,
          isLocked: true,
          reason: "plan_required",
          requiredPlanTier: programMinTier,
          userPlanTier: userTier,
          requiresSeparatePurchase,
        };
      }

      return {
        hasAccess: true,
        isLocked: false,
        reason: null,
        requiredPlanTier: programMinTier,
        userPlanTier: userTier,
        requiresSeparatePurchase,
      };
    },
    [user, state.userPlan],
  );

  /**
   * Check if user has plan-based access to a module (in addition to intra-program tier)
   * Now async to check instructor/coach assignments
   */
  const checkModulePlanAccess = useCallback(
    async (
      moduleId: string,
      programId: string,
      modulePlanId: string | null,
      moduleMinTier: number,
    ): Promise<boolean> => {
      // If no plan restriction on module, allow
      if (moduleMinTier === 0 && !modulePlanId) {
        return true;
      }

      if (!user) return false;

      // Check if user is assigned as instructor or coach to the program
      const { data: programInstructor } = await supabase
        .from("program_instructors")
        .select("id")
        .eq("program_id", programId)
        .eq("instructor_id", user.id)
        .maybeSingle();

      const { data: programCoach } = await supabase
        .from("program_coaches")
        .select("id")
        .eq("program_id", programId)
        .eq("coach_id", user.id)
        .maybeSingle();

      // Check if user is assigned as instructor or coach to this specific module
      const { data: moduleInstructor } = await supabase
        .from("module_instructors")
        .select("id")
        .eq("module_id", moduleId)
        .eq("instructor_id", user.id)
        .maybeSingle();

      const { data: moduleCoach } = await supabase
        .from("module_coaches")
        .select("id")
        .eq("module_id", moduleId)
        .eq("coach_id", user.id)
        .maybeSingle();

      // Instructors and coaches always have access to assigned modules
      if (programInstructor || programCoach || moduleInstructor || moduleCoach) {
        return true;
      }

      const userTier = state.userPlan?.tier_level || 0;

      // Check tier requirement
      if (moduleMinTier > 0 && userTier < moduleMinTier) {
        return false;
      }

      // If specific plan required, check if user has it or higher tier
      if (modulePlanId && state.userPlan?.id !== modulePlanId) {
        // Allow if user's tier is at least as high as required
        const requiredPlan = state.plans.find((p) => p.id === modulePlanId);
        if (requiredPlan && userTier < requiredPlan.tier_level) {
          return false;
        }
      }

      return true;
    },
    [user, state.userPlan, state.plans],
  );

  /**
   * Check if user has plan-based access to a resource
   */
  const checkResourcePlanAccess = useCallback(
    (resourcePlanId: string | null, resourceMinTier: number): boolean => {
      // If no plan restriction, allow
      if (resourceMinTier === 0 && !resourcePlanId) {
        return true;
      }

      const userTier = state.userPlan?.tier_level || 0;

      // Check tier requirement
      if (resourceMinTier > 0 && userTier < resourceMinTier) {
        return false;
      }

      return true;
    },
    [state.userPlan],
  );

  /**
   * Get the plan name for a given tier level
   */
  const getPlanNameForTier = useCallback(
    (tierLevel: number): string => {
      const plan = state.plans.find((p) => p.tier_level === tierLevel);
      return plan?.name || `Tier ${tierLevel}`;
    },
    [state.plans],
  );

  return {
    ...state,
    checkProgramAccess,
    checkModulePlanAccess,
    checkResourcePlanAccess,
    getPlanNameForTier,
  };
}

/**
 * @deprecated Use useResourceCredits from '@/hooks/useResourceCredits' instead.
 * This hook is maintained for backwards compatibility only.
 * Resources now consume credits instead of tracking monthly quotas.
 *
 * Migration guide:
 * - Import { useResourceCredits } from '@/hooks/useResourceCredits'
 * - Replace useResourceUsage(resourceId) with useResourceCredits(resourceId)
 * - Use consumeResourceCredit() instead of incrementUsage()
 */
export function useResourceUsage(resourceId: string) {
  const { user } = useAuth();
  const [usage, setUsage] = useState<{
    isLoading: boolean;
    currentUsage: number;
    limit: number | null;
    remaining: number | null;
  }>({
    isLoading: true,
    currentUsage: 0,
    limit: null,
    remaining: null,
  });

  useEffect(() => {
    async function fetchUsage() {
      if (!user || !resourceId) {
        setUsage({ isLoading: false, currentUsage: 0, limit: null, remaining: null });
        return;
      }

      try {
        const periodStart = new Date();
        periodStart.setDate(1);
        periodStart.setHours(0, 0, 0, 0);

        // Get current usage (legacy - reading from deprecated table)
        const { data: usageData } = await supabase
          .from("resource_usage_tracking")
          .select("used_count")
          .eq("user_id", user.id)
          .eq("resource_id", resourceId)
          .eq("period_start", periodStart.toISOString())
          .maybeSingle();

        // Get user's plan to find limit (legacy)
        const { data: profile } = await supabase
          .from("profiles")
          .select("plan_id")
          .eq("id", user.id)
          .single();

        let limit: number | null = null;
        if (profile?.plan_id) {
          const { data: limitData } = await supabase
            .from("plan_resource_limits")
            .select("monthly_limit")
            .eq("plan_id", profile.plan_id)
            .eq("resource_id", resourceId)
            .maybeSingle();

          limit = limitData?.monthly_limit || null;
        }

        const currentUsage = usageData?.used_count || 0;

        setUsage({
          isLoading: false,
          currentUsage,
          limit,
          remaining: limit !== null ? Math.max(0, limit - currentUsage) : null,
        });
      } catch (error) {
        console.error("Error fetching resource usage:", error);
        setUsage({ isLoading: false, currentUsage: 0, limit: null, remaining: null });
      }
    }

    fetchUsage();
  }, [user, resourceId]);

  /**
   * @deprecated Use consumeResourceCredit from useResourceCredits instead
   */
  const incrementUsage = async (): Promise<{ success: boolean; remaining: number | null }> => {
    if (!user) return { success: false, remaining: null };

    const { data, error } = await supabase.rpc("increment_resource_usage", {
      p_user_id: user.id,
      p_resource_id: resourceId,
    });

    const result = data as {
      success: boolean;
      current?: number;
      remaining?: number | null;
      error?: string;
    } | null;

    if (error || !result?.success) {
      return { success: false, remaining: usage.remaining };
    }

    setUsage((prev) => ({
      ...prev,
      currentUsage: result.current ?? prev.currentUsage,
      remaining: result.remaining ?? prev.remaining,
    }));

    return { success: true, remaining: result.remaining ?? null };
  };

  return { ...usage, incrementUsage };
}
