import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const DEFAULT_CREDIT_RATIO = 2;

/**
 * Hook to read the credit-to-EUR ratio from system_settings.
 * The ratio means "N credits = 1 EUR" (default 2).
 */
export function useCreditRatio() {
  const { data: creditRatio, isLoading } = useQuery({
    queryKey: ["system-settings", "credit_to_eur_ratio"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "credit_to_eur_ratio")
        .maybeSingle();

      if (error || !data) return DEFAULT_CREDIT_RATIO;
      return parseFloat(data.value) || DEFAULT_CREDIT_RATIO;
    },
    staleTime: 5 * 60 * 1000,
  });

  return {
    creditRatio: creditRatio ?? DEFAULT_CREDIT_RATIO,
    isLoading,
  };
}

// === Pure utility functions (accept ratio as optional param for flexibility) ===

/** Calculate bonus percentage for a credit package against the base ratio. */
export function calculatePackageBonus(
  priceCents: number,
  creditValue: number,
  ratio: number = DEFAULT_CREDIT_RATIO,
): number {
  if (priceCents === 0) return 0;
  const baseCredits = (priceCents / 100) * ratio;
  if (baseCredits === 0) return 0;
  const bonus = ((creditValue - baseCredits) / baseCredits) * 100;
  return Math.round(bonus);
}

/** Convert a credit amount to its EUR equivalent. */
export function creditsToEur(credits: number, ratio: number = DEFAULT_CREDIT_RATIO): number {
  return credits / ratio;
}

/** Format a credit amount as a EUR currency string. */
export function formatCreditsAsEur(credits: number, ratio: number = DEFAULT_CREDIT_RATIO): string {
  return new Intl.NumberFormat("en-EU", {
    style: "currency",
    currency: "EUR",
  }).format(credits / ratio);
}

/** Format the ratio as human-readable text, e.g. "2 credits = EUR 1". */
export function formatRatioText(ratio: number = DEFAULT_CREDIT_RATIO): string {
  return `${ratio} credits = EUR 1`;
}
