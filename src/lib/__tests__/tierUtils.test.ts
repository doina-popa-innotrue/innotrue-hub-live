import { describe, it, expect } from "vitest";
import { hasTierAccess, getTierDisplayName } from "../tierUtils";

describe("hasTierAccess", () => {
  const programTiers = ["Essentials", "Premium", "Enterprise"];

  // --- No tiers defined: everything accessible ---
  it("returns true when programTiers is null", () => {
    expect(hasTierAccess(null, "Premium", "Essentials")).toBe(true);
  });

  it("returns true when programTiers is undefined", () => {
    expect(hasTierAccess(undefined, "Premium", "Essentials")).toBe(true);
  });

  it("returns true when programTiers is empty array", () => {
    expect(hasTierAccess([], "Premium", "Essentials")).toBe(true);
  });

  // --- No module tier requirement: everything accessible ---
  it("returns true when moduleRequiredTier is null", () => {
    expect(hasTierAccess(programTiers, "Premium", null)).toBe(true);
  });

  it("returns true when moduleRequiredTier is undefined", () => {
    expect(hasTierAccess(programTiers, "Premium", undefined)).toBe(true);
  });

  it("returns true when moduleRequiredTier is empty string", () => {
    expect(hasTierAccess(programTiers, "Premium", "")).toBe(true);
  });

  // --- Hierarchical access: higher tier can access lower ---
  it("returns true when user tier equals module tier", () => {
    expect(hasTierAccess(programTiers, "Premium", "Premium")).toBe(true);
  });

  it("returns true when user tier is higher than module tier", () => {
    expect(hasTierAccess(programTiers, "Enterprise", "Essentials")).toBe(true);
    expect(hasTierAccess(programTiers, "Premium", "Essentials")).toBe(true);
    expect(hasTierAccess(programTiers, "Enterprise", "Premium")).toBe(true);
  });

  it("returns false when user tier is lower than module tier", () => {
    expect(hasTierAccess(programTiers, "Essentials", "Premium")).toBe(false);
    expect(hasTierAccess(programTiers, "Essentials", "Enterprise")).toBe(false);
    expect(hasTierAccess(programTiers, "Premium", "Enterprise")).toBe(false);
  });

  // --- Case insensitive ---
  it("matches tiers case-insensitively", () => {
    expect(hasTierAccess(programTiers, "premium", "essentials")).toBe(true);
    expect(hasTierAccess(programTiers, "ENTERPRISE", "premium")).toBe(true);
    expect(hasTierAccess(programTiers, "ESSENTIALS", "PREMIUM")).toBe(false);
  });

  // --- No user tier: defaults to first (lowest) tier ---
  it("defaults to first tier when userTier is null", () => {
    expect(hasTierAccess(programTiers, null, "Essentials")).toBe(true);
    expect(hasTierAccess(programTiers, null, "Premium")).toBe(false);
  });

  it("defaults to first tier when userTier is undefined", () => {
    expect(hasTierAccess(programTiers, undefined, "Essentials")).toBe(true);
    expect(hasTierAccess(programTiers, undefined, "Premium")).toBe(false);
  });

  // --- Unknown tiers: permissive fallback ---
  it("returns true (permissive) when user tier not found in program", () => {
    expect(hasTierAccess(programTiers, "Unknown", "Essentials")).toBe(true);
  });

  it("returns true (permissive) when module tier not found in program", () => {
    expect(hasTierAccess(programTiers, "Premium", "Unknown")).toBe(true);
  });

  // --- Two-tier programs ---
  it("works with two-tier programs", () => {
    const twoTiers = ["Basic", "Pro"];
    expect(hasTierAccess(twoTiers, "Pro", "Basic")).toBe(true);
    expect(hasTierAccess(twoTiers, "Basic", "Pro")).toBe(false);
    expect(hasTierAccess(twoTiers, "Basic", "Basic")).toBe(true);
  });

  // --- Single-tier programs ---
  it("works with single-tier programs", () => {
    const singleTier = ["Standard"];
    expect(hasTierAccess(singleTier, "Standard", "Standard")).toBe(true);
  });
});

describe("getTierDisplayName", () => {
  const programTiers = ["Essentials", "Premium", "Enterprise"];

  it("returns numbered display name for valid tier", () => {
    expect(getTierDisplayName(programTiers, "Essentials")).toBe("1. Essentials");
    expect(getTierDisplayName(programTiers, "Premium")).toBe("2. Premium");
    expect(getTierDisplayName(programTiers, "Enterprise")).toBe("3. Enterprise");
  });

  it("matches case-insensitively", () => {
    expect(getTierDisplayName(programTiers, "premium")).toBe("2. Premium");
    expect(getTierDisplayName(programTiers, "ENTERPRISE")).toBe("3. Enterprise");
  });

  it("returns raw tier string when not found", () => {
    expect(getTierDisplayName(programTiers, "Unknown")).toBe("Unknown");
  });

  it("returns empty string when tier is null", () => {
    expect(getTierDisplayName(programTiers, null)).toBe("");
  });

  it("returns empty string when tier is undefined", () => {
    expect(getTierDisplayName(programTiers, undefined)).toBe("");
  });

  it("returns raw tier when programTiers is null", () => {
    expect(getTierDisplayName(null, "Premium")).toBe("Premium");
  });

  it("returns raw tier when programTiers is empty", () => {
    expect(getTierDisplayName([], "Premium")).toBe("Premium");
  });
});
