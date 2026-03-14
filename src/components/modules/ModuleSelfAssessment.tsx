import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ClipboardList,
  CheckCircle2,
  ArrowRight,
  User,
  UserCheck,
  Clock,
  FileText,
  Info,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";

interface ModuleSelfAssessmentProps {
  moduleId: string;
  enrollmentId: string;
  moduleProgressId: string;
}

export function ModuleSelfAssessment({ moduleId, enrollmentId, moduleProgressId }: ModuleSelfAssessmentProps) {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Fetch the module's linked capability assessment
  const { data: moduleData } = useQuery({
    queryKey: ["module-capability-assessment", moduleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("program_modules")
        .select("capability_assessment_id")
        .eq("id", moduleId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Fetch the capability assessment details
  const { data: assessment, isLoading: assessmentLoading } = useQuery({
    queryKey: ["capability-assessment", moduleData?.capability_assessment_id],
    queryFn: async () => {
      if (!moduleData?.capability_assessment_id) return null;
      const { data, error } = await supabase
        .from("capability_assessments")
        .select("id, name, description, slug")
        .eq("id", moduleData.capability_assessment_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!moduleData?.capability_assessment_id,
  });

  // Fetch module assignments to check for scoring_snapshot_id + scenario link
  const { data: moduleAssignments } = useQuery({
    queryKey: ["module-assignment-evaluation", moduleProgressId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("module_assignments")
        .select("id, status, scoring_snapshot_id, scenario_assignment_id")
        .eq("module_progress_id", moduleProgressId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!moduleProgressId,
  });

  // Fetch the specific evaluator snapshot linked to this module's assignment
  const scoredAssignment = moduleAssignments?.find((a) => a.scoring_snapshot_id);
  const linkedSnapshotId = scoredAssignment?.scoring_snapshot_id;

  const { data: evaluatorSnapshot } = useQuery({
    queryKey: ["linked-evaluator-snapshot", linkedSnapshotId],
    queryFn: async () => {
      if (!linkedSnapshotId) return null;
      const { data, error } = await supabase
        .from("capability_snapshots")
        .select("id, status, completed_at, is_self_assessment, evaluator_id")
        .eq("id", linkedSnapshotId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!linkedSnapshotId,
  });

  // Fetch the linked scenario assignment for "View Scenario" link
  const linkedScenarioId = scoredAssignment?.scenario_assignment_id;

  const { data: linkedScenario } = useQuery({
    queryKey: ["linked-scenario-assignment", linkedScenarioId],
    queryFn: async () => {
      if (!linkedScenarioId) return null;
      const { data, error } = await supabase
        .from("scenario_assignments")
        .select("id, status, template_id, scenario_templates(title)")
        .eq("id", linkedScenarioId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!linkedScenarioId,
  });

  // Fetch user's self-assessment snapshots for this assessment (standalone activity)
  const { data: selfSnapshots } = useQuery({
    queryKey: ["user-self-assessment-snapshots", assessment?.id, user?.id, enrollmentId],
    queryFn: async () => {
      if (!assessment?.id || !user?.id) return [];
      const { data, error } = await supabase
        .from("capability_snapshots")
        .select("id, status, completed_at, is_self_assessment, created_at")
        .eq("assessment_id", assessment.id)
        .eq("user_id", user.id)
        .eq("enrollment_id", enrollmentId)
        .eq("is_self_assessment", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!assessment?.id && !!user?.id,
  });

  if (!moduleData?.capability_assessment_id || assessmentLoading) {
    return null;
  }

  if (!assessment) {
    return null;
  }

  // Derive assignment state
  const hasAssignments = (moduleAssignments?.length ?? 0) > 0;
  const anySubmitted = moduleAssignments?.some(
    (a) => a.status === "submitted" || a.status === "reviewed" || a.status === "completed",
  );
  const hasEvaluatorResults = !!evaluatorSnapshot?.status && evaluatorSnapshot.status === "completed";

  // Self-assessment state
  const completedSelfSnapshot = selfSnapshots?.find((s) => s.status === "completed");
  const inProgressSelfSnapshot = selfSnapshots?.find(
    (s) => s.status === "in_progress" || s.status === "draft",
  );

  const handleStartSelfAssessment = () => {
    navigate(`/capabilities/${assessment.id}?enrollment_id=${enrollmentId}`);
  };

  const handleViewSelfResults = () => {
    navigate(`/capabilities/${assessment.id}?view=self`);
  };

  const handleViewEvaluatorResults = () => {
    navigate(`/capabilities/${assessment.id}?view=evaluator`);
  };

  const handleContinueSelfAssessment = () => {
    if (inProgressSelfSnapshot) {
      navigate(
        `/capabilities/${assessment.id}?snapshot_id=${inProgressSelfSnapshot.id}&enrollment_id=${enrollmentId}`,
      );
    }
  };

  const handleViewScenario = () => {
    if (linkedScenario) {
      navigate(`/scenarios/${linkedScenario.id}/print`);
    }
  };

  return (
    <Card className="border-primary/50 bg-primary/5">
      <CardHeader>
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Capability Assessment</CardTitle>
        </div>
        <CardDescription>{assessment.name}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {assessment.description && (
          <p className="text-sm text-muted-foreground">{assessment.description}</p>
        )}

        {/* ── Section 1: Evaluator Assessment (tied to module assignment) ── */}
        {hasAssignments && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Evaluator Assessment</span>
            </div>

            {hasEvaluatorResults ? (
              // Evaluator has completed assessment for this assignment
              <div className="space-y-3 rounded-lg border bg-background p-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span>
                    Evaluated{" "}
                    {evaluatorSnapshot.completed_at &&
                      format(new Date(evaluatorSnapshot.completed_at), "MMM d, yyyy")}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={handleViewEvaluatorResults} variant="default" size="sm">
                    <UserCheck className="mr-1.5 h-4 w-4" />
                    Evaluator Results <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Button>
                  {linkedScenario && (
                    <Button onClick={handleViewScenario} variant="outline" size="sm">
                      <FileText className="mr-1.5 h-4 w-4" />
                      View Scenario
                    </Button>
                  )}
                </div>
              </div>
            ) : anySubmitted ? (
              // Assignment submitted but not yet evaluated
              <div className="flex items-center gap-2 rounded-lg border bg-background p-3 text-sm text-muted-foreground">
                <Clock className="h-4 w-4 text-amber-500 shrink-0" />
                <span>
                  Your assignment has been submitted. Assessment results will appear here once your evaluator completes their review.
                </span>
              </div>
            ) : (
              // Assignment not yet submitted
              <div className="flex items-center gap-2 rounded-lg border bg-background p-3 text-sm text-muted-foreground">
                <Info className="h-4 w-4 text-blue-500 shrink-0" />
                <span>
                  Your evaluator will assess your assignment and provide their feedback once you submit your work.
                </span>
              </div>
            )}
          </div>
        )}

        {/* ── Separator between sections ── */}
        {hasAssignments && <Separator />}

        {/* ── Section 2: Self-Assessment (optional when evaluator exists, standalone otherwise) ── */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Self-Assessment</span>
            {hasAssignments && (
              <Badge variant="outline" className="text-xs">Optional</Badge>
            )}
          </div>

          {hasAssignments ? (
            <p className="text-xs text-muted-foreground">
              You are free to self-assess yourself at any time. This is optional. Your evaluator will assess your assignment and provide their feedback independently.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Evaluate your own capabilities by completing this self-assessment.
            </p>
          )}

          {completedSelfSnapshot ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>
                  Completed{" "}
                  {completedSelfSnapshot.completed_at &&
                    format(new Date(completedSelfSnapshot.completed_at), "MMM d, yyyy")}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={handleViewSelfResults} variant="outline" size="sm">
                  <User className="mr-1.5 h-4 w-4" />
                  Self Results <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
                <Button onClick={handleStartSelfAssessment} variant="ghost" size="sm">
                  Take Again
                </Button>
              </div>
            </div>
          ) : inProgressSelfSnapshot ? (
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleContinueSelfAssessment} variant="outline" size="sm">
                Continue Assessment <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
              <Button onClick={handleStartSelfAssessment} variant="ghost" size="sm">
                Start New
              </Button>
            </div>
          ) : (
            <Button onClick={handleStartSelfAssessment} variant="outline" size="sm">
              Start Self-Assessment <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
