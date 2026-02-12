import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface DiscountValidation {
  is_valid: boolean;
  discount_code_id: string | null;
  discount_type: string | null;
  discount_value: number | null;
  error_message: string | null;
}

export interface DiscountResult {
  discountId: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  originalCost: number;
  discountedCost: number;
  discountAmount: number;
}

export function useDiscountCode() {
  const { user } = useAuth();
  const [isValidating, setIsValidating] = useState(false);
  const [validatedDiscount, setValidatedDiscount] = useState<DiscountResult | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const validateCode = useCallback(
    async (
      code: string,
      programId: string,
      tierName: string,
      originalCreditCost: number,
    ): Promise<DiscountResult | null> => {
      if (!user || !code.trim()) {
        setValidatedDiscount(null);
        setValidationError(null);
        return null;
      }

      setIsValidating(true);
      setValidationError(null);

      try {
        const { data, error } = await supabase.rpc("validate_discount_code", {
          p_code: code.trim().toUpperCase(),
          p_program_id: programId,
          p_tier_name: tierName,
          p_user_id: user.id,
        });

        if (error) {
          console.error("Discount validation error:", error);
          setValidationError("Failed to validate code");
          setValidatedDiscount(null);
          return null;
        }

        // The RPC returns an array with one row
        const resultArray = data as DiscountValidation[] | null;
        const result = resultArray?.[0];

        if (!result?.is_valid || !result.discount_code_id) {
          setValidationError(result?.error_message || "Invalid discount code");
          setValidatedDiscount(null);
          return null;
        }

        // Calculate discounted cost
        let discountedCost: number;
        let discountAmount: number;

        if (result.discount_type === "percentage") {
          discountAmount = Math.round((originalCreditCost * (result.discount_value || 0)) / 100);
          discountedCost = Math.max(0, originalCreditCost - discountAmount);
        } else {
          discountAmount = Math.min(result.discount_value || 0, originalCreditCost);
          discountedCost = Math.max(0, originalCreditCost - discountAmount);
        }

        const discountResult: DiscountResult = {
          discountId: result.discount_code_id,
          discountType: result.discount_type as "percentage" | "fixed",
          discountValue: result.discount_value || 0,
          originalCost: originalCreditCost,
          discountedCost,
          discountAmount,
        };

        setValidatedDiscount(discountResult);
        setValidationError(null);
        return discountResult;
      } catch (err) {
        console.error("Discount code error:", err);
        setValidationError("Error validating code");
        setValidatedDiscount(null);
        return null;
      } finally {
        setIsValidating(false);
      }
    },
    [user],
  );

  const clearDiscount = useCallback(() => {
    setValidatedDiscount(null);
    setValidationError(null);
  }, []);

  const recordUsage = useCallback(
    async (
      discountId: string,
      enrollmentId: string,
      originalCost: number,
      finalCost: number,
    ): Promise<{ success: boolean; error?: string }> => {
      if (!user) return { success: false, error: "Not authenticated" };

      const discountPercent =
        originalCost > 0 ? Math.round(((originalCost - finalCost) / originalCost) * 100) : 0;

      try {
        // Record usage
        const { error: usageError } = await supabase.from("discount_code_uses").insert({
          discount_code_id: discountId,
          user_id: user.id,
          enrollment_id: enrollmentId,
        });

        if (usageError) {
          console.error("Failed to record discount usage:", usageError);
          return { success: false, error: "Failed to record discount usage" };
        }

        // Update enrollment with discount info
        const { error: enrollmentError } = await supabase
          .from("client_enrollments")
          .update({
            discount_code_id: discountId,
            discount_percent: discountPercent,
            original_credit_cost: originalCost,
            final_credit_cost: finalCost,
          })
          .eq("id", enrollmentId);

        if (enrollmentError) {
          console.error("Failed to update enrollment with discount:", enrollmentError);
          return { success: false, error: "Failed to apply discount to enrollment" };
        }

        return { success: true };
      } catch (err) {
        console.error("Error recording discount usage:", err);
        return { success: false, error: "Unexpected error recording discount" };
      }
    },
    [user],
  );

  return {
    isValidating,
    validatedDiscount,
    validationError,
    validateCode,
    clearDiscount,
    recordUsage,
  };
}
