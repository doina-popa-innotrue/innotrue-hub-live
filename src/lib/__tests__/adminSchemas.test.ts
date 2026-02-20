import { describe, it, expect } from "vitest";
import {
  nameSchema,
  slugSchema,
  descriptionSchema,
  optionalUrlSchema,
  assessmentFamilySchema,
  assessmentCategorySchema,
  capabilityAssessmentSchema,
  programSchema,
  moduleSchema,
  featureSchema,
  planSchema,
  programPlanSchema,
  trackSchema,
  resourceSchema,
  sessionTypeSchema,
  assignmentTypeSchema,
  moduleTypeSchema,
  addOnSchema,
  skillSchema,
  skillCategorySchema,
  userRoleSchema,
  clientProfileSchema,
  decisionCapabilitySettingSchema,
  validateForm,
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

// ===========================================================================
// Schemas imported but previously untested
// ===========================================================================

describe("moduleSchema", () => {
  it("accepts valid module", () => {
    const result = moduleSchema.safeParse({
      title: "Introduction to Leadership",
      description: "First module",
      order_index: 0,
      is_active: true,
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing title", () => {
    const result = moduleSchema.safeParse({ description: "No title" });
    expect(result.success).toBe(false);
  });

  it("defaults order_index to 0 and is_active to true", () => {
    const result = moduleSchema.safeParse({ title: "Test" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.order_index).toBe(0);
      expect(result.data.is_active).toBe(true);
    }
  });

  it("rejects negative duration_minutes", () => {
    const result = moduleSchema.safeParse({
      title: "Test",
      duration_minutes: -5,
    });
    expect(result.success).toBe(false);
  });
});

describe("featureSchema", () => {
  it("accepts valid feature with lowercase underscore key", () => {
    const result = featureSchema.safeParse({
      name: "Goal Tracking",
      key: "goal_tracking",
      description: "Track goals",
    });
    expect(result.success).toBe(true);
  });

  it("rejects key with uppercase letters", () => {
    const result = featureSchema.safeParse({
      name: "Test",
      key: "Invalid_Key",
    });
    expect(result.success).toBe(false);
  });

  it("rejects key with hyphens", () => {
    const result = featureSchema.safeParse({
      name: "Test",
      key: "invalid-key",
    });
    expect(result.success).toBe(false);
  });
});

describe("planSchema", () => {
  it("accepts valid plan with all fields", () => {
    const result = planSchema.safeParse({
      name: "Pro Plan",
      slug: "pro-plan",
      description: "Premium features",
      price_cents: 9900,
      billing_period: "monthly",
      is_active: true,
      is_public: true,
    });
    expect(result.success).toBe(true);
  });

  it("defaults price_cents to 0 and billing_period to monthly", () => {
    const result = planSchema.safeParse({
      name: "Free",
      slug: "free",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.price_cents).toBe(0);
      expect(result.data.billing_period).toBe("monthly");
      expect(result.data.trial_days).toBe(0);
    }
  });

  it("accepts all valid billing periods", () => {
    const periods = ["monthly", "yearly", "one_time", "lifetime"] as const;
    periods.forEach((period) => {
      const result = planSchema.safeParse({
        name: "Test",
        slug: "test",
        billing_period: period,
      });
      expect(result.success).toBe(true);
    });
  });

  it("rejects invalid billing period", () => {
    const result = planSchema.safeParse({
      name: "Test",
      slug: "test",
      billing_period: "weekly",
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative trial_days", () => {
    const result = planSchema.safeParse({
      name: "Test",
      slug: "test",
      trial_days: -1,
    });
    expect(result.success).toBe(false);
  });
});

describe("trackSchema", () => {
  it("accepts valid track with hex color", () => {
    const result = trackSchema.safeParse({
      name: "Leadership Track",
      slug: "leadership",
      color: "#FF5733",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid hex color", () => {
    const result = trackSchema.safeParse({
      name: "Test",
      slug: "test",
      color: "red",
    });
    expect(result.success).toBe(false);
  });

  it("accepts null color", () => {
    const result = trackSchema.safeParse({
      name: "Test",
      slug: "test",
      color: null,
    });
    expect(result.success).toBe(true);
  });
});

describe("resourceSchema", () => {
  it("accepts valid resource", () => {
    const result = resourceSchema.safeParse({
      title: "Getting Started Guide",
      resource_type: "pdf",
      url: "https://example.com/guide.pdf",
    });
    expect(result.success).toBe(true);
  });

  it("defaults resource_type to link", () => {
    const result = resourceSchema.safeParse({ title: "Test" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.resource_type).toBe("link");
    }
  });

  it("accepts all valid resource types", () => {
    const types = ["pdf", "video", "link", "document", "image", "audio"] as const;
    types.forEach((type) => {
      const result = resourceSchema.safeParse({
        title: "Test",
        resource_type: type,
      });
      expect(result.success).toBe(true);
    });
  });

  it("rejects invalid resource type", () => {
    const result = resourceSchema.safeParse({
      title: "Test",
      resource_type: "spreadsheet",
    });
    expect(result.success).toBe(false);
  });
});

// ===========================================================================
// Schemas not previously imported or tested
// ===========================================================================

describe("assessmentCategorySchema", () => {
  it("accepts valid assessment category", () => {
    const result = assessmentCategorySchema.safeParse({
      name: "Technical Skills",
      description: "Tech category",
      is_active: true,
    });
    expect(result.success).toBe(true);
  });

  it("defaults is_active to true", () => {
    const result = assessmentCategorySchema.safeParse({ name: "Test" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.is_active).toBe(true);
    }
  });

  it("rejects negative order_index", () => {
    const result = assessmentCategorySchema.safeParse({
      name: "Test",
      order_index: -1,
    });
    expect(result.success).toBe(false);
  });
});

describe("capabilityAssessmentSchema", () => {
  it("accepts valid capability assessment", () => {
    const result = capabilityAssessmentSchema.safeParse({
      name: "Leadership Assessment",
      slug: "leadership-assessment",
      description: "Measures leadership skills",
      rating_scale: 5,
    });
    expect(result.success).toBe(true);
  });

  it("defaults rating_scale to 5", () => {
    const result = capabilityAssessmentSchema.safeParse({
      name: "Test",
      slug: "test",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.rating_scale).toBe(5);
    }
  });

  it("rejects rating_scale below 3", () => {
    const result = capabilityAssessmentSchema.safeParse({
      name: "Test",
      slug: "test",
      rating_scale: 2,
    });
    expect(result.success).toBe(false);
  });

  it("rejects rating_scale above 10", () => {
    const result = capabilityAssessmentSchema.safeParse({
      name: "Test",
      slug: "test",
      rating_scale: 11,
    });
    expect(result.success).toBe(false);
  });

  it("validates pass_fail_mode enum values", () => {
    const valid = capabilityAssessmentSchema.safeParse({
      name: "Test",
      slug: "test",
      pass_fail_mode: "percentage",
    });
    expect(valid.success).toBe(true);

    const invalid = capabilityAssessmentSchema.safeParse({
      name: "Test",
      slug: "test",
      pass_fail_mode: "invalid",
    });
    expect(invalid.success).toBe(false);
  });

  it("validates pass_fail_threshold range 0-100", () => {
    const valid = capabilityAssessmentSchema.safeParse({
      name: "Test",
      slug: "test",
      pass_fail_threshold: 70,
    });
    expect(valid.success).toBe(true);

    const tooHigh = capabilityAssessmentSchema.safeParse({
      name: "Test",
      slug: "test",
      pass_fail_threshold: 101,
    });
    expect(tooHigh.success).toBe(false);
  });
});

describe("sessionTypeSchema", () => {
  it("accepts valid session type", () => {
    const result = sessionTypeSchema.safeParse({
      name: "1:1 Coaching",
      duration_minutes: 60,
      color: "#3B82F6",
    });
    expect(result.success).toBe(true);
  });

  it("defaults duration_minutes to 60", () => {
    const result = sessionTypeSchema.safeParse({ name: "Test" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.duration_minutes).toBe(60);
    }
  });

  it("rejects duration_minutes below 5", () => {
    const result = sessionTypeSchema.safeParse({
      name: "Test",
      duration_minutes: 4,
    });
    expect(result.success).toBe(false);
  });

  it("rejects duration_minutes above 480", () => {
    const result = sessionTypeSchema.safeParse({
      name: "Test",
      duration_minutes: 481,
    });
    expect(result.success).toBe(false);
  });

  it("validates hex color format", () => {
    const valid = sessionTypeSchema.safeParse({
      name: "Test",
      color: "#FF5733",
    });
    expect(valid.success).toBe(true);

    const invalid = sessionTypeSchema.safeParse({
      name: "Test",
      color: "not-a-color",
    });
    expect(invalid.success).toBe(false);
  });
});

describe("assignmentTypeSchema", () => {
  it("accepts valid assignment type", () => {
    const result = assignmentTypeSchema.safeParse({
      name: "Homework",
      requires_submission: true,
      allows_feedback: true,
    });
    expect(result.success).toBe(true);
  });

  it("defaults requires_submission and allows_feedback to true", () => {
    const result = assignmentTypeSchema.safeParse({ name: "Test" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.requires_submission).toBe(true);
      expect(result.data.allows_feedback).toBe(true);
    }
  });

  it("rejects negative max_score", () => {
    const result = assignmentTypeSchema.safeParse({
      name: "Test",
      max_score: -1,
    });
    expect(result.success).toBe(false);
  });
});

describe("moduleTypeSchema", () => {
  it("accepts valid module type", () => {
    const result = moduleTypeSchema.safeParse({
      name: "Lecture",
      description: "A lecture module",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing name", () => {
    const result = moduleTypeSchema.safeParse({ description: "No name" });
    expect(result.success).toBe(false);
  });
});

describe("programPlanSchema", () => {
  it("accepts valid program plan", () => {
    const result = programPlanSchema.safeParse({
      name: "Basic Plan",
      tier: "basic",
      price_cents: 4900,
    });
    expect(result.success).toBe(true);
  });

  it("requires tier", () => {
    const result = programPlanSchema.safeParse({
      name: "Test",
    });
    expect(result.success).toBe(false);
  });

  it("defaults price_cents to 0", () => {
    const result = programPlanSchema.safeParse({
      name: "Free",
      tier: "free",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.price_cents).toBe(0);
    }
  });
});

describe("addOnSchema", () => {
  it("accepts valid add-on", () => {
    const result = addOnSchema.safeParse({
      name: "Extra Storage",
      key: "extra_storage",
      price_cents: 500,
    });
    expect(result.success).toBe(true);
  });

  it("rejects key with hyphens (must be lowercase + underscores only)", () => {
    const result = addOnSchema.safeParse({
      name: "Test",
      key: "invalid-key",
    });
    expect(result.success).toBe(false);
  });

  it("defaults is_consumable to false", () => {
    const result = addOnSchema.safeParse({
      name: "Test",
      key: "test",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.is_consumable).toBe(false);
    }
  });

  it("rejects negative initial_quantity", () => {
    const result = addOnSchema.safeParse({
      name: "Test",
      key: "test",
      initial_quantity: -1,
    });
    expect(result.success).toBe(false);
  });
});

describe("skillSchema", () => {
  it("accepts valid skill", () => {
    const result = skillSchema.safeParse({
      name: "Communication",
      slug: "communication",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing name", () => {
    const result = skillSchema.safeParse({ slug: "test" });
    expect(result.success).toBe(false);
  });
});

describe("skillCategorySchema", () => {
  it("accepts valid skill category", () => {
    const result = skillCategorySchema.safeParse({
      name: "Soft Skills",
      key: "soft-skills",
      color: "#10B981",
    });
    expect(result.success).toBe(true);
  });

  it("defaults order_index to 0", () => {
    const result = skillCategorySchema.safeParse({
      name: "Test",
      key: "test",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.order_index).toBe(0);
    }
  });

  it("rejects invalid hex color", () => {
    const result = skillCategorySchema.safeParse({
      name: "Test",
      key: "test",
      color: "rgb(0,0,0)",
    });
    expect(result.success).toBe(false);
  });
});

describe("userRoleSchema", () => {
  it("accepts all valid roles", () => {
    const roles = ["client", "instructor", "coach", "admin"] as const;
    roles.forEach((role) => {
      const result = userRoleSchema.safeParse({ role });
      expect(result.success).toBe(true);
    });
  });

  it("rejects invalid role", () => {
    const result = userRoleSchema.safeParse({ role: "superadmin" });
    expect(result.success).toBe(false);
  });
});

describe("clientProfileSchema", () => {
  it("defaults status to active", () => {
    const result = clientProfileSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("active");
    }
  });

  it("rejects notes longer than 5000 characters", () => {
    const result = clientProfileSchema.safeParse({
      notes: "a".repeat(5001),
    });
    expect(result.success).toBe(false);
  });
});

describe("decisionCapabilitySettingSchema", () => {
  it("accepts valid decision capability setting", () => {
    const result = decisionCapabilitySettingSchema.safeParse({
      capability: "Strategic Thinking",
      feature_key: "decision_toolkit_basic",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty capability", () => {
    const result = decisionCapabilitySettingSchema.safeParse({
      capability: "",
      feature_key: "decision_toolkit_basic",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid feature_key", () => {
    const result = decisionCapabilitySettingSchema.safeParse({
      capability: "Test",
      feature_key: "invalid_key",
    });
    expect(result.success).toBe(false);
  });
});

// ===========================================================================
// validateForm helper
// ===========================================================================

describe("validateForm", () => {
  it("returns success with parsed data for valid input", () => {
    const result = validateForm(nameSchema, "Valid Name");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("Valid Name");
    }
  });

  it("returns errors record for invalid input", () => {
    const result = validateForm(assessmentFamilySchema, { slug: "test" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toHaveProperty("name");
    }
  });

  it("error keys match field paths", () => {
    const result = validateForm(programSchema, {
      name: "",
      slug: "INVALID",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(Object.keys(result.errors)).toContain("name");
      expect(Object.keys(result.errors)).toContain("slug");
    }
  });

  it("works with any Zod schema", () => {
    const result = validateForm(sessionTypeSchema, {
      name: "Quick Call",
      duration_minutes: 15,
    });
    expect(result.success).toBe(true);
  });
});
