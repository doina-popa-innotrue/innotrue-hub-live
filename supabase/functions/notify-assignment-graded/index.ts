import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { checkUserEmailStatus, getStagingRecipient, getStagingSubject } from "../_shared/email-utils.ts";
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
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

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

    // HTML-escape helper to prevent XSS in email templates
    const escapeHtml = (str: string): string =>
      str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");

    const safeAssignmentTypeName = escapeHtml(assignmentTypeName.trim());

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

    // Use centralized check for user email status
    const userStatus = await checkUserEmailStatus(supabase, clientUserId);

    if (!userStatus.canReceiveEmails) {
      console.log(`Client ${clientUserId} is ${userStatus.reason}, skipping notification`);
      return successResponse.ok({ message: `Client is ${userStatus.reason}`, skipped: true }, cors);
    }

    if (!userStatus.email) {
      console.log("No email found for client");
      return successResponse.ok({ message: "No client email found" }, cors);
    }

    const clientEmail = userStatus.email;
    const clientName = userStatus.name || "Client";

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

    // Check client notification preferences
    const { data: notifPrefs } = await supabase
      .from("notification_preferences")
      .select("assignment_graded")
      .eq("user_id", clientUserId)
      .single();

    // Default to true if no preferences set
    const shouldNotify = notifPrefs?.assignment_graded !== false;

    if (!shouldNotify) {
      console.log("Client has disabled assignment_graded notifications");
      return successResponse.ok({ message: "Notifications disabled by user" }, cors);
    }

    if (!resendApiKey) {
      console.log("Resend not configured, skipping email");
      return successResponse.ok({ message: "Email service not configured" }, cors);
    }

    // Fetch email template from database
    const { data: template } = await supabase
      .from("email_templates")
      .select("subject, html_content")
      .eq("template_key", "assignment_graded")
      .single();

    // Generate the view link with login hint for SSO
    const siteUrl = Deno.env.get("SITE_URL") || "https://app.innotrue.com";
    const baseUrl = `${siteUrl}/programs/${enrollment.program_id}/modules/${moduleProgress.module_id}`;
    const viewLink = `${baseUrl}?expected_user=${clientUserId}&login_hint=${encodeURIComponent(clientEmail)}`;

    let emailSubject: string;
    let emailHtml: string;

    if (template) {
      // Use database template with variable substitution
      emailSubject = template.subject
        .replace(/\{\{assignmentName\}\}/g, safeAssignmentTypeName)
        .replace(/\{\{clientName\}\}/g, clientName);

      emailHtml = template.html_content
        .replace(/\{\{clientName\}\}/g, clientName)
        .replace(/\{\{instructorName\}\}/g, instructorName)
        .replace(/\{\{assignmentName\}\}/g, safeAssignmentTypeName)
        .replace(/\{\{moduleName\}\}/g, moduleName)
        .replace(/\{\{programName\}\}/g, programName)
        .replace(/\{\{viewLink\}\}/g, viewLink);
    } else {
      // Fallback to default template
      emailSubject = `Your Assignment Has Been Reviewed: ${safeAssignmentTypeName}`;
      emailHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
              .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
              .assignment-info { background: white; padding: 15px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #10b981; }
              .btn { display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 15px; }
              .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0;">✅ Your Assignment Has Been Reviewed</h1>
              </div>
              <div class="content">
                <p>Hi ${escapeHtml(clientName)},</p>
                <p>Good news! Your assignment has been reviewed by <strong>${escapeHtml(instructorName)}</strong>.</p>

                <div class="assignment-info">
                  <p style="margin: 0 0 8px 0;"><strong>Assignment:</strong> ${safeAssignmentTypeName}</p>
                  <p style="margin: 0 0 8px 0;"><strong>Module:</strong> ${escapeHtml(moduleName)}</p>
                  <p style="margin: 0;"><strong>Program:</strong> ${escapeHtml(programName)}</p>
                </div>
                
                <p>Log in to view your feedback and assessment results.</p>
                
                <a href="${viewLink}" class="btn">
                  View Feedback
                </a>
              </div>
              <div class="footer">
                <p>This is an automated notification from InnoTrue Hub.</p>
              </div>
            </div>
          </body>
        </html>
      `;
    }

    // Send email notification
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "InnoTrue Hub <notifications@mail.innotrue.com>",
        to: [getStagingRecipient(clientEmail)],
        subject: getStagingSubject(emailSubject, clientEmail),
        html: emailHtml,
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error("Resend API error:", errorText);
      return errorResponse.serverErrorWithMessage("Failed to send email", cors);
    }

    console.log(`Graded notification sent to ${clientEmail}`);

    return successResponse.ok({
      success: true,
      recipient: clientEmail
    }, cors);
  } catch (error) {
    return errorResponse.serverError("notify-assignment-graded", error, cors);
  }
};

serve(handler);