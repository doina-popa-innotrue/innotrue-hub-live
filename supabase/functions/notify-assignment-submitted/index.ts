import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { isValidUUID } from "../_shared/validation.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { errorResponse, successResponse } from "../_shared/error-response.ts";

interface NotificationRequest {
  moduleProgressId: string;
  assignmentId: string;
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

    const { moduleProgressId, assignmentId, assignmentTypeName }: NotificationRequest = await req.json();

    // Validate required fields
    if (!moduleProgressId || !assignmentId || !assignmentTypeName) {
      return errorResponse.badRequest("moduleProgressId, assignmentId, and assignmentTypeName are required", cors);
    }

    // Validate UUID formats
    if (!isValidUUID(moduleProgressId) || !isValidUUID(assignmentId)) {
      return errorResponse.badRequest("Invalid ID format", cors);
    }

    // Validate assignmentTypeName length
    if (typeof assignmentTypeName !== "string" || assignmentTypeName.length > 500) {
      return errorResponse.badRequest("Invalid assignment type name", cors);
    }

    const safeAssignmentTypeName = assignmentTypeName.trim();

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

    // Get program_id from module if not available from enrollment
    let programId = enrollment?.program_id;
    if (!programId) {
      const { data: moduleData } = await supabase
        .from("program_modules")
        .select("program_id")
        .eq("id", moduleProgress.module_id)
        .single();
      programId = moduleData?.program_id;
    }

    // Get program title
    const { data: program } = await supabase
      .from("programs")
      .select("title")
      .eq("id", programId)
      .single();

    const clientUserId = enrollment?.client_user_id;
    const programTitle = program?.title || "Unknown Program";

    // Get client name
    const { data: clientProfile } = await supabase
      .from("profiles")
      .select("name")
      .eq("id", clientUserId)
      .single();

    const clientName = clientProfile?.name || "A client";

    // Get module info
    const { data: moduleData } = await supabase
      .from("program_modules")
      .select("title")
      .eq("id", moduleProgress.module_id)
      .single();

    const moduleTitle = moduleData?.title || "Unknown Module";

    // Get instructors and coaches assigned to this module or program
    const recipientIds = new Set<string>();

    // Module-level instructors
    const { data: moduleInstructors } = await supabase
      .from("module_instructors")
      .select("instructor_id")
      .eq("module_id", moduleProgress.module_id);

    moduleInstructors?.forEach((mi) => recipientIds.add(mi.instructor_id));

    // Module-level coaches
    const { data: moduleCoaches } = await supabase
      .from("module_coaches")
      .select("coach_id")
      .eq("module_id", moduleProgress.module_id);

    moduleCoaches?.forEach((mc) => recipientIds.add(mc.coach_id));

    // Program-level instructors and coaches
    if (programId) {
      const { data: programInstructors } = await supabase
        .from("program_instructors")
        .select("instructor_id")
        .eq("program_id", programId);

      programInstructors?.forEach((pi) => recipientIds.add(pi.instructor_id));

      const { data: programCoaches } = await supabase
        .from("program_coaches")
        .select("coach_id")
        .eq("program_id", programId);

      programCoaches?.forEach((pc) => recipientIds.add(pc.coach_id));
    }

    if (recipientIds.size === 0) {
      console.log("No instructors or coaches to notify");
      return successResponse.ok({ message: "No recipients found" }, cors);
    }

    // Use create_notification RPC for each recipient (async via email_queue)
    const recipientIdsArray = Array.from(recipientIds);
    let notifiedCount = 0;

    for (const recipientId of recipientIdsArray) {
      try {
        await supabase.rpc("create_notification", {
          p_user_id: recipientId,
          p_type_key: "assignment_submitted",
          p_title: `Assignment Submitted: ${safeAssignmentTypeName}`,
          p_message: `${clientName} submitted ${safeAssignmentTypeName} in ${moduleTitle} (${programTitle})`,
          p_link: "/teaching/assignments",
          p_metadata: {
            assignmentId,
            moduleProgressId,
            clientName,
            assignmentTypeName: safeAssignmentTypeName,
            moduleName: moduleTitle,
            programName: programTitle,
          },
        });
        notifiedCount++;
      } catch (notifError) {
        console.error(`Error notifying recipient ${recipientId}:`, notifError);
      }
    }

    console.log(`Notifications queued for ${notifiedCount}/${recipientIdsArray.length} recipients`);

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
      recipientCount: notifiedCount,
    }, cors);
  } catch (error) {
    return errorResponse.serverError("notify-assignment-submitted", error, cors);
  }
};

serve(handler);
