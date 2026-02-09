import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCreditBatches } from './useCreditBatches';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface ConsumeResult {
  success: boolean;
  consumed?: number;
  remaining?: number;
  error?: string;
}

/**
 * Hook for consuming add-on credits.
 * 
 * **CONSOLIDATED**: Add-on credits are now stored in `credit_batches` table
 * and consumed via `consume_credits_fifo`. This hook wraps `useCreditBatches`
 * for backward compatibility.
 * 
 * @deprecated Consider using `useCreditBatches` directly for new code.
 */
export function useConsumableAddOns() {
  const { user } = useAuth();
  const { summary, bonusCredits, consume, refetch } = useCreditBatches();

  /**
   * Get the user's current balance for a consumable add-on.
   * Now returns bonus credits from credit_batches.
   */
  const getBalance = useCallback(async (addOnKey: string): Promise<number> => {
    if (!user || !summary) return 0;
    
    // Filter bonus batches by feature key if specific add-on requested
    const relevantBatches = summary.bonus_batches?.filter(
      batch => batch.feature_key === addOnKey || batch.feature_key === null
    ) ?? [];
    
    return relevantBatches.reduce((sum, batch) => sum + batch.remaining, 0);
  }, [user, summary]);

  /**
   * Consume credits from a consumable add-on.
   * Now uses unified consume_credits_fifo under the hood.
   */
  const consumeCredits = useCallback(async (
    addOnKey: string,
    quantity: number = 1,
    actionType: string = 'general',
    actionReferenceId?: string,
    notes?: string
  ): Promise<ConsumeResult> => {
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      const result = await consume(
        quantity,
        addOnKey, // Use add-on key as feature key
        notes,
        actionType,
        actionReferenceId
      );

      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Insufficient credits',
          remaining: result.available,
        };
      }

      return {
        success: true,
        consumed: result.consumed,
        remaining: result.balance_after,
      };
    } catch (error: any) {
      console.error('Error consuming add-on:', error);
      return { success: false, error: error.message };
    }
  }, [user, consume]);

  /**
   * Check if user has sufficient credits for an action
   */
  const hasCredits = useCallback(async (addOnKey: string, requiredAmount: number = 1): Promise<boolean> => {
    const balance = await getBalance(addOnKey);
    return balance >= requiredAmount;
  }, [getBalance]);

  /**
   * Consume credits with user feedback
   */
  const consumeWithFeedback = useCallback(async (
    addOnKey: string,
    actionDescription: string,
    quantity: number = 1,
    actionType: string = 'general',
    actionReferenceId?: string
  ): Promise<boolean> => {
    const result = await consumeCredits(addOnKey, quantity, actionType, actionReferenceId, actionDescription);
    
    if (!result.success) {
      if (result.error === 'Insufficient credits') {
        toast.error(`You don't have enough credits for this action. Remaining: ${result.remaining || 0}`);
      } else {
        toast.error(result.error || 'Failed to use credits');
      }
      return false;
    }

    toast.success(`Used ${result.consumed} credit(s). ${result.remaining} remaining.`);
    return true;
  }, [consumeCredits]);

  return {
    getBalance,
    consumeCredits,
    hasCredits,
    consumeWithFeedback,
  };
}

/**
 * Hook to get the current balance of a specific add-on.
 * Now returns bonus credits from credit_batches filtered by feature key.
 * 
 * @deprecated Consider using `useCreditBatches` directly for new code.
 */
export function useAddOnBalance(addOnKey: string) {
  const { user } = useAuth();
  const { summary, isLoading } = useCreditBatches();

  const balance = summary?.bonus_batches
    ?.filter(batch => batch.feature_key === addOnKey || batch.feature_key === null)
    .reduce((sum, batch) => sum + batch.remaining, 0) ?? 0;

  return {
    data: balance,
    isLoading,
    refetch: () => {}, // Handled by useCreditBatches internally
  };
}
