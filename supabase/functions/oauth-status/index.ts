import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';
import { 
  OAuthProvider, 
  getConfiguredProviders,
  isProviderConfigured 
} from '../_shared/oauth-providers.ts';

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

    // Get user's connected OAuth providers
    const { data: connections, error: fetchError } = await supabase
      .from('user_oauth_tokens')
      .select('provider, provider_email, provider_user_id, token_expires_at, created_at, updated_at')
      .eq('user_id', user.id);

    if (fetchError) {
      console.error('Failed to fetch connections:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch connections' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get list of available (configured) providers
    const availableProviders = getConfiguredProviders();

    // Build status response
    const connectedProviders = connections?.map(c => ({
      provider: c.provider,
      email: c.provider_email,
      providerUserId: c.provider_user_id,
      isExpired: c.token_expires_at ? new Date(c.token_expires_at) < new Date() : false,
      connectedAt: c.created_at,
      lastUpdated: c.updated_at,
    })) || [];

    // All possible providers with their status
    const allProviders: OAuthProvider[] = ['zoom', 'google', 'microsoft'];
    const providerStatus = allProviders.map(provider => {
      const connection = connectedProviders.find(c => c.provider === provider);
      return {
        provider,
        isConfigured: isProviderConfigured(provider),
        isConnected: !!connection,
        email: connection?.email || null,
        isExpired: connection?.isExpired || false,
        connectedAt: connection?.connectedAt || null,
      };
    });

    return new Response(
      JSON.stringify({
        providers: providerStatus,
        connectedProviders,
        availableProviders,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('OAuth status error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
