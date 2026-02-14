/**
 * LinkedIn Integration Utilities
 *
 * This file provides utilities for integrating with LinkedIn's profile features.
 */

const PLATFORM_BASE_URL = typeof window !== "undefined" ? window.location.origin : "https://app.innotrue.com";
const ORGANIZATION_NAME = "InnoTrue";

/**
 * Generates a LinkedIn "Add to Profile" URL for certifications/badges
 * This opens LinkedIn's certification form pre-filled with the provided data
 *
 * @param params - The certification/badge details
 * @returns The LinkedIn Add to Profile URL
 */
export function generateLinkedInAddToProfileUrl(params: {
  name: string;
  organizationName?: string;
  issueYear?: number;
  issueMonth?: number;
  expirationYear?: number;
  expirationMonth?: number;
  certificationUrl?: string;
  certificationId?: string;
}): string {
  const baseUrl = "https://www.linkedin.com/profile/add";
  const urlParams = new URLSearchParams();

  urlParams.set("startTask", "CERTIFICATION_NAME");
  urlParams.set("name", params.name);
  urlParams.set("organizationName", params.organizationName || ORGANIZATION_NAME);

  if (params.issueYear) {
    urlParams.set("issueYear", params.issueYear.toString());
  }
  if (params.issueMonth) {
    urlParams.set("issueMonth", params.issueMonth.toString());
  }
  if (params.expirationYear) {
    urlParams.set("expirationYear", params.expirationYear.toString());
  }
  if (params.expirationMonth) {
    urlParams.set("expirationMonth", params.expirationMonth.toString());
  }
  if (params.certificationUrl) {
    urlParams.set("certUrl", params.certificationUrl);
  }
  if (params.certificationId) {
    urlParams.set("certId", params.certificationId);
  }

  return `${baseUrl}?${urlParams.toString()}`;
}

/**
 * Generates a public verification URL for a badge
 */
export function generateBadgeVerificationUrl(badgeId: string): string {
  return `${PLATFORM_BASE_URL}/verify/badge/${badgeId}`;
}

/**
 * Generates a LinkedIn share URL for posting to feed
 * Note: This is for simple URL sharing, not the Share API
 */
export function generateLinkedInShareUrl(params: { url: string; title?: string }): string {
  const baseUrl = "https://www.linkedin.com/sharing/share-offsite/";
  const urlParams = new URLSearchParams();
  urlParams.set("url", params.url);

  return `${baseUrl}?${urlParams.toString()}`;
}

/**
 * Information about LinkedIn Share API integration
 *
 * The Share API allows programmatic posting to a user's LinkedIn feed.
 *
 * Requirements:
 * 1. OAuth 2.0 authentication with LinkedIn
 * 2. User grants 'w_member_social' permission scope
 * 3. Server-side implementation to make API calls
 *
 * Flow:
 * 1. User initiates "Share to LinkedIn" action
 * 2. Redirect to LinkedIn OAuth authorization URL
 * 3. User authorizes the app
 * 4. LinkedIn redirects back with auth code
 * 5. Exchange code for access token (server-side)
 * 6. Use access token to post to LinkedIn API
 *
 * API Endpoint: POST https://api.linkedin.com/v2/ugcPosts
 *
 * Note: LinkedIn OAuth requires a custom server-side OAuth implementation.
 * The Share API would need a dedicated Cloudflare Worker or Edge Function.
 */
export const LINKEDIN_SHARE_API_INFO = {
  authUrl: "https://www.linkedin.com/oauth/v2/authorization",
  tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
  postUrl: "https://api.linkedin.com/v2/ugcPosts",
  requiredScopes: ["w_member_social", "openid", "profile", "email"],
  documentation:
    "https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/share-on-linkedin",
} as const;
