import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  Calendar,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Users,
  BookOpen,
  UserCheck,
  Clock,
  MapPin,
  Link as LinkIcon,
  FileText,
  Video,
  Save,
  Bell,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { format, isPast, isToday } from "date-fns";
import { CohortSessionAttendance } from "@/components/admin/CohortSessionAttendance";
import { SessionHomework } from "@/components/cohort/SessionHomework";
import { PageLoadingState } from "@/components/ui/page-loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "sonner";

interface CohortInfo {
  id: string;
  name: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  max_capacity: number | null;
  program_id: string;
  lead_instructor_name: string | null;
  program_name: string | null;
}

interface SessionInfo {
  id: string;
  title: string;
  description: string | null;
  session_date: string;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  meeting_link: string | null;
  module_title: string | null;
  instructor_name: string | null;
  recap: string | null;
  recording_url: string | null;
  order_index: number;
  attendance_present: number;
  attendance_total: number;
}

interface EnrolledClient {
  enrollment_id: string;
  user_id: string;
  name: string;
  email: string;
  sessions_present: number;
  sessions_total: number;
}

export default function TeachingCohortDetail() {
  const { cohortId } = useParams<{ cohortId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [cohort, setCohort] = useState<CohortInfo | null>(null);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [enrolledClients, setEnrolledClients] = useState<EnrolledClient[]>([]);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [recapEdits, setRecapEdits] = useState<Record<string, { recap: string; recording_url: string }>>({});
  const [savingRecap, setSavingRecap] = useState<string | null>(null);
  const [notifying, setNotifying] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!user || !cohortId) return;

    // 1. Load cohort with lead instructor + program name
    const { data: cohortData, error: cohortError } = await supabase
      .from("program_cohorts")
      .select(`
        id, name, description, start_date, end_date, status, max_capacity, program_id,
        lead_instructor:profiles!program_cohorts_lead_instructor_id_fkey ( name ),
        programs ( name )
      `)
      .eq("id", cohortId)
      .single();

    if (cohortError || !cohortData) {
      setLoading(false);
      return;
    }

    setCohort({
      id: (cohortData as any).id,
      name: (cohortData as any).name,
      description: (cohortData as any).description,
      start_date: (cohortData as any).start_date,
      end_date: (cohortData as any).end_date,
      status: (cohortData as any).status,
      max_capacity: (cohortData as any).max_capacity,
      program_id: (cohortData as any).program_id,
      lead_instructor_name: (cohortData as any).lead_instructor?.name || null,
      program_name: (cohortData as any).programs?.name || null,
    });

    // 2. Load sessions with instructor + module
    const { data: sessionsData } = await supabase
      .from("cohort_sessions")
      .select(`
        id, title, description, session_date, start_time, end_time,
        location, meeting_link, module_id, recap, recording_url, order_index,
        program_modules ( title ),
        instructor:profiles!cohort_sessions_instructor_id_fkey ( name )
      `)
      .eq("cohort_id", cohortId)
      .order("order_index", { ascending: true });

    // 3. Load attendance records for all sessions
    const { data: attendanceData } = await supabase
      .from("cohort_session_attendance" as string)
      .select("session_id, enrollment_id, status")
      .in(
        "session_id",
        (sessionsData || []).map((s: any) => s.id),
      );

    // Build attendance stats per session
    const sessionAttendance: Record<string, { present: number; total: number }> = {};
    const attendanceArr = (attendanceData as { session_id: string; enrollment_id: string; status: string }[]) || [];
    attendanceArr.forEach((a) => {
      if (!sessionAttendance[a.session_id]) {
        sessionAttendance[a.session_id] = { present: 0, total: 0 };
      }
      sessionAttendance[a.session_id].total++;
      if (a.status === "present") {
        sessionAttendance[a.session_id].present++;
      }
    });

    const mappedSessions: SessionInfo[] = (sessionsData || []).map((s: any) => ({
      id: s.id,
      title: s.title,
      description: s.description,
      session_date: s.session_date,
      start_time: s.start_time,
      end_time: s.end_time,
      location: s.location,
      meeting_link: s.meeting_link,
      module_title: s.program_modules?.title || null,
      instructor_name: s.instructor?.name || (cohortData as any).lead_instructor?.name || null,
      recap: s.recap,
      recording_url: s.recording_url,
      order_index: s.order_index,
      attendance_present: sessionAttendance[s.id]?.present || 0,
      attendance_total: sessionAttendance[s.id]?.total || 0,
    }));

    setSessions(mappedSessions);

    // 4. Load enrolled clients with attendance summary
    const { data: enrollments } = await supabase
      .from("client_enrollments")
      .select("id, client_user_id, profiles:client_user_id(name, email)")
      .eq("cohort_id" as string, cohortId)
      .eq("status", "active");

    // Build per-client attendance
    const clientAttendance: Record<string, { present: number; total: number }> = {};
    attendanceArr.forEach((a) => {
      if (!clientAttendance[a.enrollment_id]) {
        clientAttendance[a.enrollment_id] = { present: 0, total: 0 };
      }
      clientAttendance[a.enrollment_id].total++;
      if (a.status === "present") {
        clientAttendance[a.enrollment_id].present++;
      }
    });

    const totalSessions = mappedSessions.length;
    const clients: EnrolledClient[] = ((enrollments as any) || []).map((e: any) => ({
      enrollment_id: e.id,
      user_id: e.client_user_id,
      name: e.profiles?.name || "Unknown",
      email: e.profiles?.email || "",
      sessions_present: clientAttendance[e.id]?.present || 0,
      sessions_total: totalSessions,
    }));

    setEnrolledClients(clients);
    setLoading(false);
  }, [user, cohortId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getSessionStatus = (date: string) => {
    const sessionDate = new Date(date + "T00:00:00");
    if (isToday(sessionDate)) return "live";
    if (isPast(sessionDate)) return "past";
    return "upcoming";
  };

  const getSessionStatusBadge = (date: string) => {
    const status = getSessionStatus(date);
    switch (status) {
      case "live":
        return <Badge className="bg-green-600">Today</Badge>;
      case "past":
        return <Badge variant="secondary">Past</Badge>;
      case "upcoming":
        return <Badge variant="outline">Upcoming</Badge>;
    }
  };

  const getRecapEdit = (session: SessionInfo) => {
    return recapEdits[session.id] || {
      recap: session.recap || "",
      recording_url: session.recording_url || "",
    };
  };

  const handleRecapChange = (sessionId: string, field: "recap" | "recording_url", value: string) => {
    setRecapEdits((prev) => ({
      ...prev,
      [sessionId]: {
        ...getRecapEdit(sessions.find((s) => s.id === sessionId)!),
        [field]: value,
      },
    }));
  };

  const handleSaveRecap = async (sessionId: string, notify = false) => {
    const edit = getRecapEdit(sessions.find((s) => s.id === sessionId)!);

    if (notify) {
      setNotifying(sessionId);
    } else {
      setSavingRecap(sessionId);
    }

    try {
      const { error } = await supabase
        .from("cohort_sessions")
        .update({
          recap: edit.recap || null,
          recording_url: edit.recording_url || null,
        })
        .eq("id", sessionId);

      if (error) throw error;

      // Update local state
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId
            ? { ...s, recap: edit.recap || null, recording_url: edit.recording_url || null }
            : s,
        ),
      );

      if (notify) {
        // Call the notify RPC
        const { error: rpcError } = await supabase.rpc("notify_cohort_session_recap", {
          p_session_id: sessionId,
        });

        if (rpcError) {
          console.error("Notify error:", rpcError);
          toast.success("Recap saved, but notification failed to send.");
        } else {
          toast.success("Recap saved and notification sent!");
        }
      } else {
        toast.success("Recap saved!");
      }

      // Clear edit state for this session
      setRecapEdits((prev) => {
        const next = { ...prev };
        delete next[sessionId];
        return next;
      });
    } catch (err) {
      console.error("Error saving recap:", err);
      toast.error("Failed to save recap");
    } finally {
      setSavingRecap(null);
      setNotifying(null);
    }
  };

  const handleAttendanceStatsChange = () => {
    // Reload data to refresh attendance stats
    loadData();
  };

  if (loading) {
    return <PageLoadingState />;
  }

  if (!cohort) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="Cohort Not Found"
        description="This cohort could not be found or you don't have access to it."
        actionLabel="Back to Cohorts"
        actionHref="/teaching/cohorts"
      />
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge>Active</Badge>;
      case "upcoming":
        return <Badge variant="outline">Upcoming</Badge>;
      case "completed":
        return <Badge variant="secondary">Completed</Badge>;
      case "cancelled":
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Back button */}
      <Button variant="ghost" size="sm" onClick={() => navigate("/teaching/cohorts")}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Cohorts
      </Button>

      {/* Cohort header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="text-2xl">{cohort.name}</CardTitle>
              <CardDescription className="mt-1">
                {cohort.program_name}
                {cohort.start_date && cohort.end_date && (
                  <>
                    {" • "}
                    {format(new Date(cohort.start_date), "MMM d, yyyy")} –{" "}
                    {format(new Date(cohort.end_date), "MMM d, yyyy")}
                  </>
                )}
              </CardDescription>
            </div>
            {getStatusBadge(cohort.status)}
          </div>
          <div className="flex flex-wrap gap-4 mt-3 text-sm text-muted-foreground">
            {cohort.lead_instructor_name && (
              <div className="flex items-center gap-1">
                <UserCheck className="h-4 w-4" />
                <span>Lead: {cohort.lead_instructor_name}</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              <span>
                {enrolledClients.length}
                {cohort.max_capacity ? ` / ${cohort.max_capacity}` : ""} enrolled
              </span>
            </div>
            <div className="flex items-center gap-1">
              <CalendarDays className="h-4 w-4" />
              <span>{sessions.length} session{sessions.length !== 1 ? "s" : ""}</span>
            </div>
          </div>
          {cohort.description && (
            <p className="text-sm text-muted-foreground mt-2">{cohort.description}</p>
          )}
        </CardHeader>
      </Card>

      {/* Sessions list */}
      <div>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Sessions ({sessions.length})
        </h2>

        {sessions.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <CalendarDays className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No sessions scheduled for this cohort yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => {
              const isExpanded = expandedSession === session.id;
              const status = getSessionStatus(session.session_date);
              const isPastSession = status === "past" || status === "live";
              const recapEdit = getRecapEdit(session);
              const hasRecapChanges =
                recapEdit.recap !== (session.recap || "") ||
                recapEdit.recording_url !== (session.recording_url || "");

              return (
                <Card key={session.id} className={status === "live" ? "border-green-500/50" : ""}>
                  {/* Session header row */}
                  <CardHeader
                    className="cursor-pointer"
                    onClick={() => setExpandedSession(isExpanded ? null : session.id)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="shrink-0">
                          {getSessionStatusBadge(session.session_date)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold">{session.title}</span>
                            {session.module_title && (
                              <Badge variant="outline" className="text-xs">
                                <BookOpen className="h-3 w-3 mr-1" />
                                {session.module_title}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1 flex-wrap">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" />
                              {format(new Date(session.session_date), "EEE, MMM d, yyyy")}
                            </span>
                            {session.start_time && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5" />
                                {session.start_time.slice(0, 5)}
                                {session.end_time && ` – ${session.end_time.slice(0, 5)}`}
                              </span>
                            )}
                            {session.instructor_name && (
                              <span className="flex items-center gap-1">
                                <UserCheck className="h-3.5 w-3.5" />
                                {session.instructor_name}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {session.attendance_total > 0 && (
                          <Badge variant="outline" className="text-xs">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            {session.attendance_present}/{session.attendance_total}
                          </Badge>
                        )}
                        {session.recap && (
                          <Badge variant="outline" className="text-xs bg-blue-50 dark:bg-blue-950">
                            <FileText className="h-3 w-3 mr-1" />
                            Recap
                          </Badge>
                        )}
                        {isExpanded ? (
                          <ChevronUp className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </CardHeader>

                  {/* Expanded content */}
                  {isExpanded && (
                    <CardContent className="pt-0 space-y-4">
                      {/* Session details */}
                      {(session.description || session.location || session.meeting_link) && (
                        <div className="space-y-2 text-sm">
                          {session.description && (
                            <p className="text-muted-foreground">{session.description}</p>
                          )}
                          <div className="flex flex-wrap gap-3">
                            {session.location && (
                              <span className="flex items-center gap-1 text-muted-foreground">
                                <MapPin className="h-3.5 w-3.5" />
                                {session.location}
                              </span>
                            )}
                            {session.meeting_link && (
                              <a
                                href={session.meeting_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-primary hover:underline"
                              >
                                <LinkIcon className="h-3.5 w-3.5" />
                                Meeting Link
                              </a>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Attendance panel */}
                      <div>
                        <h4 className="text-sm font-medium mb-1 flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          Attendance
                        </h4>
                        <CohortSessionAttendance
                          sessionId={session.id}
                          cohortId={cohortId!}
                          onStatsChange={handleAttendanceStatsChange}
                        />
                      </div>

                      {/* Session homework */}
                      <SessionHomework
                        sessionId={session.id}
                        cohortId={cohortId!}
                        sessionDate={session.session_date}
                      />

                      {/* Recap editor (for past / today sessions) */}
                      {isPastSession && (
                        <div className="space-y-3 border-t pt-4">
                          <h4 className="text-sm font-medium flex items-center gap-1">
                            <FileText className="h-4 w-4" />
                            Session Recap
                          </h4>
                          <div className="space-y-2">
                            <Label htmlFor={`recap-${session.id}`} className="text-xs text-muted-foreground">
                              Recap Notes
                            </Label>
                            <Textarea
                              id={`recap-${session.id}`}
                              placeholder="Write a recap of what was covered in this session..."
                              value={recapEdit.recap}
                              onChange={(e) => handleRecapChange(session.id, "recap", e.target.value)}
                              rows={4}
                              className="resize-none"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`recording-${session.id}`} className="text-xs text-muted-foreground flex items-center gap-1">
                              <Video className="h-3.5 w-3.5" />
                              Recording URL
                            </Label>
                            <Input
                              id={`recording-${session.id}`}
                              placeholder="https://..."
                              value={recapEdit.recording_url}
                              onChange={(e) => handleRecapChange(session.id, "recording_url", e.target.value)}
                            />
                          </div>
                          <div className="flex gap-2 justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSaveRecap(session.id, false)}
                              disabled={savingRecap === session.id || notifying === session.id || !hasRecapChanges}
                            >
                              {savingRecap === session.id ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-1" />
                              ) : (
                                <Save className="h-4 w-4 mr-1" />
                              )}
                              Save Recap
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleSaveRecap(session.id, true)}
                              disabled={savingRecap === session.id || notifying === session.id}
                            >
                              {notifying === session.id ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-1" />
                              ) : (
                                <Bell className="h-4 w-4 mr-1" />
                              )}
                              Save & Notify
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Enrolled clients */}
      <div>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Users className="h-5 w-5" />
          Enrolled Clients ({enrolledClients.length})
        </h2>

        {enrolledClients.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <Users className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No clients enrolled in this cohort yet.</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2">
                {enrolledClients.map((client) => (
                  <div
                    key={client.enrollment_id}
                    className="flex items-center justify-between gap-2 py-2 px-3 rounded hover:bg-muted/50"
                  >
                    <div className="min-w-0">
                      <Link
                        to={`/teaching/students/${client.user_id}`}
                        className="font-medium text-sm hover:underline"
                      >
                        {client.name}
                      </Link>
                      <p className="text-xs text-muted-foreground truncate">{client.email}</p>
                    </div>
                    <div className="shrink-0">
                      {client.sessions_total > 0 ? (
                        <Badge
                          variant={
                            client.sessions_present === client.sessions_total
                              ? "default"
                              : client.sessions_present === 0
                                ? "destructive"
                                : "secondary"
                          }
                          className="text-xs"
                        >
                          {client.sessions_present}/{client.sessions_total} attended
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">No attendance yet</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
