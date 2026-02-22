import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { errorResponse, successResponse } from "../_shared/error-response.ts";

/**
 * G8: Redeem an enrollment code to self-enroll in a program.
 *
 * Input: { code: string }
 * - Validates the code (active, not expired, not at max_uses)
 * - Checks user is not already enrolled
 * - Calls enroll_with_credits RPC for free enrollments
 * - Increments code usage counter
 * - Notifies the code creator
 */

function validateCode(code: unknown): string | null {
  if (typeof code !== "string" || !code.trim()) return null;
  // Codes are alphanumeric, 3-20 chars (e.g., "ENRABCDEF")
  const cleaned = code.trim().toUpperCase();
  if (cleaned.length < 3 || cleaned.length > 30) return null;
  if (!/^[A-Z0-9_-]+$/.test(cleaned)) return null;
  return cleaned;
}

serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    // 1. Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return errorResponse.unauthorized("No authorization header", cors);
    }

    const jwt = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
    if (userError || !userData.user) {
      return errorResponse.unauthorized("Invalid auth token", cors);
    }

    const userId = userData.user.id;
    const userEmail = userData.user.email ?? "unknown";

    // 2. Parse and validate input
    const body = await req.json();
    const code = validateCode(body?.code);
    if (!code) {
      return errorResponse.badRequest("Invalid enrollment code format", cors);
    }

    // 3. Fetch code with program info (service role bypasses RLS)
    const { data: enrollCode, error: codeError } = await supabase
      .from("enrollment_codes")
      .select(
        `
        *,
        programs:program_id(id, name, slug, is_active)
      `,
      )
      .eq("code", code)
      .single();

    if (codeError || !enrollCode) {
      return errorResponse.notFound("Invalid enrollment code", cors);
    }

    // 4. Validate code status
    if (!enrollCode.is_active) {
      return errorResponse.badRequest("This enrollment code is no longer active", cors);
    }

    if (!enrollCode.programs?.is_active) {
      return errorResponse.badRequest("This program is no longer available", cors);
    }

    if (enrollCode.expires_at && new Date(enrollCode.expires_at) < new Date()) {
      return errorResponse.badRequest("This enrollment code has expired", cors);
    }

    if (
      enrollCode.max_uses !== null &&
      enrollCode.current_uses >= enrollCode.max_uses
    ) {
      return errorResponse.badRequest(
        "This enrollment code has reached its usage limit",
        cors,
      );
    }

    // 5. Check if user is already enrolled in this program
    const { data: existingEnrollment } = await supabase
      .from("client_enrollments")
      .select("id")
      .eq("client_user_id", userId)
      .eq("program_id", enrollCode.program_id)
      .eq("status", "active")
      .maybeSingle();

    if (existingEnrollment) {
      return errorResponse.badRequest(
        "You are already enrolled in this program",
        cors,
      );
    }

    // 5b. Check program capacity
    const { data: progCapacity } = await supabase.rpc("check_program_capacity", {
      p_program_id: enrollCode.program_id,
    });

    if (progCapacity && !progCapacity.has_capacity) {
      return errorResponse.badRequest(
        `This program is at full capacity (${progCapacity.enrolled_count}/${progCapacity.capacity}).`,
        cors,
      );
    }

    // 5c. Check cohort capacity if code targets a specific cohort
    if (enrollCode.cohort_id) {
      const { data: cohortCapacity } = await supabase.rpc("check_cohort_capacity", {
        p_cohort_id: enrollCode.cohort_id,
      });

      if (cohortCapacity && !cohortCapacity.has_capacity) {
        return errorResponse.badRequest(
          `This cohort is at full capacity (${cohortCapacity.enrolled_count}/${cohortCapacity.capacity}).`,
          cors,
        );
      }
    }

    // 6. G8 scope: only process free enrollments
    const isFreeEnrollment =
      enrollCode.is_free || enrollCode.discount_percent === 100;

    if (!isFreeEnrollment) {
      return errorResponse.badRequest(
        "Paid enrollment via code is not yet supported. Please contact the administrator.",
        cors,
      );
    }

    // 7. Call enroll_with_credits RPC (atomic: creates enrollment, handles credits)
    const { data: enrollResult, error: enrollError } = await supabase.rpc(
      "enroll_with_credits",
      {
        p_client_user_id: userId,
        p_program_id: enrollCode.program_id,
        p_tier: enrollCode.grants_tier || null,
        p_program_plan_id: enrollCode.grants_plan_id || null,
        p_discount_percent: enrollCode.is_free
          ? 100
          : enrollCode.discount_percent || null,
        p_original_credit_cost: 0,
        p_final_credit_cost: 0,
        p_description: `Self-enrolled via code ${enrollCode.code}`,
        p_cohort_id: enrollCode.cohort_id || null,
        p_enrollment_source: "enrollment_code",
        p_referred_by: enrollCode.created_by || null,
        p_referral_note: `Via code ${enrollCode.code}`,
      },
    );

    if (enrollError) {
      console.error("Enrollment RPC error:", enrollError);
      return errorResponse.serverError(
        "redeem-enrollment-code",
        enrollError,
        cors,
      );
    }

    if (!enrollResult?.success) {
      return errorResponse.badRequest(
        enrollResult?.error || "Enrollment failed",
        cors,
      );
    }

    const enrollmentId = enrollResult.enrollment_id;

    // 8. Link enrollment to the code + increment usage counter
    // These are non-fatal — enrollment already succeeded
    const { error: linkError } = await supabase
      .from("client_enrollments")
      .update({ enrollment_code_id: enrollCode.id })
      .eq("id", enrollmentId);

    if (linkError) {
      console.error("Failed to link enrollment to code:", linkError);
    }

    const { error: usageError } = await supabase
      .from("enrollment_codes")
      .update({ current_uses: enrollCode.current_uses + 1 })
      .eq("id", enrollCode.id);

    if (usageError) {
      console.error("Failed to increment code usage:", usageError);
    }

    // For single_use codes, deactivate after use
    if (enrollCode.code_type === "single_use") {
      await supabase
        .from("enrollment_codes")
        .update({ is_active: false })
        .eq("id", enrollCode.id);
    }

    // 9. Notify code creator
    try {
      await supabase.rpc("create_notification", {
        p_user_id: enrollCode.created_by,
        p_type_key: "enrollment_code_redeemed",
        p_title: "Enrollment Code Redeemed",
        p_message: `${userEmail} enrolled in ${enrollCode.programs.name} using code ${enrollCode.code}`,
        p_link: "/admin/enrollment-codes",
        p_metadata: {
          enrollment_id: enrollmentId,
          enrollment_code_id: enrollCode.id,
          code: enrollCode.code,
          user_email: userEmail,
          program_name: enrollCode.programs.name,
        },
      });
    } catch (notifError) {
      // Non-fatal — enrollment succeeded even if notification fails
      console.error("Failed to send notification:", notifError);
    }

    console.log(
      `User ${userEmail} enrolled in ${enrollCode.programs.name} via code ${enrollCode.code}`,
    );

    return successResponse.ok(
      {
        success: true,
        enrollment_id: enrollmentId,
        program_name: enrollCode.programs.name,
        program_slug: enrollCode.programs.slug,
        program_id: enrollCode.program_id,
      },
      cors,
    );
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    console.error("Error in redeem-enrollment-code:", errorMessage);
    return errorResponse.serverError(
      "redeem-enrollment-code",
      error,
      cors,
    );
  }
});
