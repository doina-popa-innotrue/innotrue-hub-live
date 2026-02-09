import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useOrgCreditBatches } from './useCreditBatches';

/**
 * Legacy interface maintained for backward compatibility.
 * @deprecated Use useOrgCreditBatches for new code.
 */
interface OrgCreditSummary {
  available_credits: number;
  total_purchased: number;
  total_consumed: number;
  reserved_credits: number;
  expiring_soon: number;
  has_platform_subscription: boolean;
  subscription_status: string | null;
  subscription_ends: string | null;
}

interface CreditPackage {
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
}

interface PlatformTier {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  annual_fee_cents: number;
  monthly_fee_cents: number | null;
  currency: string;
  features: string[];
  max_members: number | null;
  max_sponsored_seats: number | null;
  includes_analytics: boolean;
  display_order: number;
  is_active: boolean;
}

interface CreditTransaction {
  id: string;
  transaction_type: string;
  amount: number;
  balance_after: number;
  description: string | null;
  created_at: string;
}

/**
 * Hook for organization credit management.
 * 
 * **CONSOLIDATED**: Now uses `useOrgCreditBatches` internally for credit calculations.
 * Legacy API maintained for backward compatibility.
 * 
 * @deprecated Consider using `useOrgCreditBatches` directly for new code.
 */
export function useOrgCredits(organizationId: string | undefined) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Use the consolidated org credit batches hook
  const {
    summary: batchSummary,
    isLoading: batchLoading,
    refetch: refetchBatch,
    totalAvailable,
    planRemaining,
    bonusCredits,
    expiringCredits,
  } = useOrgCreditBatches(organizationId);

  // Transform batch summary to legacy format for backward compatibility
  const summary: OrgCreditSummary | null = batchSummary ? {
    available_credits: totalAvailable,
    total_purchased: bonusCredits,
    total_consumed: batchSummary.period_usage ?? 0,
    reserved_credits: 0,
    expiring_soon: expiringCredits,
    has_platform_subscription: !!batchSummary.plan_name,
    subscription_status: batchSummary.plan_name ? 'active' : null,
    subscription_ends: batchSummary.period_end,
  } : null;

  // Fetch available credit packages
  const { data: packages, isLoading: packagesLoading } = useQuery({
    queryKey: ['org-credit-packages'],
    queryFn: async (): Promise<CreditPackage[]> => {
      const { data, error } = await supabase
        .from('org_credit_packages')
        .select('*')
        .eq('is_active', true)
        .order('display_order');

      if (error) {
        console.error('Error fetching packages:', error);
        return [];
      }

      return data as CreditPackage[];
    },
    enabled: !!user,
  });

  // Fetch platform tiers
  const { data: tiers, isLoading: tiersLoading } = useQuery({
    queryKey: ['org-platform-tiers'],
    queryFn: async (): Promise<PlatformTier[]> => {
      const { data, error } = await supabase
        .from('org_platform_tiers')
        .select('*')
        .eq('is_active', true)
        .order('display_order');

      if (error) {
        console.error('Error fetching tiers:', error);
        return [];
      }

      return (data || []).map(tier => ({
        ...tier,
        features: Array.isArray(tier.features) ? tier.features : [],
      })) as PlatformTier[];
    },
    enabled: !!user,
  });

  // Fetch recent transactions
  const { data: transactions, isLoading: transactionsLoading } = useQuery({
    queryKey: ['org-credit-transactions', organizationId],
    queryFn: async (): Promise<CreditTransaction[]> => {
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from('org_credit_transactions')
        .select('id, transaction_type, amount, balance_after, description, created_at')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching transactions:', error);
        return [];
      }

      return data as CreditTransaction[];
    },
    enabled: !!organizationId && !!user,
  });

  // Purchase credits mutation
  const purchaseCredits = useMutation({
    mutationFn: async (packageId: string) => {
      if (!organizationId) throw new Error('No organization selected');

      const { data, error } = await supabase.functions.invoke('org-purchase-credits', {
        body: { organizationId, packageId },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      return data;
    },
    onSuccess: (data) => {
      if (data.url) {
        window.open(data.url, '_blank');
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to initiate purchase',
        variant: 'destructive',
      });
    },
  });

  // Subscribe to platform mutation
  const subscribePlatform = useMutation({
    mutationFn: async ({ tierId, billingPeriod }: { tierId: string; billingPeriod: 'annual' | 'monthly' }) => {
      if (!organizationId) throw new Error('No organization selected');

      const { data, error } = await supabase.functions.invoke('org-platform-subscription', {
        body: { organizationId, tierId, billingPeriod },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      return data;
    },
    onSuccess: (data) => {
      if (data.url) {
        window.open(data.url, '_blank');
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to initiate subscription',
        variant: 'destructive',
      });
    },
  });

  // Confirm credit purchase (call after return from Stripe)
  const confirmPurchase = useMutation({
    mutationFn: async (sessionId: string) => {
      if (!organizationId) throw new Error('No organization selected');

      const { data, error } = await supabase.functions.invoke('org-confirm-credit-purchase', {
        body: { sessionId, organizationId },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      return data;
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: 'Credits Added!',
          description: `${data.creditsAdded.toLocaleString()} credits have been added to your account.`,
        });
        queryClient.invalidateQueries({ queryKey: ['org-credit-summary', organizationId] });
        queryClient.invalidateQueries({ queryKey: ['org-credit-transactions', organizationId] });
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to confirm purchase',
        variant: 'destructive',
      });
    },
  });

  return {
    summary,
    packages,
    tiers,
    transactions,
    isLoading: batchLoading || packagesLoading || tiersLoading,
    transactionsLoading,
    purchaseCredits: purchaseCredits.mutate,
    isPurchasing: purchaseCredits.isPending,
    subscribePlatform: subscribePlatform.mutate,
    isSubscribing: subscribePlatform.isPending,
    confirmPurchase: confirmPurchase.mutate,
    isConfirming: confirmPurchase.isPending,
    refetch: refetchBatch,
  };
}

// Utility to format credits with thousands separator
export function formatCredits(credits: number): string {
  return credits.toLocaleString();
}

// Utility to format price from cents
export function formatPrice(cents: number, currency: string = 'EUR'): string {
  return new Intl.NumberFormat('en-EU', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

// Calculate bonus percentage
export function calculateBonus(priceCents: number, creditValue: number): number {
  if (priceCents === 0) return 0;
  const baseCredits = priceCents; // 1 cent = 1 credit base
  const bonus = ((creditValue - baseCredits) / baseCredits) * 100;
  return Math.round(bonus);
}
