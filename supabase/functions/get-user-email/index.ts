import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { errorResponse, successResponse } from "../_shared/error-response.ts";

// Input validation
function validateUserId(userId: unknown): string | null {
  if (typeof userId !== 'string' || !userId) {
    return null;
  }
  // UUID format validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(userId)) {
    return null;
  }
  return userId;
}

serve(async (req: Request): Promise<Response> => {
  const cors = getCorsHeaders(req);

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Get the authorization header to verify the requesting user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // Create client with user's token to verify they're authenticated
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the user is authenticated
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const userId = validateUserId(body?.userId);

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Invalid userId format. Must be a valid UUID." }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // Check if the requesting user has access
    let hasAccess = false;

    // First check if the requesting user is an admin - admins can fetch any email
    const { data: requesterAdminRole } = await supabaseClient
      .from("user_roles")
      .select("id")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .limit(1);

    if (requesterAdminRole && requesterAdminRole.length > 0) {
      hasAccess = true;
    }

    // If not admin, check if the requesting user has a valid relationship with the target user
    // They must be:
    // 1. Enrolled in a program where target is instructor/coach
    // 2. Or target is an admin
    if (!hasAccess) {
      // Check if target is an instructor/coach for any of the user's enrolled programs
      const { data: enrollments } = await supabaseClient
        .from("client_enrollments")
        .select("program_id")
        .eq("client_user_id", user.id);

      const programIds = enrollments?.map(e => e.program_id) || [];

      if (programIds.length > 0) {
        // Check if target is instructor for any enrolled program
        const { data: instructorMatch } = await supabaseClient
          .from("program_instructors")
          .select("id")
          .eq("instructor_id", userId)
          .in("program_id", programIds)
          .limit(1);

        if (instructorMatch && instructorMatch.length > 0) {
          hasAccess = true;
        }

        // Check if target is coach for any enrolled program
        if (!hasAccess) {
          const { data: coachMatch } = await supabaseClient
            .from("program_coaches")
            .select("id")
            .eq("coach_id", userId)
            .in("program_id", programIds)
            .limit(1);

          if (coachMatch && coachMatch.length > 0) {
            hasAccess = true;
          }
        }

        // Check module-level assignments
        if (!hasAccess) {
          const { data: modules } = await supabaseClient
            .from("program_modules")
            .select("id")
            .in("program_id", programIds);

          const moduleIds = modules?.map(m => m.id) || [];

          if (moduleIds.length > 0) {
            const { data: moduleInstructorMatch } = await supabaseClient
              .from("module_instructors")
              .select("id")
              .eq("instructor_id", userId)
              .in("module_id", moduleIds)
              .limit(1);

            if (moduleInstructorMatch && moduleInstructorMatch.length > 0) {
              hasAccess = true;
            }

            if (!hasAccess) {
              const { data: moduleCoachMatch } = await supabaseClient
                .from("module_coaches")
                .select("id")
                .eq("coach_id", userId)
                .in("module_id", moduleIds)
                .limit(1);

              if (moduleCoachMatch && moduleCoachMatch.length > 0) {
                hasAccess = true;
              }
            }
          }
        }
      }

      // Also allow if target is an admin
      if (!hasAccess) {
        const { data: adminRole } = await supabaseClient
          .from("user_roles")
          .select("id")
          .eq("user_id", userId)
          .eq("role", "admin")
          .limit(1);

        if (adminRole && adminRole.length > 0) {
          hasAccess = true;
        }
      }
    }

    if (!hasAccess) {
      return new Response(
        JSON.stringify({ error: "Access denied" }),
        { status: 403, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // Get the email using admin client
    const { data: targetUser, error: userError } = await supabaseClient.auth.admin.getUserById(userId);

    if (userError || !targetUser?.user?.email) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // Check if user is disabled (banned_until is in the future)
    const bannedUntil = (targetUser.user as any).banned_until;
    const isDisabled = bannedUntil ? new Date(bannedUntil) > new Date() : false;

    return new Response(
      JSON.stringify({ 
        email: targetUser.user.email,
        isDisabled 
      }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error("Error in get-user-email:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});
