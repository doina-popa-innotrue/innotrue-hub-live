import { describe, it, expect } from "vitest";
import {
  mergeFeatureEntitlements,
  hasFeature,
  getLimit,
  getAccessSource,
  type FeatureEntitlement,
  type AccessSource,
} from "../entitlementUtils";

function e(
  source: AccessSource,
  limit: number | null = null,
  enabled = true,
): FeatureEntitlement {
  return { enabled, limit, source };
}

describe("mergeFeatureEntitlements", () => {
  it("returns empty features when no entitlements", () => {
    const result = mergeFeatureEntitlements({});
    expect(Object.keys(result.features)).toHaveLength(0);
    expect(Object.keys(result.featuresByPrefix)).toHaveLength(0);
  });

  it("includes only features with at least one enabled entitlement", () => {
    const result = mergeFeatureEntitlements({
      allowed: [e("subscription", 10), e("program_plan", 5, false)],
      disabled_only: [e("program_plan", 1, false)],
    });
    expect(result.features.allowed).toBeDefined();
    expect(result.features.allowed.enabled).toBe(true);
    expect(result.features.disabled_only).toBeUndefined();
  });

  it("takes max limit across enabled entitlements", () => {
    const result = mergeFeatureEntitlements({
      feature_a: [
        e("subscription", 5),
        e("program_plan", 10),
        e("add_on", 3),
      ],
    });
    expect(getLimit(result, "feature_a")).toBe(10);
  });

  it("treats null limit as unlimited (max wins)", () => {
    const result = mergeFeatureEntitlements({
      feature_a: [
        e("subscription", 5),
        e("add_on", null), // unlimited
      ],
    });
    expect(getLimit(result, "feature_a")).toBe(null);
  });

  it("picks source by priority: add_on > track > org_sponsored > subscription > program_plan", () => {
    const result = mergeFeatureEntitlements({
      f: [
        e("program_plan", 1),
        e("subscription", 2),
        e("add_on", null),
      ],
    });
    expect(getAccessSource(result, "f")).toBe("add_on");
  });

  it("picks track over subscription and program_plan", () => {
    const result = mergeFeatureEntitlements({
      f: [e("program_plan", 1), e("subscription", 2), e("track", 5)],
    });
    expect(getAccessSource(result, "f")).toBe("track");
  });

  it("picks org_sponsored over subscription and program_plan", () => {
    const result = mergeFeatureEntitlements({
      f: [e("program_plan", 1), e("subscription", 2), e("org_sponsored", 3)],
    });
    expect(getAccessSource(result, "f")).toBe("org_sponsored");
  });

  it("builds featuresByPrefix from first segment of key", () => {
    const result = mergeFeatureEntitlements({
      assessments_foo: [e("subscription", 1)],
      assessments_bar: [e("program_plan", 2)],
      decisions_baz: [e("add_on", null)],
    });
    expect(result.featuresByPrefix.assessments).toEqual(
      new Set(["assessments_foo", "assessments_bar"]),
    );
    expect(result.featuresByPrefix.decisions).toEqual(new Set(["decisions_baz"]));
  });

  it("merges multiple sources for same key correctly", () => {
    const result = mergeFeatureEntitlements({
      ai_insights: [
        e("program_plan", 5),
        e("subscription", 10),
        e("track", 20),
      ],
    });
    expect(hasFeature(result, "ai_insights")).toBe(true);
    expect(getLimit(result, "ai_insights")).toBe(20);
    expect(getAccessSource(result, "ai_insights")).toBe("track");
  });
});

describe("hasFeature", () => {
  it("returns false for missing feature (missing features not accessible)", () => {
    const merged = mergeFeatureEntitlements({
      only_this: [e("subscription", 1)],
    });
    expect(hasFeature(merged, "only_this")).toBe(true);
    expect(hasFeature(merged, "unknown_feature")).toBe(false);
  });

  it("returns true when feature is in merged result", () => {
    const merged = mergeFeatureEntitlements({
      my_feature: [e("add_on", null)],
    });
    expect(hasFeature(merged, "my_feature")).toBe(true);
  });
});

describe("getLimit", () => {
  it("returns null for missing feature", () => {
    const merged = mergeFeatureEntitlements({});
    expect(getLimit(merged, "missing")).toBe(null);
  });

  it("returns merged limit for present feature", () => {
    const merged = mergeFeatureEntitlements({
      x: [e("subscription", 10), e("program_plan", 15)],
    });
    expect(getLimit(merged, "x")).toBe(15);
  });
});

describe("getAccessSource", () => {
  it("returns null for missing feature", () => {
    const merged = mergeFeatureEntitlements({});
    expect(getAccessSource(merged, "missing")).toBe(null);
  });

  it("returns prioritized source for present feature", () => {
    const merged = mergeFeatureEntitlements({
      x: [e("program_plan", 1), e("subscription", 2)],
    });
    expect(getAccessSource(merged, "x")).toBe("subscription");
  });
});
