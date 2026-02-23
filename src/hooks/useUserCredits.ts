import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useCreditBatches } from "./useCreditBatches";

/**
 * Legacy interface maintained for backward compatibility.
 * The actual data now comes from useCreditBatches.
 */
interface UserCreditSummary {
  available_credits: number;
  total_received: number;
  total_consumed: number;
  reserved_credits: number;
  expiring_soon: number;
  has_credit_plan: boolean;
  plan_name: string | null;
  plan_credit_allowance: number | null;
  program_credit_allowance: number | null;
  total_allowance: number | null;
}

interface TopupPackage {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price_cents: number;
  credit_value: number;
  currency: string;
  validity_months: number | null;
  display_order: number;
  is_active: boolean;
  is_featured: boolean;
}

interface CreditTransaction {
  id: string;
  transaction_type: string;
  amount: number;
  balance_after: number;
  description: string | null;
  action_type: string | null;
  created_at: string;
}

/**
 * Hook for user credit management.
 *
 * **CONSOLIDATED**: Now uses `useCreditBatches` internally for credit calculations.
 * All credit operations go through `get_user_credit_summary_v2` and `consume_credits_fifo`.
 * Legacy API maintained for backward compatibility.
 *
 * @deprecated Consider using `useCreditBatches` directly for new code.
 * This hook is maintained for backward compatibility with existing components.
 *
 * @example
 * ```tsx
 * // For new code, prefer useCreditBatches:
 * const { totalAvailable, consume, summary } = useCreditBatches();
 *
 * // Legacy usage (still supported):
 * const { availableCredits, consumeCredits } = useUserCredits();
 * ```
 */
export function useUserCredits() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Use the consolidated credit batches hook
  const {
    summary: batchSummary,
    isLoading: batchLoading,
    refetch: refetchBatch,
    totalAvailable,
    planRemaining,
    programRemaining,
    bonusCredits,
    expiringCredits,
    consume: batchConsume,
    isConsuming: batchConsuming,
  } = useCreditBatches();

  // Transform batch summary to legacy format for backward compatibility
  const summary: UserCreditSummary | null = batchSummary
    ? {
        available_credits: totalAvailable,
        total_received: batchSummary.plan_allowance + bonusCredits + programRemaining,
        total_consumed: batchSummary.period_usage + batchSummary.program_used,
        reserved_credits: 0, // No longer tracked separately
        expiring_soon: expiringCredits,
        has_credit_plan: !!batchSummary.plan_name,
        plan_name: batchSummary.plan_name,
        plan_credit_allowance: batchSummary.plan_allowance,
        program_credit_allowance: programRemaining,
        total_allowance: batchSummary.plan_allowance + programRemaining,
      }
    : null;

  // Fetch available top-up packages
  const { data: packages, isLoading: packagesLoading } = useQuery({
    queryKey: ["credit-topup-packages"],
    queryFn: async (): Promise<TopupPackage[]> => {
      const { data, error } = await supabase
        .from("credit_topup_packages")
        .select("*")
        .eq("is_active", true)
        .order("display_order");

      if (error) {
        console.error("Error fetching packages:", error);
        return [];
      }

      return data as TopupPackage[];
    },
    enabled: !!user,
  });

  // Fetch recent transactions
  const { data: transactions, isLoading: transactionsLoading } = useQuery({
    queryKey: ["user-credit-transactions", user?.id],
    queryFn: async (): Promise<CreditTransaction[]> => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("user_credit_transactions")
        .select("id, transaction_type, amount, balance_after, description, action_type, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error("Error fetching transactions:", error);
        return [];
      }

      return data as CreditTransaction[];
    },
    enabled: !!user,
  });

  // Purchase top-up mutation
  const purchaseTopup = useMutation({
    mutationFn: async (packageId: string) => {
      const { data, error } = await supabase.functions.invoke("purchase-credit-topup", {
        body: { packageId },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      return data;
    },
    onSuccess: (data) => {
      if (data.url) {
        window.open(data.url, "_blank");
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to initiate purchase",
        variant: "destructive",
      });
    },
  });

  // Confirm purchase (call after return from Stripe)
  const confirmTopup = useMutation({
    mutationFn: async (sessionId: string) => {
      const { data, error } = await supabase.functions.invoke("confirm-credit-topup", {
        body: { sessionId },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      return data;
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Credits Added!",
          description: `${data.creditsAdded.toLocaleString()} credits have been added to your account.`,
        });
        queryClient.invalidateQueries({ queryKey: ["user-credit-summary"] });
        queryClient.invalidateQueries({ queryKey: ["user-credit-transactions"] });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to confirm purchase",
        variant: "destructive",
      });
    },
  });

  // Consume credits - now uses unified consume_credits_fifo
  const consumeCreditsInternal = async ({
    amount,
    actionType,
    actionReferenceId,
    description,
  }: {
    amount: number;
    actionType?: string;
    actionReferenceId?: string;
    description?: string;
  }) => {
    if (!user) throw new Error("Not authenticated");

    const result = await batchConsume(
      amount,
      undefined, // No specific feature key
      description,
      actionType,
      actionReferenceId,
    );

    if (!result.success) {
      throw new Error(result.error || "Insufficient credits");
    }

    return result;
  };

  // Enroll in program using credits
  const enrollWithCredits = useMutation({
    mutationFn: async (programId: string) => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase.rpc("enroll_with_user_credits", {
        p_user_id: user.id,
        p_program_id: programId,
      });

      if (error) throw error;
      return data as {
        success: boolean;
        error?: string;
        credits_consumed?: number;
        balance_after?: number;
        enrollment_id?: string;
        free_enrollment?: boolean;
      };
    },
    onSuccess: (data) => {
      if (data?.success) {
        queryClient.invalidateQueries({ queryKey: ["user-credit-summary"] });
        queryClient.invalidateQueries({ queryKey: ["user-credit-transactions"] });
        queryClient.invalidateQueries({ queryKey: ["enrollments"] });

        if (data.free_enrollment) {
          toast({
            title: "Enrolled!",
            description: "You have been enrolled in the program.",
          });
        } else {
          toast({
            title: "Enrolled!",
            description: `You used ${data.credits_consumed} credits. Remaining balance: ${data.balance_after}`,
          });
        }
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Enrollment Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    summary,
    packages,
    transactions,
    isLoading: batchLoading || packagesLoading,
    transactionsLoading,
    availableCredits: summary?.available_credits ?? 0,
    hasCredits: (summary?.available_credits ?? 0) > 0,
    purchaseTopup: purchaseTopup.mutate,
    isPurchasing: purchaseTopup.isPending,
    confirmTopup: confirmTopup.mutate,
    isConfirming: confirmTopup.isPending,
    consumeCredits: consumeCreditsInternal,
    isConsuming: batchConsuming,
    enrollWithCredits: enrollWithCredits.mutateAsync,
    isEnrolling: enrollWithCredits.isPending,
    refetch: refetchBatch,
  };
}

// Utility to format credits
export function formatCredits(credits: number): string {
  return credits.toLocaleString();
}

// Utility to format price from cents
export function formatPriceFromCents(cents: number, currency: string = "EUR"): string {
  return new Intl.NumberFormat("en-EU", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

// Calculate bonus percentage for a package (2:1 ratio: 1 EUR = 2 credits)
export function calculatePackageBonus(priceCents: number, creditValue: number): number {
  if (priceCents === 0) return 0;
  // Base: €1 = 2 credits, so base credits = (price in cents / 100) * 2
  const baseCredits = (priceCents / 100) * 2;
  if (baseCredits === 0) return 0;
  const bonus = ((creditValue - baseCredits) / baseCredits) * 100;
  return Math.round(bonus);
}

// Convert credits to EUR equivalent (2:1 ratio)
export function creditsToEur(credits: number): number {
  return credits / 2;
}

// Format credits as EUR equivalent
export function formatCreditsAsEur(credits: number): string {
  return new Intl.NumberFormat("en-EU", {
    style: "currency",
    currency: "EUR",
  }).format(credits / 2);
}
