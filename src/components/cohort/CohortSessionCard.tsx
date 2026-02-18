import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Video,
  Clock,
  MapPin,
  Calendar,
  Download,
  BookOpen,
  UserCheck,
} from "lucide-react";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { useSessionTimeStatus } from "@/hooks/useSessionTimeStatus";
import { downloadICSFile, type ICSEvent } from "@/lib/icsGenerator";

export interface CohortSession {
  id: string;
  title: string;
  description?: string | null;
  session_date: string;
  start_time?: string | null;
  end_time?: string | null;
  location?: string | null;
  meeting_link?: string | null;
  module_id?: string | null;
  notes?: string | null;
  module_title?: string | null;
  instructor_name?: string | null;
}

interface CohortSessionCardProps {
  session: CohortSession;
  userTimezone: string;
  programId?: string;
  /** Highlighted styling for "next session" emphasis */
  isHighlighted?: boolean;
  /** Show module link */
  showModuleLink?: boolean;
}

function combineDateAndTime(dateStr: string, timeStr?: string | null): Date {
  if (timeStr) {
    const timeParts = timeStr.split(":");
    const normalizedTime =
      timeParts.length === 2 ? `${timeStr}:00` : timeStr;
    return new Date(`${dateStr}T${normalizedTime}`);
  }
  return new Date(`${dateStr}T00:00:00`);
}

export function CohortSessionCard({
  session,
  userTimezone,
  programId,
  isHighlighted = false,
  showModuleLink = true,
}: CohortSessionCardProps) {
  const status = useSessionTimeStatus({
    sessionDate: session.session_date,
    startTime: session.start_time,
    endTime: session.end_time,
    userTimezone,
  });

  const sessionDate = new Date(session.session_date);
  const zonedDate = toZonedTime(sessionDate, userTimezone);

  const videoLink =
    session.meeting_link ||
    (session.location?.startsWith("http") ? session.location : null);

  // Calculate duration in minutes from start/end time
  const durationMinutes =
    session.start_time && session.end_time
      ? Math.round(
          (combineDateAndTime(session.session_date, session.end_time).getTime() -
            combineDateAndTime(session.session_date, session.start_time).getTime()) /
            60000,
        )
      : null;

  const getStatusBadgeVariant = () => {
    switch (status.variant) {
      case "destructive":
        return "destructive" as const;
      case "default":
        return "default" as const;
      case "secondary":
        return "secondary" as const;
      default:
        return "outline" as const;
    }
  };

  const handleDownloadICS = () => {
    const startDate = combineDateAndTime(
      session.session_date,
      session.start_time,
    );
    const endDate = session.end_time
      ? combineDateAndTime(session.session_date, session.end_time)
      : new Date(startDate.getTime() + 60 * 60 * 1000);

    const icsEvent: ICSEvent = {
      id: session.id,
      title: session.title,
      description: session.description || undefined,
      location: session.location || undefined,
      startDate,
      endDate,
      timezone: userTimezone,
    };
    downloadICSFile(icsEvent);
  };

  const isEnded = status.label === "Ended";

  return (
    <Card
      className={`transition-colors ${
        isHighlighted
          ? "border-primary/50 bg-primary/5"
          : isEnded
            ? "opacity-60"
            : "hover:bg-muted/50"
      }`}
    >
      <CardContent className="py-4">
        <div className="flex flex-col gap-3">
          {/* Header: title + status */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium">{session.title}</span>
                <Badge variant={getStatusBadgeVariant()}>
                  {status.label === "Live Now" && (
                    <span className="relative flex h-2 w-2 mr-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
                    </span>
                  )}
                  {status.label}
                </Badge>
              </div>

              {session.description && !isEnded && (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {session.description}
                </p>
              )}

              {/* Date, time, duration, location */}
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {format(zonedDate, "EEE, MMM d")}
                </span>
                {session.start_time && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {session.start_time.slice(0, 5)}
                    {session.end_time && ` – ${session.end_time.slice(0, 5)}`}
                  </span>
                )}
                {durationMinutes && <span>({durationMinutes} min)</span>}
                {session.location &&
                  !session.location.startsWith("http") && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {session.location}
                    </span>
                  )}
                {session.instructor_name && (
                  <span className="flex items-center gap-1">
                    <UserCheck className="h-3.5 w-3.5" />
                    {session.instructor_name}
                  </span>
                )}
              </div>

              {/* Module link */}
              {showModuleLink &&
                session.module_id &&
                programId &&
                !isEnded && (
                  <Link
                    to={`/programs/${programId}/modules/${session.module_id}`}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                  >
                    <BookOpen className="h-3 w-3" />
                    {session.module_title || "View Module"}
                  </Link>
                )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Join Now — prominent when joinable */}
            {videoLink && status.isJoinable && (
              <Button
                size="sm"
                variant="default"
                className={
                  status.label === "Live Now" ? "animate-pulse" : ""
                }
                asChild
              >
                <a href={videoLink} target="_blank" rel="noopener noreferrer">
                  <Video className="mr-2 h-3.5 w-3.5" />
                  {status.label === "Live Now" ? "Join Now" : "Join Session"}
                </a>
              </Button>
            )}

            {/* Join button for non-joinable upcoming sessions (less prominent) */}
            {videoLink && !status.isJoinable && !isEnded && (
              <Button size="sm" variant="outline" asChild>
                <a href={videoLink} target="_blank" rel="noopener noreferrer">
                  <Video className="mr-2 h-3.5 w-3.5" />
                  Meeting Link
                </a>
              </Button>
            )}

            {/* Add to Calendar */}
            {!isEnded && (
              <Button size="sm" variant="outline" onClick={handleDownloadICS}>
                <Download className="mr-2 h-3.5 w-3.5" />
                Add to Calendar
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
