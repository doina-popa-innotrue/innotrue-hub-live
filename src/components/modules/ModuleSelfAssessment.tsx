import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, CheckCircle2, ArrowRight, User, UserCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";

interface ModuleSelfAssessmentProps {
  moduleId: string;
  enrollmentId: string;
}

export function ModuleSelfAssessment({ moduleId, enrollmentId }: ModuleSelfAssessmentProps) {
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

  // Fetch user's existing snapshots for this assessment (both self and evaluator)
  const { data: snapshots } = useQuery({
    queryKey: ["user-assessment-snapshots", assessment?.id, user?.id, enrollmentId],
    queryFn: async () => {
      if (!assessment?.id || !user?.id) return [];
      const { data, error } = await supabase
        .from("capability_snapshots")
        .select("id, status, completed_at, is_self_assessment, created_at, evaluator_id")
        .eq("assessment_id", assessment.id)
        .eq("user_id", user.id)
        .eq("enrollment_id", enrollmentId)
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

  const completedSelfSnapshot = snapshots?.find(
    (s) => s.status === "completed" && s.is_self_assessment,
  );
  const completedEvaluatorSnapshot = snapshots?.find(
    (s) => s.status === "completed" && !s.is_self_assessment,
  );
  const inProgressSnapshot = snapshots?.find(
    (s) => (s.status === "in_progress" || s.status === "draft") && s.is_self_assessment,
  );

  const handleStartAssessment = () => {
    // Navigate to the assessment page with enrollment context
    navigate(`/capabilities/${assessment.id}?enrollment_id=${enrollmentId}`);
  };

  const handleViewResults = () => {
    // Navigate to assessment detail page
    navigate(`/capabilities/${assessment.id}`);
  };

  const handleContinueAssessment = () => {
    if (inProgressSnapshot) {
      navigate(
        `/capabilities/${assessment.id}?snapshot_id=${inProgressSnapshot.id}&enrollment_id=${enrollmentId}`,
      );
    }
  };

  const hasAnyCompleted = completedSelfSnapshot || completedEvaluatorSnapshot;

  return (
    <Card className="border-primary/50 bg-primary/5">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Capability Assessment</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {completedSelfSnapshot && (
              <Badge variant="outline" className="flex items-center gap-1">
                <User className="h-3 w-3" />
                Self
                <CheckCircle2 className="h-3 w-3 ml-1" />
              </Badge>
            )}
            {completedEvaluatorSnapshot && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <UserCheck className="h-3 w-3" />
                Evaluator
                <CheckCircle2 className="h-3 w-3 ml-1" />
              </Badge>
            )}
            {inProgressSnapshot && !completedSelfSnapshot && (
              <Badge variant="secondary">In Progress</Badge>
            )}
          </div>
        </div>
        <CardDescription>{assessment.name}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {assessment.description && (
          <p className="text-sm text-muted-foreground">{assessment.description}</p>
        )}

        {/* Show completion status */}
        {hasAnyCompleted && (
          <div className="space-y-2 text-sm">
            {completedSelfSnapshot && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <User className="h-4 w-4" />
                <span>
                  Self-evaluation completed{" "}
                  {format(new Date(completedSelfSnapshot.completed_at!), "MMM d, yyyy")}
                </span>
              </div>
            )}
            {completedEvaluatorSnapshot && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <UserCheck className="h-4 w-4" />
                <span>
                  Evaluator graded{" "}
                  {format(new Date(completedEvaluatorSnapshot.completed_at!), "MMM d, yyyy")}
                </span>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2">
          {hasAnyCompleted ? (
            <>
              <Button onClick={handleViewResults} variant="default">
                View Results <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              {!completedSelfSnapshot && (
                <Button onClick={handleStartAssessment} variant="outline">
                  Take Self-Assessment
                </Button>
              )}
              {completedSelfSnapshot && (
                <Button onClick={handleStartAssessment} variant="outline">
                  Take Again
                </Button>
              )}
            </>
          ) : inProgressSnapshot ? (
            <>
              <Button onClick={handleContinueAssessment} variant="default">
                Continue Assessment <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button onClick={handleStartAssessment} variant="outline">
                Start New
              </Button>
            </>
          ) : (
            <Button onClick={handleStartAssessment}>
              Start Self-Assessment <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
