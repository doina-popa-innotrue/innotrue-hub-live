import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCreditBatches } from "@/hooks/useCreditBatches";
import { useDiscountCode, type DiscountResult } from "@/hooks/useDiscountCode";
import { toast } from "sonner";

interface TierPricing {
  tier_name: string;
  credit_cost: number | null;
  program_plan_id: string | null;
}

interface EnrollmentResult {
  success: boolean;
  enrollmentId?: string;
  creditsConsumed?: number;
  insufficientCredits?: boolean;
  requiredCredits?: number;
  availableCredits?: number;
  discountApplied?: boolean;
  originalCost?: number;
  finalCost?: number;
}

export function useProgramEnrollment() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { summary, consume } = useCreditBatches();
  const discountCodeHook = useDiscountCode();
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [tierPricing, setTierPricing] = useState<Map<string, TierPricing>>(new Map());

  // Fetch tier pricing for a program
  const fetchTierPricing = useCallback(async (programId: string): Promise<TierPricing[]> => {
    const { data, error } = await supabase
      .from("program_tier_plans")
      .select("tier_name, credit_cost, program_plan_id")
      .eq("program_id", programId);

    if (error) {
      console.error("Error fetching tier pricing:", error);
      return [];
    }

    const pricing = (data || []).map((d) => ({
      tier_name: d.tier_name,
      credit_cost: d.credit_cost,
      program_plan_id: d.program_plan_id,
    }));

    // Cache the pricing
    const pricingMap = new Map<string, TierPricing>();
    pricing.forEach((p) => pricingMap.set(`${programId}:${p.tier_name}`, p));
    setTierPricing((prev) => new Map([...prev, ...pricingMap]));

    return pricing;
  }, []);

  // Get credit cost for a specific tier
  const getTierCreditCost = useCallback(
    (programId: string, tierName: string): number | null => {
      const key = `${programId}:${tierName}`;
      return tierPricing.get(key)?.credit_cost ?? null;
    },
    [tierPricing],
  );

  // Check if user can afford to enroll in a tier
  const canAffordTier = useCallback(
    (
      programId: string,
      tierName: string,
    ): {
      canAfford: boolean;
      creditCost: number | null;
      availableCredits: number;
      shortfall: number;
    } => {
      const creditCost = getTierCreditCost(programId, tierName);
      const availableCredits = summary?.total_available ?? 0;

      if (creditCost === null) {
        // No credit cost set - might be free or admin-only
        return { canAfford: true, creditCost: null, availableCredits, shortfall: 0 };
      }

      const shortfall = Math.max(0, creditCost - availableCredits);
      return {
        canAfford: availableCredits >= creditCost,
        creditCost,
        availableCredits,
        shortfall,
      };
    },
    [getTierCreditCost, summary],
  );

  // Attempt to enroll user in a program tier
  const enrollInProgram = useCallback(
    async (
      programId: string,
      tierName: string,
      options?: {
        redirectIfInsufficientCredits?: boolean;
        returnUrl?: string;
        discountCode?: string;
      },
    ): Promise<EnrollmentResult> => {
      if (!user) {
        toast.error("You must be logged in to enroll");
        return { success: false };
      }

      setIsEnrolling(true);

      try {
        // Check program capacity before proceeding
        const { data: capCheck } = await supabase.rpc("check_program_capacity", {
          p_program_id: programId,
        });

        if (capCheck && !capCheck.has_capacity) {
          toast.error(
            `This program is at full capacity (${capCheck.enrolled_count}/${capCheck.capacity}).`,
          );
          return { success: false };
        }

        // Fetch fresh tier pricing
        const pricing = await fetchTierPricing(programId);
        // Case-insensitive comparison to match DB values like "Premium" / "Essentials"
        const tierInfo = pricing.find((p) => p.tier_name.toLowerCase() === tierName.toLowerCase());
        const originalCreditCost = tierInfo?.credit_cost ?? null;
        const programPlanId = tierInfo?.program_plan_id ?? null;

        const availableCredits = summary?.total_available ?? 0;

        // Validate discount code if provided
        let discountResult: DiscountResult | null = null;
        let finalCreditCost = originalCreditCost;

        if (options?.discountCode && originalCreditCost !== null && originalCreditCost > 0) {
          discountResult = await discountCodeHook.validateCode(
            options.discountCode,
            programId,
            tierName,
            originalCreditCost,
          );

          if (discountResult) {
            finalCreditCost = discountResult.discountedCost;
          }
        }

        // Check if credits are required and available
        if (finalCreditCost !== null && finalCreditCost > 0) {
          if (availableCredits < finalCreditCost) {
            // Insufficient credits
            if (options?.redirectIfInsufficientCredits !== false) {
              const returnUrl = options?.returnUrl || `/explore?program=${programId}`;
              toast.info(
                `You need ${finalCreditCost} credits to enroll. You have ${availableCredits}.`,
                { description: "Redirecting to purchase credits..." },
              );

              // Store enrollment intent in sessionStorage for post-purchase
              sessionStorage.setItem(
                "pendingEnrollment",
                JSON.stringify({
                  programId,
                  tierName,
                  creditCost: finalCreditCost,
                  discountCode: options?.discountCode,
                  returnUrl,
                }),
              );

              navigate(`/credits?return=${encodeURIComponent(returnUrl)}`);
            }

            return {
              success: false,
              insufficientCredits: true,
              requiredCredits: finalCreditCost,
              availableCredits,
            };
          }

          // Consume credits (at discounted rate)
          const consumeResult = await consume(
            finalCreditCost,
            undefined,
            `Enrollment: Program tier ${tierName}${discountResult ? " (with discount)" : ""}`,
          );

          if (!consumeResult?.success) {
            toast.error("Failed to process credits");
            return { success: false };
          }
        }

        // Create enrollment with discount info
        const { data: enrollment, error: enrollError } = await supabase
          .from("client_enrollments")
          .insert({
            client_user_id: user.id,
            program_id: programId,
            tier: tierName,
            program_plan_id: programPlanId,
            status: "active",
            payment_status: finalCreditCost ? "paid" : "free",
            start_date: new Date().toISOString().split("T")[0],
            discount_code_id: discountResult?.discountId || null,
            discount_percent: discountResult
              ? Math.round(
                  ((originalCreditCost! - discountResult.discountedCost) / originalCreditCost!) *
                    100,
                )
              : null,
            original_credit_cost: originalCreditCost,
            final_credit_cost: finalCreditCost,
            enrollment_source: "self",
          })
          .select("id")
          .single();

        if (enrollError) {
          // If enrollment fails but we consumed credits, this is a problem
          // In a real system, you'd want a transaction or compensating action
          console.error("Enrollment failed:", enrollError);

          if (enrollError.code === "23505") {
            // Check if this is a repeat enrollment rejection
            if (enrollError.message?.includes("Duplicate enrollment not allowed")) {
              toast.error("This program does not allow repeat enrollment", {
                description: "You are already enrolled or have completed this program.",
              });
            } else {
              toast.error("You are already enrolled in this program");
            }
          } else {
            toast.error("Failed to create enrollment");
          }
          return { success: false };
        }

        // Record discount usage if applicable
        if (discountResult) {
          await discountCodeHook.recordUsage(
            discountResult.discountId,
            enrollment.id,
            originalCreditCost!,
            finalCreditCost!,
          );
        }

        const savedCredits = discountResult ? discountResult.discountAmount : 0;
        toast.success("Successfully enrolled!", {
          description: finalCreditCost
            ? `${finalCreditCost} credits deducted${savedCredits > 0 ? ` (saved ${savedCredits} with discount!)` : ""}.`
            : "Welcome to the program!",
        });

        return {
          success: true,
          enrollmentId: enrollment.id,
          creditsConsumed: finalCreditCost ?? 0,
          discountApplied: !!discountResult,
          originalCost: originalCreditCost ?? undefined,
          finalCost: finalCreditCost ?? undefined,
        };
      } catch (error: any) {
        console.error("Enrollment error:", error);
        toast.error("An error occurred during enrollment");
        return { success: false };
      } finally {
        setIsEnrolling(false);
      }
    },
    [user, summary, fetchTierPricing, consume, navigate, discountCodeHook],
  );

  // Check for pending enrollment after returning from credit purchase
  const checkPendingEnrollment = useCallback(async (): Promise<{
    hasPending: boolean;
    programId?: string;
    tierName?: string;
  }> => {
    const pendingStr = sessionStorage.getItem("pendingEnrollment");
    if (!pendingStr) return { hasPending: false };

    try {
      const pending = JSON.parse(pendingStr);
      return {
        hasPending: true,
        programId: pending.programId,
        tierName: pending.tierName,
      };
    } catch {
      return { hasPending: false };
    }
  }, []);

  // Clear pending enrollment
  const clearPendingEnrollment = useCallback(() => {
    sessionStorage.removeItem("pendingEnrollment");
  }, []);

  // Resume pending enrollment after credit purchase
  const resumePendingEnrollment = useCallback(async (): Promise<EnrollmentResult> => {
    const pending = await checkPendingEnrollment();
    if (!pending.hasPending || !pending.programId || !pending.tierName) {
      return { success: false };
    }

    clearPendingEnrollment();
    return enrollInProgram(pending.programId, pending.tierName, {
      redirectIfInsufficientCredits: true,
    });
  }, [checkPendingEnrollment, clearPendingEnrollment, enrollInProgram]);

  return {
    isEnrolling,
    fetchTierPricing,
    getTierCreditCost,
    canAffordTier,
    enrollInProgram,
    checkPendingEnrollment,
    clearPendingEnrollment,
    resumePendingEnrollment,
    // Expose discount validation for UI
    validateDiscountCode: discountCodeHook.validateCode,
    validatedDiscount: discountCodeHook.validatedDiscount,
    isValidatingDiscount: discountCodeHook.isValidating,
    discountValidationError: discountCodeHook.validationError,
    clearDiscount: discountCodeHook.clearDiscount,
  };
}
