import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { errorResponse, successResponse } from "../_shared/error-response.ts";

/**
 * 2B.2: Redeem a partner code to self-enroll in a program.
 *
 * Input: { code: string }
 * - Validates the code via validate_partner_code RPC
 * - Checks user is not already enrolled
 * - Calls enroll_with_credits RPC for free/discounted enrollments
 * - Records partner referral in partner_referrals
 * - Increments code usage counter
 * - Notifies the partner
 */

function validateCode(code: unknown): string | null {
  if (typeof code !== "string" || !code.trim()) return null;
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
      return errorResponse.badRequest("Invalid partner code format", cors);
    }

    // 3. Validate code via RPC (checks active, not expired, not at max_uses)
    const { data: codeValidation, error: validationError } = await supabase.rpc(
      "validate_partner_code",
      { p_code: code },
    );

    if (validationError) {
      console.error("Partner code validation error:", validationError);
      return errorResponse.serverError("redeem-partner-code", validationError, cors);
    }

    if (!codeValidation?.valid) {
      return errorResponse.notFound(
        codeValidation?.error || "Invalid or expired partner code",
        cors,
      );
    }

    const programId = codeValidation.program_id;
    const partnerId = codeValidation.partner_id;
    const codeId = codeValidation.code_id;

    // 4. Check if user is already enrolled in this program
    const { data: existingEnrollment } = await supabase
      .from("client_enrollments")
      .select("id")
      .eq("client_user_id", userId)
      .eq("program_id", programId)
      .eq("status", "active")
      .maybeSingle();

    if (existingEnrollment) {
      return errorResponse.badRequest(
        "You are already enrolled in this program",
        cors,
      );
    }

    // 5. Check program capacity
    const { data: progCapacity } = await supabase.rpc("check_program_capacity", {
      p_program_id: programId,
    });

    if (progCapacity && !progCapacity.has_capacity) {
      return errorResponse.badRequest(
        `This program is at full capacity (${progCapacity.enrolled_count}/${progCapacity.capacity}).`,
        cors,
      );
    }

    // 5b. Check cohort capacity if code targets a specific cohort
    if (codeValidation.cohort_id) {
      const { data: cohortCapacity } = await supabase.rpc("check_cohort_capacity", {
        p_cohort_id: codeValidation.cohort_id,
      });

      if (cohortCapacity && !cohortCapacity.has_capacity) {
        return errorResponse.badRequest(
          `This cohort is at full capacity (${cohortCapacity.enrolled_count}/${cohortCapacity.capacity}).`,
          cors,
        );
      }
    }

    // 6. Only process free enrollments for now (same as enrollment codes)
    const isFreeEnrollment =
      codeValidation.is_free || codeValidation.discount_percent === 100;

    if (!isFreeEnrollment) {
      return errorResponse.badRequest(
        "Paid enrollment via partner code is not yet supported. Please contact the administrator.",
        cors,
      );
    }

    // 7. Call enroll_with_credits RPC (atomic: creates enrollment, handles credits)
    //    Pass grants_tier from the partner code; the RPC defaults to the
    //    program's lowest tier when NULL.
    const { data: enrollResult, error: enrollError } = await supabase.rpc(
      "enroll_with_credits",
      {
        p_client_user_id: userId,
        p_program_id: programId,
        p_tier: codeValidation.grants_tier || null,
        p_program_plan_id: null,
        p_discount_percent: codeValidation.is_free
          ? 100
          : codeValidation.discount_percent || null,
        p_original_credit_cost: 0,
        p_final_credit_cost: 0,
        p_description: `Self-enrolled via partner code ${code}`,
        p_cohort_id: codeValidation.cohort_id || null,
        p_enrollment_source: "partner_referral",
        p_referred_by: partnerId,
        p_referral_note: `Via partner code ${code}`,
      },
    );

    if (enrollError) {
      console.error("Enrollment RPC error:", enrollError);
      return errorResponse.serverError("redeem-partner-code", enrollError, cors);
    }

    if (!enrollResult?.success) {
      return errorResponse.badRequest(
        enrollResult?.error || "Enrollment failed",
        cors,
      );
    }

    const enrollmentId = enrollResult.enrollment_id;

    // 8. Record partner referral (non-fatal — enrollment already succeeded)
    const { error: referralError } = await supabase
      .from("partner_referrals")
      .insert({
        partner_code_id: codeId,
        partner_id: partnerId,
        referred_user_id: userId,
        enrollment_id: enrollmentId,
        referral_type: "enrollment",
        status: "attributed",
      });

    if (referralError) {
      console.error("Failed to record partner referral:", referralError);
    }

    // 9. Increment code usage counter (non-fatal)
    const { error: usageError } = await supabase.rpc("validate_partner_code", {
      p_code: code,
    });
    // Actually increment via direct update for atomicity
    const { data: currentCode } = await supabase
      .from("partner_codes")
      .select("current_uses")
      .eq("id", codeId)
      .single();

    if (currentCode) {
      const { error: updateError } = await supabase
        .from("partner_codes")
        .update({ current_uses: currentCode.current_uses + 1 })
        .eq("id", codeId);

      if (updateError) {
        console.error("Failed to increment partner code usage:", updateError);
      }
    }

    // 10. Notify the partner
    try {
      await supabase.rpc("create_notification", {
        p_user_id: partnerId,
        p_type_key: "partner_code_redeemed",
        p_title: "Partner Code Redeemed",
        p_message: `${userEmail} enrolled in ${codeValidation.program_name} using your partner code ${code}`,
        p_link: "/teaching",
        p_metadata: {
          enrollment_id: enrollmentId,
          partner_code_id: codeId,
          code: code,
          user_email: userEmail,
          program_name: codeValidation.program_name,
        },
      });
    } catch (notifError) {
      // Non-fatal — enrollment succeeded even if notification fails
      console.error("Failed to send partner notification:", notifError);
    }

    console.log(
      `User ${userEmail} enrolled in ${codeValidation.program_name} via partner code ${code}`,
    );

    return successResponse.ok(
      {
        success: true,
        enrollment_id: enrollmentId,
        program_name: codeValidation.program_name,
        program_slug: codeValidation.program_slug,
        program_id: programId,
      },
      cors,
    );
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    console.error("Error in redeem-partner-code:", errorMessage);
    return errorResponse.serverError(
      "redeem-partner-code",
      error,
      cors,
    );
  }
});
