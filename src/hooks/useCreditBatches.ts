import { useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface BonusBatch {
  id: string;
  feature_key: string | null;
  remaining: number;
  original: number;
  expires_at: string;
  source_type: string;
  description: string | null;
}

interface ProgramCredit {
  program_id: string;
  program_name: string;
  feature_key: string;
  total: number;
  used: number;
  remaining: number;
}

interface CreditSummary {
  /** Name of the user's plan */
  plan_name: string | null;
  /** Monthly plan allowance */
  plan_allowance: number;
  /** Current billing period start */
  period_start: string;
  /** Current billing period end */
  period_end: string;
  /** Credits used this period (general) */
  period_usage: number;
  /** Remaining plan credits for this period */
  plan_remaining: number;
  /** Feature-specific allocations: { feature_key: monthly_amount } */
  feature_allocations: Record<string, number>;
  /** Feature-specific usage this period: { feature_key: used_amount } */
  feature_usage: Record<string, number>;
  /** Total program entitlement credits */
  program_total: number;
  /** Program credits used */
  program_used: number;
  /** Remaining program credits */
  program_remaining: number;
  /** Program credit details by enrollment */
  program_details: ProgramCredit[];
  /** Total bonus/purchased credits available */
  bonus_credits: number;
  /** Bonus credit batches */
  bonus_batches: BonusBatch[];
  /** Bonus credits expiring within 7 days */
  expiring_soon: number;
  /** Earliest expiry date for bonus batches */
  earliest_expiry: string | null;
  /** Total available credits (plan + program + bonus) */
  total_available: number;
}

interface OrgCreditSummary {
  plan_name: string | null;
  plan_allowance: number;
  period_start: string;
  period_end: string;
  period_usage: number;
  plan_remaining: number;
  bonus_credits: number;
  bonus_batches: BonusBatch[];
  expiring_soon: number;
  earliest_expiry: string | null;
  total_available: number;
}

interface ConsumeResult {
  success: boolean;
  consumed?: number;
  from_plan?: number;
  from_program?: number;
  from_bonus?: number;
  balance_after?: number;
  batches_used?: { batch_id: string; amount: number }[];
  error?: string;
  available?: number;
  required?: number;
  breakdown?: {
    plan: number;
    program: number;
    bonus: number;
  };
}

interface ConsumeResult {
  success: boolean;
  consumed?: number;
  from_plan?: number;
  from_bonus?: number;
  balance_after?: number;
  batches_used?: { batch_id: string; amount: number }[];
  error?: string;
  available?: number;
  required?: number;
}

/**
 * Unified hook for managing user credits with lazy calculation.
 * 
 * Credits are calculated on-demand:
 * - Plan credits: Monthly allowance minus usage this billing period
 * - Bonus credits: Manual grants, purchases, rollovers (stored in batches)
 * 
 * This approach scales to millions of users without requiring cron jobs.
 * 
 * @example
 * ```tsx
 * function CreditDisplay() {
 *   const { summary, consume, isLoading } = useCreditBatches();
 * 
 *   const handleUseAI = async () => {
 *     const result = await consume(5, 'ai_insights', 'Used AI analysis');
 *     if (result.success) {
 *       toast.success('Credits consumed!');
 *     }
 *   };
 * 
 *   if (isLoading) return <Skeleton />;
 * 
 *   return (
 *     <div>
 *       <p>Plan: {summary?.plan_remaining} / {summary?.plan_allowance}</p>
 *       <p>Bonus: {summary?.bonus_credits}</p>
 *       <p>Total: {summary?.total_available}</p>
 *       <Button onClick={handleUseAI}>Use 5 AI credits</Button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useCreditBatches() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch user credit summary using lazy calculation
  const { 
    data: summary, 
    isLoading, 
    refetch 
  } = useQuery({
    queryKey: ['credit-batches-summary', user?.id],
    queryFn: async (): Promise<CreditSummary | null> => {
      if (!user) return null;

      const { data, error } = await supabase.rpc('get_user_credit_summary_v2', {
        p_user_id: user.id,
      });

      if (error) {
        console.error('Error fetching credit summary:', error);
        return null;
      }

      return data as unknown as CreditSummary;
    },
    enabled: !!user,
    staleTime: 30000, // 30 seconds
  });

  // Get available credits for a specific feature (plan + program + bonus)
  const getFeatureCredits = useCallback((featureKey: string): number => {
    if (!summary) return 0;
    
    // Feature-specific allocation minus usage
    const allocation = summary.feature_allocations?.[featureKey] ?? 0;
    const usage = summary.feature_usage?.[featureKey] ?? 0;
    const featureRemaining = Math.max(0, allocation - usage);
    
    // Plus general plan credits (if no feature-specific allocation)
    const planCredits = allocation > 0 ? 0 : summary.plan_remaining;
    
    // Plus program credits for this feature
    const programCredits = summary.program_details
      ?.filter(p => p.feature_key === featureKey)
      .reduce((sum, p) => sum + p.remaining, 0) ?? 0;
    
    // Plus bonus credits (feature-specific or general)
    const bonusCredits = summary.bonus_credits ?? 0;
    
    return featureRemaining + planCredits + programCredits + bonusCredits;
  }, [summary]);

  // Check if user can consume a specific amount for a feature
  const canConsume = useCallback((amount: number, featureKey?: string): boolean => {
    if (!summary) return false;
    if (featureKey) {
      return getFeatureCredits(featureKey) >= amount;
    }
    return summary.total_available >= amount;
  }, [summary, getFeatureCredits]);

  // Consume credits mutation
  const consumeMutation = useMutation({
    mutationFn: async ({
      amount,
      featureKey,
      actionType,
      actionReferenceId,
      description,
    }: {
      amount: number;
      featureKey?: string;
      actionType?: string;
      actionReferenceId?: string;
      description?: string;
    }): Promise<ConsumeResult> => {
      if (!user) {
        return { success: false, error: 'Not authenticated' };
      }

      const { data, error } = await supabase.rpc('consume_credits_fifo', {
        p_owner_type: 'user',
        p_owner_id: user.id,
        p_amount: amount,
        p_feature_key: featureKey || undefined,
        p_action_type: actionType || 'general',
        p_action_reference_id: actionReferenceId || undefined,
        p_description: description || undefined,
      });

      if (error) {
        throw new Error(error.message);
      }

      return data as unknown as ConsumeResult;
    },
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['credit-batches-summary'] });
        queryClient.invalidateQueries({ queryKey: ['user-credit-transactions'] });
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Consume credits helper
  const consume = useCallback(async (
    amount: number,
    featureKey?: string,
    description?: string,
    actionType?: string,
    actionReferenceId?: string,
  ): Promise<ConsumeResult> => {
    return consumeMutation.mutateAsync({
      amount,
      featureKey,
      actionType,
      actionReferenceId,
      description,
    });
  }, [consumeMutation]);

  // Batches expiring soon
  const expiringBatches = useMemo(() => {
    if (!summary?.bonus_batches) return [];
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    
    return summary.bonus_batches.filter(batch => 
      new Date(batch.expires_at) <= sevenDaysFromNow
    );
  }, [summary?.bonus_batches]);

  // Days until period reset
  const daysUntilReset = useMemo(() => {
    if (!summary?.period_end) return null;
    const periodEnd = new Date(summary.period_end);
    const today = new Date();
    const diffTime = periodEnd.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }, [summary?.period_end]);

  return {
    /** User credit summary with plan, program, and bonus details */
    summary,
    /** Whether data is loading */
    isLoading,
    /** Refetch credit data */
    refetch,
    /** Remaining plan credits for this period */
    planRemaining: summary?.plan_remaining ?? 0,
    /** Total program credits remaining */
    programRemaining: summary?.program_remaining ?? 0,
    /** Program credit details by enrollment */
    programDetails: summary?.program_details ?? [],
    /** Total bonus credits available */
    bonusCredits: summary?.bonus_credits ?? 0,
    /** Total available credits (plan + program + bonus) */
    totalAvailable: summary?.total_available ?? 0,
    /** Feature-specific allocations map */
    featureAllocations: summary?.feature_allocations ?? {},
    /** Feature-specific usage map */
    featureUsage: summary?.feature_usage ?? {},
    /** Bonus credits expiring within 7 days */
    expiringCredits: summary?.expiring_soon ?? 0,
    /** Bonus batches expiring within 7 days */
    expiringBatches,
    /** Days until billing period resets */
    daysUntilReset,
    /** Get credits available for a specific feature (plan + program + bonus) */
    getFeatureCredits,
    /** Check if user can consume amount */
    canConsume,
    /** Consume credits with priority: Plan → Program → Bonus (FIFO) */
    consume,
    /** Whether consumption is in progress */
    isConsuming: consumeMutation.isPending,
  };
}

/**
 * Hook for managing organization credit batches with lazy calculation.
 */
export function useOrgCreditBatches(organizationId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { 
    data: summary, 
    isLoading, 
    refetch 
  } = useQuery({
    queryKey: ['org-credit-batches-summary', organizationId],
    queryFn: async (): Promise<OrgCreditSummary | null> => {
      if (!organizationId) return null;

      const { data, error } = await supabase.rpc('get_org_credit_summary_v2', {
        p_org_id: organizationId,
      });

      if (error) {
        console.error('Error fetching org credit summary:', error);
        return null;
      }

      return data as unknown as OrgCreditSummary;
    },
    enabled: !!organizationId && !!user,
    staleTime: 30000,
  });

  const consumeMutation = useMutation({
    mutationFn: async ({
      amount,
      description,
    }: {
      amount: number;
      description?: string;
    }): Promise<ConsumeResult> => {
      if (!organizationId) {
        return { success: false, error: 'No organization selected' };
      }

      const { data, error } = await supabase.rpc('consume_credits_fifo', {
        p_owner_type: 'org',
        p_owner_id: organizationId,
        p_amount: amount,
        p_feature_key: undefined,
        p_action_type: 'general',
        p_action_reference_id: undefined,
        p_description: description || undefined,
      });

      if (error) {
        throw new Error(error.message);
      }

      return data as unknown as ConsumeResult;
    },
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['org-credit-batches-summary', organizationId] });
        queryClient.invalidateQueries({ queryKey: ['org-credit-transactions', organizationId] });
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const consume = useCallback(async (
    amount: number,
    description?: string,
  ): Promise<ConsumeResult> => {
    return consumeMutation.mutateAsync({ amount, description });
  }, [consumeMutation]);

  return {
    summary,
    isLoading,
    refetch,
    planRemaining: summary?.plan_remaining ?? 0,
    bonusCredits: summary?.bonus_credits ?? 0,
    totalAvailable: summary?.total_available ?? 0,
    expiringCredits: summary?.expiring_soon ?? 0,
    consume,
    isConsuming: consumeMutation.isPending,
  };
}

/**
 * Admin hook for granting bonus credit batches.
 * Use this for manual grants, promotional credits, and purchases.
 */
export function useGrantCreditBatch() {
  const queryClient = useQueryClient();

  const grantMutation = useMutation({
    mutationFn: async ({
      ownerType,
      ownerId,
      amount,
      expiresAt,
      sourceType,
      featureKey,
      description,
    }: {
      ownerType: 'user' | 'org';
      ownerId: string;
      amount: number;
      expiresAt: Date;
      sourceType: string;
      featureKey?: string;
      description?: string;
    }): Promise<string> => {
      const { data, error } = await supabase.rpc('grant_credit_batch', {
        p_owner_type: ownerType,
        p_owner_id: ownerId,
        p_amount: amount,
        p_expires_at: expiresAt.toISOString(),
        p_source_type: sourceType,
        p_feature_key: featureKey || undefined,
        p_source_reference_id: undefined,
        p_description: description || undefined,
      });

      if (error) {
        throw new Error(error.message);
      }

      return data as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit-batches-summary'] });
      queryClient.invalidateQueries({ queryKey: ['org-credit-batches-summary'] });
      toast.success('Credits granted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  return {
    grant: grantMutation.mutateAsync,
    isGranting: grantMutation.isPending,
  };
}

// ============ Utility Functions ============

/**
 * Format a credit amount with thousands separator.
 */
export function formatCredits(credits: number): string {
  return credits.toLocaleString();
}

/**
 * Format price in cents to a currency string.
 */
export function formatPrice(cents: number, currency: string = 'EUR'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/**
 * Calculate bonus percentage for credit packages.
 */
export function calculateBonus(priceCents: number, creditValue: number): number {
  if (priceCents <= 0) return 0;
  const baseRate = 100; // 1 credit = 1 cent baseline
  const expectedCredits = priceCents / baseRate;
  if (creditValue <= expectedCredits) return 0;
  return Math.round(((creditValue - expectedCredits) / expectedCredits) * 100);
}
