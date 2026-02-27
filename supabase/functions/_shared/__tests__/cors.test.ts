/**
 * Tests for supabase/functions/_shared/cors.ts
 *
 * Requires Deno mock since cors.ts reads Deno.env for allowed origins.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setupDenoMock, cleanupDenoMock } from "./deno-mock";

// We need to dynamically import cors.ts AFTER setting up the Deno mock,
// since the module reads Deno.env at import time for some constants.
// Using dynamic import with vi.resetModules() to get fresh module state.

describe("cors.ts", () => {
  beforeEach(() => {
    setupDenoMock({
      SITE_URL: "https://app.innotrue.com",
      SUPABASE_URL: "https://qfdztdgublwlmewobxmx.supabase.co",
    });
  });

  afterEach(() => {
    cleanupDenoMock();
    vi.resetModules();
  });

  // ===========================================================================
  // getAllowedOrigins
  // ===========================================================================
  describe("getAllowedOrigins", () => {
    it("includes the production domain", async () => {
      const { getAllowedOrigins } = await import("../cors");
      const origins = getAllowedOrigins();
      expect(origins).toContain("https://app.innotrue.com");
    });

    it("includes SITE_URL from env", async () => {
      const { getAllowedOrigins } = await import("../cors");
      const origins = getAllowedOrigins();
      expect(origins).toContain("https://app.innotrue.com");
    });

    it("includes SUPABASE_URL from env", async () => {
      const { getAllowedOrigins } = await import("../cors");
      const origins = getAllowedOrigins();
      expect(origins).toContain(
        "https://qfdztdgublwlmewobxmx.supabase.co",
      );
    });
  });

  // ===========================================================================
  // isOriginAllowed
  // ===========================================================================
  describe("isOriginAllowed", () => {
    it("allows null origin (server-to-server)", async () => {
      const { isOriginAllowed } = await import("../cors");
      expect(isOriginAllowed(null)).toBe(true);
    });

    it("allows production domain", async () => {
      const { isOriginAllowed } = await import("../cors");
      expect(isOriginAllowed("https://app.innotrue.com")).toBe(true);
    });

    it("allows Supabase URL", async () => {
      const { isOriginAllowed } = await import("../cors");
      expect(
        isOriginAllowed("https://qfdztdgublwlmewobxmx.supabase.co"),
      ).toBe(true);
    });

    it("allows localhost with port", async () => {
      const { isOriginAllowed } = await import("../cors");
      expect(isOriginAllowed("http://localhost:8080")).toBe(true);
      expect(isOriginAllowed("http://localhost:3000")).toBe(true);
    });

    it("allows plain localhost", async () => {
      const { isOriginAllowed } = await import("../cors");
      expect(isOriginAllowed("http://localhost")).toBe(true);
    });

    it("allows Cloudflare Pages preview URLs", async () => {
      const { isOriginAllowed } = await import("../cors");
      expect(
        isOriginAllowed("https://abc123.innotrue-hub-live.pages.dev"),
      ).toBe(true);
      expect(
        isOriginAllowed("https://preprod.innotrue-hub-live.pages.dev"),
      ).toBe(true);
    });

    it("rejects unknown origins", async () => {
      const { isOriginAllowed } = await import("../cors");
      expect(isOriginAllowed("https://evil.com")).toBe(false);
      expect(isOriginAllowed("https://app.innotrue.com.evil.com")).toBe(false);
      expect(isOriginAllowed("https://notinnotrue.com")).toBe(false);
    });

    it("rejects similar-looking domains", async () => {
      const { isOriginAllowed } = await import("../cors");
      expect(isOriginAllowed("https://app.innotrue.com.attacker.com")).toBe(false);
      // This should NOT match since .pages.dev suffix doesn't match
      expect(isOriginAllowed("https://evil.pages.dev")).toBe(false);
    });
  });

  // ===========================================================================
  // getCorsHeaders
  // ===========================================================================
  describe("getCorsHeaders", () => {
    it("returns allowed origin for recognized origins", async () => {
      const { getCorsHeaders } = await import("../cors");
      const req = new Request("https://test.com", {
        headers: { origin: "https://app.innotrue.com" },
      });
      const headers = getCorsHeaders(req);
      expect(headers["Access-Control-Allow-Origin"]).toBe(
        "https://app.innotrue.com",
      );
    });

    it("returns localhost origin for development", async () => {
      const { getCorsHeaders } = await import("../cors");
      const req = new Request("https://test.com", {
        headers: { origin: "http://localhost:8080" },
      });
      const headers = getCorsHeaders(req);
      expect(headers["Access-Control-Allow-Origin"]).toBe(
        "http://localhost:8080",
      );
    });

    it("returns default fallback for unknown origins", async () => {
      const { getCorsHeaders } = await import("../cors");
      const req = new Request("https://test.com", {
        headers: { origin: "https://evil.com" },
      });
      const headers = getCorsHeaders(req);
      expect(headers["Access-Control-Allow-Origin"]).toBe(
        "https://app.innotrue.com",
      );
    });

    it("returns default fallback when no origin header", async () => {
      const { getCorsHeaders } = await import("../cors");
      const req = new Request("https://test.com");
      const headers = getCorsHeaders(req);
      expect(headers["Access-Control-Allow-Origin"]).toBe(
        "https://app.innotrue.com",
      );
    });

    it("includes required CORS headers", async () => {
      const { getCorsHeaders } = await import("../cors");
      const req = new Request("https://test.com");
      const headers = getCorsHeaders(req);
      expect(headers["Access-Control-Allow-Methods"]).toContain("GET");
      expect(headers["Access-Control-Allow-Methods"]).toContain("POST");
      expect(headers["Access-Control-Allow-Headers"]).toContain("authorization");
      expect(headers["Access-Control-Allow-Headers"]).toContain("content-type");
      expect(headers["Access-Control-Max-Age"]).toBe("86400");
    });
  });
});
