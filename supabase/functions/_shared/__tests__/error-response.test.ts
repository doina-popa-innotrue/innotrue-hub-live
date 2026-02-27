/**
 * Tests for supabase/functions/_shared/error-response.ts
 *
 * Tests all error and success response factory functions.
 * Uses the Web API Response object (available in jsdom/Node 18+).
 */
import { describe, it, expect } from "vitest";
import { errorResponse, successResponse } from "../error-response";

// Helper to parse response body
async function parseBody(response: Response): Promise<Record<string, unknown>> {
  return JSON.parse(await response.text());
}

const testCors = {
  "Access-Control-Allow-Origin": "https://app.innotrue.com",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

// =============================================================================
// errorResponse.badRequest
// =============================================================================
describe("errorResponse.badRequest", () => {
  it("returns 400 with error message", async () => {
    const resp = errorResponse.badRequest("Missing email field");
    expect(resp.status).toBe(400);
    const body = await parseBody(resp);
    expect(body.error).toBe("Missing email field");
  });

  it("includes Content-Type header", () => {
    const resp = errorResponse.badRequest("test");
    expect(resp.headers.get("Content-Type")).toBe("application/json");
  });

  it("includes CORS headers when provided", () => {
    const resp = errorResponse.badRequest("test", testCors);
    expect(resp.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://app.innotrue.com",
    );
  });
});

// =============================================================================
// errorResponse.unauthorized
// =============================================================================
describe("errorResponse.unauthorized", () => {
  it("returns 401 with default message", async () => {
    const resp = errorResponse.unauthorized();
    expect(resp.status).toBe(401);
    const body = await parseBody(resp);
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 401 with custom message", async () => {
    const resp = errorResponse.unauthorized("Token expired");
    expect(resp.status).toBe(401);
    const body = await parseBody(resp);
    expect(body.error).toBe("Token expired");
  });
});

// =============================================================================
// errorResponse.forbidden
// =============================================================================
describe("errorResponse.forbidden", () => {
  it("returns 403 with default message", async () => {
    const resp = errorResponse.forbidden();
    expect(resp.status).toBe(403);
    const body = await parseBody(resp);
    expect(body.error).toBe("Forbidden");
  });

  it("returns 403 with custom message", async () => {
    const resp = errorResponse.forbidden("Admin only");
    expect(resp.status).toBe(403);
    const body = await parseBody(resp);
    expect(body.error).toBe("Admin only");
  });
});

// =============================================================================
// errorResponse.notFound
// =============================================================================
describe("errorResponse.notFound", () => {
  it("returns 404 with message", async () => {
    const resp = errorResponse.notFound("User not found");
    expect(resp.status).toBe(404);
    const body = await parseBody(resp);
    expect(body.error).toBe("User not found");
  });
});

// =============================================================================
// errorResponse.rateLimit
// =============================================================================
describe("errorResponse.rateLimit", () => {
  it("returns 429 with default message", async () => {
    const resp = errorResponse.rateLimit();
    expect(resp.status).toBe(429);
    const body = await parseBody(resp);
    expect(body.error).toContain("Too many requests");
  });

  it("returns 429 with custom message", async () => {
    const resp = errorResponse.rateLimit("Slow down!");
    const body = await parseBody(resp);
    expect(body.error).toBe("Slow down!");
  });
});

// =============================================================================
// errorResponse.serverError
// =============================================================================
describe("errorResponse.serverError", () => {
  it("returns 500 with generic message (does not leak error details)", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const resp = errorResponse.serverError("signup", new Error("DB connection lost"));
    expect(resp.status).toBe(500);
    const body = await parseBody(resp);
    expect(body.error).toBe("Internal server error");
    // Should NOT contain the real error message
    expect(body.error).not.toContain("DB connection");
    consoleSpy.mockRestore();
  });

  it("logs the real error to console", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    errorResponse.serverError("webhook", new Error("timeout"));
    expect(consoleSpy).toHaveBeenCalledWith(
      "[webhook] Internal error:",
      expect.any(Error),
    );
    consoleSpy.mockRestore();
  });
});

// =============================================================================
// errorResponse.serverErrorWithMessage
// =============================================================================
describe("errorResponse.serverErrorWithMessage", () => {
  it("returns 500 with the actual error message", async () => {
    const resp = errorResponse.serverErrorWithMessage("unique_constraint_violation");
    expect(resp.status).toBe(500);
    const body = await parseBody(resp);
    expect(body.error).toBe("unique_constraint_violation");
  });
});

// =============================================================================
// successResponse.ok
// =============================================================================
describe("successResponse.ok", () => {
  it("returns 200 with data", async () => {
    const resp = successResponse.ok({ user: { id: "123", name: "Alice" } });
    expect(resp.status).toBe(200);
    const body = await parseBody(resp);
    expect(body.user).toEqual({ id: "123", name: "Alice" });
  });

  it("includes CORS headers when provided", () => {
    const resp = successResponse.ok({ ok: true }, testCors);
    expect(resp.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://app.innotrue.com",
    );
  });
});

// =============================================================================
// successResponse.created
// =============================================================================
describe("successResponse.created", () => {
  it("returns 201 with data", async () => {
    const resp = successResponse.created({ id: "new-id" });
    expect(resp.status).toBe(201);
    const body = await parseBody(resp);
    expect(body.id).toBe("new-id");
  });
});

// =============================================================================
// successResponse.noContent
// =============================================================================
describe("successResponse.noContent", () => {
  it("returns 204 with null body", async () => {
    const resp = successResponse.noContent();
    expect(resp.status).toBe(204);
    expect(resp.body).toBeNull();
  });

  it("includes CORS headers when provided", () => {
    const resp = successResponse.noContent(testCors);
    expect(resp.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://app.innotrue.com",
    );
  });
});
