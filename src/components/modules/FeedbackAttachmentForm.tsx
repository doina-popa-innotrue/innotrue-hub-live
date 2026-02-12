import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Upload, Link, Image, FileText } from "lucide-react";

interface FeedbackAttachmentFormProps {
  feedbackId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function FeedbackAttachmentForm({
  feedbackId,
  onSuccess,
  onCancel,
}: FeedbackAttachmentFormProps) {
  const { user } = useAuth();
  const [type, setType] = useState<"file" | "image" | "link">("file");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !title.trim()) return;

    setSubmitting(true);
    try {
      let filePath: string | null = null;
      let fileSize: number | null = null;
      let mimeType: string | null = null;

      // Upload file if present
      if (file && (type === "file" || type === "image")) {
        const fileExt = file.name.split(".").pop();
        const fileName = `${feedbackId}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("coach-feedback-attachments")
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        filePath = fileName;
        fileSize = file.size;
        mimeType = file.type;
      }

      // Insert attachment record
      const { error } = await supabase.from("coach_feedback_attachments").insert({
        feedback_id: feedbackId,
        title: title.trim(),
        description: description.trim() || null,
        attachment_type: type,
        file_path: filePath,
        url: type === "link" ? url.trim() : null,
        file_size: fileSize,
        mime_type: mimeType,
      });

      if (error) throw error;

      toast.success("Attachment added");
      onSuccess();
    } catch (error) {
      console.error("Error adding attachment:", error);
      toast.error("Failed to add attachment");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-md bg-muted/30">
      <div className="space-y-2">
        <Label>Type</Label>
        <Select value={type} onValueChange={(v) => setType(v as "file" | "image" | "link")}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="file">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                File
              </div>
            </SelectItem>
            <SelectItem value="image">
              <div className="flex items-center gap-2">
                <Image className="h-4 w-4" />
                Image
              </div>
            </SelectItem>
            <SelectItem value="link">
              <div className="flex items-center gap-2">
                <Link className="h-4 w-4" />
                Link
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Title *</Label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Attachment title"
          required
        />
      </div>

      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional description"
          rows={2}
        />
      </div>

      {type === "link" ? (
        <div className="space-y-2">
          <Label>URL *</Label>
          <Input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
            required
          />
        </div>
      ) : (
        <div className="space-y-2">
          <Label>File *</Label>
          <Input
            type="file"
            accept={type === "image" ? "image/*" : "*/*"}
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            required
          />
          {file && (
            <p className="text-xs text-muted-foreground">
              Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
            </p>
          )}
        </div>
      )}

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={submitting || !title.trim() || (type === "link" ? !url.trim() : !file)}
        >
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          <Upload className="mr-2 h-4 w-4" />
          Add Attachment
        </Button>
      </div>
    </form>
  );
}
