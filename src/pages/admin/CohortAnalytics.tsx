import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  CalendarDays,
  Users,
  CheckCircle2,
  AlertTriangle,
  BarChart3,
  TrendingUp,
  BookOpen,
} from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { PageLoadingState } from "@/components/ui/page-loading-state";
import { EmptyState } from "@/components/ui/empty-state";

interface CohortAnalytic {
  id: string;
  name: string;
  status: string;
  program_name: string;
  program_id: string;
  start_date: string | null;
  end_date: string | null;
  max_capacity: number | null;
  enrolled_count: number;
  total_sessions: number;
  average_attendance_pct: number;
  module_completion_pct: number;
  at_risk_count: number;
}

interface AtRiskClient {
  user_id: string;
  name: string;
  email: string;
  cohort_name: string;
  cohort_id: string;
  attendance_pct: number;
  module_completion_pct: number;
  reason: string;
}

export default function CohortAnalytics() {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-cohort-analytics"],
    queryFn: async () => {
      // 1. Load all cohorts
      const { data: cohorts, error: cohortsError } = await supabase
        .from("program_cohorts")
        .select(`
          id, name, status, start_date, end_date, max_capacity, program_id,
          programs ( name )
        `)
        .in("status", ["active", "upcoming"])
        .order("start_date", { ascending: false });

      if (cohortsError) throw cohortsError;
      if (!cohorts || cohorts.length === 0) return { cohorts: [], atRisk: [] };

      const cohortIds = cohorts.map((c) => c.id);

      // 2. Load enrollments per cohort
      const { data: enrollments } = await supabase
        .from("client_enrollments")
        .select("id, cohort_id, client_user_id, program_id")
        .in("cohort_id", cohortIds)
        .eq("status", "active");

      const enrollmentsByCohort: Record<string, typeof enrollments> = {};
      (enrollments || []).forEach((e: any) => {
        if (!enrollmentsByCohort[e.cohort_id]) enrollmentsByCohort[e.cohort_id] = [];
        enrollmentsByCohort[e.cohort_id].push(e);
      });

      // 3. Load session counts
      const { data: sessions } = await supabase
        .from("cohort_sessions")
        .select("id, cohort_id")
        .in("cohort_id", cohortIds);

      const sessionsByCohort: Record<string, string[]> = {};
      (sessions || []).forEach((s: any) => {
        if (!sessionsByCohort[s.cohort_id]) sessionsByCohort[s.cohort_id] = [];
        sessionsByCohort[s.cohort_id].push(s.id);
      });

      // 4. Load all attendance records for these sessions
      const allSessionIds = (sessions || []).map((s: any) => s.id);
      const { data: attendance } = allSessionIds.length > 0
        ? await supabase
            .from("cohort_session_attendance" as string)
            .select("session_id, enrollment_id, status")
            .in("session_id", allSessionIds)
        : { data: [] };

      // Attendance by session
      const attendanceBySession: Record<string, { present: number; total: number }> = {};
      ((attendance as { session_id: string; enrollment_id: string; status: string }[]) || []).forEach((a) => {
        if (!attendanceBySession[a.session_id]) attendanceBySession[a.session_id] = { present: 0, total: 0 };
        attendanceBySession[a.session_id].total++;
        if (a.status === "present") attendanceBySession[a.session_id].present++;
      });

      // Attendance by enrollment
      const attendanceByEnrollment: Record<string, { present: number; total: number }> = {};
      ((attendance as { session_id: string; enrollment_id: string; status: string }[]) || []).forEach((a) => {
        if (!attendanceByEnrollment[a.enrollment_id]) attendanceByEnrollment[a.enrollment_id] = { present: 0, total: 0 };
        attendanceByEnrollment[a.enrollment_id].total++;
        if (a.status === "present") attendanceByEnrollment[a.enrollment_id].present++;
      });

      // 5. Load module progress for enrolled users
      const enrollmentIds = (enrollments || []).map((e: any) => e.id);
      const { data: moduleProgress } = enrollmentIds.length > 0
        ? await supabase
            .from("module_progress")
            .select("enrollment_id, status")
            .in("enrollment_id", enrollmentIds)
        : { data: [] };

      // Module completion by enrollment
      const modulesByEnrollment: Record<string, { completed: number; total: number }> = {};
      (moduleProgress || []).forEach((mp: any) => {
        if (!modulesByEnrollment[mp.enrollment_id]) modulesByEnrollment[mp.enrollment_id] = { completed: 0, total: 0 };
        modulesByEnrollment[mp.enrollment_id].total++;
        if (mp.status === "completed") modulesByEnrollment[mp.enrollment_id].completed++;
      });

      // 6. Load profiles for all enrolled users
      const userIds = [...new Set((enrollments || []).map((e: any) => e.client_user_id))];
      const { data: profiles } = userIds.length > 0
        ? await supabase.from("profiles").select("id, name, username").in("id", userIds)
        : { data: [] };
      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

      // Build cohort analytics
      const cohortAnalytics: CohortAnalytic[] = cohorts.map((c: any) => {
        const cohortEnrollments = enrollmentsByCohort[c.id] || [];
        const cohortSessionIds = sessionsByCohort[c.id] || [];
        const totalSessions = cohortSessionIds.length;

        // Average attendance %
        let totalAttendancePct = 0;
        let sessionsWithAttendance = 0;
        cohortSessionIds.forEach((sid) => {
          const stats = attendanceBySession[sid];
          if (stats && stats.total > 0) {
            totalAttendancePct += (stats.present / stats.total) * 100;
            sessionsWithAttendance++;
          }
        });
        const avgAttendance = sessionsWithAttendance > 0 ? Math.round(totalAttendancePct / sessionsWithAttendance) : 0;

        // Module completion %
        let totalCompletionPct = 0;
        let enrollmentsWithModules = 0;
        cohortEnrollments.forEach((e: any) => {
          const mp = modulesByEnrollment[e.id];
          if (mp && mp.total > 0) {
            totalCompletionPct += (mp.completed / mp.total) * 100;
            enrollmentsWithModules++;
          }
        });
        const avgCompletion = enrollmentsWithModules > 0 ? Math.round(totalCompletionPct / enrollmentsWithModules) : 0;

        // At-risk count (attendance < 60% OR module completion < 30%)
        let atRisk = 0;
        cohortEnrollments.forEach((e: any) => {
          const att = attendanceByEnrollment[e.id];
          const mp = modulesByEnrollment[e.id];
          const attPct = att && att.total > 0 ? (att.present / att.total) * 100 : 100;
          const compPct = mp && mp.total > 0 ? (mp.completed / mp.total) * 100 : 100;
          if (attPct < 60 || compPct < 30) atRisk++;
        });

        return {
          id: c.id,
          name: c.name,
          status: c.status,
          program_name: c.programs?.name || "",
          program_id: c.program_id,
          start_date: c.start_date,
          end_date: c.end_date,
          max_capacity: c.max_capacity,
          enrolled_count: cohortEnrollments.length,
          total_sessions: totalSessions,
          average_attendance_pct: avgAttendance,
          module_completion_pct: avgCompletion,
          at_risk_count: atRisk,
        };
      });

      // Build at-risk clients list
      const atRiskClients: AtRiskClient[] = [];
      cohorts.forEach((c: any) => {
        const cohortEnrollments = enrollmentsByCohort[c.id] || [];
        cohortEnrollments.forEach((e: any) => {
          const att = attendanceByEnrollment[e.id];
          const mp = modulesByEnrollment[e.id];
          const attPct = att && att.total > 0 ? Math.round((att.present / att.total) * 100) : 100;
          const compPct = mp && mp.total > 0 ? Math.round((mp.completed / mp.total) * 100) : 100;

          const reasons: string[] = [];
          if (att && att.total > 0 && attPct < 60) reasons.push(`${attPct}% attendance`);
          if (mp && mp.total > 0 && compPct < 30) reasons.push(`${compPct}% module completion`);

          if (reasons.length > 0) {
            const profile = profileMap.get(e.client_user_id);
            atRiskClients.push({
              user_id: e.client_user_id,
              name: profile?.name || "Unknown",
              email: profile?.username || "",
              cohort_name: c.name,
              cohort_id: c.id,
              attendance_pct: attPct,
              module_completion_pct: compPct,
              reason: reasons.join(", "),
            });
          }
        });
      });

      return { cohorts: cohortAnalytics, atRisk: atRiskClients };
    },
  });

  if (isLoading) return <PageLoadingState />;

  const cohorts = data?.cohorts || [];
  const atRiskClients = data?.atRisk || [];

  // Summary stats
  const totalEnrolled = cohorts.reduce((sum, c) => sum + c.enrolled_count, 0);
  const avgAttendanceAll = cohorts.length > 0
    ? Math.round(cohorts.reduce((sum, c) => sum + c.average_attendance_pct, 0) / cohorts.length)
    : 0;
  const avgCompletionAll = cohorts.length > 0
    ? Math.round(cohorts.reduce((sum, c) => sum + c.module_completion_pct, 0) / cohorts.length)
    : 0;

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Cohort Analytics</h1>
        <p className="text-muted-foreground">
          Attendance, completion, and at-risk indicators across all active cohorts
        </p>
      </div>

      {cohorts.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No Active Cohorts"
          description="Create cohorts in your programs to see analytics here."
        />
      ) : (
        <>
          {/* Summary stats */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Cohorts</CardTitle>
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{cohorts.length}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Enrolled</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalEnrolled}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Attendance</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{avgAttendanceAll}%</div>
                <Progress value={avgAttendanceAll} className="mt-2 h-1.5" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Completion</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{avgCompletionAll}%</div>
                <Progress value={avgCompletionAll} className="mt-2 h-1.5" />
              </CardContent>
            </Card>

            <Card className={atRiskClients.length > 0 ? "border-amber-500/50" : ""}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">At Risk</CardTitle>
                <AlertTriangle className={`h-4 w-4 ${atRiskClients.length > 0 ? "text-amber-500" : "text-muted-foreground"}`} />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${atRiskClients.length > 0 ? "text-amber-600" : ""}`}>
                  {atRiskClients.length}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  &lt;60% attendance or &lt;30% completion
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Cohort cards */}
          <div>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Cohort Breakdown
            </h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {cohorts.map((cohort) => (
                <Card key={cohort.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{cohort.name}</CardTitle>
                        <CardDescription className="flex items-center gap-1 mt-1">
                          <BookOpen className="h-3.5 w-3.5" />
                          {cohort.program_name}
                        </CardDescription>
                      </div>
                      <Badge variant={cohort.status === "active" ? "default" : "outline"}>
                        {cohort.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Date range */}
                    {cohort.start_date && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {format(new Date(cohort.start_date), "MMM d")}
                        {cohort.end_date && ` – ${format(new Date(cohort.end_date), "MMM d, yyyy")}`}
                      </p>
                    )}

                    {/* Metrics */}
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">Enrolled</p>
                        <p className="font-semibold">
                          {cohort.enrolled_count}
                          {cohort.max_capacity ? ` / ${cohort.max_capacity}` : ""}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Sessions</p>
                        <p className="font-semibold">{cohort.total_sessions}</p>
                      </div>
                    </div>

                    {/* Attendance */}
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Attendance</span>
                        <span className="font-medium">{cohort.average_attendance_pct}%</span>
                      </div>
                      <Progress
                        value={cohort.average_attendance_pct}
                        className={`h-1.5 ${cohort.average_attendance_pct < 60 ? "[&>div]:bg-amber-500" : ""}`}
                      />
                    </div>

                    {/* Completion */}
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Module Completion</span>
                        <span className="font-medium">{cohort.module_completion_pct}%</span>
                      </div>
                      <Progress
                        value={cohort.module_completion_pct}
                        className={`h-1.5 ${cohort.module_completion_pct < 30 ? "[&>div]:bg-red-500" : ""}`}
                      />
                    </div>

                    {/* At-risk badge */}
                    {cohort.at_risk_count > 0 && (
                      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-400">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        {cohort.at_risk_count} at-risk client{cohort.at_risk_count !== 1 ? "s" : ""}
                      </Badge>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => navigate(`/admin/programs/${cohort.program_id}`)}
                    >
                      Manage Cohort
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* At-risk clients */}
          {atRiskClients.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                At-Risk Clients ({atRiskClients.length})
              </h2>
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-2">
                    {atRiskClients.map((client, idx) => (
                      <div
                        key={`${client.user_id}-${client.cohort_id}-${idx}`}
                        className="flex items-center justify-between gap-3 py-2 px-3 rounded hover:bg-muted/50"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-sm">{client.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {client.cohort_name} · {client.email}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge
                            variant="outline"
                            className="text-xs bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400"
                          >
                            {client.reason}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
