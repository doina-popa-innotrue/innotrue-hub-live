import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Calendar,
  Clock,
  MapPin,
  Video,
  ArrowLeft,
  Repeat,
  Download,
  Users,
  Check,
  X,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { useAuth } from "@/contexts/AuthContext";
import { downloadICSFile } from "@/lib/icsGenerator";
import { useToast } from "@/hooks/use-toast";

export default function GroupSessionDetail() {
  const { groupId, sessionId } = useParams<{ groupId: string; sessionId: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: userProfile } = useQuery({
    queryKey: ["user-profile-tz-name", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("timezone, name")
        .eq("id", user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const userTimezone = userProfile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

  const { data: session, isLoading } = useQuery({
    queryKey: ["group-session", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_sessions")
        .select("*")
        .eq("id", sessionId ?? "")
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!sessionId,
  });

  const { data: group } = useQuery({
    queryKey: ["group-basic", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("groups")
        .select("id, name")
        .eq("id", groupId ?? "")
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!groupId,
  });

  // Fetch participants
  const { data: participants } = useQuery({
    queryKey: ["group-session-participants", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_session_participants")
        .select("id, user_id, response_status, responded_at")
        .eq("session_id", sessionId ?? "");
      if (error) throw error;
      return data;
    },
    enabled: !!sessionId,
  });

  // Fetch profiles for participants
  const participantUserIds = participants?.map((p) => p.user_id) || [];
  const { data: participantProfiles } = useQuery({
    queryKey: ["participant-profiles", participantUserIds],
    queryFn: async () => {
      if (participantUserIds.length === 0) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, avatar_url")
        .in("id", participantUserIds);
      if (error) throw error;
      return data;
    },
    enabled: participantUserIds.length > 0,
  });

  const profilesById = new Map(participantProfiles?.map((p) => [p.id, p]) || []);

  // Get current user's participation
  const myParticipation = participants?.find((p) => p.user_id === user?.id);

  // Mutation to update response status
  const updateResponseMutation = useMutation({
    mutationFn: async (status: "accepted" | "declined") => {
      const { error } = await supabase
        .from("group_session_participants")
        .update({
          response_status: status,
          responded_at: new Date().toISOString(),
        })
        .eq("session_id", sessionId ?? "")
        .eq("user_id", user?.id ?? "");
      if (error) throw error;
      return status;
    },
    onSuccess: async (status) => {
      queryClient.invalidateQueries({ queryKey: ["group-session-participants", sessionId] });
      toast({
        title: status === "accepted" ? "Accepted" : "Declined",
        description: `You have ${status} this session.`,
      });

      // Send email confirmation
      if (user && session) {
        const participantName = userProfile?.name || user.email?.split("@")[0] || "Participant";
        try {
          await supabase.functions.invoke("send-notification-email", {
            body: {
              userId: user.id,
              name: participantName,
              type: "session_rsvp_confirmation",
              timestamp: new Date().toISOString(),
              sessionTitle: session.title,
              sessionDate: session.session_date,
              groupName: group?.name,
              rsvpStatus: status,
              meetingUrl: session.meeting_link || undefined,
              entityLink: window.location.href,
            },
          });
          console.log("RSVP confirmation email sent");
        } catch (emailErr) {
          console.error("Failed to send RSVP confirmation email:", emailErr);
          // Don't show error to user - email is secondary
        }
      }
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleDownloadICS = () => {
    if (!session) return;
    const startDate = new Date(session.session_date);
    const endDate = new Date(startDate.getTime() + (session.duration_minutes || 60) * 60 * 1000);

    const sessionTimezone = (session as any).timezone || userTimezone || "UTC";

    downloadICSFile({
      id: session.id,
      title: session.title,
      description: session.description || undefined,
      location: session.meeting_link || session.location || undefined,
      startDate,
      endDate,
      timezone: sessionTimezone,
      isRecurring: session.is_recurring || false,
      recurrencePattern: session.recurrence_pattern || undefined,
      recurrenceEndDate: session.recurrence_end_date || undefined,
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Session not found</p>
            <Button asChild className="mt-4">
              <Link to={`/groups/${groupId}`}>Back to Group</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const sessionDate = new Date(session.session_date);
  const zonedDate = toZonedTime(sessionDate, userTimezone);
  const isPast = sessionDate < new Date();

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

  const getResponseBadge = (status: string) => {
    switch (status) {
      case "accepted":
        return (
          <Badge variant="default" className="text-xs">
            Accepted
          </Badge>
        );
      case "declined":
        return (
          <Badge variant="destructive" className="text-xs">
            Declined
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="outline" className="text-xs">
            Pending
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-xs">
            {status}
          </Badge>
        );
    }
  };

  // Count responses
  const acceptedCount = participants?.filter((p) => p.response_status === "accepted").length || 0;
  const declinedCount = participants?.filter((p) => p.response_status === "declined").length || 0;
  const pendingCount = participants?.filter((p) => p.response_status === "pending").length || 0;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/groups">Groups</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to={`/groups/${groupId}`}>{group?.name || "Group"}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{session.title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <Button variant="ghost" size="sm" asChild>
        <Link to={`/groups/${groupId}`}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Group
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="space-y-2 min-w-0">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                <CardTitle className="break-words">{session.title}</CardTitle>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {getStatusBadge(session.status)}
                {session.is_recurring && (
                  <Badge variant="outline">
                    <Repeat className="mr-1 h-3 w-3" />
                    {session.recurrence_pattern}
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadICS}
                className="w-full sm:w-auto"
              >
                <Download className="mr-2 h-4 w-4" />
                Add to Calendar
              </Button>
              {videoLink && !isPast && (
                <Button asChild className="w-full sm:w-auto">
                  <a href={videoLink} target="_blank" rel="noopener noreferrer">
                    <Video className="mr-2 h-4 w-4" />
                    Join Meeting
                  </a>
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Your Response (if participant) */}
          {myParticipation && !isPast && session.status === "scheduled" && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 rounded-lg border bg-muted/50">
              <div className="flex-1">
                <p className="font-medium">Your Response</p>
                <p className="text-sm text-muted-foreground">
                  {myParticipation.response_status === "pending"
                    ? "Will you attend this session?"
                    : `You have ${myParticipation.response_status} this session.`}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={myParticipation.response_status === "accepted" ? "default" : "outline"}
                  onClick={() => updateResponseMutation.mutate("accepted")}
                  disabled={updateResponseMutation.isPending}
                >
                  {updateResponseMutation.isPending ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="mr-1 h-4 w-4" />
                  )}
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant={
                    myParticipation.response_status === "declined" ? "destructive" : "outline"
                  }
                  onClick={() => updateResponseMutation.mutate("declined")}
                  disabled={updateResponseMutation.isPending}
                >
                  {updateResponseMutation.isPending ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <X className="mr-1 h-4 w-4" />
                  )}
                  Decline
                </Button>
              </div>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Date & Time</p>
                <p className="font-medium">{format(zonedDate, "PPP p")}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Duration</p>
                <p className="font-medium">{session.duration_minutes || 60} minutes</p>
              </div>
            </div>
            {(videoLink || session.location) && (
              <div className="flex items-center gap-3 md:col-span-2">
                {videoLink ? (
                  <Video className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <MapPin className="h-5 w-5 text-muted-foreground" />
                )}
                <div>
                  <p className="text-sm text-muted-foreground">
                    {videoLink ? "Meeting Link" : "Location"}
                  </p>
                  {videoLink ? (
                    <a
                      href={videoLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-primary hover:underline break-all"
                    >
                      {videoLink}
                    </a>
                  ) : (
                    <p className="font-medium">{session.location}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {session.description && (
            <div>
              <h3 className="font-semibold mb-2">Description</h3>
              <p className="text-muted-foreground whitespace-pre-wrap">{session.description}</p>
            </div>
          )}

          {/* Participants */}
          {participants && participants.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Users className="h-5 w-5 text-muted-foreground" />
                <h3 className="font-semibold">Participants ({participants.length})</h3>
              </div>

              {/* Response summary */}
              <div className="flex flex-wrap gap-2 mb-4 text-sm">
                <span className="text-muted-foreground">
                  <span className="text-foreground font-medium">{acceptedCount}</span> accepted
                </span>
                <span className="text-muted-foreground">•</span>
                <span className="text-muted-foreground">
                  <span className="text-foreground font-medium">{pendingCount}</span> pending
                </span>
                {declinedCount > 0 && (
                  <>
                    <span className="text-muted-foreground">•</span>
                    <span className="text-muted-foreground">
                      <span className="text-foreground font-medium">{declinedCount}</span> declined
                    </span>
                  </>
                )}
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                {participants.map((participant) => {
                  const profile = profilesById.get(participant.user_id);
                  const isCurrentUser = participant.user_id === user?.id;
                  return (
                    <div
                      key={participant.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border ${isCurrentUser ? "bg-primary/5 border-primary/20" : "bg-muted/30"}`}
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={profile?.avatar_url || undefined} />
                        <AvatarFallback>{profile?.name?.charAt(0) || "?"}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {profile?.name || "Unknown"}
                          {isCurrentUser && (
                            <span className="text-muted-foreground font-normal"> (you)</span>
                          )}
                        </p>
                      </div>
                      {getResponseBadge(participant.response_status)}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
