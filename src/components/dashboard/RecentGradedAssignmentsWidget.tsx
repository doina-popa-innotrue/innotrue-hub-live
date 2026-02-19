import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ClipboardCheck, ArrowRight, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";

interface GradedAssignment {
  id: string;
  assignment_type_name: string;
  scored_at: string;
  scorer_name: string;
  module_id: string;
  module_title: string;
  program_id: string;
  program_title: string;
}

export function RecentGradedAssignmentsWidget() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [gradedAssignments, setGradedAssignments] = useState<GradedAssignment[]>([]);

  useEffect(() => {
    if (user) {
      loadRecentGradedAssignments();
    }
  }, [user]);

  const loadRecentGradedAssignments = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Get user's enrollments
      const { data: enrollments } = await supabase
        .from("client_enrollments")
        .select("id, program_id")
        .eq("client_user_id", user.id);

      if (!enrollments || enrollments.length === 0) {
        setGradedAssignments([]);
        setLoading(false);
        return;
      }

      const enrollmentIds = enrollments.map((e) => e.id);

      // Get module progress for these enrollments
      const { data: moduleProgress } = await supabase
        .from("module_progress")
        .select("id, module_id, enrollment_id")
        .in("enrollment_id", enrollmentIds);

      if (!moduleProgress || moduleProgress.length === 0) {
        setGradedAssignments([]);
        setLoading(false);
        return;
      }

      const progressIds = moduleProgress.map((mp) => mp.id);

      // Get recently graded assignments (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: assignments, error } = await supabase
        .from("module_assignments")
        .select(
          `
          id,
          scored_at,
          scored_by,
          module_progress_id,
          module_assignment_types!inner(name)
        `,
        )
        .in("module_progress_id", progressIds)
        .eq("status", "reviewed")
        .not("scored_at", "is", null)
        .gte("scored_at", sevenDaysAgo.toISOString())
        .order("scored_at", { ascending: false })
        .limit(5);

      if (error) throw error;

      if (!assignments || assignments.length === 0) {
        setGradedAssignments([]);
        setLoading(false);
        return;
      }

      // Enrich with module, program, and scorer info
      const enrichedAssignments: GradedAssignment[] = [];

      for (const assignment of assignments) {
        const progress = moduleProgress.find((mp) => mp.id === assignment.module_progress_id);
        if (!progress) continue;

        const enrollment = enrollments.find((e) => e.id === progress.enrollment_id);
        if (!enrollment) continue;

        // Get module title
        const { data: moduleData } = (await supabase
          .from("program_modules")
          .select("title")
          .eq("id", progress.module_id)
          .single()) as { data: { title: string } | null; error: any };

        // Get program name
        const { data: programData } = (await supabase
          .from("programs")
          .select("name")
          .eq("id", enrollment.program_id)
          .single()) as { data: { name: string } | null; error: any };

        // Get scorer name
        let scorerName = "Instructor";
        if (assignment.scored_by) {
          const { data: scorerProfile } = await supabase
            .from("profiles")
            .select("name")
            .eq("id", assignment.scored_by)
            .single();
          scorerName = scorerProfile?.name || "Instructor";
        }

        enrichedAssignments.push({
          id: assignment.id,
          assignment_type_name: (assignment.module_assignment_types as any)?.name || "Assignment",
          scored_at: assignment.scored_at!,
          scorer_name: scorerName,
          module_id: progress.module_id,
          module_title: (moduleData as any)?.title || "Module",
          program_id: enrollment.program_id,
          program_title: (programData as any)?.name || "Program",
        });
      }

      setGradedAssignments(enrichedAssignments);
    } catch (error) {
      console.error("Error loading graded assignments:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return null; // Don't show loading state, just hide until loaded
  }

  if (gradedAssignments.length === 0) {
    return (
      <EmptyState
        icon={ClipboardCheck}
        title="No recently graded assignments"
        description="Graded assignments from the past 7 days will appear here"
      />
    );
  }

  return (
    <Card className="border-success/30 bg-success/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-success" />
            Recently Graded Assignments
          </CardTitle>
          <Badge variant="secondary" className="bg-success/15 text-success">
            {gradedAssignments.length} new
          </Badge>
        </div>
        <CardDescription>Your assignments that have been reviewed</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {gradedAssignments.map((assignment) => (
          <div
            key={assignment.id}
            className="flex items-center justify-between p-3 bg-background rounded-lg border hover:border-success/50 transition-colors cursor-pointer"
            onClick={() =>
              navigate(`/programs/${assignment.program_id}/modules/${assignment.module_id}`)
            }
          >
            <div className="flex items-start gap-3">
              <ClipboardCheck className="h-5 w-5 text-success mt-0.5" />
              <div>
                <p className="font-medium text-sm">{assignment.assignment_type_name}</p>
                <p className="text-xs text-muted-foreground">
                  {assignment.module_title} • {assignment.program_title}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Reviewed by {assignment.scorer_name} •{" "}
                  {formatDistanceToNow(new Date(assignment.scored_at), { addSuffix: true })}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="shrink-0">
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
