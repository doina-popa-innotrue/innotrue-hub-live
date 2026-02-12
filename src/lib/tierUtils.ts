/**
 * Tier hierarchy utility functions
 *
 * Tiers are defined per-program as an ordered array (e.g., ['Essentials', 'Premium']).
 * Higher-index tiers include access to all lower-index tier content.
 * Example: If tiers = ['Essentials', 'Premium'], Premium users can access Essentials modules.
 */

/**
 * Check if user's tier grants access to a module requiring a specific tier.
 * Uses hierarchical model: higher tiers include all lower tiers.
 *
 * @param programTiers - Ordered array of tier names for the program (lowest to highest)
 * @param userTier - The tier assigned to the user's enrollment
 * @param moduleRequiredTier - The tier required by the module
 * @returns true if user has access, false if locked
 */
export function hasTierAccess(
  programTiers: string[] | null | undefined,
  userTier: string | null | undefined,
  moduleRequiredTier: string | null | undefined,
): boolean {
  // If no tiers defined for program, all content is accessible
  if (!programTiers || programTiers.length === 0) {
    return true;
  }

  // If module has no tier requirement, it's accessible to all
  if (!moduleRequiredTier) {
    return true;
  }

  // If user has no tier assigned, only allow access to first (lowest) tier
  const normalizedUserTier = (userTier || programTiers[0]).toLowerCase();
  const normalizedModuleTier = moduleRequiredTier.toLowerCase();

  // Find indices in the tier hierarchy (case-insensitive)
  const userTierIndex = programTiers.findIndex((t) => t.toLowerCase() === normalizedUserTier);
  const moduleTierIndex = programTiers.findIndex((t) => t.toLowerCase() === normalizedModuleTier);

  // If tiers not found in program definition, be permissive
  if (userTierIndex === -1 || moduleTierIndex === -1) {
    console.warn(
      `Tier not found in program definition. User: ${userTier}, Module: ${moduleRequiredTier}, Program tiers: ${programTiers}`,
    );
    return true;
  }

  // User can access if their tier index >= module's required tier index
  return userTierIndex >= moduleTierIndex;
}

/**
 * Get the display name for a tier (proper case from program definition)
 */
export function getTierDisplayName(
  programTiers: string[] | null | undefined,
  tier: string | null | undefined,
): string {
  if (!tier) return "";
  if (!programTiers || programTiers.length === 0) return tier;

  const index = programTiers.findIndex((t) => t.toLowerCase() === tier.toLowerCase());
  if (index === -1) return tier;

  return `${index + 1}. ${programTiers[index]}`;
}
