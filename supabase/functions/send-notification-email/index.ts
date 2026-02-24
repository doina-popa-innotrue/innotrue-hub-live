import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { checkUserEmailStatus, isAdminNotificationType, isGlobalEmailMuted, ADMIN_NOTIFICATION_TYPES, getStagingRecipients, getStagingSubject } from "../_shared/email-utils.ts";
import { isValidEmail } from "../_shared/validation.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { errorResponse, successResponse } from "../_shared/error-response.ts";

// CORS headers - allow calls from web app
interface NotificationRequest {
  email?: string;
  userId?: string;
  name: string;
  type: "profile_update" | "password_change" | "email_change" | "email_change_old" | "email_change_new" | "email_change_verification" | "email_change_initiated" | "admin_email_change" | "program_assignment" | "talentlms_reconnect_request" | "tier_change" | "instructor_program_assignment" | "coach_program_assignment" | "instructor_module_assignment" | "coach_module_assignment" | "goal_shared" | "goal_feedback" | "program_interest_registration" | "schedule_reminder" | "waitlist_spot_available" | "registration_follow_up" | "account_deactivation_request" | "account_deletion_request" | "subscription_plan_request" | "subscription_addon_request" | "badge_issued" | "circle_connection_request" | "session_request" | "session_scheduled" | "session_rsvp_confirmation" | "org_seat_limit_warning" | "org_seat_limit_reached";
  timestamp: string;
  programName?: string;
  programDescription?: string;
  oldTier?: string;
  newTier?: string;
  unlockedModules?: string[];
  moduleName?: string;
  moduleType?: string;
  entityLink?: string;
  goalTitle?: string;
  sharedByName?: string;
  feedbackAuthor?: string;
  feedbackPreview?: string;
  userName?: string;
  userEmail?: string;
  enrollmentTimeframe?: string;
  scheduledDate?: string;
  scheduleTitle?: string;
  waitlistPosition?: number;
  followUpType?: string;
  daysSinceRegistration?: number;
  verificationUrl?: string;
  planName?: string;
  planId?: string;
  addOnName?: string;
  addOnId?: string;
  badgeName?: string;
  badgeDescription?: string;
  instructorName?: string;
  sessionDate?: string;
  sessionTitle?: string;
  meetingUrl?: string;
  schedulingUrl?: string;
  organizationName?: string;
  usedSeats?: number;
  maxSeats?: number;
  percentUsed?: number;
  groupName?: string;
  rsvpStatus?: string;
}

// Map notification types to template keys
const typeToTemplateKey: Record<string, string> = {
  profile_update: 'notification_profile_update',
  password_change: 'notification_password_change',
  email_change: 'notification_email_change',
  email_change_old: 'notification_email_change_old',
  email_change_new: 'notification_email_change_new',
  email_change_verification: 'notification_email_change_verification',
  email_change_initiated: 'notification_email_change_initiated',
  admin_email_change: 'notification_admin_email_change',
  program_assignment: 'notification_program_assignment',
  talentlms_reconnect_request: 'notification_talentlms_reconnect',
  tier_change: 'notification_tier_change',
  instructor_program_assignment: 'notification_instructor_program',
  coach_program_assignment: 'notification_coach_program',
  instructor_module_assignment: 'notification_instructor_module',
  coach_module_assignment: 'notification_coach_module',
  goal_shared: 'notification_goal_shared',
  goal_feedback: 'notification_goal_feedback',
  program_interest_registration: 'notification_program_interest',
  schedule_reminder: 'notification_schedule_reminder',
  waitlist_spot_available: 'notification_waitlist_available',
  registration_follow_up: 'notification_registration_followup',
  account_deactivation_request: 'notification_account_deactivation',
  account_deletion_request: 'notification_account_deletion_admin',
  subscription_plan_request: 'notification_subscription_plan',
  subscription_addon_request: 'notification_subscription_addon',
  badge_issued: 'notification_badge_issued',
  circle_connection_request: 'notification_circle_connection',
  session_request: 'notification_session_request',
  session_scheduled: 'notification_session_scheduled',
  session_rsvp_confirmation: 'notification_session_rsvp',
  org_seat_limit_warning: 'notification_org_seat_warning',
  org_seat_limit_reached: 'notification_org_seat_reached',
};

// Admin-targeted notification types that should bypass inactive checks
const adminTargetedNotificationTypes = [
  "talentlms_reconnect_request", "account_deactivation_request", 
  "account_deletion_request", "subscription_plan_request", 
  "subscription_addon_request", "circle_connection_request",
  "registration_follow_up", "program_interest_registration"
];

// Replace template variables with actual values
function replaceTemplateVariables(template: string, variables: Record<string, string | undefined>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(regex, value || '');
  }
  return result;
}

// Fetch template from database
async function fetchTemplate(supabase: any, templateKey: string): Promise<{ subject: string; html_content: string } | null> {
  const { data, error } = await supabase
    .from('email_templates')
    .select('subject, html_content')
    .eq('template_key', templateKey)
    .single();
  
  if (error || !data) {
    console.log(`Template ${templateKey} not found in database, using fallback`);
    return null;
  }
  
  return data;
}

// Fetch system logo from email_template_assets
async function fetchSystemLogo(supabase: any): Promise<string> {
  const { data, error } = await supabase
    .from('email_template_assets')
    .select('file_url, name')
    .eq('is_system_logo', true)
    .single();
  
  if (error || !data) {
    console.log('No system logo found');
    return '';
  }
  
  return `<img src="${data.file_url}" alt="${data.name}" style="max-width: 200px; height: auto;" />`;
}

// Get default fallback template
function getDefaultTemplate(): { subject: string; html: string } {
  return {
    subject: "Account Activity - InnoTrue Hub",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Account Activity</h2>
        <p>Hi {{userName}},</p>
        <p>There was activity on your account at {{timestamp}}.</p>
        <p>If you did not authorize this activity, please contact support immediately.</p>
        <hr style="border: 1px solid #eee; margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">This is an automated security notification from InnoTrue Hub.</p>
      </div>
    `,
  };
}

const handler = async (req: Request): Promise<Response> => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  try {
    // Validate authentication
    const authHeader = req.headers.get('Authorization');
    const expectedAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const expectedServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const siteUrl = Deno.env.get('SITE_URL') || 'https://app.innotrue.com';
    
    if (!authHeader) {
      console.error('Missing Authorization header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Missing authorization' }),
        { status: 401, headers: { "Content-Type": "application/json", ...cors } }
      );
    }
    
    const token = authHeader.replace('Bearer ', '');
    
    // Allow anon key (from DB triggers) or service role key
    let isAuthorized = token === expectedAnonKey || token === expectedServiceKey;
    
    // If not anon/service key, try to validate as a user JWT
    if (!isAuthorized) {
      const supabase = createClient(supabaseUrl, expectedAnonKey!, {
        global: { headers: { Authorization: authHeader } }
      });
      const { data: { user }, error } = await supabase.auth.getUser();
      if (user && !error) {
        isAuthorized = true;
        console.log('Authorized via user JWT:', user.id);
      }
    }
    
    if (!isAuthorized) {
      console.error('Invalid authorization token');
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid token' }),
        { status: 401, headers: { "Content-Type": "application/json", ...cors } }
      );
    }
    
    console.log('Authorization validated for notification call');
    
    const requestData = await req.json() as NotificationRequest;
    const { 
      email, userId, name, type, timestamp, programName, programDescription, 
      oldTier, newTier, unlockedModules, moduleName, moduleType, entityLink, 
      goalTitle, sharedByName, feedbackAuthor, feedbackPreview, userName, 
      userEmail, enrollmentTimeframe, scheduledDate, scheduleTitle, 
      waitlistPosition, followUpType, daysSinceRegistration, verificationUrl, 
      planName, addOnName, instructorName, sessionDate, sessionTitle, 
      meetingUrl, schedulingUrl, organizationName, usedSeats, maxSeats, percentUsed,
      groupName, rsvpStatus
    } = requestData;
    
    // Validate email if provided directly
    if (email && !isValidEmail(email)) {
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        { status: 400, headers: { "Content-Type": "application/json", ...cors } }
      );
    }

    // Require at least email or userId
    if (!email && !userId) {
      return new Response(
        JSON.stringify({ error: "Either email or userId is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...cors } }
      );
    }

    // For subscription requests, use planName or addOnName as programName for email template
    const effectiveProgramName = planName || addOnName || programName;
    const formattedTime = new Date(timestamp).toLocaleString();

    console.log(`Sending ${type} notification to ${email || userId}`);

    // Create admin Supabase client for fetching templates
    const supabaseAdmin = createClient(supabaseUrl, expectedServiceKey!);

    // Check global email mute — skip all emails if enabled
    if (await isGlobalEmailMuted(supabaseAdmin)) {
      console.log(`[GLOBAL_MUTE] Email sending is muted. Skipping ${type} notification to ${email || userId}`);
      return new Response(
        JSON.stringify({ skipped: true, reason: 'Global email mute is enabled' }),
        { status: 200, headers: { "Content-Type": "application/json", ...cors } }
      );
    }

    // If userId is provided instead of email, fetch email
    let recipientEmail = email;
    let recipientUserId = userId;
    if (userId && !email) {
      const { data: { user }, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
      if (userError || !user?.email) {
        console.error('Error fetching user email:', userError);
        return new Response(
          JSON.stringify({ error: 'User email not found' }),
          { status: 400, headers: { "Content-Type": "application/json", ...cors } }
        );
      }
      recipientEmail = user.email;
    }
    
    // If we have email but not userId, try to find the userId
    if (recipientEmail && !recipientUserId) {
      const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
      const matchedUser = users?.find(u => u.email === recipientEmail);
      if (matchedUser) {
        recipientUserId = matchedUser.id;
      }
    }
    
    // Check if user is inactive using centralized utility
    // Skip this check for admin notification types (admins should always receive notifications)
    if (recipientUserId && !adminTargetedNotificationTypes.includes(type)) {
      const userStatus = await checkUserEmailStatus(supabaseAdmin, recipientUserId);
      
      if (!userStatus.canReceiveEmails) {
        const reason = userStatus.reason === 'disabled' ? 'User is disabled' : 'Client profile is inactive';
        console.log(`Skipping notification to ${recipientEmail}: ${reason}`);
        return new Response(
          JSON.stringify({ skipped: true, reason }),
          { status: 200, headers: { "Content-Type": "application/json", ...cors } }
        );
      }
    }

    // For admin requests, send to all admins
    let recipients = [recipientEmail];
    const adminSendNotificationTypes = [
      "talentlms_reconnect_request", "account_deactivation_request", 
      "account_deletion_request", "subscription_plan_request", 
      "subscription_addon_request", "circle_connection_request"
    ];
    
    if (adminSendNotificationTypes.includes(type)) {
      // Get all admin user IDs
      const { data: adminRoles, error: rolesError } = await supabaseAdmin
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin');
      
      if (rolesError) {
        console.error('Error fetching admin roles:', rolesError);
      } else if (adminRoles && adminRoles.length > 0) {
        // Get admin emails from auth.users
        const adminIds = adminRoles.map(r => r.user_id);
        const { data: { users }, error: usersError } = await supabaseAdmin.auth.admin.listUsers();
        
        if (usersError) {
          console.error('Error fetching admin users:', usersError);
        } else if (users) {
          const adminEmails = users
            .filter(u => adminIds.includes(u.id))
            .map(u => u.email)
            .filter(e => e) as string[];
          
          if (adminEmails.length > 0) {
            recipients = adminEmails;
            console.log(`Sending notification to ${adminEmails.length} admins`);
          }
        }
      }
    }

    // Build unlocked modules HTML if applicable
    let unlockedModulesHtml = '';
    if (unlockedModules && unlockedModules.length > 0) {
      unlockedModulesHtml = `
        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
          <h3 style="color: #10b981; margin-top: 0;">🔓 Newly Unlocked Modules:</h3>
          <ul style="color: #333; line-height: 1.8;">
            ${unlockedModules.map(module => `<li>${module}</li>`).join('')}
          </ul>
        </div>
      `;
    } else if (type === 'tier_change') {
      unlockedModulesHtml = '<p style="color: #666;">All previously locked modules are now available!</p>';
    }

    // Build meeting section for session_scheduled
    let meetingSection = '';
    if (type === 'session_scheduled' && meetingUrl) {
      meetingSection = `
        <div style="text-align: center; margin: 20px 0;">
          <p style="font-size: 14px; color: #666; margin-bottom: 15px;">When it's time for your session:</p>
          <a href="${meetingUrl}" style="background: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">Join Meeting</a>
        </div>
      `;
    }

    // Build scheduling section for session_scheduled
    let schedulingSection = '';
    if (type === 'session_scheduled' && schedulingUrl && !scheduledDate) {
      schedulingSection = `
        <div style="text-align: center; margin: 20px 0;">
          <p style="font-size: 14px; color: #666; margin-bottom: 15px;">Please select a time that works for you:</p>
          <a href="${schedulingUrl}" style="background: #3b82f6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">Schedule Your Session</a>
        </div>
      `;
    }

    // Build badge description HTML
    let badgeDescriptionHtml = '';
    if (requestData.badgeDescription) {
      badgeDescriptionHtml = `<p style="color: #666; margin-bottom: 0;">${requestData.badgeDescription}</p>`;
    }

    // Fetch system logo for template variable
    const systemLogoHtml = await fetchSystemLogo(supabaseAdmin);

    // Prepare template variables
    const templateVariables: Record<string, string | undefined> = {
      userName: name,
      timestamp: formattedTime,
      programName: effectiveProgramName,
      programDescription: programDescription || 'Start your learning journey today!',
      newEmail: effectiveProgramName, // Used for email change notifications
      oldTier: oldTier || 'N/A',
      newTier: newTier || 'N/A',
      moduleName: moduleName || 'N/A',
      moduleType: moduleType || 'N/A',
      // Add SSO params to entityLink for client-targeted notifications when userId is available
      entityLink: (entityLink && recipientUserId && recipientEmail && !adminSendNotificationTypes.includes(type))
        ? `${entityLink}${entityLink.includes('?') ? '&' : '?'}expected_user=${recipientUserId}&login_hint=${encodeURIComponent(recipientEmail)}`
        : entityLink || `${siteUrl}/dashboard`,
      goalTitle: goalTitle || '',
      sharedByName: sharedByName || '',
      feedbackAuthor: feedbackAuthor || '',
      feedbackPreview: feedbackPreview || '',
      registrantName: userName || 'Unknown',
      registrantEmail: userEmail || 'Not provided',
      clientName: userName || 'N/A',
      clientEmail: userEmail || 'Not provided',
      enrollmentTimeframe: enrollmentTimeframe || 'Not specified',
      scheduledDate: scheduledDate ? new Date(scheduledDate).toLocaleString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
      }) : 'To be confirmed',
      scheduleTitle: scheduleTitle || '',
      daysSinceRegistration: String(daysSinceRegistration || ''),
      verificationUrl: verificationUrl || '',
      planName: planName || 'N/A',
      addOnName: addOnName || 'N/A',
      badgeName: requestData.badgeName || moduleName || 'Completion Badge',
      badgeDescription: badgeDescriptionHtml,
      instructorName: instructorName || 'TBD',
      sessionTitle: sessionTitle || moduleName || 'N/A',
      userEmail: userEmail || 'Not provided',
      organizationName: organizationName || 'Your Organization',
      usedSeats: String(usedSeats || 0),
      maxSeats: String(maxSeats || 0),
      percentUsed: String(percentUsed || 0),
      siteUrl: siteUrl,
      unlockedModulesHtml: unlockedModulesHtml,
      meetingSection: meetingSection,
      schedulingSection: schedulingSection,
      systemLogo: systemLogoHtml,
      groupName: groupName || 'Your Group',
      rsvpStatus: rsvpStatus || 'confirmed',
      sessionDate: sessionDate ? new Date(sessionDate).toLocaleString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
      }) : 'To be confirmed',
    };

    // Get the template key for this notification type
    const templateKey = typeToTemplateKey[type] || 'notification_default';
    
    // Try to fetch template from database
    let subject: string;
    let html: string;
    
    const dbTemplate = await fetchTemplate(supabaseAdmin, templateKey);
    
    if (dbTemplate) {
      subject = replaceTemplateVariables(dbTemplate.subject, templateVariables);
      html = replaceTemplateVariables(dbTemplate.html_content, templateVariables);
      console.log(`Using database template: ${templateKey}`);
    } else {
      // Use default fallback
      const defaultTemplate = getDefaultTemplate();
      subject = replaceTemplateVariables(defaultTemplate.subject, templateVariables);
      html = replaceTemplateVariables(defaultTemplate.html, templateVariables);
      console.log('Using default fallback template');
    }

    // Send email via Resend
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    
    if (!resendApiKey) {
      console.log('Resend API key not configured, skipping email send');
      return new Response(
        JSON.stringify({ warning: 'Email service not configured' }),
        { status: 200, headers: { "Content-Type": "application/json", ...cors } }
      );
    }

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "InnoTrue Hub <notifications@mail.innotrue.com>",
        to: getStagingRecipients(recipients.filter(e => e) as string[]),
        subject: getStagingSubject(subject, recipients.filter(e => e) as string[]),
        html: html,
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error("Resend API error:", errorText);
      return new Response(
        JSON.stringify({ error: "Failed to send email", details: errorText }),
        { status: 500, headers: { "Content-Type": "application/json", ...cors } }
      );
    }

    const result = await emailResponse.json();
    console.log(`Notification email sent successfully:`, result);

    return new Response(
      JSON.stringify({ 
        success: true, 
        recipients: recipients.length,
        messageId: result.id 
      }),
      { headers: { "Content-Type": "application/json", ...cors } }
    );
  } catch (error) {
    console.error("Error in send-notification-email:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { "Content-Type": "application/json", ...cors } }
    );
  }
};

serve(handler);