import { describe, it, expect } from "vitest";
import { isMaxPlanTier } from "@/lib/planUtils";

describe("isMaxPlanTier", () => {
  const plans = [
    { tier_level: 0, is_purchasable: true },
    { tier_level: 1, is_purchasable: true },
    { tier_level: 2, is_purchasable: true },
    { tier_level: 3, is_purchasable: false }, // admin-assigned, not purchasable
  ];

  it("returns true when user is on the highest purchasable tier", () => {
    expect(isMaxPlanTier(2, plans)).toBe(true);
  });

  it("returns true when user tier exceeds all purchasable tiers", () => {
    expect(isMaxPlanTier(3, plans)).toBe(true);
  });

  it("returns false when user is on a lower tier", () => {
    expect(isMaxPlanTier(1, plans)).toBe(false);
  });

  it("returns false when user is on the lowest tier", () => {
    expect(isMaxPlanTier(0, plans)).toBe(false);
  });

  it("returns false when user tier is null (no plan)", () => {
    expect(isMaxPlanTier(null, plans)).toBe(false);
  });

  it("returns true when no purchasable plans exist", () => {
    const nonPurchasable = [
      { tier_level: 1, is_purchasable: false },
      { tier_level: 2, is_purchasable: false },
    ];
    expect(isMaxPlanTier(0, nonPurchasable)).toBe(true);
  });

  it("returns true when plans array is empty", () => {
    expect(isMaxPlanTier(0, [])).toBe(true);
  });

  it("handles plans without is_purchasable (defaults to purchasable)", () => {
    const plansWithoutFlag = [
      { tier_level: 0 },
      { tier_level: 1 },
    ];
    expect(isMaxPlanTier(1, plansWithoutFlag)).toBe(true);
    expect(isMaxPlanTier(0, plansWithoutFlag)).toBe(false);
  });
});
