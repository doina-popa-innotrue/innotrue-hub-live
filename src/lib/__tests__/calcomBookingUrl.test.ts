import { describe, it, expect } from "vitest";
import {
  buildCalcomBookingUrl,
  isValidCalcomUrl,
  extractEventTypeSlug,
  buildCalcomRescheduleUrl,
} from "../calcom-booking-url";

describe("buildCalcomBookingUrl", () => {
  it("throws if schedulingUrl is empty", () => {
    expect(() => buildCalcomBookingUrl({ schedulingUrl: "" })).toThrow(
      "Scheduling URL is required",
    );
  });

  it("returns base URL when no optional params provided", () => {
    const url = buildCalcomBookingUrl({ schedulingUrl: "https://cal.com/user/meeting" });
    expect(url).toBe("https://cal.com/user/meeting");
  });

  it("adds enrollment_id metadata", () => {
    const url = buildCalcomBookingUrl({
      schedulingUrl: "https://cal.com/user/meeting",
      enrollmentId: "enr-123",
    });
    const parsed = new URL(url);
    expect(parsed.searchParams.get("metadata[enrollment_id]")).toBe("enr-123");
  });

  it("adds module_id metadata", () => {
    const url = buildCalcomBookingUrl({
      schedulingUrl: "https://cal.com/user/meeting",
      moduleId: "mod-456",
    });
    const parsed = new URL(url);
    expect(parsed.searchParams.get("metadata[module_id]")).toBe("mod-456");
  });

  it("adds user_id metadata", () => {
    const url = buildCalcomBookingUrl({
      schedulingUrl: "https://cal.com/user/meeting",
      userId: "usr-789",
    });
    const parsed = new URL(url);
    expect(parsed.searchParams.get("metadata[user_id]")).toBe("usr-789");
  });

  it("adds group_id and session_type metadata", () => {
    const url = buildCalcomBookingUrl({
      schedulingUrl: "https://cal.com/user/meeting",
      groupId: "grp-1",
      sessionType: "group",
    });
    const parsed = new URL(url);
    expect(parsed.searchParams.get("metadata[group_id]")).toBe("grp-1");
    expect(parsed.searchParams.get("metadata[session_type]")).toBe("group");
  });

  it("adds pending_session_id metadata for hybrid flow", () => {
    const url = buildCalcomBookingUrl({
      schedulingUrl: "https://cal.com/user/meeting",
      pendingSessionId: "sess-abc",
    });
    const parsed = new URL(url);
    expect(parsed.searchParams.get("metadata[pending_session_id]")).toBe("sess-abc");
  });

  it("prefills email and name", () => {
    const url = buildCalcomBookingUrl({
      schedulingUrl: "https://cal.com/user/meeting",
      email: "test@example.com",
      name: "John Doe",
    });
    const parsed = new URL(url);
    expect(parsed.searchParams.get("email")).toBe("test@example.com");
    expect(parsed.searchParams.get("name")).toBe("John Doe");
  });

  it("sets successUrl for redirect", () => {
    const url = buildCalcomBookingUrl({
      schedulingUrl: "https://cal.com/user/meeting",
      redirectUrl: "https://app.example.com/sessions",
    });
    const parsed = new URL(url);
    expect(parsed.searchParams.get("successUrl")).toBe("https://app.example.com/sessions");
  });

  it("combines all parameters together", () => {
    const url = buildCalcomBookingUrl({
      schedulingUrl: "https://cal.com/coach/intro",
      enrollmentId: "e1",
      moduleId: "m1",
      userId: "u1",
      sessionType: "individual",
      email: "client@test.com",
      name: "Client Name",
    });
    const parsed = new URL(url);
    expect(parsed.searchParams.get("metadata[enrollment_id]")).toBe("e1");
    expect(parsed.searchParams.get("metadata[module_id]")).toBe("m1");
    expect(parsed.searchParams.get("metadata[user_id]")).toBe("u1");
    expect(parsed.searchParams.get("metadata[session_type]")).toBe("individual");
    expect(parsed.searchParams.get("email")).toBe("client@test.com");
    expect(parsed.searchParams.get("name")).toBe("Client Name");
  });
});

describe("isValidCalcomUrl", () => {
  it("returns false for empty string", () => {
    expect(isValidCalcomUrl("")).toBe(false);
  });

  it("returns false for invalid URL", () => {
    expect(isValidCalcomUrl("not-a-url")).toBe(false);
  });

  it("returns true for https URL", () => {
    expect(isValidCalcomUrl("https://cal.com/user/meeting")).toBe(true);
  });

  it("returns true for http URL", () => {
    expect(isValidCalcomUrl("http://localhost:3000/meeting")).toBe(true);
  });

  it("returns false for ftp URL", () => {
    expect(isValidCalcomUrl("ftp://cal.com/file")).toBe(false);
  });

  it("returns true for custom domain URLs", () => {
    expect(isValidCalcomUrl("https://schedule.mycompany.com/intro")).toBe(true);
  });
});

describe("extractEventTypeSlug", () => {
  it("returns null for empty string", () => {
    expect(extractEventTypeSlug("")).toBeNull();
  });

  it("returns null for invalid URL", () => {
    expect(extractEventTypeSlug("not-a-url")).toBeNull();
  });

  it("extracts slug from standard Cal.com URL", () => {
    expect(extractEventTypeSlug("https://cal.com/username/intro-call")).toBe("intro-call");
  });

  it("extracts slug from longer paths", () => {
    expect(extractEventTypeSlug("https://cal.com/team/org/coaching-session")).toBe(
      "coaching-session",
    );
  });

  it("returns null for single-segment path", () => {
    expect(extractEventTypeSlug("https://cal.com/username")).toBeNull();
  });

  it("returns null for root path", () => {
    expect(extractEventTypeSlug("https://cal.com/")).toBeNull();
  });
});

describe("buildCalcomRescheduleUrl", () => {
  it("throws if bookingUid is empty", () => {
    expect(() => buildCalcomRescheduleUrl("")).toThrow("Booking UID is required");
  });

  it("builds reschedule URL with default base", () => {
    const url = buildCalcomRescheduleUrl("booking-123");
    expect(url).toBe("https://cal.com/reschedule/booking-123");
  });

  it("uses custom base URL", () => {
    const url = buildCalcomRescheduleUrl("booking-123", "https://schedule.example.com");
    expect(url).toBe("https://schedule.example.com/reschedule/booking-123");
  });

  it("adds successUrl for redirect", () => {
    const url = buildCalcomRescheduleUrl(
      "booking-123",
      "https://cal.com",
      "https://app.example.com/done",
    );
    const parsed = new URL(url);
    expect(parsed.pathname).toBe("/reschedule/booking-123");
    expect(parsed.searchParams.get("successUrl")).toBe("https://app.example.com/done");
  });
});
