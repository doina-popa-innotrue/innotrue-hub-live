/**
 * Tests for supabase/functions/_shared/ai-input-limits.ts
 *
 * Pure-logic truncation utilities — no Deno or Supabase dependencies.
 */
import { describe, it, expect } from "vitest";
import {
  AI_LIMITS,
  truncateArray,
  truncateString,
  truncateJson,
  enforcePromptLimit,
  truncateObjectStrings,
} from "../ai-input-limits";

// =============================================================================
// AI_LIMITS constants
// =============================================================================
describe("AI_LIMITS", () => {
  it("has expected default values", () => {
    expect(AI_LIMITS.maxArrayItems).toBe(20);
    expect(AI_LIMITS.maxStringLength).toBe(500);
    expect(AI_LIMITS.maxPromptChars).toBe(8_000);
    expect(AI_LIMITS.maxJsonChars).toBe(50_000);
  });
});

// =============================================================================
// truncateArray
// =============================================================================
describe("truncateArray", () => {
  it("returns the array unchanged when within limit", () => {
    const arr = [1, 2, 3];
    expect(truncateArray(arr)).toEqual([1, 2, 3]);
  });

  it("truncates to default maxItems (20)", () => {
    const arr = Array.from({ length: 25 }, (_, i) => i);
    const result = truncateArray(arr);
    expect(result).toHaveLength(20);
    expect(result[0]).toBe(0);
    expect(result[19]).toBe(19);
  });

  it("truncates to custom maxItems", () => {
    const arr = [1, 2, 3, 4, 5];
    expect(truncateArray(arr, 3)).toEqual([1, 2, 3]);
  });

  it("returns empty array for non-array input", () => {
    expect(truncateArray(null as unknown as unknown[])).toEqual([]);
    expect(truncateArray(undefined as unknown as unknown[])).toEqual([]);
    expect(truncateArray("hello" as unknown as unknown[])).toEqual([]);
  });

  it("returns empty array for empty input", () => {
    expect(truncateArray([])).toEqual([]);
  });
});

// =============================================================================
// truncateString
// =============================================================================
describe("truncateString", () => {
  it("returns the string unchanged when within limit", () => {
    expect(truncateString("hello")).toBe("hello");
    expect(truncateString("x".repeat(500))).toBe("x".repeat(500));
  });

  it("truncates and appends ellipsis when exceeding default limit (500)", () => {
    const long = "x".repeat(501);
    const result = truncateString(long);
    expect(result).toHaveLength(500);
    expect(result.endsWith("\u2026")).toBe(true);
  });

  it("truncates to custom maxLength", () => {
    const result = truncateString("hello world", 5);
    expect(result).toBe("hell\u2026");
    expect(result).toHaveLength(5);
  });

  it("returns empty string for null/undefined", () => {
    expect(truncateString(null)).toBe("");
    expect(truncateString(undefined)).toBe("");
  });

  it("returns empty string for empty input", () => {
    expect(truncateString("")).toBe("");
  });
});

// =============================================================================
// truncateJson
// =============================================================================
describe("truncateJson", () => {
  it("returns full JSON when within limit", () => {
    const obj = { key: "value" };
    expect(truncateJson(obj)).toBe('{"key":"value"}');
  });

  it("truncates and appends marker when exceeding limit", () => {
    const large = { data: "x".repeat(60_000) };
    const result = truncateJson(large);
    expect(result.length).toBeLessThanOrEqual(50_000 + 20); // truncation marker added
    expect(result).toContain("truncated");
  });

  it("respects custom maxChars", () => {
    const obj = { data: "abcdefghij" };
    const result = truncateJson(obj, 10);
    expect(result.length).toBeLessThanOrEqual(30); // 10 + marker
    expect(result).toContain("truncated");
  });

  it("handles arrays", () => {
    const arr = [1, 2, 3];
    expect(truncateJson(arr)).toBe("[1,2,3]");
  });

  it("handles null", () => {
    expect(truncateJson(null)).toBe("null");
  });
});

// =============================================================================
// enforcePromptLimit
// =============================================================================
describe("enforcePromptLimit", () => {
  it("returns prompt unchanged when within limit", () => {
    const prompt = "Tell me about learning";
    const result = enforcePromptLimit(prompt);
    expect(result.prompt).toBe(prompt);
    expect(result.wasTruncated).toBe(false);
  });

  it("truncates and flags when exceeding default limit (8000)", () => {
    const prompt = "x".repeat(8_001);
    const result = enforcePromptLimit(prompt);
    expect(result.wasTruncated).toBe(true);
    expect(result.prompt).toContain("[Content truncated due to size limits]");
    // The base truncated content should be 8000 chars
    expect(result.prompt.startsWith("x")).toBe(true);
  });

  it("respects custom maxChars", () => {
    const prompt = "hello world";
    const result = enforcePromptLimit(prompt, 5);
    expect(result.wasTruncated).toBe(true);
    expect(result.prompt.startsWith("hello")).toBe(true);
  });

  it("returns exact limit without truncation", () => {
    const prompt = "x".repeat(8_000);
    const result = enforcePromptLimit(prompt);
    expect(result.wasTruncated).toBe(false);
    expect(result.prompt).toBe(prompt);
  });
});

// =============================================================================
// truncateObjectStrings
// =============================================================================
describe("truncateObjectStrings", () => {
  it("truncates string fields in objects", () => {
    const items = [
      { title: "a".repeat(600), count: 42, active: true },
    ];
    const result = truncateObjectStrings(items);
    expect(result).toHaveLength(1);
    expect(result[0].title).toHaveLength(500);
    expect((result[0].title as string).endsWith("\u2026")).toBe(true);
    expect(result[0].count).toBe(42); // non-string preserved
    expect(result[0].active).toBe(true);
  });

  it("limits array length to default maxItems (20)", () => {
    const items = Array.from({ length: 25 }, (_, i) => ({ id: i, name: `item-${i}` }));
    const result = truncateObjectStrings(items);
    expect(result).toHaveLength(20);
  });

  it("respects custom maxStringLen and maxItems", () => {
    const items = [
      { desc: "hello world" },
      { desc: "foo bar" },
      { desc: "baz qux" },
    ];
    const result = truncateObjectStrings(items, 5, 2);
    expect(result).toHaveLength(2);
    expect(result[0].desc).toBe("hell\u2026");
  });

  it("handles empty array", () => {
    expect(truncateObjectStrings([])).toEqual([]);
  });

  it("handles objects with no string fields", () => {
    const items = [{ count: 1, active: false }];
    const result = truncateObjectStrings(items);
    expect(result).toEqual([{ count: 1, active: false }]);
  });

  it("does not mutate original objects", () => {
    const items = [{ name: "a".repeat(600) }];
    const original = items[0].name;
    truncateObjectStrings(items);
    expect(items[0].name).toBe(original);
  });
});
