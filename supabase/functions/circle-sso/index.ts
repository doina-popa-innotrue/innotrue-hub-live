import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', success: false }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Validate the user JWT using signing keys (recommended approach)
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await authClient.auth.getUser();

    if (userError || !user?.id || !user.email) {
      console.error('JWT validation failed:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized', success: false }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;
    const userEmail = user.email;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Circle SSO request for user:', userId);

    // Get Circle credentials
    const circleApiKey = Deno.env.get('CIRCLE_API_KEY');
    const circleCommunityId = Deno.env.get('CIRCLE_COMMUNITY_ID');
    const circleHeadlessAuthToken = Deno.env.get('CIRCLE_HEADLESS_AUTH_TOKEN');

    if (!circleApiKey || !circleCommunityId) {
      throw new Error('Circle credentials not configured');
    }

    if (!circleHeadlessAuthToken) {
      throw new Error('CIRCLE_HEADLESS_AUTH_TOKEN not configured');
    }

    const circleCommunityDomain = Deno.env.get('CIRCLE_COMMUNITY_DOMAIN');
    if (!circleCommunityDomain) {
      throw new Error('CIRCLE_COMMUNITY_DOMAIN not configured');
    }

    // Look up user's Circle mapping
    const { data: mapping, error: mappingError } = await supabaseAdmin
      .from('circle_users')
      .select('circle_user_id, circle_email')
      .eq('user_id', userId)
      .maybeSingle();

    if (mappingError) {
      console.error('Error fetching Circle mapping:', mappingError);
      throw new Error('Failed to fetch user mapping');
    }

    // Get user profile for name
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('name')
      .eq('id', userId)
      .maybeSingle();

    const userName = profile?.name || userEmail.split('@')[0] || 'User';

    let circleUserId: string = '';

    // Circle API base URLs
    // NOTE: Circle's API docs are hosted on api.circle.so / api-v1.circle.so, but the actual JSON API
    // endpoints are served from app.circle.so under /api.
    // Admin v1 endpoints: https://app.circle.so/api/v1/...
    const circleAdminBase = 'https://app.circle.so/api';

    // Headless endpoints are also hosted under app.circle.so
    const circleHeadlessBase = 'https://app.circle.so';

    const circleFetch = async (
      url: string,
      init: RequestInit
    ): Promise<Response> => {
      // Circle tokens can be accepted as either "Token" or "Bearer" depending on API family.
      // Some Circle endpoints also expect the legacy format: "Token token=...".
      const tryAuthHeaders = [
        `Bearer ${circleApiKey}`,
        `Token ${circleApiKey}`,
        `Token token=${circleApiKey}`,
      ];

      let lastRes: Response | null = null;
      for (const authValue of tryAuthHeaders) {
        const res = await fetch(url, {
          ...init,
          headers: {
            ...(init.headers ?? {}),
            Authorization: authValue,
          },
        });

        lastRes = res;
        if (res.status !== 401 && res.status !== 403) return res;
      }

      return lastRes!;
    };

    const extractId = (payload: any): string | null => {
      const maybe =
        payload?.id ??
        payload?.community_member?.id ??
        payload?.communityMember?.id ??
        payload?.data?.id ??
        payload?.data?.community_member?.id;
      return maybe != null ? String(maybe) : null;
    };

    // Helper function to look up Circle user by email
    // NOTE: Circle's Headless Member APIs require a *Headless Auth* token flow.
    // The token we have configured for this integration is an Admin API token,
    // so headless search will return 401 "access token is invalid".
    // For now we skip email search and rely on existing mapping, or create.
    const lookupCircleUserByEmail = async (_email: string): Promise<string | null> => {
      return null;
    };

    // If mapping exists but might have invalid ID (like an email), validate it
    if (mapping) {
      // Check if the stored circle_user_id looks like a numeric ID
      const isNumericId = /^\d+$/.test(mapping.circle_user_id);
      
      if (!isNumericId) {
        console.log('Stored circle_user_id is not numeric, looking up by email...');
        const foundId = await lookupCircleUserByEmail(userEmail);
        
        if (foundId) {
          circleUserId = foundId;
          // Update the mapping with the correct numeric ID
          await supabaseAdmin
            .from('circle_users')
            .update({ circle_user_id: foundId })
            .eq('user_id', userId);
          console.log('Updated mapping with correct Circle user ID:', foundId);
        } else {
          // User not found in Circle, need to create them
          console.log('User not found in Circle, will create new user');
          circleUserId = ''; // Will trigger creation below
        }
      } else {
        circleUserId = mapping.circle_user_id;
        console.log('Found existing Circle mapping with valid ID:', circleUserId);
      }
    }

    // If no mapping or need to create user
    if (!mapping || !circleUserId) {
      // First try to find existing Circle user by email using V2 search endpoint
      console.log('Searching for existing Circle user by email:', userEmail);
      const searchUrl = `${circleAdminBase}/admin/v2/community_members/search?email=${encodeURIComponent(userEmail)}`;
      const searchResponse = await circleFetch(searchUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const searchRawText = await searchResponse.text();
      let searchPayload: any = null;
      try {
        searchPayload = searchRawText ? JSON.parse(searchRawText) : null;
      } catch {
        // leave as null
      }
      
      // Check if we found an existing user
      const existingCircleId = searchPayload?.records?.[0]?.id ?? searchPayload?.id ?? null;
      
      if (existingCircleId) {
        circleUserId = String(existingCircleId);
        console.log('Found existing Circle user by email:', circleUserId);
      } else {
        // Create new Circle user using Admin V2 API first, fallback to V1
        console.log('No Circle user found, creating new Circle user');
        
        // Try V2 endpoint first
        let createUserUrl = `${circleAdminBase}/admin/v2/community_members`;
        let createResponse = await circleFetch(createUserUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: userEmail,
            name: userName,
            skip_invitation: true,
          }),
        });

        let rawText = await createResponse.text();
        let circleUserPayload: any = null;
        try {
          circleUserPayload = rawText ? JSON.parse(rawText) : null;
        } catch {
          // leave as null
        }
        
        // If V2 fails with 404 or unauthorized, try V1 endpoint
        if (!createResponse.ok || circleUserPayload?.status === 'unauthorized') {
          console.log('Admin V2 failed, trying Admin V1 endpoint...');
          createUserUrl = `${circleAdminBase}/v1/community_members`;
          createResponse = await circleFetch(createUserUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              community_id: parseInt(circleCommunityId),
              email: userEmail,
              name: userName,
              skip_invitation: true,
            }),
          });

          rawText = await createResponse.text();
          circleUserPayload = null;
          try {
            circleUserPayload = rawText ? JSON.parse(rawText) : null;
          } catch {
            // leave as null
          }
        }

        if (!createResponse.ok) {
          console.error('Circle API error creating user:', rawText);
          throw new Error(`Circle API error: ${createResponse.status} - ${rawText}`);
        }

        // Circle sometimes returns HTTP 200 with an error payload
        if (circleUserPayload?.status === 'unauthorized') {
          console.error('Circle create user unauthorized payload:', circleUserPayload);
          throw new Error('Circle API unauthorized: please verify CIRCLE_API_KEY is a valid Admin API token from Circle Developers → Tokens');
        }

        const createdId = extractId(circleUserPayload);
        if (!createdId) {
          console.error('Circle create user response missing id:', circleUserPayload ?? rawText);
          throw new Error('Circle API error: missing user id in response');
        }
        circleUserId = createdId;
        console.log('Created new Circle user:', circleUserId);
      }

      // Store or update the mapping
      if (mapping) {
        await supabaseAdmin
          .from('circle_users')
          .update({ circle_user_id: circleUserId, circle_email: userEmail })
          .eq('user_id', userId);
      } else {
        const { error: insertError } = await supabaseAdmin
          .from('circle_users')
          .insert({
            user_id: userId,
            circle_user_id: circleUserId,
            circle_email: userEmail,
          });

        if (insertError) {
          console.error('Error storing Circle mapping:', insertError);
        }
      }
    }

    // Use Headless Auth API to get an access token for the user
    // This requires a Headless Auth token (separate from the Admin API token)
    console.log('Using Headless Auth API to authenticate user:', userEmail);
    
    const headlessAuthUrl = `${circleAdminBase}/v1/headless/auth_token`;
    const headlessAuthResponse = await fetch(headlessAuthUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${circleHeadlessAuthToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: userEmail,
      }),
    });

    const headlessAuthRawText = await headlessAuthResponse.text();
    let headlessAuthData: any = null;
    try {
      headlessAuthData = headlessAuthRawText ? JSON.parse(headlessAuthRawText) : null;
    } catch {
      // leave as null
    }

    if (!headlessAuthResponse.ok) {
      console.error('Circle Headless Auth API error:', headlessAuthRawText);
      
      // Check for specific error messages
      if (headlessAuthData?.message === 'Your account could not be authenticated.') {
        throw new Error('Circle Headless Auth unauthorized: please verify CIRCLE_HEADLESS_AUTH_TOKEN');
      }
      if (headlessAuthData?.message?.includes("isn't eligible for headless API access")) {
        throw new Error('Circle community is not eligible for Headless API access. Please upgrade your Circle plan or contact Circle support.');
      }
      if (headlessAuthData?.message === 'Community member not found.') {
        throw new Error('User not found in Circle community. Please ensure the user exists in Circle first.');
      }
      
      throw new Error(`Circle Headless Auth API error: ${headlessAuthResponse.status}`);
    }

    // The headless auth returns an access_token (JWT) that can be used to authenticate to Circle
    const accessToken = headlessAuthData?.access_token;
    const communityMemberId = headlessAuthData?.community_member_id;

    if (!accessToken) {
      console.error('Circle Headless Auth response missing access_token:', headlessAuthData);
      throw new Error('Circle Headless Auth API error: missing access_token');
    }

    console.log('Successfully obtained Circle access token for community member:', communityMemberId);

    // Update the mapping with the correct community_member_id if needed
    if (communityMemberId && circleUserId !== String(communityMemberId)) {
      circleUserId = String(communityMemberId);
      await supabaseAdmin
        .from('circle_users')
        .upsert({
          user_id: userId,
          circle_user_id: circleUserId,
          circle_email: userEmail,
        }, { onConflict: 'user_id' });
      console.log('Updated Circle user mapping with community_member_id:', circleUserId);
    }

    // Build the login URL using the session/cookies endpoint
    // This redirects the user to Circle and automatically sets their session cookie
    // Ref: https://api.circle.so/apis/headless/member-api/cookies
    const loginUrl = `https://${circleCommunityDomain}/session/cookies?access_token=${accessToken}`;

    console.log('Circle SSO completed successfully, redirecting to:', circleCommunityDomain);

    return new Response(
      JSON.stringify({ 
        loginUrl: loginUrl,
        communityMemberId: communityMemberId,
        success: true 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in circle-sso function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        success: false 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
