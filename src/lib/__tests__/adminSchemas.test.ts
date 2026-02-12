import { describe, it, expect } from "vitest";
import {
  nameSchema,
  slugSchema,
  descriptionSchema,
  optionalUrlSchema,
  assessmentFamilySchema,
  programSchema,
  moduleSchema,
  featureSchema,
  planSchema,
  trackSchema,
  resourceSchema,
} from "../validations/adminSchemas";

describe("nameSchema", () => {
  it("accepts valid name", () => {
    const result = nameSchema.safeParse("Valid Name");
    expect(result.success).toBe(true);
  });

  it("rejects empty string", () => {
    const result = nameSchema.safeParse("");
    expect(result.success).toBe(false);
  });

  it("rejects name longer than 100 characters", () => {
    const result = nameSchema.safeParse("a".repeat(101));
    expect(result.success).toBe(false);
  });

  it("accepts name at exactly 100 characters", () => {
    const result = nameSchema.safeParse("a".repeat(100));
    expect(result.success).toBe(true);
  });
});

describe("slugSchema", () => {
  it("accepts valid slug", () => {
    const result = slugSchema.safeParse("my-valid-slug-123");
    expect(result.success).toBe(true);
  });

  it("rejects uppercase letters", () => {
    const result = slugSchema.safeParse("Invalid-Slug");
    expect(result.success).toBe(false);
  });

  it("rejects spaces", () => {
    const result = slugSchema.safeParse("invalid slug");
    expect(result.success).toBe(false);
  });

  it("rejects special characters", () => {
    const result = slugSchema.safeParse("invalid_slug!");
    expect(result.success).toBe(false);
  });

  it("rejects underscores", () => {
    const result = slugSchema.safeParse("invalid_slug");
    expect(result.success).toBe(false);
  });

  it("accepts hyphens and numbers", () => {
    const result = slugSchema.safeParse("my-slug-2026");
    expect(result.success).toBe(true);
  });

  it("rejects empty string", () => {
    const result = slugSchema.safeParse("");
    expect(result.success).toBe(false);
  });

  it("rejects slug longer than 50 characters", () => {
    const result = slugSchema.safeParse("a".repeat(51));
    expect(result.success).toBe(false);
  });
});

describe("descriptionSchema", () => {
  it("accepts valid description", () => {
    const result = descriptionSchema.safeParse("A short description");
    expect(result.success).toBe(true);
  });

  it("accepts null", () => {
    const result = descriptionSchema.safeParse(null);
    expect(result.success).toBe(true);
  });

  it("accepts undefined", () => {
    const result = descriptionSchema.safeParse(undefined);
    expect(result.success).toBe(true);
  });

  it("rejects description longer than 1000 characters", () => {
    const result = descriptionSchema.safeParse("a".repeat(1001));
    expect(result.success).toBe(false);
  });
});

describe("optionalUrlSchema", () => {
  it("accepts valid URL", () => {
    const result = optionalUrlSchema.safeParse("https://example.com");
    expect(result.success).toBe(true);
  });

  it("accepts empty string", () => {
    const result = optionalUrlSchema.safeParse("");
    expect(result.success).toBe(true);
  });

  it("accepts null", () => {
    const result = optionalUrlSchema.safeParse(null);
    expect(result.success).toBe(true);
  });

  it("accepts undefined", () => {
    const result = optionalUrlSchema.safeParse(undefined);
    expect(result.success).toBe(true);
  });

  it("rejects invalid URL", () => {
    const result = optionalUrlSchema.safeParse("not-a-url");
    expect(result.success).toBe(false);
  });
});

describe("assessmentFamilySchema", () => {
  it("accepts valid assessment family", () => {
    const result = assessmentFamilySchema.safeParse({
      name: "Assessment Family",
      slug: "assessment-family",
      description: "A description",
      is_active: true,
    });
    expect(result.success).toBe(true);
  });

  it("defaults is_active to true", () => {
    const result = assessmentFamilySchema.safeParse({
      name: "Test",
      slug: "test",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.is_active).toBe(true);
    }
  });

  it("rejects missing name", () => {
    const result = assessmentFamilySchema.safeParse({
      slug: "test",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing slug", () => {
    const result = assessmentFamilySchema.safeParse({
      name: "Test",
    });
    expect(result.success).toBe(false);
  });
});

describe("programSchema", () => {
  it("accepts valid program", () => {
    const result = programSchema.safeParse({
      name: "Leadership Coaching",
      slug: "leadership-coaching",
      description: "A coaching program",
      is_active: true,
      is_discoverable: true,
      program_type: "coaching",
    });
    expect(result.success).toBe(true);
  });

  it("defaults program_type to course", () => {
    const result = programSchema.safeParse({
      name: "Test",
      slug: "test",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.program_type).toBe("course");
    }
  });

  it("accepts all valid program types", () => {
    const types = ["certification", "course", "workshop", "coaching"] as const;
    types.forEach((type) => {
      const result = programSchema.safeParse({
        name: "Test",
        slug: "test",
        program_type: type,
      });
      expect(result.success).toBe(true);
    });
  });

  it("rejects invalid program type", () => {
    const result = programSchema.safeParse({
      name: "Test",
      slug: "test",
      program_type: "invalid-type",
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative duration_weeks", () => {
    const result = programSchema.safeParse({
      name: "Test",
      slug: "test",
      duration_weeks: -1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects zero duration_weeks", () => {
    const result = programSchema.safeParse({
      name: "Test",
      slug: "test",
      duration_weeks: 0,
    });
    expect(result.success).toBe(false);
  });
});
