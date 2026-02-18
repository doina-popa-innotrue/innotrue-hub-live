import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { isValidUUID } from "../_shared/validation.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { errorResponse, successResponse } from "../_shared/error-response.ts";

interface NotificationRequest {
  assignmentId: string;
  moduleProgressId: string;
  assignmentTypeName: string;
}

const handler = async (req: Request): Promise<Response> => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { assignmentId, moduleProgressId, assignmentTypeName }: NotificationRequest = await req.json();

    // Validate required fields
    if (!assignmentId || !moduleProgressId || !assignmentTypeName) {
      return errorResponse.badRequest("assignmentId, moduleProgressId, and assignmentTypeName are required", cors);
    }

    // Validate UUID formats
    if (!isValidUUID(assignmentId) || !isValidUUID(moduleProgressId)) {
      return errorResponse.badRequest("Invalid ID format", cors);
    }

    // Validate assignmentTypeName length
    if (typeof assignmentTypeName !== "string" || assignmentTypeName.length > 500) {
      return errorResponse.badRequest("Invalid assignment type name", cors);
    }

    const safeAssignmentTypeName = assignmentTypeName.trim();

    console.log("Processing graded assignment notification:", { assignmentId, moduleProgressId, assignmentTypeName: safeAssignmentTypeName });

    // Get assignment details including who graded it
    const { data: assignment, error: assignmentError } = await supabase
      .from("module_assignments")
      .select("id, scored_by, scored_at")
      .eq("id", assignmentId)
      .single();

    if (assignmentError || !assignment) {
      console.error("Error fetching assignment:", assignmentError);
      return errorResponse.notFound("Assignment not found", cors);
    }

    // Get module progress details
    const { data: moduleProgress, error: progressError } = await supabase
      .from("module_progress")
      .select("id, module_id, enrollment_id")
      .eq("id", moduleProgressId)
      .single();

    if (progressError || !moduleProgress) {
      console.error("Error fetching module progress:", progressError);
      return errorResponse.notFound("Module progress not found", cors);
    }

    // Get enrollment details
    const { data: enrollment } = await supabase
      .from("client_enrollments")
      .select("client_user_id, program_id")
      .eq("id", moduleProgress.enrollment_id)
      .single();

    if (!enrollment?.client_user_id) {
      console.log("No client user found for enrollment");
      return successResponse.ok({ message: "No client user found" }, cors);
    }

    const clientUserId = enrollment.client_user_id;

    // Get program name
    const { data: program } = await supabase
      .from("programs")
      .select("name")
      .eq("id", enrollment.program_id)
      .single();

    const programName = program?.name || "Unknown Program";

    // Get instructor/scorer profile
    const { data: scorerProfile } = await supabase
      .from("profiles")
      .select("name")
      .eq("id", assignment.scored_by)
      .single();

    const instructorName = scorerProfile?.name || "Your instructor";

    // Get module info
    const { data: moduleData } = await supabase
      .from("program_modules")
      .select("title")
      .eq("id", moduleProgress.module_id)
      .single();

    const moduleName = moduleData?.title || "Unknown Module";

    // Generate the view link
    const siteUrl = Deno.env.get("SITE_URL") || "https://app.innotrue.com";
    const viewLink = `${siteUrl}/programs/${enrollment.program_id}/modules/${moduleProgress.module_id}`;

    // Use create_notification RPC (handles preference check, in-app + email queue)
    try {
      await supabase.rpc("create_notification", {
        p_user_id: clientUserId,
        p_type_key: "assignment_graded",
        p_title: `Your Assignment Has Been Reviewed: ${safeAssignmentTypeName}`,
        p_message: `${instructorName} reviewed your ${safeAssignmentTypeName} in ${moduleName} (${programName})`,
        p_link: viewLink,
        p_metadata: {
          assignmentId,
          moduleProgressId,
          instructorName,
          assignmentTypeName: safeAssignmentTypeName,
          moduleName,
          programName,
        },
      });

      console.log(`Graded notification queued for client ${clientUserId}`);
    } catch (notifError) {
      console.error("Error creating notification:", notifError);
      return errorResponse.serverErrorWithMessage("Failed to create notification", cors);
    }

    // Fire-and-forget: trigger email queue processing
    try {
      await supabase.functions.invoke("process-email-queue", {
        body: {},
      });
    } catch (queueError) {
      // Queue processing failure is non-critical — emails will be picked up on next run
      console.log("Email queue trigger (non-critical):", queueError);
    }

    return successResponse.ok({
      success: true,
      recipient: clientUserId,
    }, cors);
  } catch (error) {
    return errorResponse.serverError("notify-assignment-graded", error, cors);
  }
};

serve(handler);