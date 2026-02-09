import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ManualCompletionControlsProps {
  enrollmentId?: string;
  moduleProgressId?: string;
  moduleId?: string; // For creating progress if it doesn't exist
  type: "enrollment" | "module";
  isCompleted?: boolean; // Current completion status
  onSuccess?: () => void;
}

export function ManualCompletionControls({
  enrollmentId,
  moduleProgressId,
  moduleId,
  type,
  isCompleted = false,
  onSuccess,
}: ManualCompletionControlsProps) {
  const queryClient = useQueryClient();

  const completeModuleMutation = useMutation({
    mutationFn: async () => {
      if (moduleProgressId) {
        // Update existing progress record
        const { error } = await supabase
          .from("module_progress")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
          })
          .eq("id", moduleProgressId);

        if (error) throw error;
      } else if (enrollmentId && moduleId) {
        // Create new progress record and mark as complete
        const { error } = await supabase
          .from("module_progress")
          .insert({
            enrollment_id: enrollmentId,
            module_id: moduleId,
            status: "completed",
            completed_at: new Date().toISOString(),
          });

        if (error) throw error;
      } else {
        throw new Error("Either moduleProgressId or both enrollmentId and moduleId required");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["module-progress"] });
      toast.success("Module marked as complete");
      onSuccess?.();
    },
    onError: (error) => {
      console.error("Error completing module:", error);
      toast.error("Failed to mark module as complete");
    },
  });

  const uncompleteModuleMutation = useMutation({
    mutationFn: async () => {
      if (moduleProgressId) {
        // Update existing progress record to in_progress
        const { error } = await supabase
          .from("module_progress")
          .update({
            status: "in_progress",
            completed_at: null,
          })
          .eq("id", moduleProgressId);

        if (error) throw error;
      } else {
        throw new Error("Module progress ID required to mark as not completed");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["module-progress"] });
      toast.success("Module marked as not completed");
      onSuccess?.();
    },
    onError: (error) => {
      console.error("Error uncompleting module:", error);
      toast.error("Failed to mark module as not completed");
    },
  });

  const completeEnrollmentMutation = useMutation({
    mutationFn: async () => {
      if (!enrollmentId) throw new Error("Enrollment ID required");

      // Get all module progress for this enrollment
      const { data: moduleProgress, error: fetchError } = await supabase
        .from("module_progress")
        .select("id")
        .eq("enrollment_id", enrollmentId);

      if (fetchError) throw fetchError;

      // Mark all modules as complete
      if (moduleProgress && moduleProgress.length > 0) {
        const { error: updateModulesError } = await supabase
          .from("module_progress")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
          })
          .eq("enrollment_id", enrollmentId);

        if (updateModulesError) throw updateModulesError;
      }

      // Mark enrollment as complete
      const { error: updateEnrollmentError } = await supabase
        .from("client_enrollments")
        .update({
          status: "completed",
          end_date: new Date().toISOString(),
        })
        .eq("id", enrollmentId);

      if (updateEnrollmentError) throw updateEnrollmentError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-enrollments"] });
      queryClient.invalidateQueries({ queryKey: ["module-progress"] });
      toast.success("Program marked as complete");
      onSuccess?.();
    },
    onError: (error) => {
      console.error("Error completing enrollment:", error);
      toast.error("Failed to mark program as complete");
    },
  });

  if (type === "module") {
    if (isCompleted) {
      return (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm">
              <XCircle className="h-4 w-4 mr-2" />
              Mark Not Complete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Mark Module as Not Complete</AlertDialogTitle>
              <AlertDialogDescription>
                This will revert this module to in-progress status for the client. Are you sure?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => uncompleteModuleMutation.mutate()}>
                Mark Not Complete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      );
    }

    return (
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" size="sm">
            <CheckCircle className="h-4 w-4 mr-2" />
            Mark Complete
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark Module as Complete</AlertDialogTitle>
            <AlertDialogDescription>
              This will manually mark this module as completed for the client. Are you sure?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => completeModuleMutation.mutate()}>
              Mark Complete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm">
          <CheckCircle className="h-4 w-4 mr-2" />
          Mark Program Complete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Mark Program as Complete</AlertDialogTitle>
          <AlertDialogDescription>
            This will mark all modules and the entire program as completed for this client. Are
            you sure?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => completeEnrollmentMutation.mutate()}>
            Mark Complete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
