import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { getStagingRecipient, getStagingSubject } from "../_shared/email-utils.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Default template as fallback
const defaultTemplate = {
  subject: "⚠️ AI Credit Usage Alert - {{usagePercent}}% of Monthly Limit",
  html_content: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2>AI Credit Usage Alert</h2>
  <p>Your platform's AI credit usage has reached <strong>{{usagePercent}}%</strong> of the monthly limit.</p>
  <ul>
    <li><strong>Credits Used:</strong> {{creditsUsed}}</li>
    <li><strong>Monthly Limit:</strong> {{monthlyLimit}}</li>
    <li><strong>Alert Threshold:</strong> {{alertThreshold}}%</li>
  </ul>
  <p>Consider reviewing usage patterns or increasing the monthly limit in System Settings.</p>
  <p>This alert is sent once per month when the threshold is reached.</p>
</body>
</html>`,
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get current month's start
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    // Fetch current month's AI consumption
    const { data: consumption, error: consumptionError } = await supabaseAdmin
      .from('add_on_consumption_log')
      .select('quantity_consumed')
      .gte('created_at', monthStart);

    if (consumptionError) {
      console.error('Error fetching consumption:', consumptionError);
      throw consumptionError;
    }

    const totalUsed = consumption?.reduce((sum, c) => sum + (c.quantity_consumed || 0), 0) || 0;

    // Fetch system settings
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('system_settings')
      .select('key, value')
      .in('key', ['ai_monthly_credit_limit', 'ai_alert_threshold_percent', 'ai_alert_email', 'ai_alert_sent_this_month']);

    if (settingsError) {
      console.error('Error fetching settings:', settingsError);
      throw settingsError;
    }

    const settingsMap = Object.fromEntries(settings?.map(s => [s.key, s.value]) || []);
    const monthlyLimit = parseInt(settingsMap.ai_monthly_credit_limit || '1000', 10);
    const alertThreshold = parseInt(settingsMap.ai_alert_threshold_percent || '70', 10);
    const alertEmail = settingsMap.ai_alert_email || 'hubadmin@innotrue.com';
    const alertSentThisMonth = settingsMap.ai_alert_sent_this_month === 'true';

    const usagePercent = monthlyLimit > 0 ? (totalUsed / monthlyLimit) * 100 : 0;
    const isOverLimit = totalUsed >= monthlyLimit;
    const shouldAlert = usagePercent >= alertThreshold && !alertSentThisMonth;

    console.log(`AI Usage: ${totalUsed}/${monthlyLimit} (${usagePercent.toFixed(1)}%)`);

    // Send alert email if threshold reached and not already sent
    if (shouldAlert) {
      const resendApiKey = Deno.env.get('RESEND_API_KEY');
      if (resendApiKey) {
        const resend = new Resend(resendApiKey);

        // Fetch email template from database
        const { data: template } = await supabaseAdmin
          .from("email_templates")
          .select("subject, html_content")
          .eq("template_key", "ai_usage_alert")
          .single();

        const emailTemplate = template || defaultTemplate;
        
        // Replace template variables
        const subject = emailTemplate.subject
          .replace(/\{\{usagePercent\}\}/g, usagePercent.toFixed(0));

        const htmlContent = emailTemplate.html_content
          .replace(/\{\{usagePercent\}\}/g, usagePercent.toFixed(1))
          .replace(/\{\{creditsUsed\}\}/g, totalUsed.toString())
          .replace(/\{\{monthlyLimit\}\}/g, monthlyLimit.toString())
          .replace(/\{\{alertThreshold\}\}/g, alertThreshold.toString());
        
        try {
          await resend.emails.send({
            from: 'InnoTrue Hub <notifications@mail.innotrue.com>',
            to: [getStagingRecipient(alertEmail)],
            subject: getStagingSubject(subject, alertEmail),
            html: htmlContent,
          });

          // Mark alert as sent for this month
          await supabaseAdmin
            .from('system_settings')
            .update({ value: 'true' })
            .eq('key', 'ai_alert_sent_this_month');

          console.log('Alert email sent to:', alertEmail);
        } catch (emailError) {
          console.error('Failed to send alert email:', emailError);
        }
      } else {
        console.log('RESEND_API_KEY not configured, skipping email');
      }
    }

    return new Response(JSON.stringify({
      totalUsed,
      monthlyLimit,
      usagePercent: Math.round(usagePercent * 10) / 10,
      isOverLimit,
      remaining: Math.max(0, monthlyLimit - totalUsed),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in check-ai-usage:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
