import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { errorResponse, successResponse } from "../_shared/error-response.ts";

/**
 * Phase 5: Complete Registration
 *
 * Called after signup verification (email/password) or OAuth redirect.
 * All paths assign client role + free plan. Coach/instructor applicants
 * additionally submit a role application for admin approval.
 *
 * Input: {
 *   role_choice: 'client' | 'coach' | 'instructor' | 'both',
 *   specialties?: string,
 *   certifications?: string,
 *   bio?: string,
 *   scheduling_url?: string,
 *   message?: string
 * }
 */

interface CompleteRegistrationRequest {
  role_choice: "client" | "coach" | "instructor" | "both";
  specialties?: string;
  certifications?: string;
  bio?: string;
  scheduling_url?: string;
  message?: string;
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
    const userEmail = userData.user.email ?? "";
    const userName = userData.user.user_metadata?.name ??
      userData.user.user_metadata?.full_name ?? "";

    // 2. Parse and validate request
    const body: CompleteRegistrationRequest = await req.json();
    const { role_choice, specialties, certifications, bio, scheduling_url, message } = body;

    if (!role_choice || !["client", "coach", "instructor", "both"].includes(role_choice)) {
      return errorResponse.badRequest("Invalid role_choice. Must be: client, coach, instructor, or both", cors);
    }

    // 3. Check if registration is already complete (idempotency guard)
    // Must also verify user has roles — Google OAuth users get registration_status='complete'
    // from the handle_new_user trigger default, but haven't actually registered yet.
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("registration_status")
      .eq("id", userId)
      .single();

    const { data: existingRoles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    if (
      existingProfile?.registration_status === "complete" &&
      existingRoles && existingRoles.length > 0
    ) {
      return successResponse.ok({ message: "Registration already complete", already_complete: true }, cors);
    }

    // 4. Upsert profile (handles Google OAuth users who may not have a profile yet)
    const { error: profileError } = await supabase
      .from("profiles")
      .upsert({
        id: userId,
        name: userName || undefined,
        username: userEmail,
      }, { onConflict: "id", ignoreDuplicates: false });

    if (profileError) {
      console.error("Error upserting profile:", profileError);
    }

    // 5. Look up free plan
    const { data: freePlan } = await supabase
      .from("plans")
      .select("id")
      .eq("key", "free")
      .single();

    if (!freePlan) {
      console.error("Free plan not found in plans table");
      return errorResponse.serverError("System configuration error: free plan not found", cors);
    }

    // 6. Assign client role (all paths)
    const { error: roleError } = await supabase
      .from("user_roles")
      .upsert(
        { user_id: userId, role: "client" },
        { onConflict: "user_id,role" },
      );

    if (roleError) {
      console.error("Error assigning client role:", roleError);
      return errorResponse.serverError("Failed to assign role", cors);
    }

    // 7. Create client_profiles entry
    await supabase
      .from("client_profiles")
      .upsert(
        { user_id: userId },
        { onConflict: "user_id" },
      );

    // 8. Create notification_preferences
    await supabase
      .from("notification_preferences")
      .upsert(
        { user_id: userId },
        { onConflict: "user_id" },
      );

    // 9. Assign free plan
    await supabase
      .from("profiles")
      .update({ plan_id: freePlan.id })
      .eq("id", userId)
      .is("plan_id", null); // Only set if not already assigned (e.g., via placeholder transfer)

    // 10. Handle coach/instructor role applications
    let registrationStatus = "complete";

    if (role_choice !== "client") {
      // Submit role application
      const { error: requestError } = await supabase
        .from("coach_instructor_requests")
        .insert({
          user_id: userId,
          request_type: role_choice === "both" ? "both" : role_choice,
          source_type: "role_application",
          message: message || null,
          specialties: specialties || null,
          certifications: certifications || null,
          bio: bio || null,
          scheduling_url: scheduling_url || null,
          status: "pending",
        });

      if (requestError) {
        console.error("Error creating role application:", requestError);
        // Non-fatal — user still gets client role
      } else {
        registrationStatus = "pending_approval";
      }

      // Update profile with application data if provided
      const profileUpdates: Record<string, string | null> = {};
      if (bio) profileUpdates.bio = bio;
      if (scheduling_url) profileUpdates.scheduling_url = scheduling_url;
      if (certifications) profileUpdates.certifications = certifications;

      if (Object.keys(profileUpdates).length > 0) {
        await supabase
          .from("profiles")
          .update(profileUpdates)
          .eq("id", userId);
      }
    }

    // 11. Update registration status
    await supabase
      .from("profiles")
      .update({ registration_status: registrationStatus })
      .eq("id", userId);

    // 12. Google OAuth placeholder matching
    // Google OAuth bypasses verify-signup, so check for placeholder here
    await transferPlaceholderIfExists(supabase, userId, userEmail);

    console.log(`Registration completed for ${userEmail}: role_choice=${role_choice}, status=${registrationStatus}`);

    return successResponse.ok({
      message: role_choice === "client"
        ? "Registration complete! Welcome to InnoTrue."
        : "Registration complete! Your coach/instructor application is under review. You can start using the platform as a client.",
      registration_status: registrationStatus,
      role_choice,
    }, cors);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error in complete-registration:", errorMessage);
    return errorResponse.serverError(errorMessage, cors);
  }
});

/**
 * Transfer data from a matching non-hidden placeholder to the real user.
 * Reuses the same 7-table transfer logic from transfer-placeholder-data.
 */
async function transferPlaceholderIfExists(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  userEmail: string,
): Promise<void> {
  if (!userEmail) return;

  // Find non-hidden placeholder with matching real_email
  const { data: placeholder } = await supabase
    .from("profiles")
    .select("id, plan_id")
    .eq("real_email", userEmail)
    .eq("is_hidden", false)
    .neq("id", userId)
    .maybeSingle();

  if (!placeholder) return;

  console.log(`Found placeholder ${placeholder.id} for ${userEmail}, transferring data...`);

  const results: Record<string, number> = {};

  // Transfer client_enrollments
  const { data: enrollments } = await supabase
    .from("client_enrollments")
    .update({ client_user_id: userId })
    .eq("client_user_id", placeholder.id)
    .select("id");
  results.enrollments = enrollments?.length ?? 0;

  // Transfer capability_snapshots
  const { data: snapshots } = await supabase
    .from("capability_snapshots")
    .update({ user_id: userId })
    .eq("user_id", placeholder.id)
    .select("id");
  results.capability_snapshots = snapshots?.length ?? 0;

  // Transfer client_badges
  const { data: badges } = await supabase
    .from("client_badges")
    .update({ user_id: userId })
    .eq("user_id", placeholder.id)
    .select("id");
  results.badges = badges?.length ?? 0;

  // Transfer client_coaches
  const { data: coachRels } = await supabase
    .from("client_coaches")
    .update({ client_id: userId })
    .eq("client_id", placeholder.id)
    .select("id");
  results.coach_relationships = coachRels?.length ?? 0;

  // Transfer client_instructors
  const { data: instructorRels } = await supabase
    .from("client_instructors")
    .update({ client_id: userId })
    .eq("client_id", placeholder.id)
    .select("id");
  results.instructor_relationships = instructorRels?.length ?? 0;

  // Transfer assessment_responses
  const { data: assessments } = await supabase
    .from("assessment_responses")
    .update({ user_id: userId })
    .eq("user_id", placeholder.id)
    .select("id");
  results.assessment_responses = assessments?.length ?? 0;

  // Transfer client_profiles (merge notes if both exist)
  const { data: placeholderClientProfile } = await supabase
    .from("client_profiles")
    .select("*")
    .eq("user_id", placeholder.id)
    .single();

  if (placeholderClientProfile) {
    const { data: targetClientProfile } = await supabase
      .from("client_profiles")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (targetClientProfile) {
      const mergedNotes = [targetClientProfile.notes, placeholderClientProfile.notes]
        .filter(Boolean)
        .join("\n\n--- Transferred from placeholder ---\n\n");
      await supabase
        .from("client_profiles")
        .update({ notes: mergedNotes || null, tags: placeholderClientProfile.tags || targetClientProfile.tags })
        .eq("user_id", userId);
    } else {
      await supabase
        .from("client_profiles")
        .insert({
          user_id: userId,
          status: placeholderClientProfile.status,
          notes: placeholderClientProfile.notes,
          tags: placeholderClientProfile.tags,
        });
    }
    results.client_profile = 1;
  }

  // Copy placeholder's roles
  const { data: placeholderRoles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", placeholder.id);

  if (placeholderRoles?.length) {
    for (const r of placeholderRoles) {
      await supabase
        .from("user_roles")
        .upsert({ user_id: userId, role: r.role }, { onConflict: "user_id,role" });
    }
    results.roles_copied = placeholderRoles.length;
  }

  // Copy placeholder's plan if user doesn't have one (or has free plan)
  if (placeholder.plan_id) {
    await supabase
      .from("profiles")
      .update({ plan_id: placeholder.plan_id })
      .eq("id", userId);
  }

  // Set registration to complete since placeholder had data
  await supabase
    .from("profiles")
    .update({ registration_status: "complete" })
    .eq("id", userId);

  console.log(`Placeholder transfer complete for ${userEmail}:`, results);
}
