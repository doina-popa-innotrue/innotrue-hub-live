import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Search,
  Trash2,
  AlertTriangle,
  Loader2,
  Eye,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { DataCleanupRecordInspector } from "./DataCleanupRecordInspector";

export interface CleanupFilters {
  userId: string;
  programId: string;
  createdBefore: string;
}

interface CleanupPreview {
  primary_count: number;
  cascade_counts: Record<string, number>;
  fk_nullify_counts: Record<string, number>;
  attachment_file_paths: string[];
}

interface DataCleanupEntityCardProps {
  entityType: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  filters: CleanupFilters;
  statusOptions: { value: string; label: string }[];
  onDeleteComplete?: () => void;
}

const FRIENDLY_NAMES: Record<string, string> = {
  paragraph_responses: "Paragraph Responses",
  paragraph_evaluations: "Paragraph Evaluations",
  paragraph_question_scores: "Question Scores",
  group_session_activities: "Group Session Activities",
  child_assignments: "Child Assignments",
  capability_snapshot_ratings: "Ratings",
  capability_domain_notes: "Domain Notes",
  capability_question_notes: "Question Notes",
  instructor_capability_evaluations: "Instructor Evaluations",
  development_item_snapshot_links: "Dev Item Links (Snapshot)",
  development_item_domain_links: "Dev Item Links (Domain)",
  development_item_question_links: "Dev Item Links (Question)",
  goal_assessment_links: "Goal Assessment Links",
  module_assignments: "Module Assignments",
  module_assignment_attachments: "Assignment Attachments",
  module_reflections: "Reflections",
  coach_module_feedback: "Coach Feedback",
  instructor_module_notes: "Instructor Notes",
  development_item_module_links: "Dev Item Links (Module)",
  scenario_assignments: "Scenario Assignments",
};

export function DataCleanupEntityCard({
  entityType,
  title,
  description,
  icon,
  filters,
  statusOptions,
  onDeleteComplete,
}: DataCleanupEntityCardProps) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("all");
  const [preview, setPreview] = useState<CleanupPreview | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isInspectOpen, setIsInspectOpen] = useState(false);
  const [showCascadeDetails, setShowCascadeDetails] = useState(false);

  const buildParams = () => ({
    p_entity_type: entityType,
    p_user_id: filters.userId === "all" ? null : filters.userId,
    p_program_id: filters.programId === "all" ? null : filters.programId,
    p_created_before: filters.createdBefore || null,
    p_status: status === "all" ? null : status,
  });

  const handlePreview = async () => {
    setIsPreviewLoading(true);
    setPreview(null);
    try {
      const { data, error } = await supabase.rpc(
        "admin_data_cleanup_preview",
        buildParams(),
      );
      if (error) throw error;
      setPreview(data as unknown as CleanupPreview);
    } catch (err) {
      console.error("Preview failed:", err);
      toast.error(
        "Failed to preview: " + (err instanceof Error ? err.message : "Unknown error"),
      );
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc(
        "admin_data_cleanup_execute",
        buildParams(),
      );
      if (error) throw error;
      return data as unknown as { deleted: number };
    },
    onSuccess: async (result) => {
      // Clean up orphaned storage files if any
      if (preview?.attachment_file_paths && preview.attachment_file_paths.length > 0) {
        try {
          const { error: storageError } = await supabase.storage
            .from("module-assignment-attachments")
            .remove(preview.attachment_file_paths);
          if (storageError) {
            console.error("Storage cleanup failed:", storageError);
            toast.warning(
              `Deleted ${result.deleted} records but some storage files may remain`,
            );
          } else {
            toast.success(
              `Deleted ${result.deleted} ${title.toLowerCase()} and ${preview.attachment_file_paths.length} storage files`,
            );
          }
        } catch (err) {
          console.error("Storage cleanup error:", err);
        }
      } else {
        toast.success(`Successfully deleted ${result.deleted} ${title.toLowerCase()}`);
      }

      setIsConfirmOpen(false);
      setPreview(null);
      queryClient.invalidateQueries({ queryKey: ["cleanup-preview"] });
      onDeleteComplete?.();
    },
    onError: (error) => {
      console.error("Delete failed:", error);
      toast.error(
        "Failed to delete: " +
          (error instanceof Error ? error.message : "Unknown error"),
      );
    },
  });

  const totalCascade = preview
    ? Object.values(preview.cascade_counts).reduce((sum, n) => sum + n, 0)
    : 0;
  const totalNullify = preview
    ? Object.values(preview.fk_nullify_counts).reduce((sum, n) => sum + n, 0)
    : 0;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            {icon}
            <CardTitle className="text-base">{title}</CardTitle>
          </div>
          <CardDescription className="text-xs">{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status filter */}
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-muted-foreground shrink-0">
              Status:
            </label>
            <Select value={status} onValueChange={(v) => { setStatus(v); setPreview(null); }}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {statusOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={handlePreview}
              disabled={isPreviewLoading}
              className="gap-1.5"
            >
              {isPreviewLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Eye className="h-3.5 w-3.5" />
              )}
              Preview
            </Button>
          </div>

          {/* Preview results */}
          {isPreviewLoading && (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-8 w-2/3" />
            </div>
          )}

          {preview && !isPreviewLoading && (
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              {preview.primary_count === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-2">
                  No records found matching filters
                </p>
              ) : (
                <>
                  {/* Primary count */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Records to delete:</span>
                    <Badge variant="destructive" className="text-base px-3 py-1">
                      {preview.primary_count.toLocaleString()}
                    </Badge>
                  </div>

                  {/* Cascade + nullify summary */}
                  {(totalCascade > 0 || totalNullify > 0) && (
                    <div className="space-y-2">
                      <button
                        onClick={() => setShowCascadeDetails(!showCascadeDetails)}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showCascadeDetails ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )}
                        {totalCascade > 0 && (
                          <span>
                            +{totalCascade.toLocaleString()} cascade deletions
                          </span>
                        )}
                        {totalCascade > 0 && totalNullify > 0 && <span>·</span>}
                        {totalNullify > 0 && (
                          <span>
                            {totalNullify.toLocaleString()} FK references nullified
                          </span>
                        )}
                      </button>

                      {showCascadeDetails && (
                        <div className="bg-background rounded-md border p-3 space-y-2 text-xs">
                          {Object.entries(preview.cascade_counts)
                            .filter(([, count]) => count > 0)
                            .map(([key, count]) => (
                              <div key={key} className="flex justify-between">
                                <span className="text-muted-foreground">
                                  {FRIENDLY_NAMES[key] || key}
                                </span>
                                <span className="font-medium">
                                  {count.toLocaleString()} deleted
                                </span>
                              </div>
                            ))}
                          {Object.entries(preview.fk_nullify_counts)
                            .filter(([, count]) => count > 0)
                            .map(([key, count]) => (
                              <div key={key} className="flex justify-between">
                                <span className="text-muted-foreground">
                                  {FRIENDLY_NAMES[key] || key}
                                </span>
                                <span className="font-medium text-amber-600">
                                  {count.toLocaleString()} nullified
                                </span>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Storage files */}
                  {preview.attachment_file_paths.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {preview.attachment_file_paths.length} storage file(s) will also be
                      removed
                    </p>
                  )}

                  {/* Action buttons */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsInspectOpen(true)}
                      className="gap-1.5"
                    >
                      <Search className="h-3.5 w-3.5" />
                      View Records
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setIsConfirmOpen(true)}
                      className="gap-1.5"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete {preview.primary_count.toLocaleString()} Records
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Record inspection dialog */}
      <DataCleanupRecordInspector
        entityType={entityType}
        title={title}
        filters={filters}
        status={status}
        open={isInspectOpen}
        onOpenChange={setIsInspectOpen}
      />

      {/* Confirmation dialog */}
      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Confirm Deletion: {title}
            </DialogTitle>
            <DialogDescription asChild>
              <div className="pt-2 space-y-4">
                <p>
                  You are about to permanently delete{" "}
                  <strong>{preview?.primary_count.toLocaleString()}</strong>{" "}
                  {title.toLowerCase()}.
                </p>

                {preview && (totalCascade > 0 || totalNullify > 0) && (
                  <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 space-y-2">
                    <p className="font-semibold text-destructive">This will also:</p>
                    <ul className="text-sm space-y-1 list-disc list-inside">
                      {Object.entries(preview.cascade_counts)
                        .filter(([, count]) => count > 0)
                        .map(([key, count]) => (
                          <li key={key}>
                            Delete <strong>{count.toLocaleString()}</strong>{" "}
                            {FRIENDLY_NAMES[key] || key}
                          </li>
                        ))}
                      {Object.entries(preview.fk_nullify_counts)
                        .filter(([, count]) => count > 0)
                        .map(([key, count]) => (
                          <li key={key}>
                            Nullify <strong>{count.toLocaleString()}</strong> FK
                            references in {FRIENDLY_NAMES[key] || key}
                          </li>
                        ))}
                      {preview.attachment_file_paths.length > 0 && (
                        <li>
                          Remove{" "}
                          <strong>{preview.attachment_file_paths.length}</strong>{" "}
                          storage file(s)
                        </li>
                      )}
                    </ul>
                  </div>
                )}

                <p className="text-destructive font-medium">
                  This action <strong>cannot be undone</strong>. Are you sure?
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="gap-2"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Delete {preview?.primary_count.toLocaleString()} Records
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
