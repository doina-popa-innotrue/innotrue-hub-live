import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Loader2,
  Paperclip,
  Link,
  Image,
  FileText,
  Download,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { format } from "date-fns";

interface Attachment {
  id: string;
  title: string;
  description: string | null;
  attachment_type: string;
  file_path: string | null;
  url: string | null;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
}

interface FeedbackAttachmentsProps {
  feedbackId: string;
  canEdit?: boolean;
}

export default function FeedbackAttachments({
  feedbackId,
  canEdit = false,
}: FeedbackAttachmentsProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAttachments();
  }, [feedbackId]);

  async function fetchAttachments() {
    try {
      const { data, error } = await supabase
        .from("coach_feedback_attachments")
        .select("*")
        .eq("feedback_id", feedbackId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAttachments(data || []);
    } catch (error) {
      console.error("Error fetching attachments:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(attachment: Attachment) {
    if (!confirm("Delete this attachment?")) return;

    try {
      // Delete file from storage if it exists
      if (attachment.file_path) {
        await supabase.storage.from("coach-feedback-attachments").remove([attachment.file_path]);
      }

      // Delete record
      const { error } = await supabase
        .from("coach_feedback_attachments")
        .delete()
        .eq("id", attachment.id);

      if (error) throw error;
      toast.success("Attachment deleted");
      fetchAttachments();
    } catch (error) {
      console.error("Error deleting attachment:", error);
      toast.error("Failed to delete attachment");
    }
  }

  async function handleDownload(attachment: Attachment) {
    if (!attachment.file_path) return;

    try {
      const { data, error } = await supabase.storage
        .from("coach-feedback-attachments")
        .download(attachment.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = attachment.title;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading file:", error);
      toast.error("Failed to download file");
    }
  }

  function getIcon(type: string) {
    switch (type) {
      case "link":
        return <Link className="h-4 w-4" />;
      case "image":
        return <Image className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  }

  function formatFileSize(bytes: number | null) {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-2">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  if (attachments.length === 0) return null;

  return (
    <div className="mt-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
        <Paperclip className="h-4 w-4" />
        <span>Attachments</span>
      </div>
      <div className="space-y-2">
        {attachments.map((attachment) => (
          <div
            key={attachment.id}
            className="flex items-center justify-between p-2 bg-muted/50 rounded-md text-sm"
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {getIcon(attachment.attachment_type)}
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{attachment.title}</p>
                {attachment.description && (
                  <p className="text-xs text-muted-foreground truncate">{attachment.description}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {format(new Date(attachment.created_at), "PP")}
                  {attachment.file_size && ` • ${formatFileSize(attachment.file_size)}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 ml-2">
              {attachment.url && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => window.open(attachment.url!, "_blank")}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              )}
              {attachment.file_path && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => handleDownload(attachment)}
                >
                  <Download className="h-3.5 w-3.5" />
                </Button>
              )}
              {canEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive"
                  onClick={() => handleDelete(attachment)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
