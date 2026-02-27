/**
 * Tests for supabase/functions/_shared/validation.ts
 *
 * Pure-logic utility functions — no Deno or Supabase dependencies.
 */
import { describe, it, expect } from "vitest";
import {
  isValidEmail,
  validatePassword,
  isValidUUID,
  validateName,
  validateTextInput,
  isValidEnum,
} from "../validation";

// =============================================================================
// isValidEmail
// =============================================================================
describe("isValidEmail", () => {
  it("accepts standard email addresses", () => {
    expect(isValidEmail("user@example.com")).toBe(true);
    expect(isValidEmail("user.name@example.co.uk")).toBe(true);
    expect(isValidEmail("user+tag@domain.org")).toBe(true);
    expect(isValidEmail("u@d.io")).toBe(true);
  });

  it("accepts emails with special characters in local part", () => {
    expect(isValidEmail("user!def@example.com")).toBe(true);
    expect(isValidEmail("user#tag@example.com")).toBe(true);
    expect(isValidEmail("user&name@example.com")).toBe(true);
  });

  it("rejects empty and non-string inputs", () => {
    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail(null as unknown as string)).toBe(false);
    expect(isValidEmail(undefined as unknown as string)).toBe(false);
    expect(isValidEmail(42 as unknown as string)).toBe(false);
  });

  it("rejects addresses without @ symbol", () => {
    expect(isValidEmail("userexample.com")).toBe(false);
  });

  it("rejects addresses without domain", () => {
    expect(isValidEmail("user@")).toBe(false);
  });

  it("rejects addresses without TLD", () => {
    expect(isValidEmail("user@domain")).toBe(false);
  });

  it("rejects addresses with single-char TLD", () => {
    expect(isValidEmail("user@domain.x")).toBe(false);
  });

  it("rejects addresses exceeding 254 chars", () => {
    const longLocal = "a".repeat(244); // 244 + "@" + "b.co" = 250 < 254, but...
    const tooLong = "a".repeat(250) + "@b.co"; // 255 chars
    expect(isValidEmail(tooLong)).toBe(false);
  });

  it("rejects addresses with spaces", () => {
    expect(isValidEmail("user @example.com")).toBe(false);
    expect(isValidEmail("user@example .com")).toBe(false);
  });
});

// =============================================================================
// validatePassword
// =============================================================================
describe("validatePassword", () => {
  it("returns null for valid passwords", () => {
    expect(validatePassword("MyPass1!")).toBeNull();
    expect(validatePassword("Str0ng@Password")).toBeNull();
    expect(validatePassword("Abc123!@#")).toBeNull();
  });

  it("rejects empty or non-string passwords", () => {
    expect(validatePassword("")).toEqual(expect.stringContaining("required"));
    expect(validatePassword(null as unknown as string)).toEqual(
      expect.stringContaining("required"),
    );
    expect(validatePassword(undefined as unknown as string)).toEqual(
      expect.stringContaining("required"),
    );
  });

  it("rejects passwords shorter than 8 characters", () => {
    expect(validatePassword("Ab1!")).toEqual(expect.stringContaining("8 characters"));
  });

  it("rejects passwords longer than 128 characters", () => {
    const long = "Aa1!" + "x".repeat(125);
    expect(validatePassword(long)).toEqual(expect.stringContaining("128 characters"));
  });

  it("requires at least one uppercase letter", () => {
    expect(validatePassword("lowercase1!")).toEqual(expect.stringContaining("uppercase"));
  });

  it("requires at least one lowercase letter", () => {
    expect(validatePassword("UPPERCASE1!")).toEqual(expect.stringContaining("lowercase"));
  });

  it("requires at least one number", () => {
    expect(validatePassword("NoNumbers!")).toEqual(expect.stringContaining("number"));
  });

  it("requires at least one special character", () => {
    expect(validatePassword("NoSpecial1")).toEqual(expect.stringContaining("special"));
  });
});

// =============================================================================
// isValidUUID
// =============================================================================
describe("isValidUUID", () => {
  it("accepts valid v4 UUIDs", () => {
    expect(isValidUUID("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
    expect(isValidUUID("6ba7b810-9dad-11d1-80b4-00c04fd430c8")).toBe(true);
  });

  it("accepts UUIDs with uppercase letters", () => {
    expect(isValidUUID("550E8400-E29B-41D4-A716-446655440000")).toBe(true);
  });

  it("rejects empty and non-string inputs", () => {
    expect(isValidUUID("")).toBe(false);
    expect(isValidUUID(null as unknown as string)).toBe(false);
    expect(isValidUUID(undefined as unknown as string)).toBe(false);
  });

  it("rejects malformed UUIDs", () => {
    expect(isValidUUID("not-a-uuid")).toBe(false);
    expect(isValidUUID("550e8400-e29b-41d4-a716")).toBe(false);
    expect(isValidUUID("550e8400e29b41d4a716446655440000")).toBe(false); // no dashes
    expect(isValidUUID("550e8400-e29b-41d4-a716-44665544000g")).toBe(false); // 'g' not hex
  });
});

// =============================================================================
// validateName
// =============================================================================
describe("validateName", () => {
  it("returns trimmed name for valid input", () => {
    expect(validateName("Alice")).toBe("Alice");
    expect(validateName("  Bob  ")).toBe("Bob");
    expect(validateName("Jean-Pierre de la Montagne")).toBe(
      "Jean-Pierre de la Montagne",
    );
  });

  it("returns null for empty, whitespace-only, or non-string", () => {
    expect(validateName("")).toBeNull();
    expect(validateName("   ")).toBeNull();
    expect(validateName(null as unknown as string)).toBeNull();
    expect(validateName(undefined as unknown as string)).toBeNull();
  });

  it("returns null for names exceeding maxLength", () => {
    expect(validateName("a".repeat(201))).toBeNull();
    expect(validateName("abc", 2)).toBeNull();
  });

  it("respects custom maxLength", () => {
    expect(validateName("ab", 2)).toBe("ab");
    expect(validateName("abc", 3)).toBe("abc");
  });
});

// =============================================================================
// validateTextInput
// =============================================================================
describe("validateTextInput", () => {
  it("returns null for valid text within limits", () => {
    expect(validateTextInput("hello world", "Message")).toBeNull();
    expect(validateTextInput("x", "Comment")).toBeNull();
  });

  it("returns error for empty/non-string input", () => {
    expect(validateTextInput("", "Bio")).toEqual(expect.stringContaining("required"));
    expect(validateTextInput(null as unknown as string, "Bio")).toEqual(
      expect.stringContaining("required"),
    );
  });

  it("returns error when exceeding default max (10,000 chars)", () => {
    const long = "x".repeat(10_001);
    expect(validateTextInput(long, "Description")).toEqual(
      expect.stringContaining("10,000"),
    );
  });

  it("respects custom maxLength", () => {
    expect(validateTextInput("abc", "Title", 2)).toEqual(expect.stringContaining("2"));
    expect(validateTextInput("ab", "Title", 2)).toBeNull();
  });

  it("includes field name in error message", () => {
    expect(validateTextInput("", "Bio")).toContain("Bio");
    expect(validateTextInput("x".repeat(11), "Bio", 10)).toContain("Bio");
  });
});

// =============================================================================
// isValidEnum
// =============================================================================
describe("isValidEnum", () => {
  const STATUSES = ["active", "inactive", "pending"] as const;

  it("returns true for valid enum values", () => {
    expect(isValidEnum("active", STATUSES)).toBe(true);
    expect(isValidEnum("inactive", STATUSES)).toBe(true);
    expect(isValidEnum("pending", STATUSES)).toBe(true);
  });

  it("returns false for invalid values", () => {
    expect(isValidEnum("deleted", STATUSES)).toBe(false);
    expect(isValidEnum("", STATUSES)).toBe(false);
    expect(isValidEnum("Active", STATUSES)).toBe(false); // case-sensitive
  });
});
