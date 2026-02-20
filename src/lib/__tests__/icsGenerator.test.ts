import { describe, it, expect } from "vitest";
import { generateICSContent } from "../icsGenerator";
import type { ICSEvent } from "../icsGenerator";

const baseEvent: ICSEvent = {
  id: "test-event-1",
  title: "Coaching Session",
  startDate: new Date("2025-03-15T10:00:00Z"),
  endDate: new Date("2025-03-15T11:00:00Z"),
};

describe("generateICSContent", () => {
  it("generates valid VCALENDAR wrapper", () => {
    const ics = generateICSContent(baseEvent);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).toContain("VERSION:2.0");
    expect(ics).toContain("PRODID:-//InnoTrue Hub//Session Calendar//EN");
  });

  it("generates valid VEVENT block", () => {
    const ics = generateICSContent(baseEvent);
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("END:VEVENT");
  });

  it("includes event UID", () => {
    const ics = generateICSContent(baseEvent);
    expect(ics).toContain("UID:test-event-1@innotruehub");
  });

  it("includes DTSTAMP", () => {
    const ics = generateICSContent(baseEvent);
    expect(ics).toMatch(/DTSTAMP:\d{8}T\d{6}Z/);
  });

  it("formats UTC dates correctly", () => {
    const ics = generateICSContent(baseEvent);
    expect(ics).toContain("DTSTART:20250315T100000Z");
    expect(ics).toContain("DTEND:20250315T110000Z");
  });

  it("includes event title with escaping", () => {
    const event: ICSEvent = {
      ...baseEvent,
      title: "Meeting; with, special\\chars\nnewline",
    };
    const ics = generateICSContent(event);
    expect(ics).toContain("SUMMARY:Meeting\\; with\\, special\\\\chars\\nnewline");
  });

  it("includes description when provided", () => {
    const event: ICSEvent = {
      ...baseEvent,
      description: "Discuss project goals",
    };
    const ics = generateICSContent(event);
    expect(ics).toContain("DESCRIPTION:Discuss project goals");
  });

  it("omits description when not provided", () => {
    const ics = generateICSContent(baseEvent);
    expect(ics).not.toContain("DESCRIPTION:");
  });

  it("includes location when provided", () => {
    const event: ICSEvent = {
      ...baseEvent,
      location: "https://zoom.us/j/123",
    };
    const ics = generateICSContent(event);
    expect(ics).toContain("LOCATION:https://zoom.us/j/123");
  });

  it("includes organizer when provided", () => {
    const event: ICSEvent = {
      ...baseEvent,
      organizer: { email: "coach@example.com", name: "Coach Jane" },
    };
    const ics = generateICSContent(event);
    expect(ics).toContain("ORGANIZER;CN=Coach Jane:mailto:coach@example.com");
  });

  it("includes organizer without name", () => {
    const event: ICSEvent = {
      ...baseEvent,
      organizer: { email: "coach@example.com" },
    };
    const ics = generateICSContent(event);
    expect(ics).toContain("ORGANIZER:mailto:coach@example.com");
  });

  it("includes attendees with roles and status", () => {
    const event: ICSEvent = {
      ...baseEvent,
      attendees: [
        {
          email: "client@example.com",
          name: "Client Bob",
          role: "REQ-PARTICIPANT",
          status: "ACCEPTED",
        },
      ],
    };
    const ics = generateICSContent(event);
    expect(ics).toContain(
      "ATTENDEE;CN=Client Bob;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;RSVP=TRUE:mailto:client@example.com",
    );
  });

  it("uses default role and status for attendees", () => {
    const event: ICSEvent = {
      ...baseEvent,
      attendees: [{ email: "client@example.com" }],
    };
    const ics = generateICSContent(event);
    expect(ics).toContain(
      "ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:client@example.com",
    );
  });

  it("includes VTIMEZONE for known timezones", () => {
    const event: ICSEvent = {
      ...baseEvent,
      timezone: "America/New_York",
    };
    const ics = generateICSContent(event);
    expect(ics).toContain("BEGIN:VTIMEZONE");
    expect(ics).toContain("TZID:America/New_York");
    expect(ics).toContain("END:VTIMEZONE");
    expect(ics).toContain("DTSTART;TZID=America/New_York:");
  });

  it("includes daylight saving for timezones that have it", () => {
    const event: ICSEvent = {
      ...baseEvent,
      timezone: "Europe/London",
    };
    const ics = generateICSContent(event);
    expect(ics).toContain("BEGIN:DAYLIGHT");
    expect(ics).toContain("END:DAYLIGHT");
  });

  it("omits daylight saving for timezones without it", () => {
    const event: ICSEvent = {
      ...baseEvent,
      timezone: "Asia/Dubai",
    };
    const ics = generateICSContent(event);
    expect(ics).toContain("BEGIN:VTIMEZONE");
    expect(ics).not.toContain("BEGIN:DAYLIGHT");
  });

  it("falls back to UTC for unknown timezones", () => {
    const event: ICSEvent = {
      ...baseEvent,
      timezone: "Unknown/Timezone",
    };
    const ics = generateICSContent(event);
    expect(ics).not.toContain("BEGIN:VTIMEZONE");
    expect(ics).toContain("DTSTART:20250315T100000Z");
  });

  it("generates RRULE for weekly recurrence", () => {
    const event: ICSEvent = {
      ...baseEvent,
      isRecurring: true,
      recurrencePattern: "weekly",
    };
    const ics = generateICSContent(event);
    expect(ics).toContain("RRULE:FREQ=WEEKLY");
  });

  it("generates RRULE for biweekly recurrence", () => {
    const event: ICSEvent = {
      ...baseEvent,
      isRecurring: true,
      recurrencePattern: "biweekly",
    };
    const ics = generateICSContent(event);
    expect(ics).toContain("RRULE:FREQ=WEEKLY;INTERVAL=2");
  });

  it("generates RRULE for daily recurrence", () => {
    const event: ICSEvent = {
      ...baseEvent,
      isRecurring: true,
      recurrencePattern: "daily",
    };
    const ics = generateICSContent(event);
    expect(ics).toContain("RRULE:FREQ=DAILY");
  });

  it("generates RRULE for monthly recurrence", () => {
    const event: ICSEvent = {
      ...baseEvent,
      isRecurring: true,
      recurrencePattern: "monthly",
    };
    const ics = generateICSContent(event);
    expect(ics).toContain("RRULE:FREQ=MONTHLY");
  });

  it("includes UNTIL in RRULE when recurrenceEndDate set", () => {
    const event: ICSEvent = {
      ...baseEvent,
      isRecurring: true,
      recurrencePattern: "weekly",
      recurrenceEndDate: "2025-06-30",
    };
    const ics = generateICSContent(event);
    expect(ics).toContain("RRULE:FREQ=WEEKLY;UNTIL=20250630T235959Z");
  });

  it("omits RRULE when isRecurring is false", () => {
    const event: ICSEvent = {
      ...baseEvent,
      isRecurring: false,
      recurrencePattern: "weekly",
    };
    const ics = generateICSContent(event);
    expect(ics).not.toContain("RRULE:");
  });

  it("omits RRULE for unknown recurrence pattern", () => {
    const event: ICSEvent = {
      ...baseEvent,
      isRecurring: true,
      recurrencePattern: "quarterly",
    };
    const ics = generateICSContent(event);
    expect(ics).not.toContain("RRULE:");
  });

  it("handles bi-weekly with hyphen", () => {
    const event: ICSEvent = {
      ...baseEvent,
      isRecurring: true,
      recurrencePattern: "bi-weekly",
    };
    const ics = generateICSContent(event);
    expect(ics).toContain("RRULE:FREQ=WEEKLY;INTERVAL=2");
  });

  // -- Additional coverage for edge cases --

  it("includes CALSCALE and METHOD in calendar wrapper", () => {
    const ics = generateICSContent(baseEvent);
    expect(ics).toContain("CALSCALE:GREGORIAN");
    expect(ics).toContain("METHOD:PUBLISH");
  });

  it("uses UTC format (no VTIMEZONE) when timezone is 'UTC'", () => {
    const event: ICSEvent = {
      ...baseEvent,
      timezone: "UTC",
    };
    const ics = generateICSContent(event);
    expect(ics).not.toContain("BEGIN:VTIMEZONE");
    expect(ics).toContain("DTSTART:20250315T100000Z");
    expect(ics).toContain("DTEND:20250315T110000Z");
  });

  it("uses UTC format when no timezone is specified", () => {
    const event: ICSEvent = {
      id: "no-tz",
      title: "No TZ Event",
      startDate: new Date("2025-01-01T08:00:00Z"),
      endDate: new Date("2025-01-01T09:00:00Z"),
    };
    const ics = generateICSContent(event);
    expect(ics).not.toContain("BEGIN:VTIMEZONE");
    expect(ics).toContain("DTSTART:20250101T080000Z");
  });

  it("handles multiple attendees", () => {
    const event: ICSEvent = {
      ...baseEvent,
      attendees: [
        { email: "alice@example.com", name: "Alice", role: "CHAIR", status: "ACCEPTED" },
        { email: "bob@example.com", name: "Bob", role: "OPT-PARTICIPANT", status: "TENTATIVE" },
      ],
    };
    const ics = generateICSContent(event);
    expect(ics).toContain("ATTENDEE;CN=Alice;ROLE=CHAIR;PARTSTAT=ACCEPTED;RSVP=TRUE:mailto:alice@example.com");
    expect(ics).toContain("ATTENDEE;CN=Bob;ROLE=OPT-PARTICIPANT;PARTSTAT=TENTATIVE;RSVP=TRUE:mailto:bob@example.com");
  });

  it("escapes special characters in description and location", () => {
    const event: ICSEvent = {
      ...baseEvent,
      description: "Goal: succeed; plan, execute\\deliver\nstep 2",
      location: "Room 1; Building A, Floor 3",
    };
    const ics = generateICSContent(event);
    expect(ics).toContain("DESCRIPTION:Goal: succeed\\; plan\\, execute\\\\deliver\\nstep 2");
    expect(ics).toContain("LOCATION:Room 1\\; Building A\\, Floor 3");
  });

  it("generates CRLF line endings (ICS spec requirement)", () => {
    const ics = generateICSContent(baseEvent);
    // ICS files must use \r\n line endings
    expect(ics).toContain("\r\n");
    // Split by \r\n and verify the structure
    const lines = ics.split("\r\n");
    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(lines[lines.length - 1]).toBe("END:VCALENDAR");
  });

  it("omits RRULE when isRecurring is undefined", () => {
    const event: ICSEvent = {
      ...baseEvent,
      recurrencePattern: "weekly",
    };
    const ics = generateICSContent(event);
    expect(ics).not.toContain("RRULE:");
  });

  it("formats timezone dates in local time format (no Z suffix)", () => {
    const event: ICSEvent = {
      ...baseEvent,
      timezone: "Europe/Paris",
    };
    const ics = generateICSContent(event);
    // With timezone, dates should NOT have Z suffix
    expect(ics).toContain("DTSTART;TZID=Europe/Paris:");
    expect(ics).not.toContain("DTSTART:20250315T100000Z");
  });
});
