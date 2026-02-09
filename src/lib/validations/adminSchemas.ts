import { z } from 'zod';

// ============================================================================
// Common field schemas
// ============================================================================

export const nameSchema = z.string().min(1, 'Name is required').max(100, 'Name is too long');
export const slugSchema = z.string()
  .min(1, 'Slug is required')
  .max(50, 'Slug is too long')
  .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens only');
export const descriptionSchema = z.string().max(1000, 'Description is too long').optional().nullable();
export const optionalUrlSchema = z.string().url('Must be a valid URL').optional().nullable().or(z.literal(''));

// ============================================================================
// Assessment schemas
// ============================================================================

export const assessmentFamilySchema = z.object({
  name: nameSchema,
  slug: slugSchema,
  description: descriptionSchema,
  is_active: z.boolean().default(true),
});

export type AssessmentFamilyFormData = z.infer<typeof assessmentFamilySchema>;

export const assessmentCategorySchema = z.object({
  name: nameSchema,
  description: descriptionSchema,
  is_active: z.boolean().default(true),
  order_index: z.number().int().min(0).optional(),
});

export type AssessmentCategoryFormData = z.infer<typeof assessmentCategorySchema>;

export const capabilityAssessmentSchema = z.object({
  name: nameSchema,
  slug: slugSchema,
  description: descriptionSchema,
  instructions: z.string().max(5000, 'Instructions are too long').optional().nullable(),
  rating_scale: z.number().int().min(3).max(10).default(5),
  is_active: z.boolean().default(true),
  is_public: z.boolean().default(false),
  is_retired: z.boolean().default(false),
  category_id: z.string().uuid().optional().nullable(),
  family_id: z.string().uuid().optional().nullable(),
  program_id: z.string().uuid().optional().nullable(),
  feature_key: z.string().optional().nullable(),
  allow_instructor_eval: z.boolean().default(false),
  pass_fail_enabled: z.boolean().default(false),
  pass_fail_threshold: z.number().min(0).max(100).optional().nullable(),
  pass_fail_mode: z.enum(['percentage', 'score']).optional().nullable(),
});

export type CapabilityAssessmentFormData = z.infer<typeof capabilityAssessmentSchema>;

// ============================================================================
// Program schemas
// ============================================================================

export const programSchema = z.object({
  name: nameSchema,
  slug: slugSchema,
  description: descriptionSchema,
  is_active: z.boolean().default(true),
  is_discoverable: z.boolean().default(true),
  program_type: z.enum(['certification', 'course', 'workshop', 'coaching']).default('course'),
  duration_weeks: z.number().int().min(1).optional().nullable(),
  category: z.string().optional().nullable(),
});

export type ProgramFormData = z.infer<typeof programSchema>;

export const moduleSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title is too long'),
  description: descriptionSchema,
  content: z.string().optional().nullable(),
  order_index: z.number().int().min(0).default(0),
  is_active: z.boolean().default(true),
  module_type_id: z.string().uuid().optional().nullable(),
  duration_minutes: z.number().int().min(0).optional().nullable(),
  prerequisites: z.array(z.string().uuid()).optional(),
});

export type ModuleFormData = z.infer<typeof moduleSchema>;

// ============================================================================
// Session & Assignment Type schemas
// ============================================================================

export const sessionTypeSchema = z.object({
  name: nameSchema,
  description: descriptionSchema,
  duration_minutes: z.number().int().min(5, 'Duration must be at least 5 minutes').max(480, 'Duration cannot exceed 8 hours').default(60),
  is_active: z.boolean().default(true),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color').optional().nullable(),
  icon: z.string().max(50).optional().nullable(),
});

export type SessionTypeFormData = z.infer<typeof sessionTypeSchema>;

export const assignmentTypeSchema = z.object({
  name: nameSchema,
  description: descriptionSchema,
  is_active: z.boolean().default(true),
  requires_submission: z.boolean().default(true),
  allows_feedback: z.boolean().default(true),
  max_score: z.number().int().min(0).optional().nullable(),
});

export type AssignmentTypeFormData = z.infer<typeof assignmentTypeSchema>;

export const moduleTypeSchema = z.object({
  name: nameSchema,
  description: descriptionSchema,
});

export type ModuleTypeFormData = z.infer<typeof moduleTypeSchema>;

// ============================================================================
// Plan schemas
// ============================================================================

export const planSchema = z.object({
  name: nameSchema,
  slug: slugSchema,
  description: descriptionSchema,
  price_cents: z.number().int().min(0).default(0),
  billing_period: z.enum(['monthly', 'yearly', 'one_time', 'lifetime']).default('monthly'),
  is_active: z.boolean().default(true),
  is_public: z.boolean().default(true),
  trial_days: z.number().int().min(0).default(0),
  sort_order: z.number().int().min(0).default(0),
  stripe_price_id: z.string().optional().nullable(),
});

export type PlanFormData = z.infer<typeof planSchema>;

export const programPlanSchema = z.object({
  name: nameSchema,
  description: descriptionSchema,
  tier: z.string().min(1, 'Tier is required'),
  price_cents: z.number().int().min(0).default(0),
  is_active: z.boolean().default(true),
  features: z.array(z.string()).optional(),
});

export type ProgramPlanFormData = z.infer<typeof programPlanSchema>;

// ============================================================================
// Feature & Add-on schemas
// ============================================================================

export const featureSchema = z.object({
  name: nameSchema,
  key: z.string()
    .min(1, 'Key is required')
    .max(50, 'Key is too long')
    .regex(/^[a-z_]+$/, 'Key must be lowercase letters and underscores only'),
  description: descriptionSchema,
  is_active: z.boolean().default(true),
  category: z.string().optional().nullable(),
});

export type FeatureFormData = z.infer<typeof featureSchema>;

export const addOnSchema = z.object({
  name: nameSchema,
  key: z.string()
    .min(1, 'Key is required')
    .max(50, 'Key is too long')
    .regex(/^[a-z_]+$/, 'Key must be lowercase letters and underscores only'),
  description: descriptionSchema,
  price_cents: z.number().int().min(0).default(0),
  is_active: z.boolean().default(true),
  is_consumable: z.boolean().default(false),
  initial_quantity: z.number().int().min(0).optional().nullable(),
});

export type AddOnFormData = z.infer<typeof addOnSchema>;

// ============================================================================
// Track schemas
// ============================================================================

export const trackSchema = z.object({
  name: nameSchema,
  slug: slugSchema,
  description: descriptionSchema,
  is_active: z.boolean().default(true),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color').optional().nullable(),
  icon: z.string().max(50).optional().nullable(),
});

export type TrackFormData = z.infer<typeof trackSchema>;

// ============================================================================
// Skill schemas
// ============================================================================

export const skillSchema = z.object({
  name: nameSchema,
  slug: slugSchema,
  description: descriptionSchema,
  category_id: z.string().uuid().optional().nullable(),
  is_active: z.boolean().default(true),
});

export type SkillFormData = z.infer<typeof skillSchema>;

export const skillCategorySchema = z.object({
  name: nameSchema,
  key: slugSchema,
  description: descriptionSchema,
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color').optional().nullable(),
  icon: z.string().max(50).optional().nullable(),
  order_index: z.number().int().default(0),
  is_active: z.boolean().default(true),
});

export type SkillCategoryFormData = z.infer<typeof skillCategorySchema>;

// ============================================================================
// Resource schemas
// ============================================================================

export const resourceSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title is too long'),
  description: descriptionSchema,
  resource_type: z.enum(['pdf', 'video', 'link', 'document', 'image', 'audio']).default('link'),
  url: z.string().url('Must be a valid URL').optional().nullable(),
  is_active: z.boolean().default(true),
  is_premium: z.boolean().default(false),
  order_index: z.number().int().min(0).default(0),
});

export type ResourceFormData = z.infer<typeof resourceSchema>;

// ============================================================================
// User management schemas
// ============================================================================

export const userRoleSchema = z.object({
  role: z.enum(['client', 'instructor', 'coach', 'admin']),
});

export type UserRoleFormData = z.infer<typeof userRoleSchema>;

export const clientProfileSchema = z.object({
  status: z.enum(['active', 'inactive', 'pending']).default('active'),
  notes: z.string().max(5000).optional().nullable(),
  status_marker: z.string().optional().nullable(),
});

export type ClientProfileFormData = z.infer<typeof clientProfileSchema>;

// ============================================================================
// Decision capability schemas
// ============================================================================

export const decisionCapabilitySettingSchema = z.object({
  capability: z.string().min(1, 'Capability is required'),
  feature_key: z.enum(['decision_toolkit_basic', 'decision_toolkit_advanced']),
});

export type DecisionCapabilitySettingFormData = z.infer<typeof decisionCapabilitySettingSchema>;

// ============================================================================
// Validation helper
// ============================================================================

/**
 * Validates form data against a schema and returns typed result.
 * 
 * @example
 * ```tsx
 * const result = validateForm(assessmentFamilySchema, formData);
 * if (result.success) {
 *   // result.data is typed as AssessmentFamilyFormData
 *   handleSubmit(result.data);
 * } else {
 *   // result.errors contains field-level errors
 *   setErrors(result.errors);
 * }
 * ```
 */
export function validateForm<T extends z.ZodSchema>(
  schema: T,
  data: unknown
): { success: true; data: z.infer<T> } | { success: false; errors: Record<string, string> } {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const path = issue.path.join('.');
    errors[path] = issue.message;
  }
  
  return { success: false, errors };
}
