// Shared CORS configuration with environment-based origin restriction
// This provides defense-in-depth against CSRF and unauthorized API access

/**
 * Get allowed origins based on environment
 * In production, restricts to known domains only
 */
export function getAllowedOrigins(): string[] {
  const siteUrl = Deno.env.get('SITE_URL');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  
  // Known production domains
  const productionOrigins = [
    'https://app.innotrue.com',
  ];
  
  // Add environment-configured URLs if available
  if (siteUrl) {
    productionOrigins.push(siteUrl);
  }
  
  // Supabase URL is also valid (for internal calls)
  if (supabaseUrl) {
    productionOrigins.push(supabaseUrl);
  }
  
  return productionOrigins;
}

/**
 * Check if the request origin is allowed
 */
export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return true; // Allow server-to-server calls
  
  const allowedOrigins = getAllowedOrigins();
  
  // Check exact match
  if (allowedOrigins.includes(origin)) {
    return true;
  }

  // Allow localhost for development
  if (origin.startsWith('http://localhost:') || origin === 'http://localhost') {
    return true;
  }

  // Allow Cloudflare Pages preview/deploy URLs (preprod, sandbox, deploy previews)
  if (origin.endsWith('.innotrue-hub-live.pages.dev')) {
    return true;
  }

  return false;
}

/**
 * Get CORS headers for a request
 * Uses the request's origin if allowed, otherwise returns restricted headers
 */
export function getCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('origin');
  
  // Determine which origin to allow
  let allowedOrigin = 'https://app.innotrue.com'; // Default fallback
  
  if (origin && isOriginAllowed(origin)) {
    allowedOrigin = origin;
  }
  
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-request-timestamp, x-request-signature',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400', // Cache preflight for 24 hours
  };
}

/**
 * Legacy CORS headers for backwards compatibility
 * @deprecated Use getCorsHeaders(request) for origin-aware CORS
 */
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-request-timestamp, x-request-signature',
};
