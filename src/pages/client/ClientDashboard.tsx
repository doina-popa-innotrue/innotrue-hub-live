import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RichTextDisplay } from "@/components/ui/rich-text-display";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import {
  BookOpen,
  Clock,
  AlertCircle,
  Calendar,
  Award,
  UsersRound,
  CheckCircle,
  MessageSquare,
  XCircle,
  Hourglass,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format, isAfter, isBefore, addDays, addWeeks, addMonths } from "date-fns";
import { ContinuationBanner } from "@/components/dashboard/ContinuationBanner";
import { WeeklyReflectionCard } from "@/components/dashboard/WeeklyReflectionCard";
import { JourneyProgressWidget } from "@/components/dashboard/JourneyProgressWidget";
import { RecentGradedAssignmentsWidget } from "@/components/dashboard/RecentGradedAssignmentsWidget";
import { RecentNotificationsWidget } from "@/components/dashboard/RecentNotificationsWidget";
import { RecentFeedbackWidget } from "@/components/dashboard/RecentFeedbackWidget";
import { LowBalanceAlert } from "@/components/credits/LowBalanceAlert";
import { AnnouncementsWidget } from "@/components/dashboard/AnnouncementsWidget";
import { DevelopmentHubWidget } from "@/components/dashboard/DevelopmentHubWidget";
import { DevelopmentItemsSection } from "@/components/dashboard/DevelopmentItemsSection";
import { MyGroupsSection } from "@/components/dashboard/MyGroupsSection";
import { MyCoachesSection } from "@/components/dashboard/MyCoachesSection";
import { hasTierAccess } from "@/lib/tierUtils";
import { useEntitlements } from "@/hooks/useEntitlements";
import { usePageView } from "@/hooks/useAnalytics";
import { EmptyState } from "@/components/ui/empty-state";
import { PageLoadingState } from "@/components/ui/page-loading-state";
import { CohortSessionCard, type CohortSession } from "@/components/cohort/CohortSessionCard";
import { useUserTimezone } from "@/hooks/useUserTimezone";

interface Enrollment {
  id: string;
  status: string;
  programs: {
    id: string;
    name: string;
    description: string;
    category: string;
  };
  progress: number;
  totalModules: number;
  completedModules: number;
}

interface Goal {
  id: string;
  title: string;
  category: string;
  status: string;
  progress_percentage: number;
}

interface Decision {
  id: string;
  title: string;
  status: string;
  importance: string;
  urgency: string;
  decision_date: string | null;
}

interface Task {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  quadrant: string;
}

interface Registration {
  id: string;
  status: string;
  enrollment_timeframe: string;
  created_at: string;
  programs: {
    id: string;
    name: string;
  };
}

interface ProgramInterest {
  id: string;
  status: string;
  enrollment_timeframe: string;
  preferred_tier: string | null;
  created_at: string;
  updated_at: string;
  programs: {
    id: string;
    name: string;
  };
}

interface AssessmentInterest {
  id: string;
  status: string;
  created_at: string;
  updated_at: string;
  psychometric_assessments: {
    name: string;
    provider: string | null;
  };
}

interface UpcomingSession {
  id: string;
  title: string;
  session_date: string;
  next_occurrence: Date;
  location: string | null;
  type: "group" | "module";
  // Group session fields
  group_id?: string;
  group_name?: string;
  // Module session fields
  program_id?: string;
  program_name?: string;
  module_id?: string;
  enrollment_id?: string;
}

interface GroupMembership {
  id: string;
  group_id: string;
  group_name: string;
  group_description: string | null;
  role: string;
}

interface SkillsSummary {
  total: number;
  acquired: number;
}

// Helper to calculate next occurrence of a recurring session
const getNextOccurrence = (session: any): Date => {
  const now = new Date();
  const sessionDate = new Date(session.session_date);

  if (!session.is_recurring || !session.recurrence_pattern || isAfter(sessionDate, now)) {
    return sessionDate;
  }

  if (session.recurrence_end_date && isBefore(new Date(session.recurrence_end_date), now)) {
    return sessionDate;
  }

  const pattern = session.recurrence_pattern.toLowerCase();
  let nextDate = new Date(sessionDate);

  while (isBefore(nextDate, now)) {
    switch (pattern) {
      case "daily":
        nextDate = addDays(nextDate, 1);
        break;
      case "weekly":
        nextDate = addWeeks(nextDate, 1);
        break;
      case "bi-weekly":
        nextDate = addWeeks(nextDate, 2);
        break;
      case "monthly":
        nextDate = addMonths(nextDate, 1);
        break;
      default:
        return sessionDate;
    }

    if (session.recurrence_end_date && isAfter(nextDate, new Date(session.recurrence_end_date))) {
      return sessionDate;
    }
  }

  return nextDate;
};

const hasUpcomingOccurrence = (session: any): boolean => {
  if (session.status !== "scheduled") return false;

  const now = new Date();
  const sessionDate = new Date(session.session_date);

  if (!session.is_recurring || !session.recurrence_pattern) {
    return isAfter(sessionDate, now);
  }

  const nextOccurrence = getNextOccurrence(session);
  if (!isAfter(nextOccurrence, now)) return false;
  if (session.recurrence_end_date && isAfter(nextOccurrence, new Date(session.recurrence_end_date)))
    return false;

  return true;
};

export default function ClientDashboard() {
  // Track page view for analytics
  usePageView("Dashboard");

  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [programInterests, setProgramInterests] = useState<ProgramInterest[]>([]);
  const [assessmentInterests, setAssessmentInterests] = useState<AssessmentInterest[]>([]);
  const [upcomingSessions, setUpcomingSessions] = useState<UpcomingSession[]>([]);
  const [groups, setGroups] = useState<GroupMembership[]>([]);
  const [skillsSummary, setSkillsSummary] = useState<SkillsSummary>({ total: 0, acquired: 0 });
  const [loading, setLoading] = useState(true);
  const [refetchTrigger, setRefetchTrigger] = useState(0); // Used to trigger refetch from realtime
  const [isOnContinuationPlan, setIsOnContinuationPlan] = useState(false);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [nextCohortSession, setNextCohortSession] = useState<{
    session: CohortSession;
    programId: string;
    programName: string;
    cohortName: string;
  } | null>(null);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { hasFeature } = useEntitlements();
  const { timezone: userTimezone } = useUserTimezone();

  useEffect(() => {
    async function fetchDashboardData() {
      if (!user) return;

      // Check if user is on Continuation plan + get profile name for welcome card
      const { data: profileData } = await supabase
        .from("profiles")
        .select("plan_id, name")
        .eq("id", user.id)
        .single();

      setProfileName(profileData?.name || null);

      if (profileData?.plan_id) {
        const { data: planData } = await supabase
          .from("plans")
          .select("key")
          .eq("id", profileData.plan_id)
          .single();

        setIsOnContinuationPlan(planData?.key === "continuation");
      }

      // Fetch enrollments with tier
      const { data: enrollmentsData } = await supabase
        .from("client_enrollments")
        .select(
          `
          id,
          status,
          tier,
          programs!inner (
            id,
            name,
            description,
            category
          )
        `,
        )
        .eq("client_user_id", user.id)
        .eq("status", "active");

      if (enrollmentsData) {
        const enrichedEnrollments = await Promise.all(
          enrollmentsData.map(async (enrollment) => {
            const { data: programDetails } = await supabase
              .from("programs")
              .select("tiers")
              .eq("id", enrollment.programs.id)
              .single();

            const programTiers = (programDetails?.tiers as string[]) || [];
            const userTier = (enrollment as any).tier || programTiers[0] || "essentials";

            const { data: modules } = await supabase
              .from("program_modules")
              .select("id, tier_required")
              .eq("program_id", enrollment.programs.id);

            const { data: progress } = await supabase
              .from("module_progress")
              .select("status, module_id")
              .eq("enrollment_id", enrollment.id);

            const accessibleModules = (modules || []).filter((m) =>
              hasTierAccess(programTiers, userTier, m.tier_required),
            );

            const accessibleModuleIds = new Set(accessibleModules.map((m) => m.id));
            const totalModules = accessibleModules.length;
            const completedModules = (progress || []).filter(
              (p) => p.status === "completed" && accessibleModuleIds.has(p.module_id),
            ).length;
            const progressPercentage =
              totalModules > 0 ? (completedModules / totalModules) * 100 : 0;

            return {
              ...enrollment,
              progress: Math.round(progressPercentage),
              totalModules,
              completedModules,
            };
          }),
        );
        setEnrollments(enrichedEnrollments as Enrollment[]);
      }

      // Fetch active goals
      const { data: goalsData } = await supabase
        .from("goals")
        .select("id, title, category, status, progress_percentage")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(5);
      setGoals((goalsData as Goal[]) || []);

      // Fetch active decisions
      const { data: decisionsData } = await supabase
        .from("decisions")
        .select("id, title, status, importance, urgency, decision_date")
        .eq("user_id", user.id)
        .in("status", ["upcoming", "in_progress"])
        .order("created_at", { ascending: false })
        .limit(5);
      setDecisions((decisionsData as Decision[]) || []);

      // Fetch tasks
      const { data: tasksData } = await supabase
        .from("tasks")
        .select("id, title, status, due_date, quadrant")
        .eq("user_id", user.id)
        .in("status", ["todo", "in_progress"])
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(5);
      setTasks((tasksData as Task[]) || []);

      // Fetch AC interest registrations (all statuses for tracking)
      const { data: registrationsData } = await supabase
        .from("ac_interest_registrations")
        .select(
          `
          id,
          status,
          enrollment_timeframe,
          created_at,
          programs:program_id (
            id,
            name
          )
        `,
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setRegistrations((registrationsData as Registration[]) || []);

      // Fetch assessment (psychometric) interest registrations (M2)
      const { data: assessmentInterestData } = await supabase
        .from("assessment_interest_registrations")
        .select(
          `
          id,
          status,
          created_at,
          updated_at,
          psychometric_assessments:assessment_id (
            name,
            provider
          )
        `,
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setAssessmentInterests((assessmentInterestData as AssessmentInterest[]) || []);

      // Fetch program interest registrations (all statuses for status tracking)
      const { data: programInterestData } = await supabase
        .from("program_interest_registrations")
        .select(
          `
          id,
          status,
          enrollment_timeframe,
          preferred_tier,
          created_at,
          updated_at,
          programs:program_id (
            id,
            name
          )
        `,
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setProgramInterests((programInterestData as ProgramInterest[]) || []);

      // Fetch group memberships - separate queries to avoid TypeScript issues
      const memberRecordsResult = await supabase
        .from("group_memberships" as any)
        .select("id, role, group_id")
        .eq("user_id", user.id);

      const memberRecords = memberRecordsResult.data as any[] | null;
      let activeGroups: {
        id: string;
        group_id: string;
        group_name: string;
        group_description: string | null;
        role: string;
      }[] = [];

      if (memberRecords && memberRecords.length > 0) {
        const groupIds = memberRecords.map((m: any) => m.group_id);
        const groupsResult = await supabase
          .from("groups" as any)
          .select("id, name, description, status")
          .in("id", groupIds);

        const groupsData = groupsResult.data as any[] | null;

        const groupMemberships = memberRecords.map((m: any) => ({
          ...m,
          groups: groupsData?.find((g: any) => g.id === m.group_id),
        }));

        activeGroups = groupMemberships
          .filter((gm: any) => gm.groups?.status === "active")
          .map((gm: any) => ({
            id: gm.id,
            group_id: gm.groups.id,
            group_name: gm.groups.name,
            group_description: gm.groups.description,
            role: gm.role,
          }));
        setGroups(activeGroups);
      }

      // Fetch upcoming sessions (both group and module) - OUTSIDE group membership check
      let allUpcomingSessions: UpcomingSession[] = [];

      // Fetch upcoming group sessions
      const activeGroupIds = activeGroups.map((g) => g.group_id);
      if (activeGroupIds.length > 0) {
        const { data: sessionsData } = await supabase
          .from("group_sessions")
          .select("*")
          .in("group_id", activeGroupIds);

        if (sessionsData) {
          const upcomingGroupSessions = sessionsData
            .filter(hasUpcomingOccurrence)
            .map((session) => ({
              id: session.id,
              title: session.title,
              session_date: session.session_date,
              next_occurrence: getNextOccurrence(session),
              location: session.location,
              type: "group" as const,
              group_id: session.group_id,
              group_name:
                activeGroups.find((g) => g.group_id === session.group_id)?.group_name || "",
            }));
          allUpcomingSessions = [...upcomingGroupSessions];
        }
      }

      // Fetch individual module sessions - independent of group membership
      if (enrollmentsData && enrollmentsData.length > 0) {
        const enrollmentIds = enrollmentsData.map((e) => e.id);
        const programMap = new Map(enrollmentsData.map((e) => [e.id, e.programs]));

        const { data: moduleSessions } = await supabase
          .from("module_sessions")
          .select("id, title, session_date, duration_minutes, location, enrollment_id, module_id")
          .eq("session_type", "individual")
          .in("status", ["scheduled", "confirmed"])
          .in("enrollment_id", enrollmentIds)
          .gte("session_date", new Date().toISOString())
          .order("session_date");

        if (moduleSessions) {
          const upcomingModuleSessions = moduleSessions.map((session) => {
            const program = session.enrollment_id
              ? programMap.get(session.enrollment_id)
              : undefined;
            return {
              id: session.id,
              title: session.title ?? "Untitled Session",
              session_date: session.session_date ?? "",
              next_occurrence: new Date(session.session_date ?? ""),
              location: session.location,
              type: "module" as const,
              program_id: program?.id,
              program_name: program?.name,
              module_id: session.module_id ?? undefined,
              enrollment_id: session.enrollment_id ?? undefined,
            };
          });
          allUpcomingSessions = [...allUpcomingSessions, ...upcomingModuleSessions];
        }
      }

      // Sort all sessions by date and take top 5
      allUpcomingSessions.sort((a, b) => a.next_occurrence.getTime() - b.next_occurrence.getTime());
      setUpcomingSessions(allUpcomingSessions.slice(0, 5));

      // Fetch skills summary - user_skills tracks acquired skills (no status column)
      const { count: skillsCount } = await supabase
        .from("user_skills")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      // Also get total skills available
      const { count: totalSkillsCount } = await supabase
        .from("skills")
        .select("*", { count: "exact", head: true });

      setSkillsSummary({
        total: totalSkillsCount || 0,
        acquired: skillsCount || 0,
      });

      // Fetch next cohort session (if user has any active cohort enrollment)
      const { data: cohortEnrollments } = await supabase
        .from("client_enrollments")
        .select(`
          id,
          cohort_id,
          program_cohorts (
            id, name, program_id,
            programs ( id, name )
          )
        `)
        .eq("client_user_id", user.id)
        .eq("status", "active")
        .not("cohort_id", "is", null);

      if (cohortEnrollments && cohortEnrollments.length > 0) {
        const cohortIds = cohortEnrollments
          .filter((e: any) => e.cohort_id)
          .map((e: any) => e.cohort_id);

        if (cohortIds.length > 0) {
          const today = new Date().toISOString().split("T")[0];
          const { data: nextSessions } = await supabase
            .from("cohort_sessions")
            .select("id, title, description, session_date, start_time, end_time, location, meeting_link, module_id, notes")
            .in("cohort_id", cohortIds)
            .gte("session_date", today)
            .order("session_date", { ascending: true })
            .limit(1);

          if (nextSessions && nextSessions.length > 0) {
            const nextSession = nextSessions[0];
            const enrollment = cohortEnrollments.find(
              (e: any) => e.cohort_id === (nextSession as any).cohort_id,
            ) as any;
            // Find the enrollment that owns this cohort by matching cohort_id
            const ownerEnrollment = cohortEnrollments.find((e: any) => {
              const cohort = e.program_cohorts as any;
              return cohort?.id === e.cohort_id;
            }) as any;
            const cohort = (ownerEnrollment || cohortEnrollments[0] as any).program_cohorts as any;
            const program = cohort?.programs as any;

            setNextCohortSession({
              session: nextSession as CohortSession,
              programId: program?.id || "",
              programName: program?.name || "",
              cohortName: cohort?.name || "",
            });
          }
        }
      }

      setLoading(false);
    }

    fetchDashboardData();
  }, [user, refetchTrigger]);

  // Real-time subscription for enrollments
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("client-enrollments-changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "client_enrollments",
          filter: `client_user_id=eq.${user.id}`,
        },
        async (payload) => {
          const newEnrollment = payload.new as any;
          if (newEnrollment.status === "active") {
            const { data: programData } = await supabase
              .from("programs")
              .select("id, name, description, category")
              .eq("id", newEnrollment.program_id)
              .single();

            if (programData) {
              const { data: modules } = await supabase
                .from("program_modules")
                .select("id")
                .eq("program_id", programData.id);

              const totalModules = modules?.length || 0;

              const newEnrollmentItem: Enrollment = {
                id: newEnrollment.id,
                status: newEnrollment.status,
                programs: { ...programData, description: programData.description ?? "" },
                progress: 0,
                totalModules,
                completedModules: 0,
              };

              setEnrollments((prev) => [newEnrollmentItem, ...prev]);
            }
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Real-time subscription for module sessions - auto-refresh when sessions are created/updated
  useEffect(() => {
    if (!user) return;

    // Get the user's enrollment IDs for filtering
    const fetchEnrollmentIds = async () => {
      const { data: enrollmentsData } = await supabase
        .from("client_enrollments")
        .select("id")
        .eq("client_user_id", user.id)
        .eq("status", "active");

      return enrollmentsData?.map((e) => e.id) || [];
    };

    let channel: ReturnType<typeof supabase.channel> | null = null;

    fetchEnrollmentIds().then((enrollmentIds) => {
      if (enrollmentIds.length === 0) return;

      channel = supabase
        .channel("client-module-sessions-changes")
        .on(
          "postgres_changes",
          {
            event: "*", // Listen to INSERT, UPDATE, DELETE
            schema: "public",
            table: "module_sessions",
          },
          (payload) => {
            const session = (payload.new || payload.old) as any;
            // Only refresh if the session is for one of the user's enrollments
            if (session?.enrollment_id && enrollmentIds.includes(session.enrollment_id)) {
              // Trigger refetch by incrementing the trigger state
              setRefetchTrigger((prev) => prev + 1);
            }
          },
        )
        .subscribe();
    });

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [user]);

  if (loading) {
    return <PageLoadingState message="Loading dashboard..." />;
  }

  const skillsProgress =
    skillsSummary.total > 0 ? Math.round((skillsSummary.acquired / skillsSummary.total) * 100) : 0;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">My Dashboard</h1>

      {/* Section 1: Alerts & Banners */}
      {isOnContinuationPlan && <ContinuationBanner />}
      {hasFeature("credits") && <LowBalanceAlert threshold={10} />}

      {/* Section 2: Recent Notifications */}
      <RecentNotificationsWidget />

      {/* Section 2b: Recent Feedback */}
      <RecentFeedbackWidget />

      {/* Section 3: Announcements */}
      <AnnouncementsWidget />

      {/* Section 3: Journey Progress */}
      <JourneyProgressWidget
        userName={profileName?.split(" ")[0] || undefined}
        hasProfileName={!!profileName}
        hasEnrollments={enrollments.length > 0}
      />

      {/* Section 3b: Next Cohort Session */}
      {nextCohortSession && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Next Live Session
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                navigate(`/programs/${nextCohortSession.programId}/cohort`)
              }
            >
              View Schedule
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mb-2">
            {nextCohortSession.cohortName} • {nextCohortSession.programName}
          </p>
          <CohortSessionCard
            session={nextCohortSession.session}
            userTimezone={userTimezone}
            programId={nextCohortSession.programId}
            isHighlighted
          />
        </div>
      )}

      {/* Section 4: Quick Stats Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card
          className="cursor-pointer hover:border-primary transition-colors"
          onClick={() => navigate("/programs")}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Programs</p>
                <p className="text-2xl font-bold">{enrollments.length}</p>
              </div>
              <BookOpen className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        {hasFeature("skills_map") && (
          <Card
            className="cursor-pointer hover:border-primary transition-colors"
            onClick={() => navigate("/skills")}
          >
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Skills Acquired</p>
                  <p className="text-2xl font-bold">{skillsSummary.acquired}</p>
                </div>
                <Award className="h-8 w-8 text-muted-foreground" />
              </div>
              <Progress value={skillsProgress} className="mt-2 h-1" />
            </CardContent>
          </Card>
        )}
        {hasFeature("groups") && (
          <Card
            className="cursor-pointer hover:border-primary transition-colors"
            onClick={() => navigate("/groups")}
          >
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Groups</p>
                  <p className="text-2xl font-bold">{groups.length}</p>
                </div>
                <UsersRound className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        )}
        <Card
          className="cursor-pointer hover:border-primary transition-colors"
          onClick={() => navigate("/calendar")}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Upcoming Sessions</p>
                <p className="text-2xl font-bold">{upcomingSessions.length}</p>
              </div>
              <Calendar className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Section 5: Active Programs & Upcoming Sessions */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Active Programs */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Active Programs
            </h2>
            <Button variant="ghost" size="sm" onClick={() => navigate("/programs")}>
              View All
            </Button>
          </div>
          {enrollments.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="No active programs yet"
              description="Browse available programs to get started"
              actionLabel="Explore Programs"
              actionHref="/programs/explore"
            />
          ) : (
            <div className="space-y-3">
              {enrollments.slice(0, 2).map((enrollment) => (
                <Card
                  key={enrollment.id}
                  className="hover:border-primary transition-colors cursor-pointer"
                  onClick={() => navigate(`/programs/${enrollment.programs.id}`)}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">{enrollment.programs.name}</CardTitle>
                    <RichTextDisplay
                      content={enrollment.programs.description}
                      className="text-sm text-muted-foreground line-clamp-1"
                    />
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-medium">
                          {enrollment.completedModules} / {enrollment.totalModules} modules
                        </span>
                      </div>
                      <Progress value={enrollment.progress} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming Sessions */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Upcoming Sessions
            </h2>
            <Button variant="ghost" size="sm" onClick={() => navigate("/calendar")}>
              View Calendar
            </Button>
          </div>
          {upcomingSessions.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="No upcoming sessions"
              description="Check your calendar for scheduling options"
              actionLabel="View Calendar"
              actionHref="/calendar"
            />
          ) : (
            <div className="space-y-3">
              {upcomingSessions.slice(0, 3).map((session) => (
                <Card
                  key={session.id}
                  className="hover:border-primary transition-colors cursor-pointer"
                  onClick={() =>
                    session.type === "group"
                      ? navigate(`/groups/${session.group_id}`)
                      : navigate(`/programs/${session.program_id}`)
                  }
                >
                  <CardContent className="pt-4 pb-4">
                    <div className="space-y-1">
                      <p className="font-medium truncate">{session.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {session.type === "group" ? session.group_name : session.program_name}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {format(session.next_occurrence, "MMM d, yyyy h:mm a")}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Section 6: Development Hub (Goals, Decisions, Tasks) */}
      <DevelopmentHubWidget goals={goals} decisions={decisions} tasks={tasks} />

      {/* Section 7: Development Items & Timeline */}
      <DevelopmentItemsSection />

      {/* Section 8: My Groups */}
      {hasFeature("groups") && groups.length > 0 && <MyGroupsSection groups={groups} />}

      {/* Section 9: Interest Registrations (Programs + Assessments) */}
      {(programInterests.length > 0 || registrations.length > 0 || assessmentInterests.length > 0) && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Hourglass className="h-5 w-5" />
              My Interest Registrations
            </h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {programInterests.map((interest) => {
              const statusConfig = {
                pending: {
                  icon: Clock,
                  label: "Pending",
                  variant: "secondary" as const,
                  className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
                },
                contacted: {
                  icon: MessageSquare,
                  label: "Contacted",
                  variant: "secondary" as const,
                  className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
                },
                enrolled: {
                  icon: CheckCircle,
                  label: "Enrolled",
                  variant: "secondary" as const,
                  className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
                },
                declined: {
                  icon: XCircle,
                  label: "Declined",
                  variant: "secondary" as const,
                  className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
                },
              };
              const config = statusConfig[interest.status as keyof typeof statusConfig] || statusConfig.pending;
              const StatusIcon = config.icon;
              return (
                <Card key={interest.id} className="hover:shadow-sm transition-shadow">
                  <CardContent className="pt-5 pb-4">
                    <div className="flex items-start gap-3">
                      <StatusIcon className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{interest.programs.name}</p>
                        {interest.preferred_tier && (
                          <p className="text-xs text-muted-foreground mt-0.5 capitalize">
                            Tier: {interest.preferred_tier}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Registered {format(new Date(interest.created_at), "MMM d, yyyy")}
                        </p>
                        {interest.status !== "pending" && interest.updated_at !== interest.created_at && (
                          <p className="text-xs text-muted-foreground">
                            Updated {format(new Date(interest.updated_at), "MMM d, yyyy")}
                          </p>
                        )}
                        <Badge variant={config.variant} className={`text-xs mt-2 ${config.className}`}>
                          {config.label}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {registrations.map((registration) => {
              const regStatusConfig = {
                pending: {
                  icon: Clock,
                  label: "Pending",
                  className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
                },
                contacted: {
                  icon: MessageSquare,
                  label: "Contacted",
                  className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
                },
                enrolled: {
                  icon: CheckCircle,
                  label: "Enrolled",
                  className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
                },
                declined: {
                  icon: XCircle,
                  label: "Declined",
                  className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
                },
              };
              const regConfig = regStatusConfig[registration.status as keyof typeof regStatusConfig] || regStatusConfig.pending;
              const RegIcon = regConfig.icon;
              return (
                <Card key={registration.id} className="hover:shadow-sm transition-shadow">
                  <CardContent className="pt-5 pb-4">
                    <div className="flex items-start gap-3">
                      <RegIcon className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{registration.programs.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Assessment-based interest
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Registered {format(new Date(registration.created_at), "MMM d, yyyy")}
                        </p>
                        <Badge variant="secondary" className={`text-xs mt-2 ${regConfig.className}`}>
                          {regConfig.label}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {assessmentInterests.map((ai) => {
              const aiStatusConfig = {
                pending: {
                  icon: Clock,
                  label: "Pending",
                  className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
                },
                contacted: {
                  icon: MessageSquare,
                  label: "Contacted",
                  className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
                },
                completed: {
                  icon: CheckCircle,
                  label: "Completed",
                  className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
                },
                declined: {
                  icon: XCircle,
                  label: "Declined",
                  className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
                },
              };
              const aiConfig = aiStatusConfig[ai.status as keyof typeof aiStatusConfig] || aiStatusConfig.pending;
              const AiIcon = aiConfig.icon;
              return (
                <Card key={ai.id} className="hover:shadow-sm transition-shadow">
                  <CardContent className="pt-5 pb-4">
                    <div className="flex items-start gap-3">
                      <AiIcon className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{ai.psychometric_assessments.name}</p>
                        {ai.psychometric_assessments.provider && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Provider: {ai.psychometric_assessments.provider}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Registered {format(new Date(ai.created_at), "MMM d, yyyy")}
                        </p>
                        {ai.status !== "pending" && ai.updated_at !== ai.created_at && (
                          <p className="text-xs text-muted-foreground">
                            Updated {format(new Date(ai.updated_at), "MMM d, yyyy")}
                          </p>
                        )}
                        <Badge variant="secondary" className={`text-xs mt-2 ${aiConfig.className}`}>
                          {aiConfig.label}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Section 10: Weekly Reflection */}
      {hasFeature("ai_insights") && <WeeklyReflectionCard />}

      {/* Section 11: Recently Graded Assignments */}
      <RecentGradedAssignmentsWidget />

      {/* Section 12: My Coaches & Instructors (Bottom) */}
      <MyCoachesSection />
    </div>
  );
}
