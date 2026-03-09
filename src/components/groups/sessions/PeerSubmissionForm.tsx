import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ExternalLink, Link, Upload, Trash2, Download, FileText, Image } from "lucide-react";
import type { Json } from "@/integrations/supabase/types";

interface AssignmentField {
  id: string;
  label: string;
  type: "text" | "textarea" | "number" | "rating" | "checkbox" | "select" | "richtext";
  required: boolean;
  options?: string[];
  min?: number;
  max?: number;
}

interface Attachment {
  id: string;
  attachment_type: string;
  title: string;
  description: string | null;
  url: string | null;
  file_path: string | null;
  file_size: number | null;
  mime_type: string | null;
}

interface PeerSubmissionFormProps {
  activityId: string;
  structure: Json;
  responses: Record<string, unknown>;
  onResponsesChange: (responses: Record<string, unknown>) => void;
  readOnly?: boolean;
  overallComments?: string;
  onOverallCommentsChange?: (value: string) => void;
}

export function PeerSubmissionForm({
  activityId,
  structure,
  responses,
  onResponsesChange,
  readOnly = false,
  overallComments = "",
  onOverallCommentsChange,
}: PeerSubmissionFormProps) {
  const { user } = useAuth();
  const fields = (structure as unknown as AssignmentField[]) || [];

  // Attachment state
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attachmentsLoaded, setAttachmentsLoaded] = useState(false);
  const [showAttachmentForm, setShowAttachmentForm] = useState(false);
  const [attachmentType, setAttachmentType] = useState<"link" | "file" | "image">("link");
  const [attachmentTitle, setAttachmentTitle] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Load attachments on first render
  if (!attachmentsLoaded) {
    setAttachmentsLoaded(true);
    supabase
      .from("group_session_activity_attachments")
      .select("id, attachment_type, title, description, url, file_path, file_size, mime_type")
      .eq("activity_id", activityId)
      .then(({ data }) => {
        if (data) setAttachments(data);
      });
  }

  const updateResponse = (fieldId: string, value: unknown) => {
    onResponsesChange({ ...responses, [fieldId]: value });
  };

  const isUrl = (str: string) => {
    try {
      const url = new URL(str);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  };

  const renderField = (field: AssignmentField) => {
    const value = responses[field.id];

    switch (field.type) {
      case "text":
        if (readOnly && typeof value === "string" && isUrl(value)) {
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
            disabled={readOnly}
          />
        );
      case "textarea":
      case "richtext":
        return (
          <Textarea
            value={(value as string) || ""}
            onChange={(e) => updateResponse(field.id, e.target.value)}
            disabled={readOnly}
          />
        );
      case "number":
        return (
          <Input
            type="number"
            min={field.min}
            max={field.max}
            value={(value as number) ?? ""}
            onChange={(e) =>
              updateResponse(field.id, e.target.value ? Number(e.target.value) : null)
            }
            disabled={readOnly}
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
              disabled={readOnly}
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
              disabled={readOnly}
            />
            <span className="text-sm">{field.label}</span>
          </div>
        );
      case "select":
        return (
          <Select
            value={(value as string) || ""}
            onValueChange={(v) => updateResponse(field.id, v)}
            disabled={readOnly}
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

  const handleAddAttachment = async () => {
    if (!user || !attachmentTitle.trim()) return;

    if (attachmentType === "link") {
      if (!attachmentUrl.trim()) {
        toast.error("Please enter a URL");
        return;
      }
      const { data, error } = await supabase
        .from("group_session_activity_attachments")
        .insert({
          activity_id: activityId,
          user_id: user.id,
          attachment_type: "link",
          title: attachmentTitle.trim(),
          url: attachmentUrl.trim(),
        })
        .select("id, attachment_type, title, description, url, file_path, file_size, mime_type")
        .single();
      if (error) {
        console.error("Error adding link:", error);
        toast.error("Failed to add link");
        return;
      }
      setAttachments((prev) => [...prev, data]);
    } else {
      if (!attachmentFile) {
        toast.error("Please select a file");
        return;
      }
      setUploading(true);
      const ext = attachmentFile.name.split(".").pop() || "bin";
      const filePath = `${activityId}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("peer-presentation-attachments")
        .upload(filePath, attachmentFile);

      if (uploadError) {
        console.error("Error uploading file:", uploadError);
        toast.error("Failed to upload file");
        setUploading(false);
        return;
      }

      const { data, error } = await supabase
        .from("group_session_activity_attachments")
        .insert({
          activity_id: activityId,
          user_id: user.id,
          attachment_type: attachmentType,
          title: attachmentTitle.trim(),
          file_path: filePath,
          file_size: attachmentFile.size,
          mime_type: attachmentFile.type || null,
        })
        .select("id, attachment_type, title, description, url, file_path, file_size, mime_type")
        .single();

      if (error) {
        console.error("Error saving attachment:", error);
        toast.error("Failed to save attachment");
        setUploading(false);
        return;
      }
      setAttachments((prev) => [...prev, data]);
      setUploading(false);
    }

    // Reset form
    setAttachmentTitle("");
    setAttachmentUrl("");
    setAttachmentFile(null);
    setShowAttachmentForm(false);
    toast.success("Attachment added");
  };

  const handleDeleteAttachment = async (att: Attachment) => {
    if (att.file_path) {
      await supabase.storage.from("peer-presentation-attachments").remove([att.file_path]);
    }
    const { error } = await supabase
      .from("group_session_activity_attachments")
      .delete()
      .eq("id", att.id);
    if (error) {
      console.error("Error deleting attachment:", error);
      toast.error("Failed to delete attachment");
      return;
    }
    setAttachments((prev) => prev.filter((a) => a.id !== att.id));
    toast.success("Attachment deleted");
  };

  const handleDownloadAttachment = async (att: Attachment) => {
    if (!att.file_path) return;
    const { data, error } = await supabase.storage
      .from("peer-presentation-attachments")
      .download(att.file_path);
    if (error || !data) {
      toast.error("Failed to download file");
      return;
    }
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = att.title;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Assignment type fields */}
      {fields.length > 0 && (
        <div className="space-y-4">
          {fields.map((field) => (
            <div key={field.id} className="space-y-2">
              {field.type !== "checkbox" && (
                <Label>
                  {field.label}
                  {field.required && <span className="text-destructive ml-1">*</span>}
                </Label>
              )}
              {renderField(field)}
            </div>
          ))}
        </div>
      )}

      {/* Overall comments */}
      <div className="space-y-2">
        <Label>Additional Comments</Label>
        <Textarea
          value={overallComments}
          onChange={(e) => onOverallCommentsChange?.(e.target.value)}
          placeholder="Any additional notes about your presentation..."
          disabled={readOnly}
        />
      </div>

      {/* Attachments section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Attachments</Label>
          {!readOnly && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAttachmentForm(!showAttachmentForm)}
            >
              {showAttachmentForm ? "Cancel" : "Add Attachment"}
            </Button>
          )}
        </div>

        {/* Attachment form */}
        {showAttachmentForm && !readOnly && (
          <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
            <div className="flex gap-2">
              <Button
                variant={attachmentType === "link" ? "default" : "outline"}
                size="sm"
                onClick={() => setAttachmentType("link")}
              >
                <Link className="h-3 w-3 mr-1" /> Link
              </Button>
              <Button
                variant={attachmentType === "file" ? "default" : "outline"}
                size="sm"
                onClick={() => setAttachmentType("file")}
              >
                <FileText className="h-3 w-3 mr-1" /> File
              </Button>
              <Button
                variant={attachmentType === "image" ? "default" : "outline"}
                size="sm"
                onClick={() => setAttachmentType("image")}
              >
                <Image className="h-3 w-3 mr-1" /> Image
              </Button>
            </div>
            <Input
              placeholder="Title"
              value={attachmentTitle}
              onChange={(e) => setAttachmentTitle(e.target.value)}
            />
            {attachmentType === "link" ? (
              <Input
                placeholder="URL"
                value={attachmentUrl}
                onChange={(e) => setAttachmentUrl(e.target.value)}
              />
            ) : (
              <Input
                type="file"
                accept={attachmentType === "image" ? "image/*" : undefined}
                onChange={(e) => setAttachmentFile(e.target.files?.[0] || null)}
              />
            )}
            <Button
              size="sm"
              onClick={handleAddAttachment}
              disabled={uploading || !attachmentTitle.trim()}
            >
              {uploading ? (
                <>
                  <Upload className="h-3 w-3 mr-1 animate-spin" /> Uploading...
                </>
              ) : (
                "Add"
              )}
            </Button>
          </div>
        )}

        {/* Attachment list */}
        {attachments.length > 0 && (
          <div className="space-y-2">
            {attachments.map((att) => (
              <div
                key={att.id}
                className="flex items-center justify-between border rounded-md px-3 py-2 text-sm"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {att.attachment_type === "link" ? (
                    <Link className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  ) : att.attachment_type === "image" ? (
                    <Image className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  ) : (
                    <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  )}
                  {att.url ? (
                    <a
                      href={att.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline truncate"
                    >
                      {att.title}
                    </a>
                  ) : (
                    <span className="truncate">{att.title}</span>
                  )}
                  {att.file_size && (
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      ({Math.round(att.file_size / 1024)} KB)
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {att.file_path && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleDownloadAttachment(att)}
                    >
                      <Download className="h-3 w-3" />
                    </Button>
                  )}
                  {!readOnly && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => handleDeleteAttachment(att)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {attachments.length === 0 && readOnly && (
          <p className="text-sm text-muted-foreground">No attachments</p>
        )}
      </div>
    </div>
  );
}
