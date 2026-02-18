import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Calendar,
  ChevronRight,
  Download,
  UsersRound,
  BookOpen,
  BarChart3,
  UserCheck,
} from "lucide-react";
import { format } from "date-fns";
import { CohortSessionCard, type CohortSession } from "@/components/cohort/CohortSessionCard";
import { useUserTimezone } from "@/hooks/useUserTimezone";
import { usePageView } from "@/hooks/useAnalytics";
import { EmptyState } from "@/components/ui/empty-state";
import { PageLoadingState } from "@/components/ui/page-loading-state";
import { SessionMismatchGuard } from "@/components/auth/SessionMismatchGuard";
import { downloadICSFile, type ICSEvent } from "@/lib/icsGenerator";

interface CohortData {
  id: string;
  name: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  program_id: string;
  lead_instructor_name?: string | null;
}

interface ProgramData {
  id: string;
  name: string;
}

interface GroupData {
  id: string;
  name: string;
  member_count: number;
}

export default function CohortDashboard() {
  usePageView("Cohort Dashboard");

  const { programId } = useParams<{ programId: string }>();
  const { user } = useAuth();
  const { timezone: userTimezone } = useUserTimezone();

  const [loading, setLoading] = useState(true);
  const [cohort, setCohort] = useState<CohortData | null>(null);
  const [program, setProgram] = useState<ProgramData | null>(null);
  const [sessions, setSessions] = useState<CohortSession[]>([]);
  const [group, setGroup] = useState<GroupData | null>(null);
  const [moduleProgress, setModuleProgress] = useState({
    total: 0,
    completed: 0,
  });
  const [noCohortEnrollment, setNoCohortEnrollment] = useState(false);

  useEffect(() => {
    async function loadCohortData() {
      if (!user || !programId) return;

      // 1. Get user's enrollment for this program with cohort
      const { data: enrollment } = await supabase
        .from("client_enrollments")
        .select("id, cohort_id")
        .eq("client_user_id", user.id)
        .eq("program_id", programId)
        .eq("status", "active")
        .maybeSingle();

      if (!enrollment?.cohort_id) {
        setNoCohortEnrollment(true);
        setLoading(false);
        return;
      }

      // 2. Load cohort info (including lead instructor name)
      const { data: cohortData } = await supabase
        .from("program_cohorts")
        .select(`
          id, name, description, start_date, end_date, status, program_id,
          lead_instructor_id,
          lead_instructor:profiles!program_cohorts_lead_instructor_id_fkey ( name )
        `)
        .eq("id", enrollment.cohort_id)
        .single();

      const leadInstructorName = (cohortData as any)?.lead_instructor?.name || null;

      if (cohortData) {
        setCohort({
          ...(cohortData as any),
          lead_instructor_name: leadInstructorName,
        } as CohortData);
      }

      // 3. Load program name
      const { data: programData } = await supabase
        .from("programs")
        .select("id, name")
        .eq("id", programId)
        .single();

      if (programData) {
        setProgram(programData as ProgramData);
      }

      // 4. Load cohort sessions with module titles and instructor names
      const { data: sessionsData } = await supabase
        .from("cohort_sessions")
        .select(`
          id, title, description, session_date, start_time, end_time,
          location, meeting_link, module_id, notes, instructor_id,
          program_modules ( title ),
          instructor:profiles!cohort_sessions_instructor_id_fkey ( name )
        `)
        .eq("cohort_id", enrollment.cohort_id)
        .order("order_index", { ascending: true });

      if (sessionsData) {
        const mapped: CohortSession[] = sessionsData.map((s: any) => ({
          id: s.id,
          title: s.title,
          description: s.description,
          session_date: s.session_date,
          start_time: s.start_time,
          end_time: s.end_time,
          location: s.location,
          meeting_link: s.meeting_link,
          module_id: s.module_id,
          notes: s.notes,
          module_title: s.program_modules?.title || null,
          instructor_name: s.instructor?.name || leadInstructorName,
        }));
        setSessions(mapped);
      }

      // 5. Load module progress for this enrollment
      const { data: modules } = await supabase
        .from("program_modules")
        .select("id")
        .eq("program_id", programId)
        .eq("is_active", true);

      const totalModules = modules?.length || 0;

      const { data: progress } = await supabase
        .from("module_progress")
        .select("status")
        .eq("enrollment_id", enrollment.id);

      const completedModules = (progress || []).filter(
        (p) => p.status === "completed",
      ).length;

      setModuleProgress({ total: totalModules, completed: completedModules });

      // 6. Check for a group linked to this program
      const { data: groupData } = await supabase
        .from("groups" as any)
        .select("id, name")
        .eq("program_id", programId)
        .in("status", ["active", "upcoming"])
        .limit(1);

      if (groupData && (groupData as any[]).length > 0) {
        const g = (groupData as any[])[0];
        // Get member count
        const { count } = await supabase
          .from("group_memberships" as any)
          .select("*", { count: "exact", head: true })
          .eq("group_id", g.id)
          .eq("status", "active");

        setGroup({
          id: g.id,
          name: g.name,
          member_count: count || 0,
        });
      }

      setLoading(false);
    }

    loadCohortData();
  }, [user, programId]);

  if (loading) {
    return (
      <SessionMismatchGuard>
        <PageLoadingState message="Loading cohort schedule..." />
      </SessionMismatchGuard>
    );
  }

  if (noCohortEnrollment) {
    return (
      <SessionMismatchGuard>
        <div className="space-y-4">
          <nav className="text-sm text-muted-foreground">
            <Link to="/programs" className="hover:underline">
              Programs
            </Link>
            {" / "}
            <Link to={`/programs/${programId}`} className="hover:underline">
              Program
            </Link>
          </nav>
          <EmptyState
            icon={Calendar}
            title="No cohort enrollment"
            description="You're not currently enrolled in a cohort for this program. Contact your administrator if you expect to be in one."
            actionLabel="Back to Program"
            actionHref={`/programs/${programId}`}
          />
        </div>
      </SessionMismatchGuard>
    );
  }

  const today = new Date().toISOString().split("T")[0];
  const upcomingSessions = sessions.filter((s) => s.session_date >= today);
  const pastSessions = sessions.filter((s) => s.session_date < today);
  const nextSession = upcomingSessions[0] || null;

  const progressPercent =
    moduleProgress.total > 0
      ? Math.round((moduleProgress.completed / moduleProgress.total) * 100)
      : 0;

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

  const handleDownloadAllICS = () => {
    upcomingSessions.forEach((session) => {
      const startDate = session.start_time
        ? new Date(`${session.session_date}T${session.start_time}`)
        : new Date(session.session_date);
      const endDate = session.end_time
        ? new Date(`${session.session_date}T${session.end_time}`)
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
    });
  };

  return (
    <SessionMismatchGuard>
      <div className="space-y-6">
        {/* Breadcrumb */}
        <nav className="text-sm text-muted-foreground">
          <Link to="/programs" className="hover:underline">
            Programs
          </Link>
          {" / "}
          <Link to={`/programs/${programId}`} className="hover:underline">
            {program?.name || "Program"}
          </Link>
          {" / "}
          <span className="text-foreground">Cohort Schedule</span>
        </nav>

        {/* Cohort Header */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-2xl">{cohort?.name}</CardTitle>
                <CardDescription className="mt-1">
                  {program?.name}
                  {cohort?.start_date && cohort?.end_date && (
                    <>
                      {" • "}
                      {format(new Date(cohort.start_date), "MMM d, yyyy")} –{" "}
                      {format(new Date(cohort.end_date), "MMM d, yyyy")}
                    </>
                  )}
                </CardDescription>
              </div>
              {cohort && getStatusBadge(cohort.status)}
            </div>
            {(cohort?.description || cohort?.lead_instructor_name) && (
              <div className="mt-2 space-y-1">
                {cohort?.description && (
                  <p className="text-sm text-muted-foreground">
                    {cohort.description}
                  </p>
                )}
                {cohort?.lead_instructor_name && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <UserCheck className="h-3.5 w-3.5" />
                    Led by {cohort.lead_instructor_name}
                  </p>
                )}
              </div>
            )}
          </CardHeader>
        </Card>

        {/* Next Session Highlight */}
        {nextSession && (
          <div>
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Next Session
            </h2>
            <CohortSessionCard
              session={nextSession}
              userTimezone={userTimezone}
              programId={programId}
              isHighlighted
              showModuleLink
            />
          </div>
        )}

        {/* All Sessions Timeline */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Session Schedule ({sessions.length})
            </h2>
            {upcomingSessions.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadAllICS}
              >
                <Download className="mr-2 h-3.5 w-3.5" />
                Add All to Calendar
              </Button>
            )}
          </div>

          {sessions.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="No sessions scheduled"
              description="Sessions for this cohort haven't been scheduled yet. Check back later."
            />
          ) : (
            <div className="space-y-3">
              {/* Upcoming sessions */}
              {upcomingSessions.length > 0 && (
                <>
                  {upcomingSessions.length > 0 &&
                    pastSessions.length > 0 && (
                      <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                        Upcoming
                      </p>
                    )}
                  {upcomingSessions
                    .filter((s) => s.id !== nextSession?.id)
                    .map((session) => (
                      <CohortSessionCard
                        key={session.id}
                        session={session}
                        userTimezone={userTimezone}
                        programId={programId}
                        showModuleLink
                      />
                    ))}
                </>
              )}

              {/* Past sessions */}
              {pastSessions.length > 0 && (
                <>
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mt-4">
                    Past Sessions
                  </p>
                  {pastSessions.map((session) => (
                    <CohortSessionCard
                      key={session.id}
                      session={session}
                      userTimezone={userTimezone}
                      programId={programId}
                      showModuleLink={false}
                    />
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        {/* Progress + Group row */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Module Progress */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Module Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {moduleProgress.completed} of {moduleProgress.total} modules
                    completed
                  </span>
                  <span className="font-medium">{progressPercent}%</span>
                </div>
                <Progress value={progressPercent} className="h-2" />
              </div>
            </CardContent>
          </Card>

          {/* Group Section */}
          {group && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <UsersRound className="h-5 w-5" />
                  Your Group
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{group.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {group.member_count} member
                      {group.member_count !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/groups/${group.id}`}>
                      View Group
                      <ChevronRight className="ml-1 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </SessionMismatchGuard>
  );
}
