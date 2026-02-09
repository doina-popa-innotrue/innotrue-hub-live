import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getStagingRecipients, getStagingSubject } from "../_shared/email-utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  moduleProgressId: string;
  assignmentId: string;
  assignmentTypeName: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { moduleProgressId, assignmentId, assignmentTypeName }: NotificationRequest = await req.json();

    // Get module progress details
    const { data: moduleProgress, error: progressError } = await supabase
      .from("module_progress")
      .select(`
        id,
        module_id,
        enrollment_id
      `)
      .eq("id", moduleProgressId)
      .single();

    if (progressError || !moduleProgress) {
      console.error("Error fetching module progress:", progressError);
      return new Response(JSON.stringify({ error: "Module progress not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get enrollment details separately
    const { data: enrollment } = await supabase
      .from("client_enrollments")
      .select("client_user_id, program_id")
      .eq("id", moduleProgress.enrollment_id)
      .single();

    // Get program_id from module if not available from enrollment
    let programId = enrollment?.program_id;
    
    if (!programId) {
      // Fallback: get program_id directly from the module
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

    // Program-level instructors
    if (programId) {
      const { data: programInstructors } = await supabase
        .from("program_instructors")
        .select("instructor_id")
        .eq("program_id", programId);

      programInstructors?.forEach((pi) => recipientIds.add(pi.instructor_id));

      // Program-level coaches
      const { data: programCoaches } = await supabase
        .from("program_coaches")
        .select("coach_id")
        .eq("program_id", programId);

      programCoaches?.forEach((pc) => recipientIds.add(pc.coach_id));
    }

    if (recipientIds.size === 0) {
      console.log("No instructors or coaches to notify");
      return new Response(JSON.stringify({ message: "No recipients found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get recipient emails
    const recipientIdsArray = Array.from(recipientIds);
    const recipientEmails: string[] = [];

    for (const recipientId of recipientIdsArray) {
      const { data: userData } = await supabase.auth.admin.getUserById(recipientId);
      if (userData?.user?.email) {
        recipientEmails.push(userData.user.email);
      }
    }

    if (recipientEmails.length === 0 || !resendApiKey) {
      console.log("No emails to send or Resend not configured");
      return new Response(JSON.stringify({ message: "No emails sent" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch email template from database
    const { data: template } = await supabase
      .from("email_templates")
      .select("subject, html_content")
      .eq("template_key", "assignment_submitted")
      .single();

    // Generate the review link
    const siteUrl = Deno.env.get("SITE_URL") || "https://app.innotrue.com";
    const reviewLink = `${siteUrl}/teaching/assignments`;

    let emailSubject: string;
    let emailHtml: string;

    if (template) {
      // Use database template with variable substitution
      emailSubject = template.subject
        .replace(/\{\{assignmentName\}\}/g, assignmentTypeName)
        .replace(/\{\{clientName\}\}/g, clientName);

      emailHtml = template.html_content
        .replace(/\{\{clientName\}\}/g, clientName)
        .replace(/\{\{assignmentName\}\}/g, assignmentTypeName)
        .replace(/\{\{moduleName\}\}/g, moduleTitle)
        .replace(/\{\{programName\}\}/g, programTitle)
        .replace(/\{\{reviewLink\}\}/g, reviewLink);
    } else {
      // Fallback to default template
      emailSubject = `Assignment Submitted: ${assignmentTypeName} - ${clientName}`;
      emailHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
              .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
              .assignment-info { background: white; padding: 15px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #6366f1; }
              .btn { display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 15px; }
              .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0;">Assignment Submitted</h1>
              </div>
              <div class="content">
                <p>Hello,</p>
                <p><strong>${clientName}</strong> has submitted an assignment for your review.</p>
                
                <div class="assignment-info">
                  <p style="margin: 0 0 8px 0;"><strong>Assignment:</strong> ${assignmentTypeName}</p>
                  <p style="margin: 0 0 8px 0;"><strong>Module:</strong> ${moduleTitle}</p>
                  <p style="margin: 0;"><strong>Program:</strong> ${programTitle}</p>
                </div>
                
                <p>Please log in to the InnoTrue Hub to review the submission and provide feedback.</p>
                
                <a href="${reviewLink}" class="btn">
                  Review Assignment
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

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "InnoTrue Hub <notifications@mail.innotrue.com>",
        to: getStagingRecipients(recipientEmails),
        subject: getStagingSubject(emailSubject, recipientEmails),
        html: emailHtml,
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error("Resend API error:", errorText);
      return new Response(JSON.stringify({ error: "Failed to send email" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Notification sent to ${recipientEmails.length} recipients`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        recipientCount: recipientEmails.length 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in notify-assignment-submitted:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);
