import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';
import { decryptToken } from '../_shared/oauth-crypto.ts';
import { OAuthProvider, refreshAccessToken } from '../_shared/oauth-providers.ts';

interface MeetingRequest {
  provider: OAuthProvider;
  topic: string;
  startTime: string; // ISO 8601
  duration: number; // minutes
  timezone?: string;
}

interface MeetingResponse {
  meetingUrl: string;
  joinUrl: string;
  meetingId: string;
  provider: string;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify JWT
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: MeetingRequest = await req.json();
    const { provider, topic, startTime, duration, timezone } = body;

    // Validate provider
    if (!provider || !['zoom', 'google', 'microsoft'].includes(provider)) {
      return new Response(
        JSON.stringify({ error: 'Invalid provider' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's OAuth token for this provider
    const { data: tokenRecord, error: tokenError } = await supabase
      .from('user_oauth_tokens')
      .select('*')
      .eq('user_id', user.id)
      .eq('provider', provider)
      .single();

    if (tokenError || !tokenRecord) {
      return new Response(
        JSON.stringify({ error: `Not connected to ${provider}`, code: 'NOT_CONNECTED' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Decrypt access token
    let accessToken = await decryptToken(tokenRecord.access_token_encrypted);

    // Check if token is expired and refresh if needed
    if (tokenRecord.token_expires_at && new Date(tokenRecord.token_expires_at) < new Date()) {
      if (!tokenRecord.refresh_token_encrypted) {
        return new Response(
          JSON.stringify({ error: 'Token expired and no refresh token available', code: 'TOKEN_EXPIRED' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const refreshToken = await decryptToken(tokenRecord.refresh_token_encrypted);
      const newTokens = await refreshAccessToken(provider, refreshToken);

      if (!newTokens) {
        return new Response(
          JSON.stringify({ error: 'Failed to refresh token, please reconnect', code: 'REFRESH_FAILED' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update stored tokens
      const { encryptToken } = await import('../_shared/oauth-crypto.ts');
      const newAccessTokenEncrypted = await encryptToken(newTokens.access_token);
      const newRefreshTokenEncrypted = newTokens.refresh_token 
        ? await encryptToken(newTokens.refresh_token) 
        : tokenRecord.refresh_token_encrypted;

      await supabase
        .from('user_oauth_tokens')
        .update({
          access_token_encrypted: newAccessTokenEncrypted,
          refresh_token_encrypted: newRefreshTokenEncrypted,
          token_expires_at: newTokens.expires_in 
            ? new Date(Date.now() + newTokens.expires_in * 1000).toISOString() 
            : tokenRecord.token_expires_at,
          updated_at: new Date().toISOString(),
        })
        .eq('id', tokenRecord.id);

      accessToken = newTokens.access_token;
    }

    // Create meeting based on provider
    let meetingResult: MeetingResponse;

    if (provider === 'zoom') {
      meetingResult = await createZoomMeeting(accessToken, topic, startTime, duration, timezone);
    } else if (provider === 'google') {
      meetingResult = await createGoogleMeeting(accessToken, topic, startTime, duration, timezone);
    } else if (provider === 'microsoft') {
      meetingResult = await createMicrosoftMeeting(accessToken, topic, startTime, duration, timezone);
    } else {
      return new Response(
        JSON.stringify({ error: 'Provider not supported for meeting creation' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Created ${provider} meeting for user ${user.id}: ${meetingResult.meetingId}`);

    return new Response(
      JSON.stringify(meetingResult),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Create meeting error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function createZoomMeeting(
  accessToken: string,
  topic: string,
  startTime: string,
  duration: number,
  timezone?: string
): Promise<MeetingResponse> {
  const response = await fetch('https://api.zoom.us/v2/users/me/meetings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      topic,
      type: 2, // Scheduled meeting
      start_time: startTime,
      duration,
      timezone: timezone || 'UTC',
      settings: {
        host_video: true,
        participant_video: true,
        join_before_host: true,
        waiting_room: false,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Zoom API error:', error);
    throw new Error('Failed to create Zoom meeting');
  }

  const meeting = await response.json();
  return {
    meetingUrl: meeting.join_url,
    joinUrl: meeting.join_url,
    meetingId: meeting.id.toString(),
    provider: 'zoom',
  };
}

async function createGoogleMeeting(
  accessToken: string,
  topic: string,
  startTime: string,
  duration: number,
  timezone?: string
): Promise<MeetingResponse> {
  const startDate = new Date(startTime);
  const endDate = new Date(startDate.getTime() + duration * 60 * 1000);

  const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      summary: topic,
      start: {
        dateTime: startDate.toISOString(),
        timeZone: timezone || 'UTC',
      },
      end: {
        dateTime: endDate.toISOString(),
        timeZone: timezone || 'UTC',
      },
      conferenceData: {
        createRequest: {
          requestId: crypto.randomUUID(),
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Google Calendar API error:', error);
    throw new Error('Failed to create Google Meet');
  }

  const event = await response.json();
  const meetUrl = event.conferenceData?.entryPoints?.find((e: any) => e.entryPointType === 'video')?.uri || event.hangoutLink;
  
  if (!meetUrl) {
    throw new Error('Google Meet link not generated');
  }

  return {
    meetingUrl: meetUrl,
    joinUrl: meetUrl,
    meetingId: event.id,
    provider: 'google',
  };
}

async function createMicrosoftMeeting(
  accessToken: string,
  topic: string,
  startTime: string,
  duration: number,
  timezone?: string
): Promise<MeetingResponse> {
  const startDate = new Date(startTime);
  const endDate = new Date(startDate.getTime() + duration * 60 * 1000);

  const response = await fetch('https://graph.microsoft.com/v1.0/me/onlineMeetings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      subject: topic,
      startDateTime: startDate.toISOString(),
      endDateTime: endDate.toISOString(),
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Microsoft Graph API error:', error);
    throw new Error('Failed to create Teams meeting');
  }

  const meeting = await response.json();
  return {
    meetingUrl: meeting.joinUrl || meeting.joinWebUrl,
    joinUrl: meeting.joinUrl || meeting.joinWebUrl,
    meetingId: meeting.id,
    provider: 'microsoft',
  };
}
