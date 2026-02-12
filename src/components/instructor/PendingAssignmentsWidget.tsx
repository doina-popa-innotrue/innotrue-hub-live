import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClipboardCheck, Clock, ArrowRight, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface AssignmentSummary {
  total: number;
  overdue: number;
  dueSoon: number;
  recent: number;
}

export function PendingAssignmentsWidget() {
  const { user, userRole, userRoles } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<AssignmentSummary>({
    total: 0,
    overdue: 0,
    dueSoon: 0,
    recent: 0,
  });

  useEffect(() => {
    if (user) {
      loadAssignmentSummary();
    }
  }, [user, userRole]);

  const loadAssignmentSummary = async () => {
    try {
      setLoading(true);

      const showInstructor = userRole === "instructor";
      const showCoach = userRole === "coach";
      const userId = user?.id ?? "";

      const programInstructorPromise =
        showInstructor && userRoles.includes("instructor") && userId
          ? supabase.from("program_instructors").select("program_id").eq("instructor_id", userId)
          : Promise.resolve({ data: [], error: null });

      const programCoachPromise =
        showCoach && userRoles.includes("coach") && userId
          ? supabase.from("program_coaches").select("program_id").eq("coach_id", userId)
          : Promise.resolve({ data: [], error: null });

      const moduleInstructorPromise =
        showInstructor && userRoles.includes("instructor") && userId
          ? supabase.from("module_instructors").select("module_id").eq("instructor_id", userId)
          : Promise.resolve({ data: [], error: null });

      const moduleCoachPromise =
        showCoach && userRoles.includes("coach") && userId
          ? supabase.from("module_coaches").select("module_id").eq("coach_id", userId)
          : Promise.resolve({ data: [], error: null });

      const [instructorPrograms, coachPrograms, instructorModules, coachModules] =
        await Promise.all([
          programInstructorPromise,
          programCoachPromise,
          moduleInstructorPromise,
          moduleCoachPromise,
        ]);

      const programIds = new Set([
        ...(instructorPrograms.data || []).map((p) => p.program_id),
        ...(coachPrograms.data || []).map((p) => p.program_id),
      ]);

      const moduleIds = new Set([
        ...(instructorModules.data || []).map((m) => m.module_id),
        ...(coachModules.data || []).map((m) => m.module_id),
      ]);

      if (programIds.size === 0 && moduleIds.size === 0) {
        setSummary({ total: 0, overdue: 0, dueSoon: 0, recent: 0 });
        setLoading(false);
        return;
      }

      let allModuleIds = new Set(moduleIds);
      if (programIds.size > 0) {
        const { data: programModules } = await supabase
          .from("program_modules")
          .select("id")
          .in("program_id", Array.from(programIds))
          .eq("is_active", true);

        programModules?.forEach((m) => allModuleIds.add(m.id));
      }

      if (allModuleIds.size === 0) {
        setSummary({ total: 0, overdue: 0, dueSoon: 0, recent: 0 });
        setLoading(false);
        return;
      }

      const { data: moduleProgressData } = await supabase
        .from("module_progress")
        .select("id")
        .in("module_id", Array.from(allModuleIds));

      if (!moduleProgressData || moduleProgressData.length === 0) {
        setSummary({ total: 0, overdue: 0, dueSoon: 0, recent: 0 });
        setLoading(false);
        return;
      }

      const progressIds = moduleProgressData.map((mp) => mp.id);

      const { data: assignments, error } = await supabase
        .from("module_assignments")
        .select("id, created_at, status")
        .in("module_progress_id", progressIds)
        .in("status", ["submitted", "pending", "in_progress", "draft"]);

      if (error) throw error;

      if (!assignments || assignments.length === 0) {
        setSummary({ total: 0, overdue: 0, dueSoon: 0, recent: 0 });
        setLoading(false);
        return;
      }

      const now = new Date();
      let overdue = 0;
      let dueSoon = 0;
      let recent = 0;

      assignments.forEach((a) => {
        const createdAt = new Date(a.created_at);
        const daysPending = Math.floor(
          (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24),
        );

        if (daysPending >= 7) overdue++;
        else if (daysPending >= 3) dueSoon++;
        else recent++;
      });

      setSummary({
        total: assignments.length,
        overdue,
        dueSoon,
        recent,
      });
    } catch (error) {
      console.error("Error loading assignment summary:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" />
            Pending Assignments
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" />
            Pending Assignments
          </CardTitle>
          {summary.total > 0 && (
            <Badge variant={summary.overdue > 0 ? "destructive" : "default"}>{summary.total}</Badge>
          )}
        </div>
        <CardDescription>Client assignments awaiting your review</CardDescription>
      </CardHeader>
      <CardContent>
        {summary.total === 0 ? (
          <div className="text-center py-4 text-muted-foreground">
            <ClipboardCheck className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No pending assignments</p>
            <p className="text-sm">You're all caught up!</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="space-y-1">
                <div className="text-2xl font-bold text-destructive">{summary.overdue}</div>
                <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                  <Clock className="h-3 w-3" />
                  Overdue
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold text-warning">{summary.dueSoon}</div>
                <div className="text-xs text-muted-foreground">Due Soon</div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold text-success">{summary.recent}</div>
                <div className="text-xs text-muted-foreground">Recent</div>
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigate("/teaching/assignments")}
            >
              View All Assignments
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
