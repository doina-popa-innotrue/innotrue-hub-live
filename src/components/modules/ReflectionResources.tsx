import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Link as LinkIcon,
  Trash2,
  Download,
} from "lucide-react";
import { format } from "date-fns";

interface ReflectionResource {
  id: string;
  resource_type: "file" | "image" | "link";
  title: string;
  description: string | null;
  url: string | null;
  file_path: string | null;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
}

interface ReflectionResourcesProps {
  reflectionId: string;
  /** Increment to trigger a refetch (e.g. after adding a resource) */
  refreshKey?: number;
}

export default function ReflectionResources({ reflectionId, refreshKey }: ReflectionResourcesProps) {
  const [resources, setResources] = useState<ReflectionResource[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchResources();
  }, [reflectionId, refreshKey]);

  async function fetchResources() {
    try {
      const { data, error } = await supabase
        .from("module_reflection_resources")
        .select("*")
        .eq("module_reflection_id", reflectionId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setResources((data as ReflectionResource[]) || []);
    } catch (error) {
      console.error("Error fetching resources:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string, filePath: string | null) {
    if (!confirm("Are you sure you want to delete this resource?")) return;

    try {
      // Delete from storage if it's a file/image
      if (filePath) {
        await supabase.storage.from("module-reflection-resources").remove([filePath]);
      }

      // Delete database record
      const { error } = await supabase.from("module_reflection_resources").delete().eq("id", id);

      if (error) throw error;
      toast.success("Resource deleted");
      fetchResources();
    } catch (error) {
      console.error("Error deleting resource:", error);
      toast.error("Failed to delete resource");
    }
  }

  async function handleDownload(filePath: string, title: string) {
    try {
      const { data, error } = await supabase.storage
        .from("module-reflection-resources")
        .download(filePath);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = title;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading file:", error);
      toast.error("Failed to download file");
    }
  }

  function getResourceIcon(type: string) {
    switch (type) {
      case "image":
        return <ImageIcon className="h-4 w-4" />;
      case "file":
        return <FileText className="h-4 w-4" />;
      case "link":
        return <LinkIcon className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  }

  if (loading || resources.length === 0) return null;

  return (
    <div className="mt-4 space-y-2">
      <h4 className="text-sm font-medium">Attachments</h4>
      <div className="space-y-2">
        {resources.map((resource) => (
          <div
            key={resource.id}
            className="flex items-start justify-between gap-2 p-3 rounded-lg border bg-card"
          >
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className="mt-1">{getResourceIcon(resource.resource_type)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm truncate">{resource.title}</p>
                  {resource.resource_type === "link" && resource.url && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={() => window.open(resource.url!, "_blank")}
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  )}
                  {resource.resource_type === "image" && resource.file_path && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={() => window.open(resource.url!, "_blank")}
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  )}
                  {resource.resource_type === "file" && resource.file_path && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={() => handleDownload(resource.file_path!, resource.title)}
                    >
                      <Download className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                {resource.description && (
                  <p className="text-xs text-muted-foreground mt-1">{resource.description}</p>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(resource.created_at), "PP")}
                  </p>
                  {resource.file_size && (
                    <p className="text-xs text-muted-foreground">
                      • {(resource.file_size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  )}
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => handleDelete(resource.id, resource.file_path)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
