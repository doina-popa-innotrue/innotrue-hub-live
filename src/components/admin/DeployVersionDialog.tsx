import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

interface DeployVersionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  versionId: string;
  programId: string;
  programName: string;
}

export function DeployVersionDialog({
  open,
  onOpenChange,
  versionId,
  programId,
  programName,
}: DeployVersionDialogProps) {
  const queryClient = useQueryClient();
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [resetProgress, setResetProgress] = useState(false);

  const { data: enrollments } = useQuery({
    queryKey: ["program-enrollments", programId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_enrollments")
        .select("*, profiles:client_user_id(name, id)")
        .eq("program_id", programId);

      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const deployMutation = useMutation({
    mutationFn: async () => {
      for (const enrollmentId of selectedClients) {
        // Update enrollment to use new version
        const { error: updateError } = await supabase
          .from("client_enrollments")
          .update({ program_version_id: versionId })
          .eq("id", enrollmentId);

        if (updateError) throw updateError;

        if (resetProgress) {
          // Get all module versions for this version
          const { data: moduleVersions, error: modulesError } = await supabase
            .from("program_module_versions")
            .select("original_module_id")
            .eq("version_id", versionId);

          if (modulesError) throw modulesError;

          // Delete existing progress
          const { error: deleteError } = await supabase
            .from("module_progress")
            .delete()
            .eq("enrollment_id", enrollmentId);

          if (deleteError) throw deleteError;

          // Create fresh progress entries
          const progressEntries = moduleVersions
            .filter((mv) => mv.original_module_id)
            .map((mv) => ({
              enrollment_id: enrollmentId,
              module_id: mv.original_module_id!,
              status: "not_started" as const,
            }));

          if (progressEntries.length > 0) {
            const { error: insertError } = await supabase
              .from("module_progress")
              .insert(progressEntries);

            if (insertError) throw insertError;
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["program-enrollments", programId] });
      queryClient.invalidateQueries({ queryKey: ["module-progress"] });
      toast.success(
        `Version deployed to ${selectedClients.length} client${
          selectedClients.length !== 1 ? "s" : ""
        }`,
      );
      onOpenChange(false);
      setSelectedClients([]);
      setResetProgress(false);
    },
    onError: (error) => {
      console.error("Error deploying version:", error);
      toast.error("Failed to deploy version");
    },
  });

  const handleDeploy = () => {
    if (selectedClients.length === 0) {
      toast.error("Please select at least one client");
      return;
    }
    deployMutation.mutate();
  };

  const toggleClient = (enrollmentId: string) => {
    setSelectedClients((prev) =>
      prev.includes(enrollmentId)
        ? prev.filter((id) => id !== enrollmentId)
        : [...prev, enrollmentId],
    );
  };

  const toggleAll = () => {
    if (selectedClients.length === enrollments?.length) {
      setSelectedClients([]);
    } else {
      setSelectedClients(enrollments?.map((e) => e.id) || []);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Deploy Version to Clients</DialogTitle>
          <DialogDescription>
            Select which clients should receive this version of {programName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Enrolled Clients</Label>
              <Button variant="outline" size="sm" onClick={toggleAll}>
                {selectedClients.length === enrollments?.length ? "Deselect All" : "Select All"}
              </Button>
            </div>
            <ScrollArea className="h-[300px] border rounded-md p-4">
              <div className="space-y-2">
                {enrollments?.map((enrollment) => {
                  const profile = enrollment.profiles as any;
                  return (
                    <div key={enrollment.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={enrollment.id}
                        checked={selectedClients.includes(enrollment.id)}
                        onCheckedChange={() => toggleClient(enrollment.id)}
                      />
                      <label
                        htmlFor={enrollment.id}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {profile?.name || "Unknown User"}
                        <span className="text-muted-foreground ml-2">({enrollment.status})</span>
                      </label>
                    </div>
                  );
                })}
                {!enrollments?.length && (
                  <div className="text-center text-muted-foreground py-8">
                    No clients enrolled in this program
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="reset-progress"
              checked={resetProgress}
              onCheckedChange={(checked) => setResetProgress(checked as boolean)}
            />
            <label
              htmlFor="reset-progress"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              Reset module progress for selected clients
            </label>
          </div>
          {resetProgress && (
            <p className="text-sm text-muted-foreground">
              This will clear all module completion data and start fresh progress tracking for the
              new version.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleDeploy} disabled={deployMutation.isPending}>
            {deployMutation.isPending ? "Deploying..." : "Deploy Version"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
