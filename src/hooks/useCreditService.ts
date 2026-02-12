import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface CreditServiceCost {
  found: boolean;
  service_id?: string;
  service_name?: string;
  base_cost?: number;
  effective_cost?: number;
  has_track_discount?: boolean;
  category?: string;
}

interface ConsumeResult {
  success: boolean;
  error?: string;
  credits_consumed?: number;
  balance_after?: number;
  service_name?: string;
}

/**
 * Hook for consuming credit services.
 *
 * @example
 * ```tsx
 * function BookSessionButton({ serviceId }: { serviceId: string }) {
 *   const { consume, isConsuming, getServiceCost } = useCreditService();
 *   const { data: cost } = getServiceCost(serviceId);
 *
 *   const handleBook = async () => {
 *     const result = await consume(serviceId, 'Booked live mock session');
 *     if (result?.success) {
 *       toast.success(`Session booked! Used ${result.credits_consumed} credits.`);
 *     }
 *   };
 *
 *   return (
 *     <Button onClick={handleBook} disabled={isConsuming}>
 *       Book Session ({cost?.effective_cost ?? '...'} credits)
 *     </Button>
 *   );
 * }
 * ```
 */
export function useCreditService() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  /**
   * Get the cost of a credit service for the current user.
   * Takes into account track discounts if applicable.
   */
  const getServiceCost = (serviceId: string) => {
    return useQuery({
      queryKey: ["credit-service-cost", serviceId, user?.id],
      queryFn: async (): Promise<CreditServiceCost | null> => {
        if (!user) return null;

        const { data, error } = await supabase.rpc("get_credit_service_cost", {
          p_user_id: user.id,
          p_service_id: serviceId,
        });

        if (error) {
          console.error("Error fetching service cost:", error);
          return null;
        }

        return data as unknown as CreditServiceCost;
      },
      enabled: !!user && !!serviceId,
      staleTime: 60000, // 1 minute
    });
  };

  /**
   * Consume a credit service.
   * Checks feature access, applies track discounts, and deducts credits.
   */
  const consumeMutation = useMutation({
    mutationFn: async ({
      serviceId,
      notes,
      actionReferenceId,
    }: {
      serviceId: string;
      notes?: string;
      actionReferenceId?: string;
    }): Promise<ConsumeResult> => {
      if (!user) {
        return { success: false, error: "Not authenticated" };
      }

      const { data, error } = await supabase.rpc("consume_credit_service", {
        p_user_id: user.id,
        p_service_id: serviceId,
        p_action_reference_id: actionReferenceId ?? undefined,
        p_notes: notes ?? undefined,
      });

      if (error) {
        throw new Error(error.message);
      }

      return data as unknown as ConsumeResult;
    },
    onSuccess: (result) => {
      if (result.success) {
        // Invalidate credit-related queries (both old and new systems)
        queryClient.invalidateQueries({ queryKey: ["user-credit-summary"] });
        queryClient.invalidateQueries({ queryKey: ["user-credit-transactions"] });
        queryClient.invalidateQueries({ queryKey: ["credit-batches-summary"] });
      } else if (result.error) {
        toast.error(result.error);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  /**
   * Consume a credit service.
   * @param serviceId - The ID of the credit service to consume
   * @param notes - Optional notes for the transaction log
   * @param actionReferenceId - Optional reference ID (e.g., session ID, booking ID)
   * @returns Promise with the result of the consumption
   */
  const consume = async (
    serviceId: string,
    notes?: string,
    actionReferenceId?: string,
  ): Promise<ConsumeResult | undefined> => {
    return consumeMutation.mutateAsync({ serviceId, notes, actionReferenceId });
  };

  return {
    consume,
    isConsuming: consumeMutation.isPending,
    getServiceCost,
  };
}

/**
 * Hook to fetch all active credit services.
 * Useful for displaying a list of available services and their costs.
 */
export function useCreditServices(category?: string) {
  return useQuery({
    queryKey: ["credit-services-active", category],
    queryFn: async () => {
      let query = supabase
        .from("credit_services")
        .select("*")
        .eq("is_active", true)
        .order("category")
        .order("credit_cost", { ascending: true });

      if (category) {
        query = query.eq("category", category);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    staleTime: 60000, // 1 minute
  });
}

/**
 * Hook to get a specific credit service by its linked entity.
 * Useful when you know the entity (e.g., session type) but need to find its credit cost.
 */
export function useCreditServiceByEntity(entityType: string, entityId: string) {
  return useQuery({
    queryKey: ["credit-service-by-entity", entityType, entityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_services")
        .select("*")
        .eq("linked_entity_type", entityType)
        .eq("linked_entity_id", entityId)
        .eq("is_active", true)
        .single();

      if (error && error.code !== "PGRST116") throw error; // PGRST116 = no rows
      return data;
    },
    enabled: !!entityType && !!entityId,
    staleTime: 60000,
  });
}
