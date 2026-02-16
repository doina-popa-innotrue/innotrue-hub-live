import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';
import { errorResponse, successResponse } from '../_shared/error-response.ts';
import {
  OAuthProvider,
  buildAuthUrl,
  isProviderConfigured,
  getConfiguredProviders
} from '../_shared/oauth-providers.ts';
import { isEncryptionConfigured } from '../_shared/oauth-crypto.ts';

serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: cors });
  }

  try {
    // Check encryption is configured
    if (!isEncryptionConfigured()) {
      console.error('OAUTH_ENCRYPTION_KEY not configured');
      return errorResponse.serverErrorWithMessage('OAuth not configured', cors);
    }

    // Verify auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return errorResponse.unauthorized('Unauthorized', cors);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify JWT
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return errorResponse.unauthorized('Unauthorized', cors);
    }

    const { provider, returnUrl } = await req.json();

    // Validate provider
    if (!provider || !['zoom', 'google', 'microsoft'].includes(provider)) {
      return errorResponse.badRequest('Invalid provider', cors);
    }

    // Check if provider is configured
    if (!isProviderConfigured(provider as OAuthProvider)) {
      return errorResponse.badRequest(`${provider} OAuth not configured`, cors);
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
      return errorResponse.serverErrorWithMessage('Failed to build authorization URL', cors);
    }

    console.log(`Generated OAuth URL for ${provider}, user: ${user.id}`);

    return successResponse.ok({ authUrl, provider }, cors);

  } catch (error) {
    return errorResponse.serverError('oauth-authorize', error, cors);
  }
});
