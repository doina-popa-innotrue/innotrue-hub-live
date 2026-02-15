/**
 * Pure utilities for credit balance calculations, formatting, and deductions.
 * Used by useUserCredits, useCreditBatches, and UI components.
 */

/**
 * Format a credit amount with thousands separator.
 */
export function formatCredits(credits: number): string {
  return credits.toLocaleString();
}

/**
 * Format price from cents to a currency string.
 */
export function formatPriceFromCents(cents: number, currency: string = "EUR"): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

/**
 * Calculate bonus percentage for a credit top-up package.
 * Base: €1 = 1 credit (price in cents / 100 = base credits).
 */
export function calculatePackageBonus(priceCents: number, creditValue: number): number {
  if (priceCents === 0) return 0;
  const baseCredits = priceCents / 100;
  if (baseCredits === 0) return 0;
  const bonus = ((creditValue - baseCredits) / baseCredits) * 100;
  return Math.round(bonus);
}

/**
 * Check if current balance is sufficient for a deduction.
 */
export function hasSufficientCredits(balance: number, amount: number): boolean {
  if (amount <= 0) return true;
  return balance >= amount;
}

/**
 * Return remaining balance after deducting amount; never below zero.
 */
export function remainingAfterDeduction(balance: number, amount: number): number {
  if (amount <= 0) return balance;
  return Math.max(0, balance - amount);
}

/**
 * Compute total available credits from a summary-like shape (for testing / pure calc).
 * Plan remaining + program remaining + bonus.
 */
export function totalAvailableFromBreakdown(breakdown: {
  planRemaining: number;
  programRemaining: number;
  bonusCredits: number;
}): number {
  return (
    (breakdown.planRemaining ?? 0) +
    (breakdown.programRemaining ?? 0) +
    (breakdown.bonusCredits ?? 0)
  );
}
