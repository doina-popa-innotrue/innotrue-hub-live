import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  FileText,
  ChevronRight,
  Clock,
  CheckCircle2,
  Send,
  Shield,
  Award,
  Play,
  Loader2,
} from "lucide-react";
import {
  useScenariosForModule,
  useScenarioAssignments,
  useScenarioProgress,
} from "@/hooks/useScenarios";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { ScenarioAssignment } from "@/types/scenarios";

interface ModuleScenariosSectionProps {
  moduleId: string;
  enrollmentId?: string;
}

export function ModuleScenariosSection({ moduleId, enrollmentId }: ModuleScenariosSectionProps) {
  const { user } = useAuth();
  const { data: linkedScenarios, isLoading: scenariosLoading } = useScenariosForModule(moduleId);
  // Only fetch assignments for the current user to avoid permission issues
  const {
    data: assignments,
    isLoading: assignmentsLoading,
    refetch: refetchAssignments,
  } = useScenarioAssignments({ userId: user?.id });

  const isLoading = scenariosLoading || assignmentsLoading;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!linkedScenarios || linkedScenarios.length === 0) {
    return null;
  }

  // Match linked scenarios with any existing assignments for the current user
  const scenariosWithAssignments = linkedScenarios.map((linked) => {
    const assignment = assignments?.find(
      (a) => a.template_id === linked.template_id && a.user_id === user?.id,
    );
    return {
      linked,
      assignment,
    };
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Scenario Assessments
        </CardTitle>
        <CardDescription>
          Complete these scenario-based assessments as part of this module
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {scenariosWithAssignments.map(({ linked, assignment }) => (
          <ScenarioItem
            key={linked.id}
            templateId={linked.template_id}
            moduleScenarioId={linked.id}
            title={linked.scenario_templates?.title || "Untitled Scenario"}
            description={linked.scenario_templates?.description}
            isProtected={linked.scenario_templates?.is_protected || false}
            isRequiredForCertification={linked.is_required_for_certification}
            assignment={assignment}
            moduleId={moduleId}
            enrollmentId={enrollmentId}
            onAssignmentCreated={refetchAssignments}
          />
        ))}
      </CardContent>
    </Card>
  );
}

interface ScenarioItemProps {
  templateId: string;
  moduleScenarioId: string;
  title: string;
  description?: string | null;
  isProtected: boolean;
  isRequiredForCertification: boolean;
  assignment?: ScenarioAssignment;
  moduleId: string;
  enrollmentId?: string;
  onAssignmentCreated: () => void;
}

function ScenarioItem({
  templateId,
  moduleScenarioId,
  title,
  description,
  isProtected,
  isRequiredForCertification,
  assignment,
  moduleId,
  enrollmentId,
  onAssignmentCreated,
}: ScenarioItemProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isStarting, setIsStarting] = useState(false);
  const { data: progress } = useScenarioProgress(templateId, assignment?.id);

  const statusConfig = {
    draft: {
      label: "In Progress",
      variant: "secondary" as const,
      icon: <Clock className="h-3 w-3" />,
    },
    submitted: {
      label: "Submitted",
      variant: "default" as const,
      icon: <Send className="h-3 w-3" />,
    },
    in_review: {
      label: "Under Review",
      variant: "outline" as const,
      icon: <Clock className="h-3 w-3" />,
    },
    evaluated: {
      label: "Completed",
      variant: "default" as const,
      icon: <CheckCircle2 className="h-3 w-3" />,
    },
  };

  const hasAssignment = !!assignment;
  const status = assignment?.status || "draft";
  const config = statusConfig[status];

  const handleStartScenario = async () => {
    if (!user) return;

    setIsStarting(true);
    try {
      // Create a new assignment for this user
      const { data: newAssignment, error } = await supabase
        .from("scenario_assignments")
        .insert({
          template_id: templateId,
          user_id: user.id,
          module_id: moduleId,
          enrollment_id: enrollmentId || null,
          status: "draft",
        })
        .select("id")
        .single();

      if (error) throw error;

      toast.success("Scenario started!");
      onAssignmentCreated();

      // Navigate to the scenario
      navigate(`/scenarios/${newAssignment.id}`);
    } catch (error: any) {
      console.error("Error starting scenario:", error);
      toast.error("Failed to start scenario");
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-medium">{title}</h4>
            {isProtected && (
              <Shield className="h-3.5 w-3.5 text-muted-foreground" aria-label="IP Protected" />
            )}
            {isRequiredForCertification && (
              <Badge variant="outline" className="text-xs gap-1">
                <Award className="h-3 w-3" />
                Required
              </Badge>
            )}
          </div>
          {description && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{description}</p>
          )}
        </div>

        {hasAssignment ? (
          <Badge variant={config.variant} className="flex items-center gap-1 shrink-0">
            {config.icon}
            {config.label}
          </Badge>
        ) : (
          <Badge variant="outline" className="shrink-0">
            Not Started
          </Badge>
        )}
      </div>

      {/* Progress bar for draft assignments */}
      {hasAssignment && status === "draft" && progress && progress.total > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Progress</span>
            <span>
              {progress.answered}/{progress.total} responses
            </span>
          </div>
          <Progress value={progress.percentage} className="h-2" />
        </div>
      )}

      {/* Action button */}
      {hasAssignment ? (
        <Button
          asChild
          size="sm"
          variant={status === "evaluated" ? "outline" : "default"}
          className="w-full sm:w-auto"
        >
          <Link to={`/scenarios/${assignment.id}`}>
            {status === "draft" ? "Continue" : status === "evaluated" ? "View Results" : "View"}
            <ChevronRight className="h-4 w-4 ml-1" />
          </Link>
        </Button>
      ) : (
        <Button
          size="sm"
          onClick={handleStartScenario}
          disabled={isStarting}
          className="w-full sm:w-auto"
        >
          {isStarting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Play className="h-4 w-4 mr-2" />
          )}
          Start Scenario
        </Button>
      )}
    </div>
  );
}
