import { useState, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCombinedFeatureAccess } from '@/hooks/useCombinedFeatureAccess';
import { useToast } from '@/hooks/use-toast';
import { useCreditBatches } from '@/hooks/useCreditBatches';
import { useCreditService } from '@/hooks/useCreditService';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface CreditServiceByFeature {
  found: boolean;
  service_id?: string;
  service_name?: string;
  base_cost?: number;
  effective_cost?: number;
  has_track_discount?: boolean;
  category?: string;
}

interface UseConsumableFeatureResult {
  /** Whether the user has access to this feature */
  hasAccess: boolean;
  /** Whether the feature check is loading */
  isLoading: boolean;
  /** Remaining uses (null = unlimited) - aggregated across plan/program/bonus */
  remaining: number | null;
  /** Current usage this period (plan-based only) */
  used: number;
  /** Monthly limit from plan (null = unlimited) */
  limit: number | null;
  /** Whether a consumption action is in progress */
  isConsuming: boolean;
  /** 
   * Consume one use of the feature. Returns true if successful.
   * Uses credit service if configured, otherwise falls back to unified credits.
   */
  consume: () => Promise<boolean>;
  /**
   * Check if the user can consume (has remaining uses).
   * Does not actually consume.
   */
  canConsume: boolean;
  /** Detailed credit breakdown by source */
  creditBreakdown: {
    plan: number;
    program: number;
    addon: number;
  } | null;
  /** Credit service info if this feature is linked to a credit service */
  creditService: CreditServiceByFeature | null;
  /** The effective cost of this feature (from credit service or 1) */
  effectiveCost: number;
}

/**
 * Hook for managing consumable features with unified credits.
 * 
 * **CONSOLIDATED**: Now uses `useCreditBatches` directly instead of `useUnifiedCredits`.
 * 
 * This hook checks for credit_services first:
 * 1. If a credit_service is linked to the feature, use its cost and consume from user credits
 * 2. Otherwise, fall back to plan/program/bonus credits via useCreditBatches
 * 
 * This allows admins to configure feature costs through the UI without code changes.
 * 
 * @example
 * ```tsx
 * function AIAnalysisButton() {
 *   const { canConsume, consume, remaining, isLoading, effectiveCost } = useConsumableFeature('ai_insights');
 * 
 *   const handleClick = async () => {
 *     const success = await consume();
 *     if (success) {
 *       await runAIAnalysis();
 *     }
 *   };
 * 
 *   if (isLoading) return <Skeleton />;
 * 
 *   return (
 *     <Button onClick={handleClick} disabled={!canConsume}>
 *       Run AI Analysis ({effectiveCost} credits)
 *     </Button>
 *   );
 * }
 * ```
 */
export function useConsumableFeature(featureKey: string): UseConsumableFeatureResult {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isConsuming, setIsConsuming] = useState(false);
  
  // Check if there's a credit service linked to this feature
  const { data: creditService, isLoading: serviceLoading } = useQuery({
    queryKey: ['credit-service-by-feature', featureKey, user?.id],
    queryFn: async (): Promise<CreditServiceByFeature | null> => {
      if (!user) return null;
      
      const { data, error } = await supabase.rpc('get_credit_service_by_feature', {
        p_user_id: user.id,
        p_feature_key: featureKey,
      });
      
      if (error) {
        console.error('Error fetching credit service by feature:', error);
        return null;
      }
      
      return data as unknown as CreditServiceByFeature;
    },
    enabled: !!user && !!featureKey,
    staleTime: 60000, // 1 minute
  });
  
  // Use the credit service consume function
  const { consume: consumeService } = useCreditService();
  
  // Use consolidated credit batches for all credit operations
  const { 
    summary,
    isLoading: batchLoading, 
    totalAvailable,
    planRemaining,
    programRemaining,
    bonusCredits,
    getFeatureCredits,
    consume: batchConsume,
    isConsuming: batchConsuming,
  } = useCreditBatches();
  
  // Also check combined feature access for hasAccess flag
  const { hasAccess, isLoading: accessLoading, limit } = useCombinedFeatureAccess(featureKey);

  // Determine if we should use credit service or batch credits
  const useCreditServiceFlow = creditService?.found === true;

  const isLoading = serviceLoading || batchLoading || accessLoading;
  
  // Calculate effective cost and remaining
  const effectiveCost = useCreditServiceFlow ? (creditService?.effective_cost ?? 1) : 1;
  
  const remaining = useMemo(() => {
    if (useCreditServiceFlow) {
      // For credit service flow, remaining is based on total available credits
      return Math.floor(totalAvailable / effectiveCost);
    }
    // For feature-specific credits
    const featureCredits = getFeatureCredits(featureKey);
    return featureCredits > 0 ? featureCredits : (hasAccess ? null : 0);
  }, [useCreditServiceFlow, totalAvailable, effectiveCost, getFeatureCredits, featureKey, hasAccess]);
  
  // User can consume if they have access AND have enough credits
  const canConsume = useMemo(() => {
    if (!hasAccess) return false;
    if (useCreditServiceFlow) {
      return totalAvailable >= effectiveCost;
    }
    const featureCredits = getFeatureCredits(featureKey);
    return featureCredits >= 1 || limit === null; // Unlimited if no limit set
  }, [hasAccess, useCreditServiceFlow, totalAvailable, effectiveCost, getFeatureCredits, featureKey, limit]);
  
  // Build credit breakdown
  const creditBreakdown = summary ? {
    plan: planRemaining,
    program: programRemaining,
    addon: bonusCredits,
  } : null;

  const consume = useCallback(async (): Promise<boolean> => {
    if (!user) {
      toast({
        title: 'Not Authenticated',
        description: 'Please sign in to continue.',
        variant: 'destructive',
      });
      return false;
    }
    
    if (!canConsume) {
      toast({
        title: 'Insufficient Credits',
        description: `You need ${effectiveCost} credit(s) to use this feature.`,
        variant: 'destructive',
      });
      return false;
    }
    
    setIsConsuming(true);
    
    try {
      if (useCreditServiceFlow && creditService?.service_id) {
        // Use credit service consumption
        const result = await consumeService(
          creditService.service_id,
          `Feature usage: ${featureKey}`
        );
        
        if (result?.success) {
          return true;
        } else {
          toast({
            title: 'Error',
            description: result?.error || 'Failed to consume credits.',
            variant: 'destructive',
          });
          return false;
        }
      } else {
        // Use unified batch credits
        const result = await batchConsume(
          1,
          featureKey,
          `Feature usage: ${featureKey}`,
          'feature_usage'
        );
        
        if (result.success) {
          return true;
        } else {
          toast({
            title: 'Insufficient Credits',
            description: result.error || 'Not enough credits available.',
            variant: 'destructive',
          });
          return false;
        }
      }
    } catch (error) {
      console.error('Error consuming feature:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsConsuming(false);
    }
  }, [user, canConsume, effectiveCost, useCreditServiceFlow, creditService, consumeService, featureKey, batchConsume, toast]);

  return {
    hasAccess,
    isLoading,
    remaining,
    used: summary?.period_usage ?? 0,
    limit,
    isConsuming: isConsuming || batchConsuming,
    consume,
    canConsume,
    creditBreakdown,
    creditService: creditService ?? null,
    effectiveCost,
  };
}
