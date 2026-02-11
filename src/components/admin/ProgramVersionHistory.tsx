import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History, Trash2, RotateCcw, Save, Users } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DeployVersionDialog } from "./DeployVersionDialog";

interface ProgramVersionHistoryProps {
  programId: string;
  programName: string;
}

export function ProgramVersionHistory({ programId, programName }: ProgramVersionHistoryProps) {
  const queryClient = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showRevertDialog, setShowRevertDialog] = useState(false);
  const [showDeployDialog, setShowDeployDialog] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);
  const [versionName, setVersionName] = useState("");
  const [overwriteCurrent, setOverwriteCurrent] = useState(false);

  const { data: versions, isLoading } = useQuery({
    queryKey: ["program-versions", programId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("program_versions")
        .select("*, profiles:created_by(name)")
        .eq("program_id", programId)
        .order("version_number", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const createVersionMutation = useMutation({
    mutationFn: async ({ name, overwrite }: { name: string; overwrite: boolean }) => {
      // Get current program data
      const { data: program, error: programError } = await supabase
        .from("programs")
        .select("*")
        .eq("id", programId)
        .single();

      if (programError) throw programError;

      // Get current modules
      const { data: modules, error: modulesError } = await supabase
        .from("program_modules")
        .select("*")
        .eq("program_id", programId)
        .order("order_index");

      if (modulesError) throw modulesError;

      if (overwrite) {
        // Get current version
        const { data: currentVersion } = await supabase
          .from("program_versions")
          .select("id")
          .eq("program_id", programId)
          .eq("is_current", true)
          .single();

        if (currentVersion) {
          // Update current version
          const { error: updateError } = await supabase
            .from("program_versions")
            .update({
              version_name: name,
              snapshot_data: {
                name: program.name,
                description: program.description,
                category: program.category,
                is_active: program.is_active,
                slug: program.slug,
              },
            })
            .eq("id", currentVersion.id);

          if (updateError) throw updateError;

          // Delete old module versions
          await supabase
            .from("program_module_versions")
            .delete()
            .eq("version_id", currentVersion.id);

          // Create new module versions
          const moduleVersions = modules.map((module) => ({
            version_id: currentVersion.id,
            original_module_id: module.id,
            module_snapshot: module,
            order_index: module.order_index,
          }));

          const { error: moduleError } = await supabase
            .from("program_module_versions")
            .insert(moduleVersions);

          if (moduleError) throw moduleError;

          return currentVersion.id;
        }
      }

      // Create new version
      const maxVersion = versions?.[0]?.version_number || 0;

      const { data: newVersion, error: versionError } = await supabase
        .from("program_versions")
        .insert([{
          program_id: programId,
          version_number: maxVersion + 1,
          version_name: name,
          created_by: (await supabase.auth.getUser()).data.user?.id ?? '',
          snapshot_data: {
            name: program.name,
            description: program.description,
            category: program.category,
            is_active: program.is_active,
            slug: program.slug,
          } as any,
          is_current: true,
        }])
        .select()
        .single();

      if (versionError) throw versionError;

      // Mark other versions as not current
      await supabase
        .from("program_versions")
        .update({ is_current: false })
        .eq("program_id", programId)
        .neq("id", newVersion.id);

      // Create module versions
      const moduleVersions = modules.map((module) => ({
        version_id: newVersion.id,
        original_module_id: module.id,
        module_snapshot: module,
        order_index: module.order_index,
      }));

      const { error: moduleError } = await supabase
        .from("program_module_versions")
        .insert(moduleVersions);

      if (moduleError) throw moduleError;

      return newVersion.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["program-versions", programId] });
      toast.success("Version saved successfully");
      setShowCreateDialog(false);
      setVersionName("");
    },
    onError: (error) => {
      console.error("Error creating version:", error);
      toast.error("Failed to save version");
    },
  });

  const deleteVersionMutation = useMutation({
    mutationFn: async (versionId: string) => {
      const { error } = await supabase
        .from("program_versions")
        .delete()
        .eq("id", versionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["program-versions", programId] });
      toast.success("Version deleted successfully");
      setShowDeleteDialog(false);
      setSelectedVersion(null);
    },
    onError: (error) => {
      console.error("Error deleting version:", error);
      toast.error("Failed to delete version");
    },
  });

  const revertVersionMutation = useMutation({
    mutationFn: async (versionId: string) => {
      // Get version data
      const { data: version, error: versionError } = await supabase
        .from("program_versions")
        .select("*")
        .eq("id", versionId)
        .single();

      if (versionError) throw versionError;

      // Update program with snapshot data
      const snapshotData = version.snapshot_data as any;
      const { error: programError } = await supabase
        .from("programs")
        .update({
          name: snapshotData.name,
          description: snapshotData.description,
          category: snapshotData.category,
          is_active: snapshotData.is_active,
          slug: snapshotData.slug,
        })
        .eq("id", programId);

      if (programError) throw programError;

      // Mark this version as current
      await supabase
        .from("program_versions")
        .update({ is_current: false })
        .eq("program_id", programId);

      const { error: currentError } = await supabase
        .from("program_versions")
        .update({ is_current: true })
        .eq("id", versionId);

      if (currentError) throw currentError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["program-versions", programId] });
      queryClient.invalidateQueries({ queryKey: ["programs"] });
      queryClient.invalidateQueries({ queryKey: ["program", programId] });
      toast.success("Reverted to previous version");
      setShowRevertDialog(false);
      setSelectedVersion(null);
    },
    onError: (error) => {
      console.error("Error reverting version:", error);
      toast.error("Failed to revert version");
    },
  });

  const handleCreateVersion = () => {
    if (!versionName.trim()) {
      toast.error("Please enter a version name");
      return;
    }
    createVersionMutation.mutate({ name: versionName, overwrite: overwriteCurrent });
  };

  if (isLoading) {
    return <div className="text-muted-foreground">Loading versions...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <History className="h-5 w-5" />
          Version History
        </h3>
        <Button onClick={() => setShowCreateDialog(true)} size="sm">
          <Save className="h-4 w-4 mr-2" />
          Save Version
        </Button>
      </div>

      <div className="space-y-2">
        {versions?.map((version) => (
          <Card key={version.id} className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">v{version.version_number}</span>
                  {version.version_name && (
                    <span className="text-muted-foreground">- {version.version_name}</span>
                  )}
                  {version.is_current && (
                    <Badge variant="default">Current</Badge>
                  )}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  Created by {(version.profiles as any)?.name || "Unknown"} on{" "}
                  {version.created_at ? format(new Date(version.created_at), "PPp") : "Unknown date"}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedVersion(version.id);
                    setShowDeployDialog(true);
                  }}
                >
                  <Users className="h-4 w-4 mr-2" />
                  Deploy
                </Button>
                {!version.is_current && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedVersion(version.id);
                        setShowRevertDialog(true);
                      }}
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Revert
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        setSelectedVersion(version.id);
                        setShowDeleteDialog(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <AlertDialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save Program Version</AlertDialogTitle>
            <AlertDialogDescription>
              Choose whether to create a new version or overwrite the current one.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="version-name">Version Name</Label>
              <Input
                id="version-name"
                placeholder="e.g., Pre-launch updates"
                value={versionName}
                onChange={(e) => setVersionName(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="overwrite"
                checked={overwriteCurrent}
                onChange={(e) => setOverwriteCurrent(e.target.checked)}
                className="h-4 w-4"
              />
              <Label htmlFor="overwrite" className="font-normal">
                Overwrite current version instead of creating new
              </Label>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleCreateVersion}>
              Save Version
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Version</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this version? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedVersion && deleteVersionMutation.mutate(selectedVersion)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showRevertDialog} onOpenChange={setShowRevertDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revert to Version</AlertDialogTitle>
            <AlertDialogDescription>
              This will restore the program to this version. The current state will be preserved
              as a version, so you can always switch back.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedVersion && revertVersionMutation.mutate(selectedVersion)}
            >
              Revert
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {selectedVersion && (
        <DeployVersionDialog
          open={showDeployDialog}
          onOpenChange={setShowDeployDialog}
          versionId={selectedVersion}
          programId={programId}
          programName={programName}
        />
      )}
    </div>
  );
}
