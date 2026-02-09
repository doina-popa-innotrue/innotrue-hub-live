import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TransferRequest {
  placeholderUserId: string;
  targetUserId: string;
  deleteAfterTransfer?: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the authorization header to verify the caller is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with the caller's JWT to verify they're an admin
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    // Get the calling user
    const { data: { user: callerUser }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !callerUser) {
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if caller is an admin
    const { data: callerRoles } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", callerUser.id);

    const isAdmin = callerRoles?.some(r => r.role === "admin");
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const { placeholderUserId, targetUserId, deleteAfterTransfer }: TransferRequest = await req.json();

    if (!placeholderUserId || !targetUserId) {
      return new Response(
        JSON.stringify({ error: "Both placeholderUserId and targetUserId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (placeholderUserId === targetUserId) {
      return new Response(
        JSON.stringify({ error: "Source and target user cannot be the same" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase admin client for data operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verify placeholder exists
    const { data: placeholderProfile, error: placeholderError } = await supabaseAdmin
      .from("profiles")
      .select("id, name, real_email")
      .eq("id", placeholderUserId)
      .single();

    if (placeholderError || !placeholderProfile) {
      return new Response(
        JSON.stringify({ error: "Placeholder user not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify target exists
    const { data: targetProfile, error: targetError } = await supabaseAdmin
      .from("profiles")
      .select("id, name")
      .eq("id", targetUserId)
      .single();

    if (targetError || !targetProfile) {
      return new Response(
        JSON.stringify({ error: "Target user not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const transferResults: Record<string, number> = {};

    // Transfer client_enrollments
    const { data: enrollments, error: enrollmentError } = await supabaseAdmin
      .from("client_enrollments")
      .update({ client_user_id: targetUserId })
      .eq("client_user_id", placeholderUserId)
      .select("id");

    if (enrollmentError) {
      console.error("Error transferring enrollments:", enrollmentError);
    } else {
      transferResults.enrollments = enrollments?.length || 0;
    }

    // Transfer module_progress (via enrollment transfer, these should cascade)
    // But we also handle direct user references if any

    // Transfer capability_snapshots
    const { data: snapshots, error: snapshotError } = await supabaseAdmin
      .from("capability_snapshots")
      .update({ user_id: targetUserId })
      .eq("user_id", placeholderUserId)
      .select("id");

    if (snapshotError) {
      console.error("Error transferring capability snapshots:", snapshotError);
    } else {
      transferResults.capability_snapshots = snapshots?.length || 0;
    }

    // Transfer client_badges
    const { data: badges, error: badgeError } = await supabaseAdmin
      .from("client_badges")
      .update({ user_id: targetUserId })
      .eq("user_id", placeholderUserId)
      .select("id");

    if (badgeError) {
      console.error("Error transferring badges:", badgeError);
    } else {
      transferResults.badges = badges?.length || 0;
    }

    // Transfer client_coaches relationships
    const { data: coachRels, error: coachError } = await supabaseAdmin
      .from("client_coaches")
      .update({ client_id: targetUserId })
      .eq("client_id", placeholderUserId)
      .select("id");

    if (coachError) {
      console.error("Error transferring coach relationships:", coachError);
    } else {
      transferResults.coach_relationships = coachRels?.length || 0;
    }

    // Transfer client_instructors relationships
    const { data: instructorRels, error: instructorError } = await supabaseAdmin
      .from("client_instructors")
      .update({ client_id: targetUserId })
      .eq("client_id", placeholderUserId)
      .select("id");

    if (instructorError) {
      console.error("Error transferring instructor relationships:", instructorError);
    } else {
      transferResults.instructor_relationships = instructorRels?.length || 0;
    }

    // Transfer assessment_responses
    const { data: assessments, error: assessmentError } = await supabaseAdmin
      .from("assessment_responses")
      .update({ user_id: targetUserId })
      .eq("user_id", placeholderUserId)
      .select("id");

    if (assessmentError) {
      console.error("Error transferring assessment responses:", assessmentError);
    } else {
      transferResults.assessment_responses = assessments?.length || 0;
    }

    // Transfer client_profile data (merge notes if both exist)
    const { data: placeholderClientProfile } = await supabaseAdmin
      .from("client_profiles")
      .select("*")
      .eq("user_id", placeholderUserId)
      .single();

    if (placeholderClientProfile) {
      // Check if target has client profile
      const { data: targetClientProfile } = await supabaseAdmin
        .from("client_profiles")
        .select("*")
        .eq("user_id", targetUserId)
        .single();

      if (targetClientProfile) {
        // Merge notes
        const mergedNotes = [targetClientProfile.notes, placeholderClientProfile.notes]
          .filter(Boolean)
          .join("\n\n--- Transferred from placeholder ---\n\n");
        
        await supabaseAdmin
          .from("client_profiles")
          .update({ 
            notes: mergedNotes || null,
            tags: placeholderClientProfile.tags || targetClientProfile.tags
          })
          .eq("user_id", targetUserId);
      } else {
        // Create client profile for target
        await supabaseAdmin
          .from("client_profiles")
          .insert({
            user_id: targetUserId,
            status: placeholderClientProfile.status,
            notes: placeholderClientProfile.notes,
            tags: placeholderClientProfile.tags
          });
      }
      transferResults.client_profile = 1;
    }

    // Optionally delete placeholder user after transfer
    if (deleteAfterTransfer) {
      // Delete from auth.users via admin API
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(placeholderUserId);
      if (deleteError) {
        console.error("Error deleting placeholder user:", deleteError);
        transferResults.placeholder_deleted = 0;
      } else {
        transferResults.placeholder_deleted = 1;
      }
    }

    console.log(`Admin ${callerUser.email} transferred data from placeholder ${placeholderUserId} to ${targetUserId}:`, transferResults);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Data transferred successfully",
        transferred: transferResults
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error in transfer-placeholder-data function:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
