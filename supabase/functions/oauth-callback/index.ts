import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { 
  OAuthProvider, 
  exchangeCodeForTokens 
} from '../_shared/oauth-providers.ts';
import { encryptToken } from '../_shared/oauth-crypto.ts';

serve(async (req) => {
  // This is a redirect endpoint, so we return HTML responses
  const errorHtml = (message: string, returnUrl: string) => `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Connection Failed</title>
      <meta http-equiv="refresh" content="3;url=${returnUrl}?error=${encodeURIComponent(message)}">
      <style>
        body { font-family: system-ui; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f5f5f5; }
        .card { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); text-align: center; max-width: 400px; }
        h1 { color: #ef4444; font-size: 1.5rem; }
        p { color: #666; }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>Connection Failed</h1>
        <p>${message}</p>
        <p>Redirecting...</p>
      </div>
    </body>
    </html>
  `;

  const successHtml = (provider: string, returnUrl: string) => `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Connected Successfully</title>
      <meta http-equiv="refresh" content="2;url=${returnUrl}?success=true&provider=${provider}">
      <style>
        body { font-family: system-ui; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f5f5f5; }
        .card { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); text-align: center; max-width: 400px; }
        h1 { color: #22c55e; font-size: 1.5rem; }
        p { color: #666; }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>Connected Successfully</h1>
        <p>Your ${provider} account has been connected.</p>
        <p>Redirecting...</p>
      </div>
    </body>
    </html>
  `;

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');
    const errorDescription = url.searchParams.get('error_description');

    const defaultReturnUrl = Deno.env.get('SITE_URL') || 'https://app.innotrue.com';

    // Handle OAuth errors
    if (error) {
      console.error('OAuth error:', error, errorDescription);
      return new Response(errorHtml(errorDescription || error, defaultReturnUrl), {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    if (!code || !state) {
      return new Response(errorHtml('Missing authorization code or state', defaultReturnUrl), {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    // Decode state
    let stateData: { userId: string; provider: OAuthProvider; returnUrl: string; timestamp: number };
    try {
      stateData = JSON.parse(atob(state));
    } catch {
      return new Response(errorHtml('Invalid state parameter', defaultReturnUrl), {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    const { userId, provider, returnUrl } = stateData;

    // Validate state timestamp (10 minute expiry)
    if (Date.now() - stateData.timestamp > 10 * 60 * 1000) {
      return new Response(errorHtml('Authorization request expired', returnUrl), {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const redirectUri = `${supabaseUrl}/functions/v1/oauth-callback`;

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(provider, code, redirectUri);

    if (!tokens) {
      return new Response(errorHtml('Failed to exchange authorization code', returnUrl), {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    // Encrypt tokens
    const accessTokenEncrypted = await encryptToken(tokens.access_token);
    const refreshTokenEncrypted = tokens.refresh_token 
      ? await encryptToken(tokens.refresh_token) 
      : null;

    // Calculate token expiry
    const tokenExpiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null;

    // Get user info from provider (optional, for display)
    let providerEmail: string | null = null;
    let providerUserId: string | null = null;

    try {
      if (provider === 'zoom') {
        const userRes = await fetch('https://api.zoom.us/v2/users/me', {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        if (userRes.ok) {
          const user = await userRes.json();
          providerEmail = user.email;
          providerUserId = user.id;
        }
      } else if (provider === 'google') {
        const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        if (userRes.ok) {
          const user = await userRes.json();
          providerEmail = user.email;
          providerUserId = user.id;
        }
      } else if (provider === 'microsoft') {
        const userRes = await fetch('https://graph.microsoft.com/v1.0/me', {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        if (userRes.ok) {
          const user = await userRes.json();
          providerEmail = user.mail || user.userPrincipalName;
          providerUserId = user.id;
        }
      }
    } catch (err) {
      console.warn('Failed to fetch user info:', err);
      // Continue without user info
    }

    // Store tokens in database
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { error: upsertError } = await supabase
      .from('user_oauth_tokens')
      .upsert({
        user_id: userId,
        provider,
        access_token_encrypted: accessTokenEncrypted,
        refresh_token_encrypted: refreshTokenEncrypted,
        token_expires_at: tokenExpiresAt,
        scopes: tokens.scope ? tokens.scope.split(' ') : null,
        provider_user_id: providerUserId,
        provider_email: providerEmail,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,provider',
      });

    if (upsertError) {
      console.error('Failed to store tokens:', upsertError);
      return new Response(errorHtml('Failed to save connection', returnUrl), {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    console.log(`Successfully connected ${provider} for user ${userId}`);

    return new Response(successHtml(provider.charAt(0).toUpperCase() + provider.slice(1), returnUrl), {
      headers: { 'Content-Type': 'text/html' },
    });

  } catch (error) {
    console.error('OAuth callback error:', error);
    const defaultReturnUrl = Deno.env.get('SITE_URL') || 'https://app.innotrue.com';
    return new Response(errorHtml('An unexpected error occurred', defaultReturnUrl), {
      headers: { 'Content-Type': 'text/html' },
    });
  }
});
