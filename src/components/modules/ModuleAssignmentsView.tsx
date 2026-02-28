import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ModuleAssignmentForm } from "./ModuleAssignmentForm";
import { ClipboardCheck } from "lucide-react";

interface AssignmentField {
  id: string;
  label: string;
  type: "text" | "textarea" | "number" | "rating" | "checkbox" | "select";
  required: boolean;
  options?: string[];
  min?: number;
  max?: number;
}

interface AssignmentType {
  id: string;
  name: string;
  description: string | null;
  structure: AssignmentField[];
  scoring_assessment_id: string | null;
}

interface ModuleAssignmentsViewProps {
  moduleId: string;
  moduleProgressId: string;
  isEditable: boolean; // true for coach/instructor, false for client
  isInstructor?: boolean; // true when instructor/coach is viewing
  hideHeader?: boolean; // true when embedded inside AssignmentSection (avoids duplicate heading)
}

export function ModuleAssignmentsView({
  moduleId,
  moduleProgressId,
  isEditable,
  isInstructor = false,
  hideHeader = false,
}: ModuleAssignmentsViewProps) {
  const { data: assignedTypes, isLoading } = useQuery({
    queryKey: ["module-assigned-assignments", moduleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("module_assignment_configs")
        .select(
          "assignment_type_id, module_assignment_types(id, name, description, structure, scoring_assessment_id)",
        )
        .eq("module_id", moduleId);
      if (error) throw error;
      return data
        .map((d) => d.module_assignment_types)
        .filter(Boolean)
        .map((t) => ({
          ...t,
          structure: (t?.structure || []) as unknown as AssignmentField[],
          scoring_assessment_id: t?.scoring_assessment_id || null,
        })) as AssignmentType[];
    },
  });

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading assignments...</div>;
  }

  if (!assignedTypes || assignedTypes.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {!hideHeader && (
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-lg">Assignments</h3>
        </div>
      )}
      {assignedTypes.map((type) => (
        <ModuleAssignmentForm
          key={type.id}
          moduleProgressId={moduleProgressId}
          moduleId={moduleId}
          assignmentType={type}
          isEditable={isEditable}
          isInstructor={isInstructor}
        />
      ))}
    </div>
  );
}
