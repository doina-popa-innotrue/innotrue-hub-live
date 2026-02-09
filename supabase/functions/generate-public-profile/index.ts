import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PublicProfileSnapshot {
  generated_at: string;
  slug: string;
  profile: {
    name?: string;
    avatar_url?: string;
    bio?: string;
    target_role?: string;
    tagline?: string;
    job_title?: string;
    organisation?: string;
    linkedin_url?: string;
    twitter_url?: string;
    website_url?: string;
  };
  interests: string[];
  values: string[];
  drives: string[];
  education: Array<{ institution: string; qualification: string; year_completed?: number }>;
  certifications: Array<{ name: string; issuing_body?: string; date_obtained?: string }>;
  goals: Array<{ title: string; description?: string; status: string; target_date?: string }>;
  programs: Array<{ name: string; description?: string; status: string }>;
  external_courses: Array<{ title: string; provider?: string; completion_date?: string }>;
  skills: Array<{ name: string; category?: string }>;
  badges: Array<{ name: string; description?: string; issued_at?: string; image_url?: string }>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Use service role to access all data
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header for non-admin requests
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;

    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }

    const { user_id: targetUserId, action } = await req.json();

    // Validate permissions - user can only generate their own profile, or admin can generate any
    if (targetUserId && targetUserId !== userId) {
      const { data: isAdmin } = await supabase.rpc("has_role", { 
        _user_id: userId, 
        _role: "admin" 
      });
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const profileUserId = targetUserId || userId;
    if (!profileUserId) {
      return new Response(
        JSON.stringify({ error: "No user ID provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle unpublish action
    if (action === "unpublish") {
      // Get current settings to find slug
      const { data: settings } = await supabase
        .from("public_profile_settings")
        .select("custom_slug")
        .eq("user_id", profileUserId)
        .single();

      if (settings?.custom_slug) {
        // Delete the snapshot file
        await supabase.storage
          .from("public-profiles")
          .remove([`${settings.custom_slug}.json`]);

        console.log(`Unpublished profile for slug: ${settings.custom_slug}`);
      }

      // Update settings
      await supabase
        .from("public_profile_settings")
        .update({ 
          is_public: false,
          published_at: null, 
          snapshot_url: null 
        })
        .eq("user_id", profileUserId);

      return new Response(
        JSON.stringify({ success: true, action: "unpublished" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get public profile settings
    const { data: settings, error: settingsError } = await supabase
      .from("public_profile_settings")
      .select("*")
      .eq("user_id", profileUserId)
      .single();

    if (settingsError || !settings) {
      return new Response(
        JSON.stringify({ error: "Profile settings not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!settings.custom_slug) {
      return new Response(
        JSON.stringify({ error: "Custom slug is required to publish profile" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build the snapshot based on visibility settings
    const snapshot: PublicProfileSnapshot = {
      generated_at: new Date().toISOString(),
      slug: settings.custom_slug,
      profile: {},
      interests: [],
      values: [],
      drives: [],
      education: [],
      certifications: [],
      goals: [],
      programs: [],
      external_courses: [],
      skills: [],
      badges: [],
    };

    // Get profile data
    const { data: profile } = await supabase
      .from("profiles")
      .select("name, avatar_url, bio, target_role, tagline, job_title, organisation, linkedin_url, twitter_url, website_url, education, certifications")
      .eq("id", profileUserId)
      .single();

    if (profile) {
      if (settings.show_name) snapshot.profile.name = profile.name;
      if (settings.show_avatar) snapshot.profile.avatar_url = profile.avatar_url;
      if (settings.show_bio) snapshot.profile.bio = profile.bio;
      if (settings.show_target_role) snapshot.profile.target_role = profile.target_role;
      if (settings.show_tagline) snapshot.profile.tagline = profile.tagline;
      if (settings.show_job_title) snapshot.profile.job_title = profile.job_title;
      if (settings.show_organisation) snapshot.profile.organisation = profile.organisation;
      if (settings.show_social_links) {
        snapshot.profile.linkedin_url = profile.linkedin_url;
        snapshot.profile.twitter_url = profile.twitter_url;
        snapshot.profile.website_url = profile.website_url;
      }
      if (settings.show_education && profile.education) {
        snapshot.education = Array.isArray(profile.education) ? profile.education : [];
      }
      if (settings.show_certifications && profile.certifications) {
        snapshot.certifications = Array.isArray(profile.certifications) ? profile.certifications : [];
      }
    }

    // Get public interests/values/drives
    const { data: interests } = await supabase
      .from("public_profile_interests")
      .select("interest_type, item_value")
      .eq("user_id", profileUserId);

    if (interests) {
      snapshot.interests = interests.filter(i => i.interest_type === "interest").map(i => i.item_value);
      snapshot.values = interests.filter(i => i.interest_type === "value").map(i => i.item_value);
      snapshot.drives = interests.filter(i => i.interest_type === "drive").map(i => i.item_value);
    }

    // Get public goals
    const { data: goals } = await supabase
      .from("goals")
      .select("title, description, status, target_date")
      .eq("user_id", profileUserId)
      .eq("is_public", true);

    if (goals) {
      snapshot.goals = goals;
    }

    // Get public program enrollments
    const { data: enrollments } = await supabase
      .from("client_enrollments")
      .select("status, programs(name, description)")
      .eq("client_user_id", profileUserId)
      .eq("is_public", true);

    if (enrollments) {
      snapshot.programs = enrollments.map((e: any) => ({
        name: e.programs?.name || "",
        description: e.programs?.description,
        status: e.status,
      }));
    }

    // Get public external courses
    const { data: courses } = await supabase
      .from("external_courses")
      .select("title, provider, completion_date")
      .eq("user_id", profileUserId)
      .eq("is_public", true);

    if (courses) {
      snapshot.external_courses = courses;
    }

    // Get public skills
    const { data: skills } = await supabase
      .from("user_skills")
      .select("skills(name, category)")
      .eq("user_id", profileUserId)
      .eq("is_public", true);

    if (skills) {
      snapshot.skills = skills.map((s: any) => ({
        name: s.skills?.name || "",
        category: s.skills?.category,
      }));
    }

    // Get public badges
    const { data: badges } = await supabase
      .from("client_badges")
      .select("issued_at, program_badges(name, description, image_url)")
      .eq("user_id", profileUserId)
      .eq("is_public", true)
      .eq("status", "issued");

    if (badges) {
      snapshot.badges = badges.map((b: any) => ({
        name: b.program_badges?.name || "",
        description: b.program_badges?.description,
        issued_at: b.issued_at,
        image_url: b.program_badges?.image_url,
      }));
    }

    // Upload snapshot to storage
    const fileName = `${settings.custom_slug}.json`;
    const snapshotJson = JSON.stringify(snapshot, null, 2);

    const { error: uploadError } = await supabase.storage
      .from("public-profiles")
      .upload(fileName, snapshotJson, {
        contentType: "application/json",
        upsert: true,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return new Response(
        JSON.stringify({ error: "Failed to upload snapshot", details: uploadError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("public-profiles")
      .getPublicUrl(fileName);

    const snapshotUrl = urlData.publicUrl;

    // Update settings with published info
    await supabase
      .from("public_profile_settings")
      .update({
        is_public: true,
        published_at: new Date().toISOString(),
        snapshot_url: snapshotUrl,
      })
      .eq("user_id", profileUserId);

    console.log(`Generated public profile snapshot for ${settings.custom_slug}`);

    return new Response(
      JSON.stringify({
        success: true,
        slug: settings.custom_slug,
        snapshot_url: snapshotUrl,
        generated_at: snapshot.generated_at,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error generating public profile:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
