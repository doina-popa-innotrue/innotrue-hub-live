// Shared OAuth encryption utilities using AES-GCM
// Used to encrypt/decrypt user OAuth tokens before storing in database

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;

/**
 * Convert hex string to Uint8Array
 */
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

/**
 * Convert Uint8Array to hex string
 */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Get the encryption key from environment
 */
async function getEncryptionKey(): Promise<CryptoKey> {
  const keyHex = Deno.env.get('OAUTH_ENCRYPTION_KEY');
  if (!keyHex) {
    throw new Error('OAUTH_ENCRYPTION_KEY not configured');
  }
  
  // Key should be 32 bytes (64 hex chars) for AES-256
  if (keyHex.length !== 64) {
    throw new Error('OAUTH_ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
  }
  
  const keyBytes = hexToBytes(keyHex);
  // Create a new ArrayBuffer to satisfy TypeScript's stricter type checking
  const keyBuffer = new Uint8Array(keyBytes).buffer as ArrayBuffer;
  return await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: ALGORITHM },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt a string value (e.g., access token)
 * Returns format: iv_hex:encrypted_hex
 */
export async function encryptToken(plaintext: string): Promise<string> {
  const key = await getEncryptionKey();
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);
  
  // Generate random IV (12 bytes for GCM)
  const iv = crypto.getRandomValues(new Uint8Array(12));
  // Create a copy of the IV as ArrayBuffer for crypto operations
  const ivBuffer = new Uint8Array(iv).buffer as ArrayBuffer;
  
  const encrypted = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv: new Uint8Array(ivBuffer) },
    key,
    data
  );
  
  return `${bytesToHex(iv)}:${bytesToHex(new Uint8Array(encrypted))}`;
}

/**
 * Decrypt a string value
 * Expects format: iv_hex:encrypted_hex
 */
export async function decryptToken(ciphertext: string): Promise<string> {
  const key = await getEncryptionKey();
  
  const [ivHex, encryptedHex] = ciphertext.split(':');
  if (!ivHex || !encryptedHex) {
    throw new Error('Invalid encrypted token format');
  }
  
  const ivBytes = hexToBytes(ivHex);
  const encryptedBytes = hexToBytes(encryptedHex);
  // Create ArrayBuffer copies for crypto operations
  const iv = new Uint8Array(new Uint8Array(ivBytes).buffer as ArrayBuffer);
  const encrypted = new Uint8Array(new Uint8Array(encryptedBytes).buffer as ArrayBuffer);
  
  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv },
    key,
    encrypted
  );
  
  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

/**
 * Check if encryption key is configured
 */
export function isEncryptionConfigured(): boolean {
  const key = Deno.env.get('OAUTH_ENCRYPTION_KEY');
  return !!key && key.length === 64;
}
