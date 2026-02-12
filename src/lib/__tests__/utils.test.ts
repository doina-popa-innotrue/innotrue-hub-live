import { describe, it, expect } from "vitest";
import { cn } from "../utils";

describe("cn (class name utility)", () => {
  it("merges multiple class strings", () => {
    const result = cn("px-4", "py-2");
    expect(result).toContain("px-4");
    expect(result).toContain("py-2");
  });

  it("handles conditional classes", () => {
    const isActive = true;
    const isDisabled = false;
    const result = cn("base", isActive && "active", isDisabled && "disabled");
    expect(result).toContain("base");
    expect(result).toContain("active");
    expect(result).not.toContain("disabled");
  });

  it("handles falsy values", () => {
    const result = cn("base", undefined, null, false, "", "extra");
    expect(result).toContain("base");
    expect(result).toContain("extra");
  });

  it("merges conflicting Tailwind classes (last wins)", () => {
    // tailwind-merge should resolve conflicts: px-4 vs px-2 → px-2 wins
    const result = cn("px-4", "px-2");
    expect(result).toContain("px-2");
    expect(result).not.toContain("px-4");
  });

  it("merges conflicting color classes", () => {
    const result = cn("text-red-500", "text-blue-500");
    expect(result).toContain("text-blue-500");
    expect(result).not.toContain("text-red-500");
  });

  it("preserves non-conflicting classes", () => {
    const result = cn("text-red-500", "bg-blue-500", "rounded-lg");
    expect(result).toContain("text-red-500");
    expect(result).toContain("bg-blue-500");
    expect(result).toContain("rounded-lg");
  });

  it("returns empty string for no arguments", () => {
    const result = cn();
    expect(result).toBe("");
  });
});
