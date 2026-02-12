/**
 * Enhanced ICS (iCalendar) file generator with timezone and attendee support
 */

export interface ICSAttendee {
  email: string;
  name?: string;
  role?: "REQ-PARTICIPANT" | "OPT-PARTICIPANT" | "CHAIR";
  status?: "ACCEPTED" | "TENTATIVE" | "NEEDS-ACTION";
}

export interface ICSEvent {
  id: string;
  title: string;
  description?: string;
  location?: string;
  startDate: Date;
  endDate: Date;
  timezone?: string;
  organizer?: { email: string; name?: string };
  attendees?: ICSAttendee[];
  isRecurring?: boolean;
  recurrencePattern?: string;
  recurrenceEndDate?: string;
}

// Common timezone offset mappings for VTIMEZONE generation
const TIMEZONE_OFFSETS: Record<
  string,
  { standard: string; daylight?: string; stdName: string; dstName?: string }
> = {
  UTC: { standard: "+0000", stdName: "UTC" },
  "America/New_York": { standard: "-0500", daylight: "-0400", stdName: "EST", dstName: "EDT" },
  "America/Chicago": { standard: "-0600", daylight: "-0500", stdName: "CST", dstName: "CDT" },
  "America/Denver": { standard: "-0700", daylight: "-0600", stdName: "MST", dstName: "MDT" },
  "America/Los_Angeles": { standard: "-0800", daylight: "-0700", stdName: "PST", dstName: "PDT" },
  "America/Anchorage": { standard: "-0900", daylight: "-0800", stdName: "AKST", dstName: "AKDT" },
  "Pacific/Honolulu": { standard: "-1000", stdName: "HST" },
  "Europe/London": { standard: "+0000", daylight: "+0100", stdName: "GMT", dstName: "BST" },
  "Europe/Paris": { standard: "+0100", daylight: "+0200", stdName: "CET", dstName: "CEST" },
  "Europe/Athens": { standard: "+0200", daylight: "+0300", stdName: "EET", dstName: "EEST" },
  "Europe/Moscow": { standard: "+0300", stdName: "MSK" },
  "Asia/Dubai": { standard: "+0400", stdName: "GST" },
  "Asia/Kolkata": { standard: "+0530", stdName: "IST" },
  "Asia/Bangkok": { standard: "+0700", stdName: "ICT" },
  "Asia/Hong_Kong": { standard: "+0800", stdName: "HKT" },
  "Asia/Tokyo": { standard: "+0900", stdName: "JST" },
  "Australia/Sydney": { standard: "+1000", daylight: "+1100", stdName: "AEST", dstName: "AEDT" },
  "Pacific/Auckland": { standard: "+1200", daylight: "+1300", stdName: "NZST", dstName: "NZDT" },
  "America/Sao_Paulo": { standard: "-0300", stdName: "BRT" },
  "Africa/Johannesburg": { standard: "+0200", stdName: "SAST" },
  "Africa/Cairo": { standard: "+0200", stdName: "EET" },
};

/**
 * Format a date for ICS in UTC format
 */
function formatICSDateUTC(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

/**
 * Format a date for ICS with timezone (local time format)
 */
function formatICSDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}T${hours}${minutes}${seconds}`;
}

/**
 * Format a date for ICS (date only, no time)
 */
function formatICSDateOnly(date: Date): string {
  return date.toISOString().split("T")[0].replace(/-/g, "");
}

/**
 * Generate VTIMEZONE component for a given IANA timezone
 */
function generateVTimezone(tzid: string): string {
  const tz = TIMEZONE_OFFSETS[tzid];
  if (!tz) {
    // Fallback to UTC if timezone not found
    return "";
  }

  const lines = [
    "BEGIN:VTIMEZONE",
    `TZID:${tzid}`,
    "BEGIN:STANDARD",
    `TZOFFSETFROM:${tz.daylight || tz.standard}`,
    `TZOFFSETTO:${tz.standard}`,
    `TZNAME:${tz.stdName}`,
    "DTSTART:19701101T020000",
    tz.daylight ? "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU" : "",
    "END:STANDARD",
  ].filter(Boolean);

  // Add daylight saving time component if applicable
  if (tz.daylight && tz.dstName) {
    lines.push(
      "BEGIN:DAYLIGHT",
      `TZOFFSETFROM:${tz.standard}`,
      `TZOFFSETTO:${tz.daylight}`,
      `TZNAME:${tz.dstName}`,
      "DTSTART:19700308T020000",
      "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU",
      "END:DAYLIGHT",
    );
  }

  lines.push("END:VTIMEZONE");
  return lines.join("\r\n");
}

/**
 * Build RRULE for recurring events
 */
function buildRRule(event: ICSEvent): string {
  if (!event.isRecurring || !event.recurrencePattern) return "";

  const pattern = event.recurrencePattern.toLowerCase();
  let freq = "";
  let interval = 1;

  if (pattern === "daily") {
    freq = "DAILY";
  } else if (pattern === "weekly") {
    freq = "WEEKLY";
  } else if (pattern === "biweekly" || pattern === "bi-weekly") {
    freq = "WEEKLY";
    interval = 2;
  } else if (pattern === "monthly") {
    freq = "MONTHLY";
  } else {
    return "";
  }

  let rrule = `RRULE:FREQ=${freq}`;
  if (interval > 1) {
    rrule += `;INTERVAL=${interval}`;
  }
  if (event.recurrenceEndDate) {
    const endRecurrence = new Date(event.recurrenceEndDate);
    rrule += `;UNTIL=${formatICSDateOnly(endRecurrence)}T235959Z`;
  }

  return rrule;
}

/**
 * Escape special characters in ICS text fields
 */
function escapeICSText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

/**
 * Generate an ICS file content string for a single event
 */
export function generateICSContent(event: ICSEvent): string {
  const timezone = event.timezone || "UTC";
  const useTimezone = timezone !== "UTC" && TIMEZONE_OFFSETS[timezone];

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//InnoTrue Hub//Session Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  // Add VTIMEZONE if using a specific timezone
  if (useTimezone) {
    lines.push(generateVTimezone(timezone));
  }

  lines.push("BEGIN:VEVENT");
  lines.push(`UID:${event.id}@innotruehub`);
  lines.push(`DTSTAMP:${formatICSDateUTC(new Date())}`);

  // Add start/end times with timezone
  if (useTimezone) {
    lines.push(`DTSTART;TZID=${timezone}:${formatICSDateLocal(event.startDate)}`);
    lines.push(`DTEND;TZID=${timezone}:${formatICSDateLocal(event.endDate)}`);
  } else {
    lines.push(`DTSTART:${formatICSDateUTC(event.startDate)}`);
    lines.push(`DTEND:${formatICSDateUTC(event.endDate)}`);
  }

  lines.push(`SUMMARY:${escapeICSText(event.title)}`);

  if (event.description) {
    lines.push(`DESCRIPTION:${escapeICSText(event.description)}`);
  }

  if (event.location) {
    lines.push(`LOCATION:${escapeICSText(event.location)}`);
  }

  // Add organizer
  if (event.organizer) {
    const orgName = event.organizer.name ? `;CN=${escapeICSText(event.organizer.name)}` : "";
    lines.push(`ORGANIZER${orgName}:mailto:${event.organizer.email}`);
  }

  // Add attendees
  if (event.attendees && event.attendees.length > 0) {
    for (const attendee of event.attendees) {
      const name = attendee.name ? `;CN=${escapeICSText(attendee.name)}` : "";
      const role = attendee.role ? `;ROLE=${attendee.role}` : ";ROLE=REQ-PARTICIPANT";
      const status = attendee.status ? `;PARTSTAT=${attendee.status}` : ";PARTSTAT=NEEDS-ACTION";
      lines.push(`ATTENDEE${name}${role}${status};RSVP=TRUE:mailto:${attendee.email}`);
    }
  }

  // Add recurrence rule
  const rrule = buildRRule(event);
  if (rrule) {
    lines.push(rrule);
  }

  lines.push("END:VEVENT");
  lines.push("END:VCALENDAR");

  return lines.join("\r\n");
}

/**
 * Download an ICS file for an event
 */
export function downloadICSFile(event: ICSEvent): void {
  const icsContent = generateICSContent(event);
  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${event.title.replace(/[^a-z0-9]/gi, "_")}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
