import { describe, it, expect } from "vitest";
import {
  getStagingRecipient,
  getStagingRecipients,
  getStagingSubject,
  type StagingEmailOptions,
} from "../emailUtils";

const production: StagingEmailOptions = { isProduction: true, stagingOverride: null };
const stagingNoOverride: StagingEmailOptions = { isProduction: false, stagingOverride: null };
const stagingWithOverride: StagingEmailOptions = {
  isProduction: false,
  stagingOverride: "test@example.com",
};

describe("getStagingRecipient", () => {
  it("returns real email when production", () => {
    expect(getStagingRecipient("user@real.com", production)).toBe("user@real.com");
  });

  it("returns real email when staging but no override set", () => {
    expect(getStagingRecipient("user@real.com", stagingNoOverride)).toBe("user@real.com");
  });

  it("returns override address when staging and override set", () => {
    expect(getStagingRecipient("user@real.com", stagingWithOverride)).toBe("test@example.com");
  });
});

describe("getStagingRecipients", () => {
  it("returns real emails when production", () => {
    const emails = ["a@x.com", "b@x.com"];
    expect(getStagingRecipients(emails, production)).toEqual(emails);
  });

  it("returns real emails when staging but no override", () => {
    const emails = ["a@x.com", "b@x.com"];
    expect(getStagingRecipients(emails, stagingNoOverride)).toEqual(emails);
  });

  it("returns single override when staging and override set", () => {
    expect(getStagingRecipients(["a@x.com", "b@x.com"], stagingWithOverride)).toEqual([
      "test@example.com",
    ]);
  });

  it("handles empty array", () => {
    expect(getStagingRecipients([], stagingWithOverride)).toEqual(["test@example.com"]);
  });
});

describe("getStagingSubject", () => {
  it("returns subject unchanged when production", () => {
    expect(getStagingSubject("Hello", "user@real.com", production)).toBe("Hello");
  });

  it("returns subject unchanged when staging but no override", () => {
    expect(getStagingSubject("Hello", "user@real.com", stagingNoOverride)).toBe("Hello");
  });

  it("prefixes subject with [STAGING → email] when override active", () => {
    expect(getStagingSubject("Password reset", "user@real.com", stagingWithOverride)).toBe(
      "[STAGING → user@real.com] Password reset",
    );
  });

  it("formats multiple recipients in subject prefix", () => {
    expect(
      getStagingSubject("Newsletter", ["a@x.com", "b@x.com"], stagingWithOverride),
    ).toBe("[STAGING → a@x.com, b@x.com] Newsletter");
  });

  it("filters out falsy recipients in array", () => {
    expect(
      getStagingSubject("Hi", ["a@x.com", "", "b@x.com"], stagingWithOverride),
    ).toBe("[STAGING → a@x.com, b@x.com] Hi");
  });
});
