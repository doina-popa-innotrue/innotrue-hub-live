import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Calendar, ArrowRight, BookOpen, UserCheck, CalendarDays } from "lucide-react";
import { format } from "date-fns";
import { PageLoadingState } from "@/components/ui/page-loading-state";

interface Cohort {
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
  enrolled_count: number;
  session_count: number;
}

export default function InstructorCohorts() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: cohorts, isLoading } = useQuery({
    queryKey: ["teaching-cohorts", user?.id],
    queryFn: async () => {
      if (!user) return [];

      // Get program IDs from both instructor and coach assignments
      const [instructorPrograms, coachPrograms] = await Promise.all([
        supabase.from("program_instructors").select("program_id").eq("instructor_id", user.id),
        supabase.from("program_coaches").select("program_id").eq("coach_id", user.id),
      ]);

      const programIds = new Set([
        ...(instructorPrograms.data || []).map((p) => p.program_id),
        ...(coachPrograms.data || []).map((p) => p.program_id),
      ]);

      if (programIds.size === 0) return [];

      // Fetch cohorts for those programs with lead instructor + program name
      const { data: cohortsData, error: cohortsError } = await supabase
        .from("program_cohorts")
        .select(`
          id, name, description, start_date, end_date, status, max_capacity, program_id,
          lead_instructor:profiles!program_cohorts_lead_instructor_id_fkey ( name ),
          programs ( name )
        `)
        .in("program_id", Array.from(programIds))
        .order("start_date", { ascending: false });

      if (cohortsError) throw cohortsError;
      if (!cohortsData || cohortsData.length === 0) return [];

      const cohortIds = cohortsData.map((c) => c.id);

      // Get enrollment counts and session counts in parallel
      const [enrollmentCounts, sessionCounts] = await Promise.all([
        supabase
          .from("client_enrollments")
          .select("cohort_id")
          .in("cohort_id", cohortIds)
          .eq("status", "active"),
        supabase
          .from("cohort_sessions")
          .select("cohort_id")
          .in("cohort_id", cohortIds),
      ]);

      const enrollCountMap: Record<string, number> = {};
      (enrollmentCounts.data || []).forEach((e: any) => {
        enrollCountMap[e.cohort_id] = (enrollCountMap[e.cohort_id] || 0) + 1;
      });

      const sessionCountMap: Record<string, number> = {};
      (sessionCounts.data || []).forEach((s: any) => {
        sessionCountMap[s.cohort_id] = (sessionCountMap[s.cohort_id] || 0) + 1;
      });

      return cohortsData.map((c: any): Cohort => ({
        id: c.id,
        name: c.name,
        description: c.description,
        start_date: c.start_date,
        end_date: c.end_date,
        status: c.status,
        max_capacity: c.max_capacity,
        program_id: c.program_id,
        lead_instructor_name: c.lead_instructor?.name || null,
        program_name: c.programs?.name || null,
        enrolled_count: enrollCountMap[c.id] || 0,
        session_count: sessionCountMap[c.id] || 0,
      }));
    },
    enabled: !!user?.id,
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
      active: "default",
      upcoming: "outline",
      completed: "secondary",
      cancelled: "destructive",
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  if (isLoading) {
    return <PageLoadingState />;
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Cohorts</h1>
        <p className="text-muted-foreground">Manage cohorts from your assigned programs</p>
      </div>

      {!cohorts || cohorts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CalendarDays className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Cohorts Found</h3>
            <p className="text-muted-foreground">
              You don't have any cohorts associated with your assigned programs yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {cohorts.map((cohort) => (
            <Card key={cohort.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1">
                    {getStatusBadge(cohort.status)}
                    <CardTitle className="text-lg mt-2">{cohort.name}</CardTitle>
                    {cohort.description && (
                      <CardDescription className="line-clamp-2">
                        {cohort.description}
                      </CardDescription>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
                  {cohort.program_name && (
                    <div className="flex items-center gap-1">
                      <BookOpen className="h-4 w-4" />
                      <span>{cohort.program_name}</span>
                    </div>
                  )}
                  {cohort.lead_instructor_name && (
                    <div className="flex items-center gap-1">
                      <UserCheck className="h-4 w-4" />
                      <span>{cohort.lead_instructor_name}</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    <span>
                      {cohort.enrolled_count}
                      {cohort.max_capacity ? ` / ${cohort.max_capacity}` : ""} enrolled
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <CalendarDays className="h-4 w-4" />
                    <span>{cohort.session_count} session{cohort.session_count !== 1 ? "s" : ""}</span>
                  </div>
                </div>

                {(cohort.start_date || cohort.end_date) && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {cohort.start_date && format(new Date(cohort.start_date), "MMM d, yyyy")}
                      {cohort.start_date && cohort.end_date && " – "}
                      {cohort.end_date && format(new Date(cohort.end_date), "MMM d, yyyy")}
                    </span>
                  </div>
                )}

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate(`/teaching/cohorts/${cohort.id}`)}
                >
                  View Cohort
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
