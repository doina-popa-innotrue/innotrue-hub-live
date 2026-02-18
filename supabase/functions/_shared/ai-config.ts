/**
 * Shared AI provider configuration.
 *
 * To switch providers:
 *   1. Uncomment the desired provider block below (and comment the current one)
 *   2. Set the corresponding secrets in Supabase Edge Function secrets:
 *      supabase secrets set <KEY_NAME>=<your-key>
 *   3. Redeploy edge functions
 *
 * All providers below use the OpenAI-compatible chat completions format,
 * so no code changes are needed in the edge functions themselves.
 */

// ─────────────────────────────────────────────────────────────────────────────
// MISTRAL AI  (EU/GDPR alternative — EU-headquartered)
//
// EU-headquartered (Paris). Data stays in EU by default.
// Signed government framework with France & Germany.
// OpenAI-compatible API. Best price-performance ratio.
//
// Models:
//   "mistral-medium-latest"  — best for coaching & learning ($0.40/$2 per 1M tokens)
//   "mistral-large-latest"   — premium reasoning ($2/$6 per 1M tokens)
//   "mistral-small-latest"   — fast & cheap, good for simple tasks
//   "open-mistral-nemo"      — most affordable ($0.02 per 1M tokens)
//
// Secret: supabase secrets set MISTRAL_API_KEY=<your-key>
// ─────────────────────────────────────────────────────────────────────────────
// export const AI_PROVIDER = "mistral" as const;
// export const AI_ENDPOINT = "https://api.mistral.ai/v1/chat/completions";
// export const AI_API_KEY_NAME = "MISTRAL_API_KEY";
// export const AI_MODEL = "mistral-medium-latest";

// ─────────────────────────────────────────────────────────────────────────────
// GOOGLE VERTEX AI  (Recommended — EU data residency in Frankfurt, europe-west3)
//
// OpenAI-compatible endpoint on Vertex AI. Data stays in Germany.
// Requires a Google Cloud project with Vertex AI API enabled and a
// service account with "Vertex AI User" role.
//
// Best value/cost for coaching & learning use cases.
// Your Google Workspace org likely already has a GCP project.
//
// Models (prefix with "google/"):
//   "google/gemini-3-flash-preview" — latest, fast & smart (preview, pricing TBC)
//   "google/gemini-3-pro-preview"   — latest premium reasoning (preview, pricing TBC)
//   "google/gemini-2.5-flash"       — stable GA fallback ($0.50/$3 per 1M tokens)
//   "google/gemini-2.5-pro"         — stable GA premium ($1.25/$10 per 1M tokens)
//
// Setup:
//   1. Enable Vertex AI API: gcloud services enable aiplatform.googleapis.com
//   2. Create service account: gcloud iam service-accounts create innotrue-ai \
//        --display-name="InnoTrue AI" --project=YOUR_PROJECT_ID
//   3. Grant role: gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
//        --member="serviceAccount:innotrue-ai@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
//        --role="roles/aiplatform.user"
//   4. Create key: gcloud iam service-accounts keys create key.json \
//        --iam-account=innotrue-ai@YOUR_PROJECT_ID.iam.gserviceaccount.com
//   5. Set secrets:
//      supabase secrets set GCP_SERVICE_ACCOUNT_KEY='<contents of key.json>'
//      supabase secrets set GCP_PROJECT_ID=YOUR_PROJECT_ID
//      supabase secrets set GCP_LOCATION=europe-west3
//
// ─────────────────────────────────────────────────────────────────────────────
export const AI_PROVIDER = "vertex" as const;
export const AI_ENDPOINT = ""; // Built dynamically from GCP_PROJECT_ID and GCP_LOCATION
export const AI_API_KEY_NAME = "GCP_SERVICE_ACCOUNT_KEY";
export const AI_MODEL = "google/gemini-2.5-flash";
// Note: gemini-3-flash-preview requires global endpoint (no EU data residency).
// Use gemini-2.5-flash for regional endpoints like europe-west3.

// ─────────────────────────────────────────────────────────────────────────────
// GOOGLE GEMINI AI Studio  (Simple API key, US-based processing)
//
// Generous free tier. Easiest Gemini setup (just an API key).
// WARNING: Data is processed in the US — not suitable for strict GDPR.
// Use Vertex AI (above) for EU data residency.
//
// Models:
//   "gemini-3-flash-preview" — latest, fast & smart (preview)
//   "gemini-3-pro-preview"   — latest premium reasoning (preview)
//   "gemini-2.5-flash"       — stable GA fallback
//   "gemini-2.5-pro"         — stable GA premium
//
// Secret: supabase secrets set GEMINI_API_KEY=<your-key>
// ─────────────────────────────────────────────────────────────────────────────
// export const AI_PROVIDER = "gemini-studio" as const;
// export const AI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
// export const AI_API_KEY_NAME = "GEMINI_API_KEY";
// export const AI_MODEL = "gemini-3-flash-preview";

// ─────────────────────────────────────────────────────────────────────────────
// AZURE OPENAI  (EU data residency via Sweden Central)
//
// Strong GDPR compliance with EU Data Boundary.
// Full GPT-4o access with enterprise SLA.
// Requires Azure resource setup first.
//
// Models:
//   "gpt-4o"       — balanced quality ($5/$15 per 1M tokens)
//   "gpt-4o-mini"  — cost-effective ($0.15/$0.60 per 1M tokens)
//   "gpt-4.1"      — premium reasoning ($2/$8 per 1M tokens)
//
// Endpoint: Replace {resource} with your Azure OpenAI resource name.
// Secret: supabase secrets set AZURE_OPENAI_API_KEY=<your-key>
// ─────────────────────────────────────────────────────────────────────────────
// export const AI_PROVIDER = "azure" as const;
// export const AI_ENDPOINT = "https://{resource}.openai.azure.com/openai/v1/chat/completions";
// export const AI_API_KEY_NAME = "AZURE_OPENAI_API_KEY";
// export const AI_MODEL = "gpt-4o";

// ─────────────────────────────────────────────────────────────────────────────
// OPENAI  (US-based, EU data residency available since 2025)
//
// Widest model selection. EU data residency opt-in available.
// Check https://openai.com/enterprise-privacy for current EU status.
//
// Models:
//   "gpt-4o"       — balanced ($5/$15 per 1M tokens)
//   "gpt-4o-mini"  — cost-effective ($0.15/$0.60 per 1M tokens)
//   "gpt-4.1"      — premium ($2/$8 per 1M tokens)
//
// Secret: supabase secrets set OPENAI_API_KEY=<your-key>
// ─────────────────────────────────────────────────────────────────────────────
// export const AI_PROVIDER = "openai" as const;
// export const AI_ENDPOINT = "https://api.openai.com/v1/chat/completions";
// export const AI_API_KEY_NAME = "OPENAI_API_KEY";
// export const AI_MODEL = "gpt-4o-mini";

// ═══════════════════════════════════════════════════════════════════════════════
// Shared helpers — no changes needed when switching providers
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Read the AI API key from environment, throwing if not set.
 */
export function getAIApiKey(): string {
  const key = Deno.env.get(AI_API_KEY_NAME);
  if (!key) {
    throw new Error(`${AI_API_KEY_NAME} is not configured`);
  }
  return key;
}

// ─── Vertex AI OAuth2 helpers ────────────────────────────────────────────────

/**
 * Base64url encode (no padding) for JWT.
 */
function base64urlEncode(data: Uint8Array): string {
  return btoa(String.fromCharCode(...data))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Import a PKCS8 PEM private key for RS256 signing.
 */
async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const pemBody = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const binary = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "pkcs8",
    binary,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

/**
 * Create a signed JWT for Google OAuth2 service account auth.
 */
async function createSignedJWT(
  serviceAccount: { client_email: string; private_key: string },
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: "https://oauth2.googleapis.com/token",
    scope: "https://www.googleapis.com/auth/cloud-platform",
    iat: now,
    exp: now + 3600,
  };

  const enc = new TextEncoder();
  const headerB64 = base64urlEncode(enc.encode(JSON.stringify(header)));
  const payloadB64 = base64urlEncode(enc.encode(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;

  const key = await importPrivateKey(serviceAccount.private_key);
  const signature = new Uint8Array(
    await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, enc.encode(signingInput)),
  );

  return `${signingInput}.${base64urlEncode(signature)}`;
}

/** Cached access token and expiry for Vertex AI. */
let _cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Get a Google Cloud access token from a service account key.
 * Caches the token until 5 minutes before expiry.
 */
async function getVertexAccessToken(): Promise<string> {
  // Return cached token if still valid (with 5-min buffer)
  if (_cachedToken && Date.now() < _cachedToken.expiresAt - 300_000) {
    return _cachedToken.token;
  }

  const keyJson = Deno.env.get("GCP_SERVICE_ACCOUNT_KEY");
  if (!keyJson) {
    throw new Error("GCP_SERVICE_ACCOUNT_KEY is not configured");
  }

  const serviceAccount = JSON.parse(keyJson);
  const jwt = await createSignedJWT(serviceAccount);

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Failed to get Google access token: ${err}`);
  }

  const data = await resp.json();
  _cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };

  return _cachedToken.token;
}

/**
 * Build the Vertex AI OpenAI-compatible endpoint URL.
 * Uses the global hostname with location in the path, per Google's docs:
 * https://docs.cloud.google.com/vertex-ai/generative-ai/docs/start/openai
 */
function getVertexEndpoint(): string {
  const projectId = Deno.env.get("GCP_PROJECT_ID");
  const location = Deno.env.get("GCP_LOCATION") ?? "europe-west3";
  if (!projectId) {
    throw new Error("GCP_PROJECT_ID is not configured");
  }
  return `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/endpoints/openapi/chat/completions`;
}

// ─── Main chat completion function ───────────────────────────────────────────

/**
 * Make a chat completion request to the configured AI provider.
 *
 * Handles both simple API-key providers and Vertex AI (OAuth2).
 * Returns the raw Response so callers can handle streaming or errors.
 */
export async function aiChatCompletion(
  messages: Array<{ role: string; content: string }>,
  options: {
    model?: string;
    temperature?: number;
    max_tokens?: number;
  } = {},
): Promise<Response> {
  let endpoint: string;
  let authHeader: string;

  if (AI_PROVIDER === "vertex") {
    // Vertex AI: use OAuth2 token and dynamic endpoint
    endpoint = getVertexEndpoint();
    const token = await getVertexAccessToken();
    authHeader = `Bearer ${token}`;
  } else {
    // All other providers: use simple API key
    endpoint = AI_ENDPOINT;
    authHeader = `Bearer ${getAIApiKey()}`;
  }

  return fetch(endpoint, {
    method: "POST",
    headers: {
      "Authorization": authHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: options.model ?? AI_MODEL,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens ?? 2000,
    }),
  });
}
