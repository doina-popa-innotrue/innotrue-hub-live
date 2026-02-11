import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { ClipboardCheck, Save, Send, Paperclip, X, ExternalLink, Download, Trash2, CheckCircle, EyeOff, FolderOpen } from "lucide-react";
import { useGoogleDriveSSO } from "@/hooks/useGoogleDriveSSO";
import { Badge } from "@/components/ui/badge";
import { InstructorAssignmentScoring } from "./InstructorAssignmentScoring";
 import { ClientAssignmentFeedback } from "./ClientAssignmentFeedback";

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
}

interface Assignment {
  id: string;
  assignment_type_id: string;
  responses: Record<string, unknown>;
  overall_score: number | null;
  overall_comments: string | null;
  status: "draft" | "submitted" | "reviewed" | "completed";
  completed_at: string | null;
  is_private: boolean;
}

interface Attachment {
  id: string;
  attachment_type: "file" | "image" | "link";
  title: string;
  description: string | null;
  url: string | null;
  file_path: string | null;
  file_size: number | null;
}

interface ModuleAssignmentFormProps {
  moduleProgressId: string;
  assignmentType: AssignmentType & { scoring_assessment_id?: string | null };
  isEditable: boolean;
  isInstructor?: boolean; // true when instructor/coach is viewing
  moduleId?: string; // needed to fetch linked capability assessment from config
}

export function ModuleAssignmentForm({ moduleProgressId, assignmentType, isEditable, isInstructor = false, moduleId }: ModuleAssignmentFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { driveUser } = useGoogleDriveSSO();
  const [responses, setResponses] = useState<Record<string, unknown>>({});
  const [overallScore, setOverallScore] = useState<number | null>(null);
  const [overallComments, setOverallComments] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [attachmentForm, setAttachmentForm] = useState({ type: "link" as "file" | "image" | "link", title: "", description: "", url: "", file: null as File | null });
  const [showAttachmentForm, setShowAttachmentForm] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Fetch linked capability assessment from module_assignment_configs
  const { data: linkedAssessmentConfig } = useQuery({
    queryKey: ["module-assignment-config-linked", moduleId, assignmentType.id],
    queryFn: async () => {
      if (!moduleId) return null;
      const { data, error } = await supabase
        .from("module_assignment_configs")
        .select("linked_capability_assessment_id")
        .eq("module_id", moduleId)
        .eq("assignment_type_id", assignmentType.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!moduleId && isInstructor,
  });

  const { data: existingAssignment, isLoading } = useQuery({
    queryKey: ["module-assignment", moduleProgressId, assignmentType.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("module_assignments")
        .select("*")
        .eq("module_progress_id", moduleProgressId)
        .eq("assignment_type_id", assignmentType.id)
        .maybeSingle();
      if (error) throw error;
      return data as Assignment | null;
    },
  });

  const { data: attachments, refetch: refetchAttachments } = useQuery({
    queryKey: ["assignment-attachments", existingAssignment?.id],
    queryFn: async () => {
      if (!existingAssignment?.id) return [];
      const { data, error } = await supabase
        .from("module_assignment_attachments")
        .select("*")
        .eq("assignment_id", existingAssignment.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Attachment[];
    },
    enabled: !!existingAssignment?.id,
  });

  useEffect(() => {
    if (existingAssignment) {
      setResponses(existingAssignment.responses as Record<string, unknown>);
      setOverallScore(existingAssignment.overall_score);
      setOverallComments(existingAssignment.overall_comments || "");
      setIsPrivate(existingAssignment.is_private ?? false);
    }
  }, [existingAssignment]);

  const saveMutation = useMutation({
    mutationFn: async ({ status }: { status: "draft" | "submitted" | "reviewed" | "completed" }) => {
      const payload = {
        module_progress_id: moduleProgressId,
        assignment_type_id: assignmentType.id,
        assessor_id: user?.id ?? '',
        responses: JSON.parse(JSON.stringify(responses)) as Json,
        overall_score: overallScore,
        overall_comments: overallComments || null,
        status,
        completed_at: status === "completed" ? new Date().toISOString() : null,
        is_private: isPrivate,
      };

      let assignmentId = existingAssignment?.id;

      if (existingAssignment) {
        const { error } = await supabase
          .from("module_assignments")
          .update(payload)
          .eq("id", existingAssignment.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("module_assignments")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        assignmentId = data.id;
      }

      // If submitting, send notification to coaches/instructors
      if (status === "submitted" && assignmentId) {
        try {
          await supabase.functions.invoke("notify-assignment-submitted", {
            body: {
              moduleProgressId,
              assignmentId,
              assignmentTypeName: assignmentType.name,
            },
          });
        } catch (notifyError) {
          console.error("Failed to send notification:", notifyError);
          // Don't fail the submission if notification fails
        }
      }
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ["module-assignment", moduleProgressId, assignmentType.id] });
      const messages: Record<string, string> = {
        draft: "Assignment saved as draft",
        submitted: "Assignment submitted for review",
        reviewed: "Assignment marked as reviewed",
        completed: "Assignment completed",
      };
      toast({ title: messages[status] || "Assignment saved" });
    },
    onError: (error) => {
      toast({ title: "Error saving assignment", description: error.message, variant: "destructive" });
    },
  });

  const handleAddAttachment = async () => {
    if (!existingAssignment?.id) {
      toast({ title: "Please save the assignment first", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      let filePath: string | null = null;
      let fileSize: number | null = null;

      if (attachmentForm.type !== "link" && attachmentForm.file) {
        const fileExt = attachmentForm.file.name.split(".").pop();
        const fileName = `${existingAssignment.id}/${crypto.randomUUID()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("module-assignment-attachments")
          .upload(fileName, attachmentForm.file);
        if (uploadError) throw uploadError;
        filePath = fileName;
        fileSize = attachmentForm.file.size;
      }

      const { error } = await supabase.from("module_assignment_attachments").insert({
        assignment_id: existingAssignment.id,
        attachment_type: attachmentForm.type,
        title: attachmentForm.title,
        description: attachmentForm.description || null,
        url: attachmentForm.type === "link" ? attachmentForm.url : null,
        file_path: filePath,
        file_size: fileSize,
        mime_type: attachmentForm.file?.type || null,
      });
      if (error) throw error;

      refetchAttachments();
      setAttachmentForm({ type: "link", title: "", description: "", url: "", file: null });
      setShowAttachmentForm(false);
      toast({ title: "Attachment added" });
    } catch (error: unknown) {
      toast({ title: "Error adding attachment", description: (error as Error).message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAttachment = async (attachment: Attachment) => {
    if (!confirm("Delete this attachment?")) return;
    try {
      if (attachment.file_path) {
        await supabase.storage.from("module-assignment-attachments").remove([attachment.file_path]);
      }
      const { error } = await supabase.from("module_assignment_attachments").delete().eq("id", attachment.id);
      if (error) throw error;
      refetchAttachments();
      toast({ title: "Attachment deleted" });
    } catch (error: unknown) {
      toast({ title: "Error deleting attachment", description: (error as Error).message, variant: "destructive" });
    }
  };

  const handleDownload = async (attachment: Attachment) => {
    if (!attachment.file_path) return;
    const { data, error } = await supabase.storage
      .from("module-assignment-attachments")
      .download(attachment.file_path);
    if (error) {
      toast({ title: "Error downloading file", variant: "destructive" });
      return;
    }
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = attachment.title;
    a.click();
    URL.revokeObjectURL(url);
  };

  const updateResponse = (fieldId: string, value: unknown) => {
    setResponses({ ...responses, [fieldId]: value });
  };

  const renderField = (field: AssignmentField) => {
    const value = responses[field.id];
    const isLocked = existingAssignment?.status === "submitted" || existingAssignment?.status === "reviewed" || existingAssignment?.status === "completed";
    const isDisabled = !isEditable || isLocked;

    // Helper to check if a string is a URL
    const isUrl = (str: string) => {
      try {
        const url = new URL(str);
        return url.protocol === 'http:' || url.protocol === 'https:';
      } catch {
        return false;
      }
    };

    switch (field.type) {
      case "text":
        // If disabled and the value is a URL, render as clickable link
        if (isDisabled && typeof value === 'string' && isUrl(value)) {
          return (
            <a 
              href={value} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-primary hover:underline break-all"
            >
              {value}
              <ExternalLink className="h-4 w-4 flex-shrink-0" />
            </a>
          );
        }
        return (
          <Input
            value={(value as string) || ""}
            onChange={(e) => updateResponse(field.id, e.target.value)}
            disabled={isDisabled}
          />
        );
      case "textarea":
        return (
          <Textarea
            value={(value as string) || ""}
            onChange={(e) => updateResponse(field.id, e.target.value)}
            disabled={isDisabled}
          />
        );
      case "number":
        return (
          <Input
            type="number"
            min={field.min}
            max={field.max}
            value={(value as number) ?? ""}
            onChange={(e) => updateResponse(field.id, e.target.value ? Number(e.target.value) : null)}
            disabled={isDisabled}
          />
        );
      case "rating":
        return (
          <div className="space-y-2">
            <Slider
              value={[(value as number) || field.min || 1]}
              min={field.min || 1}
              max={field.max || 5}
              step={1}
              onValueChange={([v]) => updateResponse(field.id, v)}
              disabled={isDisabled}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{field.min || 1}</span>
              <span className="font-medium text-foreground">{String(value ?? "-")}</span>
              <span>{field.max || 5}</span>
            </div>
          </div>
        );
      case "checkbox":
        return (
          <div className="flex items-center gap-2">
            <Checkbox
              checked={(value as boolean) || false}
              onCheckedChange={(checked) => updateResponse(field.id, checked)}
              disabled={isDisabled}
            />
            <span className="text-sm">{field.label}</span>
          </div>
        );
      case "select":
        return (
          <Select
            value={(value as string) || ""}
            onValueChange={(v) => updateResponse(field.id, v)}
            disabled={isDisabled}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      default:
        return null;
    }
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading assignment...</div>;
  }

  const isLocked = existingAssignment?.status === "submitted" || existingAssignment?.status === "reviewed" || existingAssignment?.status === "completed";
  const status = existingAssignment?.status;

  const getStatusBadge = () => {
    if (!status) return null;
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      draft: "secondary",
      submitted: "outline",
      reviewed: "default",
      completed: "default",
    };
    const labels: Record<string, string> = {
      draft: "Draft",
      submitted: "Submitted - Awaiting Review",
      reviewed: "Reviewed",
      completed: "Completed",
    };
    return <Badge variant={variants[status] || "secondary"}>{labels[status] || status}</Badge>;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">{assignmentType.name}</CardTitle>
          </div>
          {getStatusBadge()}
        </div>
        {assignmentType.description && (
          <CardDescription>{assignmentType.description}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {assignmentType.structure.map((field) => {
          // Determine helper text based on field label/id
          const fieldLabelLower = field.label.toLowerCase();
          const isArtefactsField = fieldLabelLower.includes('artefact') || field.id.toLowerCase().includes('artefact');
          const isGoogleFolderField = fieldLabelLower.includes('google folder') || field.id.toLowerCase().includes('google_folder');
          
          return (
            <div key={field.id} className="space-y-2">
              {field.type !== "checkbox" && (
                <Label>
                  {field.label}
                  {field.required && <span className="text-destructive ml-1">*</span>}
                </Label>
              )}
              {renderField(field)}
              
              {/* Helper notes for specific fields */}
              {isArtefactsField && (
                <p className="text-xs text-muted-foreground">
                  Add a link to a folder or file in your Lucid account containing your diagrams for this module.
                </p>
              )}
              {isGoogleFolderField && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Create a new folder in your shared program folder for this module. Add your notes document and any other materials you've prepared (Google Sheets, presentations, etc.).
                  </p>
                  {driveUser?.folder_url && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => window.open(driveUser.folder_url, '_blank')}
                    >
                      <FolderOpen className="h-4 w-4" />
                      Open My Shared Folder
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        <div className="border-t pt-4 space-y-4">
          <div className="space-y-2">
            <Label>Overall Comments</Label>
            <Textarea
              value={overallComments}
              onChange={(e) => setOverallComments(e.target.value)}
              disabled={!isEditable || isLocked}
              placeholder="Additional comments or feedback..."
            />
          </div>
          
          {/* Privacy Toggle - HIDDEN FOR NOW (feature needs clearer use case)
          {!isInstructor && isEditable && !isLocked && (
            <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
              <div className="space-y-0.5">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  <EyeOff className="h-4 w-4" />
                  Private Assignment
                </Label>
                <p className="text-xs text-muted-foreground">
                  Only visible to you (and admins). Coaches/instructors won't see this assignment.
                </p>
              </div>
              <Switch
                checked={isPrivate}
                onCheckedChange={setIsPrivate}
              />
            </div>
          )}
          */}
        </div>

        {/* Attachments */}
        <div className="border-t pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="font-medium">Attachments</Label>
            {isEditable && !isLocked && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  if (!existingAssignment) {
                    toast({ 
                      title: "Save draft first", 
                      description: "Please save your assignment as a draft before adding attachments.",
                      variant: "default"
                    });
                    return;
                  }
                  setShowAttachmentForm(!showAttachmentForm);
                }}
              >
                <Paperclip className="h-4 w-4 mr-1" /> Add Attachment
              </Button>
            )}
          </div>
          
          {!existingAssignment && isEditable && !isLocked && (
            <p className="text-sm text-muted-foreground">
              Save your assignment as a draft to enable attachments.
            </p>
          )}

          {showAttachmentForm && (
            <Card className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Type</Label>
                  <Select
                    value={attachmentForm.type}
                    onValueChange={(v: "file" | "image" | "link") => setAttachmentForm({ ...attachmentForm, type: v, file: null })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="link">Link</SelectItem>
                      <SelectItem value="file">File</SelectItem>
                      <SelectItem value="image">Image</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Title *</Label>
                  <Input
                    value={attachmentForm.title}
                    onChange={(e) => setAttachmentForm({ ...attachmentForm, title: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label>Description</Label>
                <Input
                  value={attachmentForm.description}
                  onChange={(e) => setAttachmentForm({ ...attachmentForm, description: e.target.value })}
                />
              </div>
              {attachmentForm.type === "link" ? (
                <div>
                  <Label>URL *</Label>
                  <Input
                    value={attachmentForm.url}
                    onChange={(e) => setAttachmentForm({ ...attachmentForm, url: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
              ) : (
                <div>
                  <Label>File *</Label>
                  <Input
                    type="file"
                    accept={attachmentForm.type === "image" ? "image/*" : "*/*"}
                    onChange={(e) => setAttachmentForm({ ...attachmentForm, file: e.target.files?.[0] || null })}
                  />
                </div>
              )}
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setShowAttachmentForm(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleAddAttachment}
                  disabled={uploading || !attachmentForm.title || (attachmentForm.type === "link" ? !attachmentForm.url : !attachmentForm.file)}
                >
                  {uploading ? "Uploading..." : "Add"}
                </Button>
              </div>
            </Card>
          )}

          {attachments && attachments.length > 0 && (
            <div className="space-y-2">
              {attachments.map((att) => (
                <div key={att.id} className="flex items-center justify-between p-2 bg-muted rounded-md">
                  <div className="flex items-center gap-2">
                    <Paperclip className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="text-sm font-medium">{att.title}</div>
                      {att.description && <div className="text-xs text-muted-foreground">{att.description}</div>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {att.attachment_type === "link" && att.url ? (
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          window.open(att.url!, '_blank', 'noopener,noreferrer');
                        }}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button variant="ghost" size="icon" onClick={() => handleDownload(att)}>
                        <Download className="h-4 w-4" />
                      </Button>
                    )}
                    {isEditable && !isLocked && (
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteAttachment(att)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions - Client view: can save draft or submit */}
        {isEditable && !isLocked && (
          <div className="flex gap-2 justify-end pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => saveMutation.mutate({ status: "draft" })}
              disabled={saveMutation.isPending}
            >
              <Save className="h-4 w-4 mr-2" /> Save Draft
            </Button>
            <Button
              onClick={() => saveMutation.mutate({ status: "submitted" })}
              disabled={saveMutation.isPending}
            >
              <Send className="h-4 w-4 mr-2" /> Submit for Review
            </Button>
          </div>
        )}

        {/* Info for submitted/locked assignments */}
        {status === "submitted" && !isInstructor && (
          <div className="pt-4 border-t">
            <p className="text-sm text-muted-foreground text-center">
              Your assignment has been submitted and is awaiting review from your coach or instructor.
            </p>
          </div>
        )}

         {/* Client Feedback Section - shown when assignment is reviewed */}
         {!isInstructor && status === "reviewed" && existingAssignment && (
           <div className="pt-4 border-t">
             <ClientAssignmentFeedback assignmentId={existingAssignment.id} />
           </div>
         )}
 
        {/* Instructor Scoring Section - uses linked assessment or falls back to scoring_assessment_id */}
        {/* Show for submitted and reviewed assignments so instructors can view/edit scoring */}
        {isInstructor && (status === "submitted" || status === "reviewed") && existingAssignment && (linkedAssessmentConfig?.linked_capability_assessment_id || assignmentType.scoring_assessment_id) && (
          <div className="pt-4 border-t">
            <InstructorAssignmentScoring
              assignmentId={existingAssignment.id}
              assignmentTypeId={assignmentType.id}
              moduleProgressId={moduleProgressId}
              linkedCapabilityAssessmentId={linkedAssessmentConfig?.linked_capability_assessment_id}
              onComplete={() => queryClient.invalidateQueries({ queryKey: ["module-assignment", moduleProgressId, assignmentType.id] })}
            />
          </div>
        )}

        {/* Instructor actions when no scoring assessment is configured */}
        {isInstructor && status === "submitted" && !linkedAssessmentConfig?.linked_capability_assessment_id && !assignmentType.scoring_assessment_id && (
          <div className="pt-4 border-t space-y-3">
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => saveMutation.mutate({ status: "reviewed" })}
                disabled={saveMutation.isPending}
              >
                <CheckCircle className="h-4 w-4 mr-2" /> Mark as Reviewed
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
