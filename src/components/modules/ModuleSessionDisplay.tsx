import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Calendar,
  Clock,
  MapPin,
  Video,
  User,
  Users,
  ExternalLink,
  MessageSquare,
  RefreshCw,
  Download,
  AlertTriangle,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { ClientSessionForm } from "./ClientSessionForm";
import { buildCalcomBookingUrl, buildCalcomRescheduleUrl } from "@/lib/calcom-booking-url";
import { useModuleRequiresSession } from "@/hooks/useModuleTypeRequiresSession";
import { useModuleSessionCapability } from "@/hooks/useModuleSessionCapability";
import { downloadICSFile } from "@/lib/icsGenerator";

interface ModuleSession {
  id: string;
  title: string;
  description: string | null;
  session_date: string | null;
  duration_minutes: number;
  location: string | null;
  meeting_url: string | null;
  status: string;
  session_type: "individual" | "group";
  client_response: string | null;
  source?: string;
  requested_by?: string;
  request_notes?: string;
  preferred_date?: string;
  calcom_booking_uid?: string | null;
  booking_source?: string | null;
}

interface ModuleSessionDisplayProps {
  moduleId: string;
  enrollmentId: string;
  programId?: string;
  schedulingUrl?: string;
  moduleName?: string;
  defaultDuration?: number;
  moduleType?: string; // Optional - if provided, skips internal lookup
}

export function ModuleSessionDisplay({
  moduleId,
  enrollmentId,
  schedulingUrl,
  moduleName = "Module",
  defaultDuration = 60,
  moduleType,
}: ModuleSessionDisplayProps) {
  const { user } = useAuth();

  // Use the resilient hook for capability check (proxy-first with fallback)
  const {
    hasCapability: resilientCapability,
    isLoading: isLoadingResilient,
    isError: isCapabilityError,
    error: capabilityError,
    retry: retryCapability,
  } = useModuleSessionCapability({
    moduleType,
    moduleId: moduleType ? undefined : moduleId,
    enabled: true,
  });

  // Legacy hook for non-moduleType path (still used as additional fallback)
  const { requiresSession, isLoading: isLoadingLegacy } = useModuleRequiresSession(
    moduleType ? undefined : moduleId,
    !moduleType && resilientCapability === null, // Only run if resilient didn't work
  );

  // Determine capability: prefer resilient result, fall back to legacy
  const hasSessionCapability = resilientCapability ?? requiresSession;
  const isLoadingCapability =
    isLoadingResilient || (resilientCapability === null && isLoadingLegacy);

  const {
    data: sessions,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["module-sessions-client", moduleId, enrollmentId, user?.id],
    queryFn: async () => {
      // Use the safe view which hides meeting_url from non-confirmed participants
      // Fetch individual sessions for this enrollment
      const { data: individualSessions, error: indError } = await supabase
        .from("module_sessions_safe")
        .select("*")
        .eq("module_id", moduleId)
        .eq("enrollment_id", enrollmentId)
        .eq("session_type", "individual")
        .neq("status", "cancelled")
        .order("session_date", { ascending: true });

      if (indError) throw indError;

      // Fetch group sessions where the user is a participant
      // The RLS policy will filter to only sessions where the user is in module_session_participants
      const { data: groupSessions, error: grpError } = await supabase
        .from("module_sessions_safe")
        .select("*")
        .eq("module_id", moduleId)
        .eq("session_type", "group")
        .neq("status", "cancelled")
        .order("session_date", { ascending: true });

      if (grpError) throw grpError;

      // Combine and sort by date
      const allSessions = [...(individualSessions || []), ...(groupSessions || [])];
      allSessions.sort((a, b) => {
        if (!a.session_date && !b.session_date) return 0;
        if (!a.session_date) return 1;
        if (!b.session_date) return -1;
        return new Date(a.session_date).getTime() - new Date(b.session_date).getTime();
      });

      return allSessions as ModuleSession[];
    },
    // Refetch when user returns from Cal.com booking flow (window regains focus)
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  // Build context-aware booking URL with enrollment/module metadata
  // Note: Supabase stores name in user_metadata.name (not full_name)
  const contextAwareBookingUrl = schedulingUrl
    ? buildCalcomBookingUrl({
        schedulingUrl,
        enrollmentId,
        moduleId,
        userId: user?.id,
        sessionType: "individual",
        email: user?.email || undefined,
        name: (user?.user_metadata?.full_name || user?.user_metadata?.name) as string | undefined,
        redirectUrl: window.location.href,
      })
    : null;

  // Sessions are now auto-accepted - clients can reschedule via Cal.com if needed

  // Show loading skeleton
  if (isLoading || isLoadingCapability) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5" />
          <Skeleton className="h-6 w-40" />
        </div>
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  // Show error state with retry option
  if (isCapabilityError && resilientCapability === null) {
    return (
      <Alert variant="default" className="border-warning/50 bg-warning/10">
        <AlertTriangle className="h-4 w-4 text-warning" />
        <AlertTitle>Unable to load session information</AlertTitle>
        <AlertDescription className="space-y-2">
          <p className="text-sm text-muted-foreground">
            This may be due to browser privacy settings blocking some requests.
          </p>
          <div className="flex gap-2 mt-2">
            <Button variant="outline" size="sm" onClick={retryCapability}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
            <a
              href="https://support.mozilla.org/en-US/kb/enhanced-tracking-protection-firefox-desktop"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Learn about browser privacy settings
            </a>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  // Don't show session section if this module type doesn't support sessions
  if (!hasSessionCapability) {
    return null;
  }

  // Always show the section if this module type supports sessions
  // Even without a scheduling URL, clients can log external sessions or request sessions
  // The "Book Session" button will only appear if schedulingUrl is available

  const hasSessions = sessions && sessions.length > 0;

  // Check if there's an active scheduled session with a date (hide Book Session button in this case)
  const hasActiveScheduledSession = sessions?.some(
    (s) =>
      s.status === "scheduled" && s.session_date && new Date(s.session_date).getTime() > Date.now(),
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "default";
      case "rescheduled":
        return "secondary";
      case "scheduled":
        return "outline";
      default:
        return "outline";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "scheduled":
        return "Confirmed";
      case "completed":
        return "Completed";
      case "rescheduled":
        return "Rescheduled";
      default:
        return status;
    }
  };

  const hasScheduledTime = (sessionDate: string | null) => {
    return sessionDate && new Date(sessionDate).getTime() > Date.now();
  };

  const handleDownloadICS = (session: ModuleSession) => {
    if (!session.session_date) return;

    const startDate = new Date(session.session_date);
    const endDate = new Date(startDate.getTime() + (session.duration_minutes || 60) * 60 * 1000);

    downloadICSFile({
      id: session.id,
      title: session.title || moduleName,
      description: session.description || undefined,
      startDate,
      endDate,
      location: session.meeting_url || session.location || undefined,
    });

    toast.success("Calendar file downloaded");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-lg">Scheduled Sessions</h3>
        </div>
        <div className="flex items-center gap-2">
          {!hasActiveScheduledSession && (
            <ClientSessionForm
              moduleId={moduleId}
              enrollmentId={enrollmentId}
              moduleName={moduleName}
              defaultDuration={defaultDuration}
              schedulingUrl={schedulingUrl}
            />
          )}
          {contextAwareBookingUrl && !hasActiveScheduledSession && (
            <a
              href={contextAwareBookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90"
            >
              <ExternalLink className="h-4 w-4" />
              Book Session
            </a>
          )}
        </div>
      </div>

      {hasSessions && (
        <div className="space-y-3">
          {sessions!.map((session) => {
            const isClientRequest = session.source === "client_request";
            const isExternalBooking = session.source === "client_external";
            const isPendingConfirmation = isClientRequest && !session.session_date;

            return (
              <Card
                key={session.id}
                className={`bg-muted/50 ${isPendingConfirmation ? "border-warning/50" : ""}`}
              >
                <CardContent className="pt-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{session.title}</span>
                      <Badge variant={session.session_type === "group" ? "secondary" : "outline"}>
                        {session.session_type === "group" ? (
                          <>
                            <Users className="h-3 w-3 mr-1" />
                            Group
                          </>
                        ) : (
                          <>
                            <User className="h-3 w-3 mr-1" />
                            1:1
                          </>
                        )}
                      </Badge>
                      {isClientRequest && isPendingConfirmation && (
                        <Badge variant="outline" className="border-warning text-warning">
                          <MessageSquare className="h-3 w-3 mr-1" />
                          Awaiting Confirmation
                        </Badge>
                      )}
                      {isExternalBooking && (
                        <Badge variant="outline" className="border-muted-foreground">
                          <ExternalLink className="h-3 w-3 mr-1" />
                          External Booking
                        </Badge>
                      )}
                      {!isPendingConfirmation && (
                        <Badge variant={getStatusColor(session.status)}>
                          {getStatusLabel(session.status)}
                        </Badge>
                      )}
                    </div>

                    {session.description && (
                      <p className="text-sm text-muted-foreground">{session.description}</p>
                    )}

                    {/* Show request notes for client-initiated sessions */}
                    {session.request_notes && (
                      <div className="text-sm bg-muted p-2 rounded border-l-2 border-primary">
                        <span className="font-medium text-xs text-muted-foreground">
                          Your notes:
                        </span>
                        <p className="mt-0.5">{session.request_notes}</p>
                      </div>
                    )}

                    {/* Show preferred date for pending requests */}
                    {isPendingConfirmation && session.preferred_date && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>
                          Preferred:{" "}
                          {format(
                            new Date(session.preferred_date),
                            "EEEE, MMMM d, yyyy 'at' h:mm a",
                          )}
                        </span>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      {session.session_date && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(session.session_date), "EEEE, MMMM d, yyyy 'at' h:mm a")}
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {session.duration_minutes} minutes
                      </div>
                      {session.location && (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {session.location}
                        </div>
                      )}
                    </div>

                    {/* Show scheduling link if no time set yet */}
                    {!session.session_date && session.status === "scheduled" && schedulingUrl && (
                      <div className="pt-2 border-t">
                        <a
                          href={schedulingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-md text-sm font-medium hover:bg-secondary/90"
                        >
                          <ExternalLink className="h-4 w-4" />
                          Pick a Time
                        </a>
                      </div>
                    )}

                    {session.meeting_url && session.status === "scheduled" && (
                      <div className="flex items-center gap-2 flex-wrap mt-2">
                        <a
                          href={session.meeting_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90"
                        >
                          <Video className="h-4 w-4" />
                          Join Meeting
                        </a>

                        {/* Add to Calendar button */}
                        {session.session_date && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownloadICS(session)}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Add to Calendar
                          </Button>
                        )}

                        {/* Reschedule button for Cal.com sessions */}
                        {session.calcom_booking_uid && (
                          <a
                            href={buildCalcomRescheduleUrl(
                              session.calcom_booking_uid,
                              undefined,
                              window.location.href,
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-md text-sm font-medium hover:bg-secondary/90"
                          >
                            <RefreshCw className="h-4 w-4" />
                            Reschedule
                          </a>
                        )}

                        {/* For non-Cal.com sessions, offer to rebook if scheduling URL available */}
                        {!session.calcom_booking_uid && contextAwareBookingUrl && (
                          <a
                            href={contextAwareBookingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-md text-sm font-medium hover:bg-secondary/90"
                          >
                            <RefreshCw className="h-4 w-4" />
                            Rebook
                          </a>
                        )}
                      </div>
                    )}

                    {/* Add to Calendar for scheduled sessions without meeting URL */}
                    {!session.meeting_url &&
                      session.session_date &&
                      session.status === "scheduled" && (
                        <div className="flex items-center gap-2 flex-wrap mt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownloadICS(session)}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Add to Calendar
                          </Button>
                        </div>
                      )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
