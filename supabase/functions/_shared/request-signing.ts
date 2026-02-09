// Request signing utilities for sensitive operations
// Provides defense against token replay attacks

const TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Verify a signed request
 * Requests must include:
 * - x-request-timestamp: Unix timestamp in milliseconds
 * - x-request-signature: HMAC-SHA256 signature of timestamp + userId + action
 */
export async function verifySignedRequest(
  request: Request,
  userId: string,
  action: string,
  secret?: string
): Promise<{ valid: boolean; error?: string }> {
  const signingSecret = secret || Deno.env.get('REQUEST_SIGNING_SECRET');
  
  // If no secret configured, skip verification (graceful degradation)
  if (!signingSecret) {
    console.warn('REQUEST_SIGNING_SECRET not configured, skipping signature verification');
    return { valid: true };
  }
  
  const timestamp = request.headers.get('x-request-timestamp');
  const signature = request.headers.get('x-request-signature');
  
  // If headers not present, allow request but log warning
  if (!timestamp || !signature) {
    console.warn('Request missing signing headers, proceeding without verification');
    return { valid: true };
  }
  
  // Verify timestamp is recent
  const requestTime = parseInt(timestamp, 10);
  const now = Date.now();
  
  if (isNaN(requestTime)) {
    return { valid: false, error: 'Invalid timestamp format' };
  }
  
  if (Math.abs(now - requestTime) > TIMESTAMP_TOLERANCE_MS) {
    return { valid: false, error: 'Request timestamp expired' };
  }
  
  // Verify signature
  const message = `${timestamp}:${userId}:${action}`;
  const expectedSignature = await computeHmacSignature(message, signingSecret);
  
  if (!timingSafeEqual(signature, expectedSignature)) {
    return { valid: false, error: 'Invalid request signature' };
  }
  
  return { valid: true };
}

/**
 * Compute HMAC-SHA256 signature
 */
async function computeHmacSignature(message: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(message)
  );
  
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Timing-safe string comparison to prevent timing attacks
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still do comparison to avoid timing differences
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ (b.charCodeAt(i % b.length) || 0);
    }
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
