import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';
import { errorResponse, successResponse } from '../_shared/error-response.ts';
import { OAuthProvider } from '../_shared/oauth-providers.ts';

serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: cors });
  }

  try {
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

    const { provider } = await req.json();

    // Validate provider
    if (!provider || !['zoom', 'google', 'microsoft'].includes(provider)) {
      return errorResponse.badRequest('Invalid provider', cors);
    }

    // Delete the OAuth token record
    const { error: deleteError } = await supabase
      .from('user_oauth_tokens')
      .delete()
      .eq('user_id', user.id)
      .eq('provider', provider);

    if (deleteError) {
      console.error('Failed to disconnect:', deleteError);
      return errorResponse.serverErrorWithMessage('Failed to disconnect provider', cors);
    }

    console.log(`Disconnected ${provider} for user ${user.id}`);

    return successResponse.ok({ success: true, provider }, cors);

  } catch (error) {
    return errorResponse.serverError('oauth-disconnect', error, cors);
  }
});
