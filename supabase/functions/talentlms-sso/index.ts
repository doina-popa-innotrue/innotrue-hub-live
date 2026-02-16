import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { errorResponse, successResponse } from "../_shared/error-response.ts";

serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: cors });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', success: false }),
        { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
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

    if (userError || !user) {
      console.error('JWT validation failed:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized', success: false }),
        { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { redirectUrl } = await req.json();

    console.log('TalentLMS SSO request for user:', userId, 'redirectUrl:', redirectUrl);

    // Get TalentLMS credentials
    const talentlmsApiKey = Deno.env.get('TALENTLMS_API_KEY');
    const talentlmsDomain = Deno.env.get('TALENTLMS_DOMAIN');

    if (!talentlmsApiKey || !talentlmsDomain) {
      throw new Error('TalentLMS credentials not configured');
    }

    // Look up user's TalentLMS mapping
    const { data: mapping, error: mappingError } = await supabaseAdmin
      .from('talentlms_users')
      .select('id, talentlms_user_id, talentlms_username')
      .eq('user_id', userId)
      .maybeSingle();

    if (mappingError) {
      console.error('Error fetching TalentLMS mapping:', mappingError);
      throw new Error('Failed to fetch user mapping');
    }

    if (!mapping) {
      return new Response(
        JSON.stringify({
          error: 'TalentLMS account not linked',
          message: 'Please contact your administrator to link your TalentLMS account'
        }),
        {
          status: 404,
          headers: { ...cors, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('Found TalentLMS mapping:', mapping.talentlms_username, 'talentlms_user_id:', mapping.talentlms_user_id);

    const credentials = btoa(`${talentlmsApiKey}:`);

    // Normalize redirectUrl to a path if a full URL was provided
    let redirectPath = redirectUrl as string | undefined;
    try {
      if (redirectPath && redirectPath.startsWith('http')) {
        redirectPath = new URL(redirectPath).pathname;
      }
    } catch {
      // ignore
    }

    // Extract a course/training ID from redirectPath.
    // Supported examples:
    // - /plus/courses/341
    // - /plus/my/training/341
    const idMatch = redirectPath?.match(/\/(?:courses|my\/training)\/(\d+)/);
    const targetId = idMatch ? idMatch[1] : null;

    console.log('Normalized redirectPath:', redirectPath, 'extracted targetId:', targetId);

    let loginUrl: string;

    // We'll try to deep-link after we resolve the real TalentLMS user id.
    const identifier = mapping.talentlms_username;
    let userData: any = null;

    // Try direct lookups first (email and username endpoints)
    const candidates: string[] = [];
    if (identifier.includes('@')) {
      candidates.push(`https://${talentlmsDomain}/api/v1/users/email:${encodeURIComponent(identifier)}`);
    }
    candidates.push(`https://${talentlmsDomain}/api/v1/users/username:${encodeURIComponent(identifier)}`);

    for (const userUrl of candidates) {
      console.log('Trying TalentLMS user lookup:', userUrl.replace(/\/users\/.+$/, '/users/<masked>'));

      const res = await fetch(userUrl, {
        method: 'GET',
        headers: { 'Authorization': `Basic ${credentials}` },
      });

      if (res.ok) {
        userData = await res.json();
        console.log('Found user via direct lookup');
        break;
      }

      const errorText = await res.text();
      console.log('Direct lookup failed:', res.status, errorText);
    }

    // Fallback: fetch all users and search (TalentLMS API quirk - direct lookups sometimes fail)
    if (!userData) {
      console.log('Direct lookups failed, fetching all users as fallback...');
      const usersUrl = `https://${talentlmsDomain}/api/v1/users`;
      const usersRes = await fetch(usersUrl, {
        method: 'GET',
        headers: { 'Authorization': `Basic ${credentials}` },
      });

      if (!usersRes.ok) {
        throw new Error(`Failed to fetch users list: ${usersRes.status}`);
      }

      const allUsers = await usersRes.json();
      console.log(`Searching through ${allUsers.length} users for: ${identifier}`);

      // Find user by email or login matching the identifier
      userData = allUsers.find((u: any) =>
        u.email?.toLowerCase() === identifier.toLowerCase() ||
        u.login?.toLowerCase() === identifier.toLowerCase()
      );

      if (userData) {
        console.log('Found user via fallback search:', userData.login);
      }
    }

    if (!userData) {
      throw new Error(`User not found in TalentLMS: ${identifier}`);
    }

    // Persist TalentLMS user id if we don't have it yet (required for deep-link APIs)
    const resolvedTalentLmsUserId = (mapping.talentlms_user_id || userData?.id || '').toString();

    if (!mapping.talentlms_user_id && resolvedTalentLmsUserId) {
      const { error: updateError } = await supabaseAdmin
        .from('talentlms_users')
        .update({ talentlms_user_id: resolvedTalentLmsUserId })
        .eq('id', mapping.id);

      if (updateError) {
        console.error('Failed to persist talentlms_user_id:', updateError);
      } else {
        console.log('Persisted talentlms_user_id for future requests');
      }
    }

    // If we have a target course/training id and a resolved TalentLMS user id, try deep-link
    if (targetId && resolvedTalentLmsUserId) {
      console.log('Using gotoCourse API for targetId:', targetId);

      const gotoCourseUrl = `https://${talentlmsDomain}/api/v1/gotocourse/user_id:${encodeURIComponent(resolvedTalentLmsUserId)},course_id:${encodeURIComponent(targetId)}`;

      const gotoCourseRes = await fetch(gotoCourseUrl, {
        method: 'GET',
        headers: { 'Authorization': `Basic ${credentials}` },
      });

      if (gotoCourseRes.ok) {
        const gotoCourseData = await gotoCourseRes.json();
        console.log('gotoCourse response:', JSON.stringify(gotoCourseData));

        if (gotoCourseData.goto_url) {
          loginUrl = gotoCourseData.goto_url;

          // Replace domain if needed
          try {
            const loginUrlParsed = new URL(loginUrl);
            const configuredDomain = talentlmsDomain.replace(/^https?:\/\//, '').replace(/\/$/, '');

            if (loginUrlParsed.hostname !== configuredDomain) {
              console.log(`Replacing domain ${loginUrlParsed.hostname} with configured domain ${configuredDomain}`);
              loginUrlParsed.hostname = configuredDomain;
              loginUrl = loginUrlParsed.toString();
            }
          } catch (e) {
            console.log('Could not parse goto_url as URL, using as-is:', e);
          }

          console.log('Generated gotoCourse login URL (masked):', loginUrl.replace(/key:[^,]+/, 'key:***'));

          return new Response(
            JSON.stringify({ loginUrl, success: true }),
            { headers: { ...cors, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        const errorText = await gotoCourseRes.text();
        console.log('gotoCourse API failed:', gotoCourseRes.status, errorText);
        // Fall back to standard login_key below
      }
    }

    // Fallback: Use standard login_key method
    console.log('Using standard login_key method');

    if (!userData.login_key) {
      throw new Error('No login_key returned from TalentLMS');
    }

    console.log('Retrieved user data successfully with login_key');

    // Construct the final redirect URL if needed
    loginUrl = userData.login_key;

    // Replace the domain in login_key with the configured custom domain if different
    try {
      const loginUrlParsed = new URL(loginUrl);
      const configuredDomain = talentlmsDomain.replace(/^https?:\/\//, '').replace(/\/$/, '');

      if (loginUrlParsed.hostname !== configuredDomain) {
        console.log(`Replacing domain ${loginUrlParsed.hostname} with configured domain ${configuredDomain}`);
        loginUrlParsed.hostname = configuredDomain;
        loginUrl = loginUrlParsed.toString();
      }
    } catch (e) {
      console.log('Could not parse login_key as URL, using as-is:', e);
    }

    console.log('Generated login URL (masked):', loginUrl.replace(/key:[^,]+/, 'key:***'));

    return new Response(
      JSON.stringify({
        loginUrl: loginUrl,
        success: true
      }),
      {
        headers: { ...cors, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in talentlms-sso function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        success: false 
      }),
      { 
        status: 500, 
        headers: { ...cors, 'Content-Type': 'application/json' } 
      }
    );
  }
});