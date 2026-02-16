import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { errorResponse, successResponse } from "../_shared/error-response.ts";

serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: cors });
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
        { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Running scheduled reminder check...');

    // Calculate date 1 week from now
    const oneWeekFromNow = new Date();
    oneWeekFromNow.setDate(oneWeekFromNow.getDate() + 7);
    const targetDate = oneWeekFromNow.toISOString().split('T')[0];

    console.log('Checking for schedules on:', targetDate);

    // Get all programs with scheduled dates
    const { data: programs, error: programsError } = await supabase
      .from('programs')
      .select('id, name, scheduled_dates')
      .not('scheduled_dates', 'is', null);

    if (programsError) throw programsError;

    let remindersSent = 0;

    for (const program of programs || []) {
      if (!program.scheduled_dates || !Array.isArray(program.scheduled_dates)) continue;

      // Find schedules matching the target date
      for (const schedule of program.scheduled_dates) {
        if (schedule.date === targetDate) {
          console.log(`Found matching schedule: ${program.name} - ${schedule.title}`);

          // Get interest registrations for this schedule
          const { data: registrations, error: regError } = await supabase
            .from('program_interest_registrations')
            .select('*, profiles!user_id (name)')
            .eq('program_id', program.id)
            .eq('scheduled_date_id', schedule.id)
            .eq('reminder_sent', false)
            .in('status', ['pending', 'contacted']);

          if (regError) {
            console.error('Error fetching registrations:', regError);
            continue;
          }

          // Send reminders to each user
          for (const registration of registrations || []) {
            try {
              // Get user email
              const { data: userData } = await supabase.auth.admin.getUserById(registration.user_id);
              if (!userData?.user?.email) continue;

              // Call notification email function
              const { error: emailError } = await supabase.functions.invoke('send-notification-email', {
                body: {
                  email: userData.user.email,
                  name: registration.profiles?.name || 'User',
                  type: 'schedule_reminder',
                  timestamp: new Date().toISOString(),
                  programName: program.name,
                  scheduledDate: schedule.date,
                  scheduleTitle: schedule.title || 'Scheduled Class',
                },
              });

              if (emailError) {
                console.error('Error sending email:', emailError);
                continue;
              }

              // Mark reminder as sent
              await supabase
                .from('program_interest_registrations')
                .update({
                  reminder_sent: true,
                  reminder_sent_at: new Date().toISOString(),
                })
                .eq('id', registration.id);

              remindersSent++;
              console.log(`Sent reminder to ${userData.user.email}`);
            } catch (error) {
              console.error('Error processing registration:', error);
            }
          }
        }
      }
    }

    console.log(`Total reminders sent: ${remindersSent}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        remindersSent,
        message: `Sent ${remindersSent} reminder(s) for schedules on ${targetDate}` 
      }),
      { headers: { "Content-Type": "application/json", ...cors } }
    );
  } catch (error: any) {
    console.error('Error in send-schedule-reminders:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { "Content-Type": "application/json", ...cors }
      }
    );
  }
});