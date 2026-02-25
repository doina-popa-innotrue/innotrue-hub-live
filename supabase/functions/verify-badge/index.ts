// verify-badge — Public endpoint for badge verification (no auth required)
// Returns badge data for public display on verification pages and LinkedIn crawlers

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { errorResponse, successResponse } from "../_shared/error-response.ts";

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  try {
    // Accept GET with query param or POST with body
    let badgeId: string | null = null;

    if (req.method === "GET") {
      const url = new URL(req.url);
      badgeId = url.searchParams.get("badgeId");
    } else if (req.method === "POST") {
      const body = await req.json();
      badgeId = body.badgeId || body.badge_id;
    }

    if (!badgeId) {
      return errorResponse.badRequest("Missing required parameter: badgeId", cors);
    }

    // Use service role to bypass RLS (public endpoint)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Fetch badge with all related data
    const { data: badge, error } = await supabaseAdmin
      .from("client_badges")
      .select(`
        id,
        status,
        image_path,
        issued_at,
        expires_at,
        is_public,
        user_id,
        program_badges (
          id,
          name,
          description,
          image_path,
          programs (
            id,
            name,
            slug
          ),
          program_badge_credentials (
            id,
            service_name,
            service_display_name,
            credential_template_url
          )
        ),
        client_badge_credentials (
          id,
          acceptance_url,
          accepted_at,
          program_badge_credential_id
        )
      `)
      .eq("id", badgeId)
      .eq("status", "issued")
      .maybeSingle();

    if (error) {
      console.error("[verify-badge] DB error:", error);
      return errorResponse.serverError("verify-badge", error, cors);
    }

    if (!badge) {
      return successResponse.ok({
        verification_valid: false,
        message: "Badge not found or has not been issued yet.",
      }, cors);
    }

    // Check visibility: badge must be public OR user's profile must be public
    let isVisible = badge.is_public;

    if (!isVisible) {
      // Check if user has a public profile
      const { data: profileSettings } = await supabaseAdmin
        .from("public_profile_settings")
        .select("is_public")
        .eq("user_id", badge.user_id)
        .maybeSingle();

      isVisible = profileSettings?.is_public === true;
    }

    if (!isVisible) {
      return successResponse.ok({
        verification_valid: false,
        message: "This badge is private.",
      }, cors);
    }

    // Fetch user name (from profiles)
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("name")
      .eq("id", badge.user_id)
      .maybeSingle();

    // Get badge image URL
    let badgeImageUrl: string | null = null;
    if (badge.image_path) {
      const { data: urlData } = supabaseAdmin.storage
        .from("client-badges")
        .getPublicUrl(badge.image_path);
      badgeImageUrl = urlData.publicUrl;
    } else if (badge.program_badges?.image_path) {
      const { data: urlData } = supabaseAdmin.storage
        .from("program-logos")
        .getPublicUrl(badge.program_badges.image_path);
      badgeImageUrl = urlData.publicUrl;
    }

    // Build credential URLs
    const credentials = (badge.program_badges?.program_badge_credentials || []).map((cred: any) => {
      const clientCred = (badge.client_badge_credentials || []).find(
        (cc: any) => cc.program_badge_credential_id === cred.id,
      );
      return {
        service_name: cred.service_name,
        service_display_name: cred.service_display_name,
        acceptance_url: clientCred?.acceptance_url || null,
      };
    });

    // Check expiry
    const isExpired = badge.expires_at ? new Date(badge.expires_at) < new Date() : false;

    return successResponse.ok({
      verification_valid: !isExpired,
      badge_id: badge.id,
      badge_name: badge.program_badges?.name || "Unknown Badge",
      badge_description: badge.program_badges?.description || null,
      badge_image_url: badgeImageUrl,
      user_name: profile?.name || "Unknown",
      program_name: badge.program_badges?.programs?.name || "Unknown Program",
      program_slug: badge.program_badges?.programs?.slug || null,
      organization_name: "InnoTrue",
      issued_at: badge.issued_at,
      expires_at: badge.expires_at,
      is_expired: isExpired,
      credentials,
    }, cors);
  } catch (err) {
    return errorResponse.serverError("verify-badge", err, cors);
  }
});
