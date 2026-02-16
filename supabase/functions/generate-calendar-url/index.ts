import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { getCorsHeaders } from "../_shared/cors.ts";
import { errorResponse, successResponse } from "../_shared/error-response.ts";

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function generateHmacSignature(
  userId: string,
  timestamp: string,
  secret: string
): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const message = `${userId}:${timestamp}`;
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return bytesToHex(new Uint8Array(signature));
}

serve(async (req) => {
  const cors = getCorsHeaders(req);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: cors });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const hmacSecret = Deno.env.get('CALENDAR_HMAC_SECRET');

    if (!hmacSecret) {
      console.error('CALENDAR_HMAC_SECRET not configured');
      return new Response(
        JSON.stringify({ error: 'Calendar signing not configured' }),
        { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    // Verify auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Verify the JWT and get the user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('Auth error:', authError?.message);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    // Check if calendar sync is enabled
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('calendar_sync_enabled')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Profile error:', profileError.message);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch profile' }),
        { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    if (!profile?.calendar_sync_enabled) {
      return new Response(
        JSON.stringify({ error: 'Calendar sync is not enabled' }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    // Generate HMAC-signed URL with timestamp
    const timestamp = Date.now().toString();
    const signature = await generateHmacSignature(user.id, timestamp, hmacSecret);

    const calendarFeedUrl = `${supabaseUrl}/functions/v1/calendar-feed?uid=${encodeURIComponent(user.id)}&ts=${timestamp}&sig=${signature}`;

    console.log('Generated signed calendar URL for user:', user.id);

    return new Response(
      JSON.stringify({ url: calendarFeedUrl }),
      { headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error generating calendar URL:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }
});
