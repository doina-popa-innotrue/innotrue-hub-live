import { describe, it, expect } from "vitest";
import {
  isPlanPurchasable,
  filterPurchasablePlans,
  hasTierLevelAccess,
  resolveFallbackPlan,
  getPlanTierLevel,
  type PlanLike,
} from "../planUtils";

describe("isPlanPurchasable", () => {
  it("returns true when is_purchasable is true", () => {
    expect(isPlanPurchasable({ is_purchasable: true })).toBe(true);
  });

  it("returns true when is_purchasable is undefined (default purchasable)", () => {
    expect(isPlanPurchasable({})).toBe(true);
  });

  it("returns false when is_purchasable is false", () => {
    expect(isPlanPurchasable({ is_purchasable: false })).toBe(false);
  });
});

describe("filterPurchasablePlans", () => {
  it("returns only plans where is_purchasable is not false", () => {
    const plans = [
      { id: "1", is_purchasable: true },
      { id: "2", is_purchasable: false },
      { id: "3" },
    ];
    const result = filterPurchasablePlans(plans);
    expect(result).toHaveLength(2);
    expect(result.map((p) => p.id)).toEqual(["1", "3"]);
  });

  it("returns empty array when all are non-purchasable", () => {
    const plans = [
      { id: "1", is_purchasable: false },
      { id: "2", is_purchasable: false },
    ];
    expect(filterPurchasablePlans(plans)).toHaveLength(0);
  });

  it("returns full list when all are purchasable", () => {
    const plans = [
      { id: "1", is_purchasable: true },
      { id: "2" },
    ];
    expect(filterPurchasablePlans(plans)).toHaveLength(2);
  });
});

describe("hasTierLevelAccess", () => {
  it("returns true when user tier equals required", () => {
    expect(hasTierLevelAccess(2, 2)).toBe(true);
  });

  it("returns true when user tier is higher than required", () => {
    expect(hasTierLevelAccess(3, 1)).toBe(true);
    expect(hasTierLevelAccess(2, 0)).toBe(true);
  });

  it("returns false when user tier is lower than required", () => {
    expect(hasTierLevelAccess(1, 2)).toBe(false);
    expect(hasTierLevelAccess(0, 1)).toBe(false);
  });

  it("handles tier 0", () => {
    expect(hasTierLevelAccess(0, 0)).toBe(true);
    expect(hasTierLevelAccess(0, 1)).toBe(false);
  });
});

describe("resolveFallbackPlan", () => {
  const planA: PlanLike = {
    id: "a",
    is_purchasable: true,
    tier_level: 1,
    fallback_plan_id: null,
  };
  const planB: PlanLike = {
    id: "b",
    is_purchasable: true,
    tier_level: 2,
    fallback_plan_id: "c",
  };
  const planC: PlanLike = {
    id: "c",
    is_purchasable: false,
    tier_level: 3,
    fallback_plan_id: null,
  };

  it("returns null when plan has no fallback_plan_id", () => {
    expect(resolveFallbackPlan(planA, new Map([["a", planA]]))).toBe(null);
  });

  it("returns null when fallback_plan_id is null", () => {
    expect(resolveFallbackPlan({ ...planB, fallback_plan_id: null }, new Map())).toBe(null);
  });

  it("returns fallback plan when present in map", () => {
    const map = new Map<string, PlanLike>([
      ["b", planB],
      ["c", planC],
    ]);
    expect(resolveFallbackPlan(planB, map)).toBe(planC);
  });

  it("returns null when fallback id not in map", () => {
    const map = new Map<string, PlanLike>([["b", planB]]);
    expect(resolveFallbackPlan(planB, map)).toBe(null);
  });

  it("works with Record instead of Map", () => {
    const record: Record<string, PlanLike> = { b: planB, c: planC };
    expect(resolveFallbackPlan(planB, record)).toBe(planC);
  });
});

describe("getPlanTierLevel", () => {
  it("returns tier_level from plan", () => {
    expect(getPlanTierLevel({ tier_level: 0 })).toBe(0);
    expect(getPlanTierLevel({ tier_level: 4 })).toBe(4);
  });
});
