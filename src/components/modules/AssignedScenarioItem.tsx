import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, ChevronRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface AssignedScenarioItemProps {
  scenarioTemplateId: string;
  title: string;
  assessmentName?: string | null;
  moduleId: string;
  enrollmentId?: string;
}

export function AssignedScenarioItem({
  scenarioTemplateId,
  title,
  assessmentName,
  moduleId,
  enrollmentId,
}: AssignedScenarioItemProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      // Fetch all assignments for this template+user, newest first
      const { data: existingAssignments, error: fetchError } = await supabase
        .from("scenario_assignments")
        .select("id, status, attempt_number")
        .eq("template_id", scenarioTemplateId)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;

      // Prefer a draft assignment (most recent)
      const draft = existingAssignments?.find((a) => a.status === "draft");
      if (draft) {
        navigate(`/scenarios/${draft.id}`);
        return;
      }

      // If there's a completed/evaluated assignment, check if resubmission is allowed
      const completed = existingAssignments?.find(
        (a) => a.status === "evaluated" || a.status === "submitted" || a.status === "in_review",
      );

      if (completed) {
        // Check if template allows resubmission
        const { data: template } = await supabase
          .from("scenario_templates")
          .select("allows_resubmission")
          .eq("id", scenarioTemplateId)
          .single();

        if (template?.allows_resubmission) {
          // Create a fresh attempt
          const { data: newAssignment, error: createError } = await supabase
            .from("scenario_assignments")
            .insert({
              template_id: scenarioTemplateId,
              user_id: user.id,
              module_id: moduleId,
              enrollment_id: enrollmentId || null,
              status: "draft",
              parent_assignment_id: completed.id,
              attempt_number: (completed.attempt_number || 1) + 1,
            })
            .select("id")
            .single();

          if (createError) throw createError;

          toast.success("New attempt started!");
          navigate(`/scenarios/${newAssignment.id}`);
          return;
        }

        // Resubmission not allowed — view existing (read-only)
        navigate(`/scenarios/${completed.id}`);
        return;
      }

      // No existing assignment at all — create a new one
      const { data: newAssignment, error: createError } = await supabase
        .from("scenario_assignments")
        .insert({
          template_id: scenarioTemplateId,
          user_id: user.id,
          module_id: moduleId,
          enrollment_id: enrollmentId || null,
          status: "draft",
        })
        .select("id")
        .single();

      if (createError) throw createError;

      toast.success("Scenario started!");
      navigate(`/scenarios/${newAssignment.id}`);
    } catch (error: any) {
      console.error("Error accessing scenario:", error);
      toast.error("Failed to access scenario");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      className="w-full justify-start border-accent bg-accent/10 hover:bg-accent/20"
      onClick={handleClick}
      disabled={isLoading}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <ClipboardList className="h-4 w-4 mr-2" />
      )}
      <span className="flex-1 text-left">{title}</span>
      {assessmentName && (
        <Badge variant="secondary" className="text-xs ml-2">
          {assessmentName}
        </Badge>
      )}
      <ChevronRight className="ml-2 h-4 w-4" />
    </Button>
  );
}
