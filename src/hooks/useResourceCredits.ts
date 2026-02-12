import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useCreditBatches } from "./useCreditBatches";
import { useQuery } from "@tanstack/react-query";

interface ResourceAccessResult {
  hasAccess: boolean;
  cost: number;
  isFree: boolean;
  availableCredits: number;
  wouldRemain: number;
  error?: string;
}

interface ConsumeResourceResult {
  success: boolean;
  free: boolean;
  creditsConsumed: number;
  remaining?: number;
  error?: string;
}

interface CheckAccessResponse {
  has_access?: boolean;
  cost?: number;
  is_free?: boolean;
  available_credits?: number;
  would_remain?: number;
  error?: string;
}

interface ConsumeResourceResponse {
  success?: boolean;
  free?: boolean;
  credits_consumed?: number;
  remaining?: { total_available?: number };
  error?: string;
}

/**
 * Hook for managing resource access and credit consumption.
 * Resources can have a credit_cost that is consumed when accessed.
 * Free resources (credit_cost = 0 or null) don't consume credits.
 */
export function useResourceCredits(resourceId?: string) {
  const { user } = useAuth();
  const { summary, refetch: refetchCredits } = useCreditBatches();
  const availableCredits = summary?.total_available ?? 0;

  // Fetch resource credit info
  const { data: resourceInfo, isLoading } = useQuery({
    queryKey: ["resource-credit-info", resourceId],
    queryFn: async () => {
      if (!resourceId) return null;

      const { data, error } = await supabase
        .from("resource_library")
        .select("id, title, credit_cost, is_consumable")
        .eq("id", resourceId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!resourceId,
  });

  /**
   * Check if user can access a resource before consuming.
   */
  const checkAccess = async (targetResourceId?: string): Promise<ResourceAccessResult> => {
    const checkId = targetResourceId || resourceId;
    if (!user || !checkId) {
      return {
        hasAccess: false,
        cost: 0,
        isFree: false,
        availableCredits: 0,
        wouldRemain: 0,
        error: "Not authenticated",
      };
    }

    const { data, error } = await supabase.rpc("check_resource_access", {
      p_user_id: user.id,
      p_resource_id: checkId,
      p_org_id: null as unknown as string,
    });

    if (error) {
      return {
        hasAccess: false,
        cost: 0,
        isFree: false,
        availableCredits: 0,
        wouldRemain: 0,
        error: error.message,
      };
    }

    const result = data as CheckAccessResponse | null;

    return {
      hasAccess: result?.has_access ?? false,
      cost: result?.cost ?? 0,
      isFree: result?.is_free ?? false,
      availableCredits: result?.available_credits ?? 0,
      wouldRemain: result?.would_remain ?? 0,
      error: result?.error,
    };
  };

  /**
   * Consume credits for accessing a resource.
   * Returns success if free resource or credits consumed successfully.
   */
  const consumeResourceCredit = async (
    targetResourceId?: string,
  ): Promise<ConsumeResourceResult> => {
    const consumeId = targetResourceId || resourceId;
    if (!user || !consumeId) {
      return {
        success: false,
        free: false,
        creditsConsumed: 0,
        error: "Not authenticated",
      };
    }

    const { data, error } = await supabase.rpc("consume_resource_credit", {
      p_user_id: user.id,
      p_resource_id: consumeId,
      p_org_id: null as unknown as string,
    });

    if (error) {
      return {
        success: false,
        free: false,
        creditsConsumed: 0,
        error: error.message,
      };
    }

    const result = data as ConsumeResourceResponse | null;

    // Refetch credit balance after consumption
    if (result?.success && !result?.free) {
      refetchCredits();
    }

    return {
      success: result?.success ?? false,
      free: result?.free ?? false,
      creditsConsumed: result?.credits_consumed ?? 0,
      remaining: result?.remaining?.total_available,
      error: result?.error,
    };
  };

  const creditCost = resourceInfo?.credit_cost ?? 0;
  const isConsumable = resourceInfo?.is_consumable ?? false;
  const isFree = !isConsumable || creditCost === 0 || creditCost === null;
  const canAfford = isFree || availableCredits >= creditCost;

  return {
    // State
    isLoading,
    creditCost,
    isConsumable,
    isFree,
    canAfford,
    availableCredits,
    resourceInfo,

    // Actions
    checkAccess,
    consumeResourceCredit,
    refetchCredits,
  };
}

/**
 * @deprecated Use useResourceCredits instead.
 * Legacy hook maintained for backwards compatibility.
 */
export function useResourceUsage(resourceId: string) {
  const { isLoading, canAfford, consumeResourceCredit, availableCredits, isFree } =
    useResourceCredits(resourceId);

  return {
    isLoading,
    currentUsage: 0, // Legacy - no longer tracked per resource
    limit: null as number | null, // Legacy - now uses credits
    remaining: isFree ? null : availableCredits,
    incrementUsage: async () => {
      const result = await consumeResourceCredit();
      return {
        success: result.success,
        remaining: result.remaining ?? null,
      };
    },
  };
}
