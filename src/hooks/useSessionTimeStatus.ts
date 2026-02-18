import { useState, useEffect, useMemo } from "react";

export interface SessionTimeStatus {
  label: string;
  variant: "outline" | "default" | "secondary" | "destructive";
  isJoinable: boolean;
}

interface UseSessionTimeStatusOptions {
  /** ISO date string for the session date (YYYY-MM-DD) */
  sessionDate: string;
  /** Time string in HH:MM or HH:MM:SS format (optional) */
  startTime?: string | null;
  /** Time string in HH:MM or HH:MM:SS format (optional) */
  endTime?: string | null;
  /** User's IANA timezone (e.g., "Europe/Berlin"). Falls back to UTC. */
  userTimezone?: string;
  /** Minutes before session start to consider "starting soon". Default: 30 */
  joinableMinutesBefore?: number;
}

/**
 * Combines a date string (YYYY-MM-DD) and optional time string (HH:MM or HH:MM:SS)
 * into a Date object. If no time is provided, defaults to start of day.
 */
function combineDateAndTime(dateStr: string, timeStr?: string | null): Date {
  if (timeStr) {
    // Ensure time has seconds
    const timeParts = timeStr.split(":");
    const normalizedTime =
      timeParts.length === 2 ? `${timeStr}:00` : timeStr;
    return new Date(`${dateStr}T${normalizedTime}`);
  }
  return new Date(`${dateStr}T00:00:00`);
}

function computeStatus(
  sessionDate: string,
  startTime?: string | null,
  endTime?: string | null,
  joinableMinutesBefore = 30,
): SessionTimeStatus {
  const now = new Date();

  const sessionStart = combineDateAndTime(sessionDate, startTime);

  // If no start_time, compare at day level
  if (!startTime) {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sessionDay = new Date(
      sessionStart.getFullYear(),
      sessionStart.getMonth(),
      sessionStart.getDate(),
    );

    if (sessionDay < today) {
      return { label: "Ended", variant: "secondary", isJoinable: false };
    }
    if (sessionDay.getTime() === today.getTime()) {
      return { label: "Today", variant: "default", isJoinable: true };
    }
    return { label: "Upcoming", variant: "outline", isJoinable: false };
  }

  // Calculate session end
  let sessionEnd: Date;
  if (endTime) {
    sessionEnd = combineDateAndTime(sessionDate, endTime);
  } else {
    // Default to 60 minutes after start
    sessionEnd = new Date(sessionStart.getTime() + 60 * 60 * 1000);
  }

  const msUntilStart = sessionStart.getTime() - now.getTime();
  const msUntilEnd = sessionEnd.getTime() - now.getTime();
  const minutesUntilStart = Math.ceil(msUntilStart / (60 * 1000));

  // Past session
  if (msUntilEnd < 0) {
    return { label: "Ended", variant: "secondary", isJoinable: false };
  }

  // Currently in session
  if (msUntilStart <= 0 && msUntilEnd >= 0) {
    return { label: "Live Now", variant: "destructive", isJoinable: true };
  }

  // Starting soon (within joinableMinutesBefore)
  if (minutesUntilStart <= joinableMinutesBefore && minutesUntilStart > 0) {
    return {
      label: `Starts in ${minutesUntilStart} min`,
      variant: "default",
      isJoinable: true,
    };
  }

  // Upcoming (more than joinableMinutesBefore away)
  return { label: "Upcoming", variant: "outline", isJoinable: false };
}

/**
 * Reactive hook that returns a time-aware session status.
 * Re-evaluates every 30 seconds so "Starts in X min" counts down.
 */
export function useSessionTimeStatus(
  options: UseSessionTimeStatusOptions,
): SessionTimeStatus {
  const {
    sessionDate,
    startTime,
    endTime,
    joinableMinutesBefore = 30,
  } = options;

  const [tick, setTick] = useState(0);

  // Re-evaluate every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  const status = useMemo(
    () => computeStatus(sessionDate, startTime, endTime, joinableMinutesBefore),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessionDate, startTime, endTime, joinableMinutesBefore, tick],
  );

  return status;
}
