import { useCallback, useMemo } from 'react';
import { useCreditBatches } from './useCreditBatches';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface CreditBreakdown {
  plan: {
    limit: number | null;
    used: number;
    remaining: number;
    /** Credits rolled over from previous month (capped at plan limit) */
    rollover: number;
    /** Credits remaining from current period only (excluding rollover) */
    current_period_remaining: number;
  };
  program: {
    total: number;
    used: number;
    remaining: number;
  };
  addon: {
    remaining: number;
  };
  total_remaining: number;
}

interface UseUnifiedCreditsResult {
  /** Credit breakdown by source */
  credits: CreditBreakdown | null;
  /** Whether the credits are loading */
  isLoading: boolean;
  /** Total remaining credits across all sources */
  totalRemaining: number;
  /** Whether the user can consume (has any credits) */
  canConsume: boolean;
  /** Whether a consumption action is in progress */
  isConsuming: boolean;
  /**
   * Consume credits. Returns true if successful.
   * Consumes in priority order: Plan → Program → Bonus (Add-on/Purchased)
   */
  consume: (
    quantity?: number,
    actionType?: string,
    actionReferenceId?: string,
    notes?: string
  ) => Promise<boolean>;
  /** Refetch credit balance */
  refetch: () => void;
}

/**
 * Unified hook for managing consumable credits across Plan, Program, and Add-on/Bonus sources.
 * 
 * **CONSOLIDATED**: This hook now wraps `useCreditBatches` for a unified credit system.
 * All credit operations go through `get_user_credit_summary_v2` and `consume_credits_fifo`.
 * 
 * @deprecated Consider using `useCreditBatches` directly for new code.
 * This hook is maintained for backward compatibility with existing components.
 * 
 * Credits are consumed in priority order:
 * 1. Plan credits (renewable monthly, lazy-calculated)
 * 2. Program entitlements (from active enrollments)
 * 3. Bonus credits (add-ons, purchases, grants - stored in credit_batches)
 * 
 * @param featureKey - The feature key to get credits for (used for feature-specific allocations)
 * 
 * @example
 * ```tsx
 * // For new code, prefer useCreditBatches:
 * const { totalAvailable, consume, isLoading } = useCreditBatches();
 * 
 * // Legacy usage (still supported):
 * const { totalRemaining, canConsume, consume } = useUnifiedCredits('mock_sessions');
 * ```
 */
export function useUnifiedCredits(featureKey: string): UseUnifiedCreditsResult {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const {
    summary,
    isLoading,
    refetch,
    planRemaining,
    programRemaining,
    bonusCredits,
    totalAvailable,
    getFeatureCredits,
    canConsume: batchCanConsume,
    consume: batchConsume,
    isConsuming,
  } = useCreditBatches();

  // Transform the new summary format to the legacy CreditBreakdown format
  const credits = useMemo((): CreditBreakdown | null => {
    if (!summary) return null;

    // For feature-specific credits, check allocations
    const featureAllocation = summary.feature_allocations?.[featureKey] ?? 0;
    const featureUsage = summary.feature_usage?.[featureKey] ?? 0;
    
    // If feature has specific allocation, use that; otherwise use general plan credits
    const planLimit = featureAllocation > 0 ? featureAllocation : summary.plan_allowance;
    const planUsed = featureAllocation > 0 ? featureUsage : summary.period_usage;
    const planRemainingCalc = Math.max(0, planLimit - planUsed);
    
    // Get program credits for this specific feature
    const programCreditsForFeature = summary.program_details
      ?.filter(p => p.feature_key === featureKey)
      .reduce((sum, p) => sum + p.remaining, 0) ?? 0;
    const programTotalForFeature = summary.program_details
      ?.filter(p => p.feature_key === featureKey)
      .reduce((sum, p) => sum + p.total, 0) ?? 0;
    const programUsedForFeature = summary.program_details
      ?.filter(p => p.feature_key === featureKey)
      .reduce((sum, p) => sum + p.used, 0) ?? 0;

    return {
      plan: {
        limit: planLimit,
        used: planUsed,
        remaining: planRemainingCalc,
        rollover: 0, // Rollover is now handled via bonus batches
        current_period_remaining: planRemainingCalc,
      },
      program: {
        total: programTotalForFeature || summary.program_total,
        used: programUsedForFeature || summary.program_used,
        remaining: programCreditsForFeature || summary.program_remaining,
      },
      addon: {
        remaining: summary.bonus_credits, // Bonus credits include add-ons now
      },
      total_remaining: planRemainingCalc + (programCreditsForFeature || summary.program_remaining) + summary.bonus_credits,
    };
  }, [summary, featureKey]);

  const totalRemaining = useMemo(() => {
    if (featureKey) {
      return getFeatureCredits(featureKey);
    }
    return totalAvailable;
  }, [featureKey, getFeatureCredits, totalAvailable]);

  const canConsume = totalRemaining > 0;

  const consume = useCallback(
    async (
      quantity: number = 1,
      actionType: string = 'general',
      actionReferenceId?: string,
      notes?: string
    ): Promise<boolean> => {
      if (!user) {
        toast({
          title: 'Not Authenticated',
          description: 'Please sign in to continue.',
          variant: 'destructive',
        });
        return false;
      }

      if (!canConsume || totalRemaining < quantity) {
        toast({
          title: 'Insufficient Credits',
          description: `You need ${quantity} credit(s) but only have ${totalRemaining} available.`,
          variant: 'destructive',
        });
        return false;
      }

      try {
        const result = await batchConsume(
          quantity,
          featureKey || undefined,
          notes,
          actionType,
          actionReferenceId
        );

        if (!result.success) {
          toast({
            title: 'Insufficient Credits',
            description: result.error || 'Not enough credits available.',
            variant: 'destructive',
          });
          return false;
        }

        return true;
      } catch (error) {
        console.error('Failed to consume credits:', error);
        toast({
          title: 'Error',
          description: 'An unexpected error occurred. Please try again.',
          variant: 'destructive',
        });
        return false;
      }
    },
    [user, canConsume, totalRemaining, featureKey, batchConsume, toast]
  );

  return {
    credits,
    isLoading,
    totalRemaining,
    canConsume,
    isConsuming,
    consume,
    refetch,
  };
}
