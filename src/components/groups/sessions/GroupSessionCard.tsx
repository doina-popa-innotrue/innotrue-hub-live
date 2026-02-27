import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Video,
  Repeat,
  Clock,
  MapPin,
  Calendar,
  Download,
  ExternalLink,
  Trash2,
  Pencil,
  ChevronRight,
  Edit2,
} from "lucide-react";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { useSessionTimeStatus } from "@/hooks/useSessionTimeStatus";
import { getTimezoneAbbreviation } from "@/components/profile/TimezoneSelect";

export interface GroupSessionCardProps {
  session: any;
  groupId: string;
  userTimezone: string;
  linkPrefix?: string; // '/groups' or '/admin/groups'
  // Admin features
  isAdmin?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (sessionId: string) => void;
  onEdit?: (session: any) => void;
  onDelete?: (session: any) => void;
  onStatusChange?: (sessionId: string, status: string) => void;
  // Client features
  onDownloadICS?: (session: any) => void;
  // For generated occurrences - allows editing parent
  onEditParent?: (parentSessionId: string) => void;
  sessions?: any[]; // Full sessions array to find parent
}

export function GroupSessionCard({
  session,
  groupId,
  userTimezone,
  linkPrefix = "/groups",
  isAdmin = false,
  isSelected = false,
  onToggleSelect,
  onEdit,
  onDelete,
  onStatusChange,
  onDownloadICS,
  onEditParent,
  sessions,
}: GroupSessionCardProps) {
  const sessionDate = new Date(session.session_date);
  const zonedDate = toZonedTime(sessionDate, userTimezone);
  const isGenerated = session.isGeneratedOccurrence;

  // Extract date string (YYYY-MM-DD) for the time status hook
  const sessionDateStr = session.session_date?.split("T")[0] || new Date(session.session_date).toISOString().split("T")[0];
  // Extract time from the timestamp (group sessions store full timestamps, not separate time fields)
  const sessionTimeStr = format(sessionDate, "HH:mm:ss");
  const endTimeStr = session.duration_minutes
    ? format(new Date(sessionDate.getTime() + session.duration_minutes * 60000), "HH:mm:ss")
    : null;

  const timeStatus = useSessionTimeStatus({
    sessionDate: sessionDateStr,
    startTime: sessionTimeStr,
    endTime: endTimeStr,
    userTimezone,
  });
  const isPast = timeStatus.label === "Ended";

  const linkTo = isGenerated
    ? `${linkPrefix}/${groupId}/sessions/${session.parentSessionId}`
    : `${linkPrefix}/${groupId}/sessions/${session.id}`;

  // Prefer meeting_link over location
  const videoLink =
    session.meeting_link || (session.location?.startsWith("http") ? session.location : null);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "scheduled":
        return <Badge>Scheduled</Badge>;
      case "completed":
        return <Badge variant="secondary">Completed</Badge>;
      case "cancelled":
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleEditClick = () => {
    if (isGenerated && onEditParent && session.parentSessionId) {
      onEditParent(session.parentSessionId);
    } else if (onEdit) {
      onEdit(session);
    }
  };

  return (
    <Card className="hover:bg-muted/50 transition-colors">
      <CardContent className="py-4">
        <div className="flex flex-col gap-3">
          {/* Header row with selection and main content */}
          <div className="flex items-start gap-3">
            {/* Checkbox for admin selection */}
            {isAdmin && onToggleSelect && !isGenerated && (
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => onToggleSelect(session.id)}
                className="mt-1"
              />
            )}

            {/* Main content - clickable link */}
            <Link to={linkTo} className="flex-1 min-w-0">
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Video className="h-4 w-4 text-primary flex-shrink-0" />
                  <span className="font-medium truncate">{session.title}</span>
                  {session.is_recurring && (
                    <Badge variant="outline" className="text-xs gap-1">
                      <Repeat className="h-3 w-3" />
                      {session.recurrence_pattern}
                    </Badge>
                  )}
                  {isGenerated && (
                    <Badge variant="secondary" className="text-xs">
                      Recurring
                    </Badge>
                  )}
                  {getStatusBadge(session.status)}
                  {/* Time-aware status badge */}
                  {session.status === "scheduled" && timeStatus.label !== "Upcoming" && (
                    <Badge variant={timeStatus.variant === "destructive" ? "destructive" : timeStatus.variant === "default" ? "default" : "secondary"} className="text-xs">
                      {timeStatus.label === "Live Now" && (
                        <span className="relative flex h-2 w-2 mr-1">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
                        </span>
                      )}
                      {timeStatus.label}
                    </Badge>
                  )}
                </div>

                {session.description && (
                  <p className="text-sm text-muted-foreground line-clamp-1">
                    {session.description}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {format(zonedDate, "EEE, MMM d")}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {format(zonedDate, "h:mm a")} <span className="text-xs font-medium">{getTimezoneAbbreviation(userTimezone)}</span>
                  </span>
                  {session.duration_minutes && <span>({session.duration_minutes} min)</span>}
                  {session.location && !session.location.startsWith("http") && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {session.location}
                    </span>
                  )}
                </div>
              </div>
            </Link>

            {/* Arrow indicator for clickable link */}
            <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-1" />
          </div>

          {/* Action buttons row */}
          <div className="flex flex-wrap items-center gap-2 pl-0 sm:pl-7">
            {/* Join Meeting button — enhanced with time awareness */}
            {videoLink && !isPast && (
              <Button
                size="sm"
                variant="default"
                className={timeStatus.label === "Live Now" ? "animate-pulse" : ""}
                asChild
              >
                <a href={videoLink} target="_blank" rel="noopener noreferrer">
                  <Video className="mr-2 h-3.5 w-3.5" />
                  {timeStatus.isJoinable ? (timeStatus.label === "Live Now" ? "Join Now" : "Join") : "Join"}
                </a>
              </Button>
            )}

            {/* Download ICS */}
            {onDownloadICS && (
              <Button size="sm" variant="outline" onClick={() => onDownloadICS(session)}>
                <Download className="mr-2 h-3.5 w-3.5" />
                Add to Calendar
              </Button>
            )}

            {/* Edit button - works for both regular and generated sessions */}
            {(onEdit || onEditParent) && (
              <Button size="sm" variant="ghost" onClick={handleEditClick}>
                <Edit2 className="h-3.5 w-3.5 mr-1" />
                {isGenerated ? "Edit Series" : "Edit"}
              </Button>
            )}

            {/* Admin-only actions */}
            {isAdmin && (
              <>
                {onDelete && !isGenerated && (
                  <Button size="sm" variant="ghost" onClick={() => onDelete(session)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                )}
                {onStatusChange && session.status === "scheduled" && isPast && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onStatusChange(session.id, "completed")}
                  >
                    Mark Complete
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
