/**
 * Tests for supabase/functions/_shared/request-signing.ts
 *
 * Tests HMAC signature verification and timing-safe comparison.
 * Requires Deno mock for env vars and Web Crypto API (available in Node 20+).
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setupDenoMock, cleanupDenoMock } from "./deno-mock";

const TEST_SECRET = "test-signing-secret-1234567890";
const TEST_USER_ID = "550e8400-e29b-41d4-a716-446655440000";
const TEST_ACTION = "delete-account";

/**
 * Helper to compute HMAC-SHA256 signature matching the implementation.
 */
async function computeSignature(message: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

describe("request-signing.ts", () => {
  beforeEach(() => {
    setupDenoMock({ REQUEST_SIGNING_SECRET: TEST_SECRET });
  });

  afterEach(() => {
    cleanupDenoMock();
    vi.resetModules();
  });

  // ===========================================================================
  // verifySignedRequest — valid signatures
  // ===========================================================================
  describe("verifySignedRequest — valid requests", () => {
    it("accepts a correctly signed request", async () => {
      const { verifySignedRequest } = await import("../request-signing");
      const timestamp = String(Date.now());
      const message = `${timestamp}:${TEST_USER_ID}:${TEST_ACTION}`;
      const signature = await computeSignature(message, TEST_SECRET);

      const req = new Request("https://example.com/api", {
        headers: {
          "x-request-timestamp": timestamp,
          "x-request-signature": signature,
        },
      });

      const result = await verifySignedRequest(req, TEST_USER_ID, TEST_ACTION);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  // ===========================================================================
  // verifySignedRequest — invalid signatures
  // ===========================================================================
  describe("verifySignedRequest — invalid requests", () => {
    it("rejects expired timestamps (> 5 minutes)", async () => {
      const { verifySignedRequest } = await import("../request-signing");
      const oldTimestamp = String(Date.now() - 6 * 60 * 1000); // 6 minutes ago
      const message = `${oldTimestamp}:${TEST_USER_ID}:${TEST_ACTION}`;
      const signature = await computeSignature(message, TEST_SECRET);

      const req = new Request("https://example.com/api", {
        headers: {
          "x-request-timestamp": oldTimestamp,
          "x-request-signature": signature,
        },
      });

      const result = await verifySignedRequest(req, TEST_USER_ID, TEST_ACTION);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("expired");
    });

    it("rejects invalid timestamp format", async () => {
      const { verifySignedRequest } = await import("../request-signing");
      const req = new Request("https://example.com/api", {
        headers: {
          "x-request-timestamp": "not-a-number",
          "x-request-signature": "some-sig",
        },
      });

      const result = await verifySignedRequest(req, TEST_USER_ID, TEST_ACTION);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid timestamp");
    });

    it("rejects tampered signature", async () => {
      const { verifySignedRequest } = await import("../request-signing");
      const timestamp = String(Date.now());

      const req = new Request("https://example.com/api", {
        headers: {
          "x-request-timestamp": timestamp,
          "x-request-signature": "0000000000000000000000000000000000000000000000000000000000000000",
        },
      });

      const result = await verifySignedRequest(req, TEST_USER_ID, TEST_ACTION);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid request signature");
    });

    it("rejects signature for wrong user", async () => {
      const { verifySignedRequest } = await import("../request-signing");
      const timestamp = String(Date.now());
      const message = `${timestamp}:wrong-user-id:${TEST_ACTION}`;
      const signature = await computeSignature(message, TEST_SECRET);

      const req = new Request("https://example.com/api", {
        headers: {
          "x-request-timestamp": timestamp,
          "x-request-signature": signature,
        },
      });

      const result = await verifySignedRequest(req, TEST_USER_ID, TEST_ACTION);
      expect(result.valid).toBe(false);
    });

    it("rejects signature for wrong action", async () => {
      const { verifySignedRequest } = await import("../request-signing");
      const timestamp = String(Date.now());
      const message = `${timestamp}:${TEST_USER_ID}:wrong-action`;
      const signature = await computeSignature(message, TEST_SECRET);

      const req = new Request("https://example.com/api", {
        headers: {
          "x-request-timestamp": timestamp,
          "x-request-signature": signature,
        },
      });

      const result = await verifySignedRequest(req, TEST_USER_ID, TEST_ACTION);
      expect(result.valid).toBe(false);
    });
  });

  // ===========================================================================
  // verifySignedRequest — graceful degradation
  // ===========================================================================
  describe("verifySignedRequest — graceful degradation", () => {
    it("allows requests when signing secret is not configured", async () => {
      cleanupDenoMock();
      setupDenoMock({}); // no REQUEST_SIGNING_SECRET
      vi.resetModules();

      const { verifySignedRequest } = await import("../request-signing");
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const req = new Request("https://example.com/api");
      const result = await verifySignedRequest(req, TEST_USER_ID, TEST_ACTION);
      expect(result.valid).toBe(true);

      consoleSpy.mockRestore();
    });

    it("allows requests without signing headers (graceful fallback)", async () => {
      const { verifySignedRequest } = await import("../request-signing");
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const req = new Request("https://example.com/api");
      const result = await verifySignedRequest(req, TEST_USER_ID, TEST_ACTION);
      expect(result.valid).toBe(true);

      consoleSpy.mockRestore();
    });

    it("accepts explicit secret parameter over env var", async () => {
      const { verifySignedRequest } = await import("../request-signing");
      const customSecret = "custom-secret-xyz";
      const timestamp = String(Date.now());
      const message = `${timestamp}:${TEST_USER_ID}:${TEST_ACTION}`;
      const signature = await computeSignature(message, customSecret);

      const req = new Request("https://example.com/api", {
        headers: {
          "x-request-timestamp": timestamp,
          "x-request-signature": signature,
        },
      });

      const result = await verifySignedRequest(
        req,
        TEST_USER_ID,
        TEST_ACTION,
        customSecret,
      );
      expect(result.valid).toBe(true);
    });
  });
});
