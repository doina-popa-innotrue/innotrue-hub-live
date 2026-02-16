import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { errorResponse, successResponse } from "../_shared/error-response.ts";

interface Registration {
  id: string;
  user_id: string;
  program_id: string;
  created_at: string;
  profiles: { name: string } | null;
  auth_users: { email: string } | null;
  programs: { name: string } | null;
}

Deno.serve(async (req) => {
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

    const now = new Date();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Get pending registrations that are 3 or 7 days old
    const { data: registrations, error } = await supabase
      .from('program_interest_registrations')
      .select('*, programs(name)')
      .eq('status', 'pending')
      .or(`created_at.lte.${threeDaysAgo.toISOString()},created_at.lte.${sevenDaysAgo.toISOString()}`);

    if (error) {
      throw error;
    }

    const followUpsSent = [];

    for (const reg of registrations || []) {
      const createdAt = new Date(reg.created_at);
      const daysSinceCreation = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

      // Skip if already sent follow-up for this timeframe
      const shouldSend3Day = daysSinceCreation >= 3 && daysSinceCreation < 4;
      const shouldSend7Day = daysSinceCreation >= 7;

      if (!shouldSend3Day && !shouldSend7Day) continue;

      // Get user details
      const { data: profileData } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', reg.user_id)
        .single();

      const { data: userData } = await supabase.auth.admin.getUserById(reg.user_id);

      if (!userData?.user?.email) continue;

      const followUpType = shouldSend7Day ? '7-day' : '3-day';

      // Get all admin emails
      const { data: adminRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin');

      if (!adminRoles || adminRoles.length === 0) continue;

      // Send follow-up to all admins
      for (const adminRole of adminRoles) {
        const { data: adminUser } = await supabase.auth.admin.getUserById(adminRole.user_id);
        
        if (!adminUser?.user?.email) continue;

        await supabase.functions.invoke('send-notification-email', {
          body: {
            email: adminUser.user.email,
            name: 'Admin',
            type: 'registration_follow_up',
            timestamp: new Date().toISOString(),
            userName: profileData?.name || 'User',
            userEmail: userData.user.email,
            programName: reg.programs?.name || 'Unknown Program',
            followUpType,
            daysSinceRegistration: daysSinceCreation,
            entityLink: `${Deno.env.get('SITE_URL') || 'https://app.innotrue.com'}/admin/clients`,
          },
        });
      }

      followUpsSent.push({
        registrationId: reg.id,
        type: followUpType,
        daysSince: daysSinceCreation,
      });
    }

    console.log(`Sent ${followUpsSent.length} follow-up notifications`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        followUpsSent: followUpsSent.length,
        details: followUpsSent 
      }),
      {
        headers: { ...cors, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in registration-follow-ups:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        headers: { ...cors, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
