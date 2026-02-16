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

    const { programId, scheduledDateId } = await req.json();

    console.log(`Checking waitlist for program ${programId}, schedule ${scheduledDateId}`);

    // Get the program details
    const { data: program, error: programError } = await supabase
      .from('programs')
      .select('name, scheduled_dates')
      .eq('id', programId)
      .single();

    if (programError) throw programError;

    // Find the specific schedule
    const scheduledDates = program.scheduled_dates || [];
    const schedule = scheduledDates.find((s: any) => s.id === scheduledDateId);

    if (!schedule) {
      return new Response(
        JSON.stringify({ error: 'Schedule not found' }),
        { status: 404, headers: { "Content-Type": "application/json", ...cors } }
      );
    }

    // Check if there are spots available
    const capacity = schedule.capacity || 0;
    const enrolledCount = schedule.enrolled_count || 0;
    const availableSpots = capacity - enrolledCount;

    if (availableSpots <= 0) {
      return new Response(
        JSON.stringify({ message: 'No spots available yet' }),
        { status: 200, headers: { "Content-Type": "application/json", ...cors } }
      );
    }

    // Get waitlist entries that haven't been notified
    const { data: waitlistEntries, error: waitlistError } = await supabase
      .from('program_waitlist')
      .select('*, profiles!user_id (name)')
      .eq('program_id', programId)
      .eq('scheduled_date_id', scheduledDateId)
      .eq('notified', false)
      .order('position')
      .limit(availableSpots);

    if (waitlistError) throw waitlistError;

    let notifiedCount = 0;

    // Notify users from waitlist
    for (const entry of waitlistEntries || []) {
      try {
        // Get user email
        const { data: userData } = await supabase.auth.admin.getUserById(entry.user_id);
        if (!userData?.user?.email) continue;

        // Send notification
        const { error: emailError } = await supabase.functions.invoke('send-notification-email', {
          body: {
            email: userData.user.email,
            name: entry.profiles?.name || 'User',
            type: 'waitlist_spot_available',
            timestamp: new Date().toISOString(),
            programName: program.name,
            scheduledDate: schedule.date,
            scheduleTitle: schedule.title || 'Scheduled Class',
            waitlistPosition: entry.position,
          },
        });

        if (emailError) {
          console.error('Error sending email:', emailError);
          continue;
        }

        // Mark as notified
        await supabase
          .from('program_waitlist')
          .update({ notified: true })
          .eq('id', entry.id);

        notifiedCount++;
        console.log(`Notified user ${userData.user.email} (position ${entry.position})`);
      } catch (error) {
        console.error('Error processing waitlist entry:', error);
      }
    }

    console.log(`Notified ${notifiedCount} user(s) from waitlist`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        notifiedCount,
        message: `Notified ${notifiedCount} user(s) from waitlist` 
      }),
      { headers: { "Content-Type": "application/json", ...cors } }
    );
  } catch (error: any) {
    console.error('Error in notify-waitlist:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { "Content-Type": "application/json", ...cors }
      }
    );
  }
});