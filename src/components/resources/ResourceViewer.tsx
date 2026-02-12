import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, ExternalLink, Download, Eye, X } from "lucide-react";
import { toast } from "sonner";

interface ResourceViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resource: {
    title: string;
    file_path: string | null;
    file_name: string | null;
    mime_type: string | null;
    downloadable: boolean;
  };
}

export function ResourceViewer({ open, onOpenChange, resource }: ResourceViewerProps) {
  const [loading, setLoading] = useState(true);
  const [viewUrl, setViewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadResource = async () => {
    if (!resource.file_path) {
      setLoading(false);
      setError("No file path available");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.storage
        .from("resource-library")
        .download(resource.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      setViewUrl(url);
    } catch (err: any) {
      console.error("Resource load error:", err);
      setError(err.message || "Failed to load resource");
      toast.error("Failed to load resource");
    } finally {
      setLoading(false);
    }
  };

  // Load resource when dialog opens
  useEffect(() => {
    if (open && resource.file_path) {
      loadResource();
    }

    // Cleanup blob URL when dialog closes
    return () => {
      if (viewUrl) {
        URL.revokeObjectURL(viewUrl);
      }
    };
  }, [open, resource.file_path]);

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      loadResource();
    } else {
      // Clean up blob URL
      if (viewUrl) {
        URL.revokeObjectURL(viewUrl);
        setViewUrl(null);
      }
    }
    onOpenChange(newOpen);
  };

  const isViewable = (mimeType: string | null): boolean => {
    if (!mimeType) return false;
    return (
      mimeType === "application/pdf" ||
      mimeType.startsWith("image/") ||
      mimeType.startsWith("video/") ||
      mimeType.startsWith("text/")
    );
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-[70vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-[70vh] text-muted-foreground">
          <p className="mb-4">{error}</p>
          <Button onClick={loadResource}>Try Again</Button>
        </div>
      );
    }

    if (!viewUrl) {
      return (
        <div className="flex items-center justify-center h-[70vh] text-muted-foreground">
          <p>No content to display</p>
        </div>
      );
    }

    const mimeType = resource.mime_type;

    if (mimeType === "application/pdf") {
      return (
        <div className="flex flex-col h-[70vh]">
          <div className="flex justify-end mb-2">
            <Button variant="outline" size="sm" onClick={() => window.open(viewUrl, "_blank")}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Open in New Tab
            </Button>
          </div>
          <object
            data={viewUrl}
            type="application/pdf"
            className="w-full flex-1 border rounded-md"
            title={resource.title}
          >
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <p className="mb-4">PDF preview is blocked by your browser.</p>
              <Button onClick={() => window.open(viewUrl, "_blank")}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Open PDF in New Tab
              </Button>
            </div>
          </object>
        </div>
      );
    }

    if (mimeType?.startsWith("image/")) {
      return (
        <div className="flex items-center justify-center h-[70vh]">
          <img
            src={viewUrl}
            alt={resource.title}
            className="max-w-full max-h-full object-contain"
          />
        </div>
      );
    }

    if (mimeType?.startsWith("video/")) {
      return (
        <video
          src={viewUrl}
          controls
          className="w-full h-[70vh]"
          controlsList={resource.downloadable ? "" : "nodownload"}
        >
          Your browser does not support video playback.
        </video>
      );
    }

    // For text files
    if (mimeType?.startsWith("text/")) {
      return (
        <iframe
          src={viewUrl}
          className="w-full h-[70vh] border rounded-md bg-background"
          title={resource.title}
        />
      );
    }

    // Fallback for non-viewable files
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] text-muted-foreground">
        <p className="mb-4">This file type cannot be previewed in the browser.</p>
        {resource.downloadable && (
          <Button asChild>
            <a href={viewUrl} download={resource.file_name || "download"}>
              <Download className="h-4 w-4 mr-2" />
              Download File
            </a>
          </Button>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-5xl h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            {resource.title}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-hidden">{renderContent()}</div>
      </DialogContent>
    </Dialog>
  );
}
