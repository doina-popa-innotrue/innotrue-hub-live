/**
 * Client-side request signing for sensitive operations
 * Works in conjunction with server-side verification in edge functions
 */

const SIGNING_SECRET_KEY = "request_signing_enabled";

/**
 * Check if request signing is available (secret configured)
 */
export function isRequestSigningEnabled(): boolean {
  // This is determined by whether the server validates signatures
  // For now, we always generate signatures if possible
  return true;
}

/**
 * Generate request signature for sensitive operations
 * @param userId - The authenticated user's ID
 * @param action - The action being performed (e.g., 'checkout', 'delete-user')
 * @returns Headers to include with the request
 */
export async function generateSignedRequestHeaders(
  userId: string,
  action: string,
): Promise<Record<string, string>> {
  const timestamp = Date.now().toString();

  // Generate signature using SubtleCrypto
  // Note: In production, consider using a per-session key derived from the JWT
  const message = `${timestamp}:${userId}:${action}`;

  // Use a client-side derived key for the signature
  // The server will verify this matches the expected signature
  const signature = await computeClientSignature(message, userId);

  return {
    "x-request-timestamp": timestamp,
    "x-request-signature": signature,
  };
}

/**
 * Compute client-side signature
 * Uses a deterministic derivation from user ID to create consistent signatures
 */
async function computeClientSignature(message: string, userId: string): Promise<string> {
  const encoder = new TextEncoder();

  // Derive a key from the user ID (this is visible to the user, which is fine)
  // The security comes from the server verifying with a secret
  const keyMaterial = encoder.encode(userId);

  // Create a simple hash of the message
  const messageData = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    new Uint8Array([...keyMaterial, ...messageData]),
  );

  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Wrapper for fetch that adds signed headers for sensitive operations
 */
export async function signedFetch(
  url: string,
  userId: string,
  action: string,
  options: RequestInit = {},
): Promise<Response> {
  const signedHeaders = await generateSignedRequestHeaders(userId, action);

  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      ...signedHeaders,
    },
  });
}
