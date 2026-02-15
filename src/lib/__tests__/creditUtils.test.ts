import { describe, it, expect } from "vitest";
import {
  formatCredits,
  formatPriceFromCents,
  calculatePackageBonus,
  hasSufficientCredits,
  remainingAfterDeduction,
  totalAvailableFromBreakdown,
} from "../creditUtils";

describe("formatCredits", () => {
  it("formats small numbers without separator", () => {
    expect(formatCredits(0)).toBe("0");
    expect(formatCredits(5)).toBe("5");
  });

  it("formats large numbers with thousands separator", () => {
    expect(formatCredits(1000)).toMatch(/1[,.]000/);
    expect(formatCredits(15000)).toMatch(/15[,.]000/);
  });

  it("handles zero and negative", () => {
    expect(formatCredits(0)).toBe("0");
    expect(formatCredits(-10)).toBe("-10");
  });
});

describe("formatPriceFromCents", () => {
  it("formats cents to currency", () => {
    expect(formatPriceFromCents(100)).toContain("1");
    expect(formatPriceFromCents(999)).toContain("9.99");
  });

  it("defaults to EUR", () => {
    const result = formatPriceFromCents(1000);
    expect(result).toMatch(/[\d.,]+\s*€|€\s*[\d.,]+/);
  });

  it("accepts custom currency", () => {
    const result = formatPriceFromCents(1000, "USD");
    expect(result).toContain("$");
  });

  it("handles zero", () => {
    expect(formatPriceFromCents(0)).toContain("0");
  });
});

describe("calculatePackageBonus", () => {
  it("returns 0 when price is zero", () => {
    expect(calculatePackageBonus(0, 100)).toBe(0);
  });

  it("returns 0 when credit value equals base (no bonus)", () => {
    // 100 cents = 1€ = 1 base credit
    expect(calculatePackageBonus(100, 1)).toBe(0);
  });

  it("returns positive bonus when credit value exceeds base", () => {
    // 100 cents = 1 base credit; 2 credits = 100% bonus
    expect(calculatePackageBonus(100, 2)).toBe(100);
    expect(calculatePackageBonus(1000, 15)).toBe(50); // 10 base, 15 value → 50%
  });

  it("rounds to integer", () => {
    expect(Number.isInteger(calculatePackageBonus(333, 5))).toBe(true);
  });
});

describe("hasSufficientCredits", () => {
  it("returns true when balance equals amount", () => {
    expect(hasSufficientCredits(10, 10)).toBe(true);
  });

  it("returns true when balance exceeds amount", () => {
    expect(hasSufficientCredits(10, 5)).toBe(true);
  });

  it("returns false when balance is less than amount", () => {
    expect(hasSufficientCredits(3, 5)).toBe(false);
    expect(hasSufficientCredits(0, 1)).toBe(false);
  });

  it("returns true when amount is zero or negative", () => {
    expect(hasSufficientCredits(0, 0)).toBe(true);
    expect(hasSufficientCredits(5, 0)).toBe(true);
  });
});

describe("remainingAfterDeduction", () => {
  it("returns balance minus amount when sufficient", () => {
    expect(remainingAfterDeduction(10, 3)).toBe(7);
    expect(remainingAfterDeduction(10, 10)).toBe(0);
  });

  it("returns 0 when amount exceeds balance", () => {
    expect(remainingAfterDeduction(5, 10)).toBe(0);
    expect(remainingAfterDeduction(0, 1)).toBe(0);
  });

  it("returns balance unchanged when amount is zero or negative", () => {
    expect(remainingAfterDeduction(10, 0)).toBe(10);
  });
});

describe("totalAvailableFromBreakdown", () => {
  it("sums plan, program, and bonus credits", () => {
    expect(
      totalAvailableFromBreakdown({
        planRemaining: 10,
        programRemaining: 5,
        bonusCredits: 2,
      }),
    ).toBe(17);
  });

  it("handles zeros and missing values as 0", () => {
    expect(totalAvailableFromBreakdown({ planRemaining: 0, programRemaining: 0, bonusCredits: 0 })).toBe(0);
  });
});
