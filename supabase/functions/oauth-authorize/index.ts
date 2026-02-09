import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';
import { 
  OAuthProvider, 
  buildAuthUrl, 
  isProviderConfigured,
  getConfiguredProviders 
} from '../_shared/oauth-providers.ts';
import { isEncryptionConfigured } from '../_shared/oauth-crypto.ts';

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check encryption is configured
    if (!isEncryptionConfigured()) {
      console.error('OAUTH_ENCRYPTION_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'OAuth not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    const { provider, returnUrl } = await req.json();

    // Validate provider
    if (!provider || !['zoom', 'google', 'microsoft'].includes(provider)) {
      return new Response(
        JSON.stringify({ error: 'Invalid provider', validProviders: ['zoom', 'google', 'microsoft'] }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if provider is configured
    if (!isProviderConfigured(provider as OAuthProvider)) {
      return new Response(
        JSON.stringify({ 
          error: `${provider} OAuth not configured`,
          configuredProviders: getConfiguredProviders()
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build redirect URI (callback function URL)
    const redirectUri = `${supabaseUrl}/functions/v1/oauth-callback`;

    // Create state with user info and return URL (encrypted in production)
    const stateData = {
      userId: user.id,
      provider,
      returnUrl: returnUrl || `${Deno.env.get('SITE_URL') || 'https://app.innotrue.com'}/profile/connections`,
      timestamp: Date.now(),
    };
    const state = btoa(JSON.stringify(stateData));

    // Build authorization URL
    const authUrl = buildAuthUrl(provider as OAuthProvider, redirectUri, state);

    if (!authUrl) {
      return new Response(
        JSON.stringify({ error: 'Failed to build authorization URL' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Generated OAuth URL for ${provider}, user: ${user.id}`);

    return new Response(
      JSON.stringify({ authUrl, provider }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('OAuth authorize error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
