import { createClient } from "npm:@supabase/supabase-js@2";
import { checkUserEmailStatus, getStagingRecipient, getStagingSubject } from "../_shared/email-utils.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate request is authorized (must include valid anon key or service role key)
    const authHeader = req.headers.get('Authorization');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const providedToken = authHeader?.replace('Bearer ', '');
    if (providedToken !== supabaseAnonKey && providedToken !== supabaseServiceKey) {
      console.error('Unauthorized: Invalid or missing authorization token');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY')!;
    const siteUrl = Deno.env.get('SITE_URL') || 'https://app.innotrue.com';

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Checking for pending decision reminders...');

    // Get all reminders that are due today and haven't been sent yet
    const today = new Date().toISOString().split('T')[0];
    
    const { data: reminders, error: remindersError } = await supabase
      .from('decision_reminders')
      .select(`
        *,
        decisions (
          id,
          title,
          description,
          status
        )
      `)
      .eq('is_completed', false)
      .eq('email_sent', false)
      .lte('reminder_date', today);

    if (remindersError) {
      console.error('Error fetching reminders:', remindersError);
      throw remindersError;
    }

    console.log(`Found ${reminders?.length || 0} reminders to process`);

    if (!reminders || reminders.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No pending reminders', count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const emailsSent: string[] = [];
    const skipped: string[] = [];
    const errors: any[] = [];

    // Process each reminder
    for (const reminder of reminders) {
      try {
        // Use centralized check for user email status
        const userStatus = await checkUserEmailStatus(supabase, reminder.user_id);

        if (!userStatus.canReceiveEmails) {
          console.log(`User ${reminder.user_id} is ${userStatus.reason}, skipping reminder`);
          skipped.push(reminder.id);
          continue;
        }

        if (!userStatus.email) {
          console.error(`No email found for user ${reminder.user_id}`);
          errors.push({ reminderId: reminder.id, error: 'User email not found' });
          continue;
        }

        const userName = userStatus.name || userStatus.email?.split('@')[0] || 'User';

        // Fetch system logo
        const { data: logoData } = await supabase
          .from('email_template_assets')
          .select('file_url, name')
          .eq('is_system_logo', true)
          .single();
        
        const systemLogoHtml = logoData 
          ? `<img src="${logoData.file_url}" alt="${logoData.name}" style="max-width: 200px; height: auto;" />`
          : '';

        // Fetch email template from database
        const { data: template } = await supabase
          .from('email_templates')
          .select('subject, html_content')
          .eq('template_key', 'decision_reminder')
          .single();

        // Default fallback template
        const defaultTemplate = {
          subject: '🔔 Decision Follow-Up: {{decisionTitle}}',
          html_content: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Decision Follow-Up Reminder</h2>
            <p>Hi {{userName}},</p>
            <p>This is your scheduled reminder to check in on your decision: <strong>{{decisionTitle}}</strong></p>
            <p><a href="{{decisionLink}}">View Decision</a></p>
          </div>`
        };

        const emailTemplate = template || defaultTemplate;

        // Prepare template variables
        const reminderDateFormatted = new Date(reminder.reminder_date).toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });

        // Replace template variables
        const subject = emailTemplate.subject
          .replace(/\{\{decisionTitle\}\}/g, reminder.decisions?.title || 'Decision')
          .replace(/\{\{userName\}\}/g, userName);

        const emailHtml = emailTemplate.html_content
          .replace(/\{\{userName\}\}/g, userName)
          .replace(/\{\{decisionTitle\}\}/g, reminder.decisions?.title || 'Decision')
          .replace(/\{\{decisionDescription\}\}/g, reminder.decisions?.description || '')
          .replace(/\{\{reminderTitle\}\}/g, reminder.title || 'Check-in')
          .replace(/\{\{reminderDescription\}\}/g, reminder.description || '')
          .replace(/\{\{reminderDate\}\}/g, reminderDateFormatted)
          .replace(/\{\{decisionLink\}\}/g, `${siteUrl}/decisions/${reminder.decisions?.id}?expected_user=${reminder.user_id}&login_hint=${encodeURIComponent(userStatus.email || '')}`)
          .replace(/\{\{systemLogo\}\}/g, systemLogoHtml);

        // Send email using Resend
        const emailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: 'InnoTrue Hub <noreply@mail.innotrue.com>',
            to: [getStagingRecipient(userStatus.email!)],
            subject: getStagingSubject(subject, userStatus.email!),
            html: emailHtml,
          }),
        });

        if (!emailResponse.ok) {
          const errorText = await emailResponse.text();
          console.error(`Email send failed for reminder ${reminder.id}:`, errorText);
          errors.push({ reminderId: reminder.id, error: errorText });
          continue;
        }

        // Mark reminder as email sent
        const { error: updateError } = await supabase
          .from('decision_reminders')
          .update({
            email_sent: true,
            email_sent_at: new Date().toISOString(),
          })
          .eq('id', reminder.id);

        if (updateError) {
          console.error(`Error updating reminder ${reminder.id}:`, updateError);
          errors.push({ reminderId: reminder.id, error: updateError });
        } else {
          emailsSent.push(reminder.id);
          console.log(`✓ Sent reminder email for decision: ${reminder.decisions?.title}`);
        }
      } catch (error) {
        console.error(`Error processing reminder ${reminder.id}:`, error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push({ reminderId: reminder.id, error: errorMessage });
      }
    }

    return new Response(
      JSON.stringify({
        message: 'Reminders processed',
        sent: emailsSent.length,
        skipped: skipped.length,
        errors: errors.length,
        details: { emailsSent, skipped, errors },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in decision-reminders function:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});