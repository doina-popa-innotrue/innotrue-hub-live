import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Minimum response time to prevent timing attacks
const MIN_RESPONSE_TIME = 300;

// Helper function to ensure constant-time responses
async function delayResponse(startTime: number): Promise<void> {
  const elapsed = Date.now() - startTime;
  if (elapsed < MIN_RESPONSE_TIME) {
    await new Promise(resolve => setTimeout(resolve, MIN_RESPONSE_TIME - elapsed));
  }
}

serve(async (req) => {
  const startTime = Date.now();

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace('Bearer', '').trim();

    if (!token) {
      console.error('Missing bearer token in Authorization header');
      await delayResponse(startTime);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !userData?.user) {
      console.error('Failed to get user from token', userError);
      await delayResponse(startTime);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const callerId = userData.user.id;
    const callerEmail = userData.user.email;

    const { targetUserId, newEmail, newPassword } = await req.json();
    
    // Get the old email before updating
    let oldEmail: string | null = null;
    if (newEmail && targetUserId) {
      const { data: targetUser } = await supabaseAdmin.auth.admin.getUserById(targetUserId);
      oldEmail = targetUser?.user?.email || null;
    } else if (newEmail) {
      oldEmail = callerEmail || null;
    }

    // Check if caller is an admin
    const { data: callerRoles } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', callerId);

    const isAdmin = callerRoles?.some(r => r.role === 'admin');

    // Determine which user to update
    const userIdToUpdate = isAdmin && targetUserId ? targetUserId : callerId;

    // If not admin and trying to update another user, deny
    if (!isAdmin && targetUserId && targetUserId !== callerId) {
      await delayResponse(startTime);
      return new Response(
        JSON.stringify({ error: 'Not authorized to update other users' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Admin ${callerId} updating user ${userIdToUpdate}`);

    const updateData: { email?: string; password?: string; email_confirm?: boolean } = {};
    
    if (newEmail) {
      updateData.email = newEmail;
      updateData.email_confirm = true;
    }
    
    if (newPassword) {
      updateData.password = newPassword;
    }

    if (Object.keys(updateData).length === 0) {
      await delayResponse(startTime);
      return new Response(
        JSON.stringify({ error: 'No updates provided' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userIdToUpdate, updateData);

    if (error) {
      console.error('Error updating user:', error);
      
      // Provide user-friendly error messages (generic to prevent enumeration)
      let errorMessage = 'Failed to update user. Please try again.';
      if (error.message?.includes('duplicate key') || error.message?.includes('already exists') || error.status === 500) {
        errorMessage = 'This email address is already in use by another account.';
      }
      
      await delayResponse(startTime);
      return new Response(
        JSON.stringify({ error: errorMessage }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // If email was updated, also update username in profiles and send notification
    if (newEmail) {
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update({ username: newEmail })
        .eq('id', userIdToUpdate);

      if (profileError) {
        console.error('Error updating username in profiles:', profileError);
      }

      // Get user name for email notification
      const { data: profileData } = await supabaseAdmin
        .from('profiles')
        .select('name')
        .eq('id', userIdToUpdate)
        .single();

      // Send notification emails to both old and new email addresses
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
        const userName = profileData?.name || 'User';
        const timestamp = new Date().toISOString();
        
        // Send to new email address
        const newEmailResponse = await fetch(`${supabaseUrl}/functions/v1/send-notification-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${anonKey}`,
          },
          body: JSON.stringify({
            email: newEmail,
            name: userName,
            type: 'admin_email_change',
            timestamp,
          }),
        });

        if (!newEmailResponse.ok) {
          console.error('Failed to send email notification to new address');
        } else {
          console.log('Email notification sent to new address successfully');
        }
        
        // Send to old email address if available
        if (oldEmail && oldEmail !== newEmail) {
          const oldEmailResponse = await fetch(`${supabaseUrl}/functions/v1/send-notification-email`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${anonKey}`,
            },
            body: JSON.stringify({
              email: oldEmail,
              name: userName,
              type: 'email_change_old',
              programName: newEmail, // Pass the new email to show in the notification
              timestamp,
            }),
          });

          if (!oldEmailResponse.ok) {
            console.error('Failed to send email notification to old address');
          } else {
            console.log('Email notification sent to old address successfully');
          }
        }
      } catch (emailError) {
        console.error('Error sending email notifications:', emailError);
      }
    }

    console.log('User updated successfully for user:', userIdToUpdate);

    await delayResponse(startTime);
    return new Response(
      JSON.stringify({ success: true, user: data.user }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error in update-user-email function:', error);
    await delayResponse(startTime);
    return new Response(
      JSON.stringify({ error: error.message ?? 'Unexpected error' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
