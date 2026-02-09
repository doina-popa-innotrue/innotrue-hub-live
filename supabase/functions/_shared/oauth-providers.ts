// OAuth provider configurations for Zoom, Google, and Microsoft

export type OAuthProvider = 'zoom' | 'google' | 'microsoft';

export interface OAuthProviderConfig {
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
  clientIdEnvVar: string;
  clientSecretEnvVar: string;
  extraParams?: Record<string, string>;
}

export const OAUTH_PROVIDERS: Record<OAuthProvider, OAuthProviderConfig> = {
  zoom: {
    authUrl: 'https://zoom.us/oauth/authorize',
    tokenUrl: 'https://zoom.us/oauth/token',
    scopes: ['meeting:write:meeting', 'user:read:user'],
    clientIdEnvVar: 'ZOOM_CLIENT_ID',
    clientSecretEnvVar: 'ZOOM_CLIENT_SECRET',
  },
  google: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: [
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ],
    clientIdEnvVar: 'GOOGLE_OAUTH_CLIENT_ID',
    clientSecretEnvVar: 'GOOGLE_OAUTH_CLIENT_SECRET',
    extraParams: {
      access_type: 'offline',
      prompt: 'consent',
    },
  },
  microsoft: {
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    scopes: [
      'offline_access',
      'User.Read',
      'Calendars.ReadWrite',
      'OnlineMeetings.ReadWrite',
    ],
    clientIdEnvVar: 'MICROSOFT_CLIENT_ID',
    clientSecretEnvVar: 'MICROSOFT_CLIENT_SECRET',
  },
};

/**
 * Get provider config with credentials from environment
 */
export function getProviderCredentials(provider: OAuthProvider): {
  config: OAuthProviderConfig;
  clientId: string;
  clientSecret: string;
} | null {
  const config = OAUTH_PROVIDERS[provider];
  if (!config) return null;

  const clientId = Deno.env.get(config.clientIdEnvVar);
  const clientSecret = Deno.env.get(config.clientSecretEnvVar);

  if (!clientId || !clientSecret) {
    console.log(`Missing credentials for ${provider}: ${config.clientIdEnvVar} or ${config.clientSecretEnvVar}`);
    return null;
  }

  return { config, clientId, clientSecret };
}

/**
 * Check if a provider is configured
 */
export function isProviderConfigured(provider: OAuthProvider): boolean {
  return getProviderCredentials(provider) !== null;
}

/**
 * Get all configured providers
 */
export function getConfiguredProviders(): OAuthProvider[] {
  return (['zoom', 'google', 'microsoft'] as OAuthProvider[])
    .filter(isProviderConfigured);
}

/**
 * Build the OAuth authorization URL for a provider
 */
export function buildAuthUrl(
  provider: OAuthProvider,
  redirectUri: string,
  state: string
): string | null {
  const creds = getProviderCredentials(provider);
  if (!creds) return null;

  const { config, clientId } = creds;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: config.scopes.join(' '),
    state,
    ...config.extraParams,
  });

  return `${config.authUrl}?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(
  provider: OAuthProvider,
  code: string,
  redirectUri: string
): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
} | null> {
  const creds = getProviderCredentials(provider);
  if (!creds) return null;

  const { config, clientId, clientSecret } = creds;

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
  });

  // Zoom requires Basic auth header
  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
  };

  if (provider === 'zoom') {
    const credentials = btoa(`${clientId}:${clientSecret}`);
    headers['Authorization'] = `Basic ${credentials}`;
  }

  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers,
    body: body.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`Token exchange failed for ${provider}:`, error);
    return null;
  }

  return await response.json();
}

/**
 * Refresh an access token
 */
export async function refreshAccessToken(
  provider: OAuthProvider,
  refreshToken: string
): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
} | null> {
  const creds = getProviderCredentials(provider);
  if (!creds) return null;

  const { config, clientId, clientSecret } = creds;

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
  };

  if (provider === 'zoom') {
    const credentials = btoa(`${clientId}:${clientSecret}`);
    headers['Authorization'] = `Basic ${credentials}`;
  }

  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers,
    body: body.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`Token refresh failed for ${provider}:`, error);
    return null;
  }

  return await response.json();
}
