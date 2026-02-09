import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Input validation
function validateInviteToken(token: unknown): string | null {
  if (typeof token !== 'string' || !token) {
    return null;
  }
  // Token should be a reasonable length UUID-like string
  if (token.length < 10 || token.length > 100) {
    return null;
  }
  // Allow alphanumeric and hyphens only
  if (!/^[a-zA-Z0-9-]+$/.test(token)) {
    return null;
  }
  return token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get the user from the auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user) {
      throw new Error("Invalid auth token");
    }

    const body = await req.json();
    const invite_token = validateInviteToken(body?.invite_token);
    const link_existing_account = typeof body?.link_existing_account === 'boolean' ? body.link_existing_account : false;

    if (!invite_token) {
      return new Response(
        JSON.stringify({ error: "Invalid invite_token format" }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400 
        }
      );
    }

    // Get the invite
    const { data: invite, error: inviteError } = await supabaseClient
      .from('organization_invites')
      .select(`
        *,
        organizations (id, name)
      `)
      .eq('token', invite_token)
      .single();

    if (inviteError || !invite) {
      throw new Error("Invalid or expired invitation");
    }

    // Check if already accepted
    if (invite.accepted_at) {
      throw new Error("This invitation has already been accepted");
    }

    // Check if expired
    if (new Date(invite.expires_at) < new Date()) {
      throw new Error("This invitation has expired");
    }

    // Check if the user's email matches the invite
    if (userData.user.email?.toLowerCase() !== invite.email.toLowerCase()) {
      throw new Error("This invitation was sent to a different email address");
    }

    // Check if already a member
    const { data: existingMember } = await supabaseClient
      .from('organization_members')
      .select('id')
      .eq('organization_id', invite.organization_id)
      .eq('user_id', userData.user.id)
      .single();

    if (existingMember) {
      // Mark invite as accepted and return success
      await supabaseClient
        .from('organization_invites')
        .update({ accepted_at: new Date().toISOString() })
        .eq('id', invite.id);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "You are already a member of this organization",
          organization: invite.organizations
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Add user to organization
    const { error: memberError } = await supabaseClient
      .from('organization_members')
      .insert({
        organization_id: invite.organization_id,
        user_id: userData.user.id,
        role: invite.role,
        joined_at: new Date().toISOString(),
      });

    if (memberError) {
      console.error("Error adding member:", memberError);
      throw new Error("Failed to add you to the organization");
    }

    // Initialize organization sharing consent with conservative defaults
    // User starts with all sharing disabled - they can enable via settings
    const { error: consentError } = await supabaseClient
      .from('user_organization_sharing_consent')
      .upsert({
        user_id: userData.user.id,
        organization_id: invite.organization_id,
        share_profile: false,
        share_enrollments: false,
        share_progress: false,
        share_assessments: false,
        share_goals: false,
        consent_given_at: null, // Not consented yet - just initialized
      }, {
        onConflict: 'user_id,organization_id',
        ignoreDuplicates: true, // Don't overwrite if already exists
      });

    if (consentError) {
      console.error("Error initializing consent:", consentError);
      // Non-fatal - continue with membership creation
    }

    // Mark invite as accepted
    await supabaseClient
      .from('organization_invites')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invite.id);

    console.log(`User ${userData.user.email} joined organization ${invite.organizations?.name}${link_existing_account ? ' (linked existing account)' : ''}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `You have joined ${invite.organizations?.name || 'the organization'}`,
        organization: invite.organizations,
        linked_existing_account: link_existing_account,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error in accept-org-invite:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400 
      }
    );
  }
});
