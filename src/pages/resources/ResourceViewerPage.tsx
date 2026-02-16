import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Loader2,
  ExternalLink,
  Download,
  ArrowLeft,
  FileText,
  Image as ImageIcon,
  Video,
  File,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { PageLoadingState } from "@/components/ui/page-loading-state";
import { ErrorState } from "@/components/ui/error-state";

interface Resource {
  id: string;
  title: string;
  description: string | null;
  file_path: string | null;
  file_name: string | null;
  mime_type: string | null;
  url: string | null;
  downloadable: boolean;
  resource_type: string;
}

export default function ResourceViewerPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [resource, setResource] = useState<Resource | null>(null);
  const [viewUrl, setViewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadResource = useCallback(async () => {
    if (!id) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch resource metadata
      const { data, error: fetchError } = await supabase
        .from("resource_library")
        .select(
          "id, title, description, file_path, file_name, mime_type, url, downloadable, resource_type",
        )
        .eq("id", id)
        .single();

      if (fetchError) throw fetchError;
      if (!data) throw new Error("Resource not found");

      setResource(data);

      // If it's a file-based resource, get the blob URL
      if (data.file_path) {
        const { data: fileData, error: downloadError } = await supabase.storage
          .from("resource-library")
          .download(data.file_path);

        if (downloadError) throw downloadError;

        const url = URL.createObjectURL(fileData);
        setViewUrl(url);
      } else if (data.url) {
        // External link - we'll display info about it
        setViewUrl(data.url);
      }
    } catch (err: any) {
      console.error("Resource load error:", err);
      setError(err.message || "Failed to load resource");
      toast.error("Failed to load resource");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadResource();

    // Cleanup blob URL on unmount
    return () => {
      if (viewUrl && viewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(viewUrl);
      }
    };
  }, [loadResource]);

  // Prevent right-click on non-downloadable content
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (resource && !resource.downloadable) {
        e.preventDefault();
        toast.info("Downloads are disabled for this resource");
      }
    },
    [resource],
  );

  const handleDownload = async () => {
    if (!resource?.file_path || !resource.downloadable) return;

    try {
      const { data, error } = await supabase.storage
        .from("resource-library")
        .download(resource.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = resource.file_name || resource.title;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Download started");
    } catch (err) {
      console.error("Download error:", err);
      toast.error("Failed to download file");
    }
  };

  const getResourceIcon = (type: string) => {
    switch (type) {
      case "video":
        return Video;
      case "image":
        return ImageIcon;
      case "document":
        return FileText;
      case "link":
        return ExternalLink;
      default:
        return File;
    }
  };

  const renderContent = () => {
    if (loading) {
      return <PageLoadingState />;
    }

    if (error || !resource) {
      return (
        <ErrorState title="Not Found" description={error || "The requested resource could not be found."} />
      );
    }

    // External link
    if (resource.resource_type === "link" && resource.url) {
      return (
        <div className="flex flex-col items-center justify-center h-[50vh] text-center">
          <ExternalLink className="h-16 w-16 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">External Resource</h3>
          <p className="text-muted-foreground mb-4 max-w-md">{resource.description}</p>
          <Button onClick={() => window.open(resource.url!, "_blank")}>
            <ExternalLink className="h-4 w-4 mr-2" />
            Open Link
          </Button>
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

    // PDF viewer
    if (mimeType === "application/pdf") {
      return (
        <div className="flex flex-col h-[75vh]" onContextMenu={handleContextMenu}>
          <div className="flex justify-end mb-2 gap-2">
            <Button variant="outline" size="sm" onClick={() => window.open(viewUrl, "_blank")}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Open in New Tab
            </Button>
            {resource.downloadable && (
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            )}
          </div>
          <object
            data={viewUrl + (resource.downloadable ? "" : "#toolbar=0")}
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

    // Image viewer
    if (mimeType?.startsWith("image/")) {
      return (
        <div
          className="flex flex-col items-center justify-center h-[75vh]"
          onContextMenu={handleContextMenu}
        >
          <img
            src={viewUrl}
            alt={resource.title}
            className="max-w-full max-h-[65vh] object-contain rounded-md"
            draggable={resource.downloadable}
          />
          {resource.downloadable && (
            <Button variant="outline" size="sm" onClick={handleDownload} className="mt-4">
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          )}
        </div>
      );
    }

    // Video viewer
    if (mimeType?.startsWith("video/")) {
      return (
        <div className="flex flex-col" onContextMenu={handleContextMenu}>
          <video
            src={viewUrl}
            controls
            className="w-full max-h-[70vh] rounded-md"
            controlsList={resource.downloadable ? "" : "nodownload"}
            onContextMenu={handleContextMenu}
          >
            Your browser does not support video playback.
          </video>
          {!resource.downloadable && (
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
              <Lock className="h-3 w-3" />
              Downloads disabled for this resource
            </p>
          )}
        </div>
      );
    }

    // Text/code files
    if (mimeType?.startsWith("text/")) {
      return (
        <div className="h-[75vh]" onContextMenu={handleContextMenu}>
          <iframe
            src={viewUrl}
            className="w-full h-full border rounded-md bg-background"
            title={resource.title}
          />
        </div>
      );
    }

    // Fallback for non-viewable files
    const ResourceIcon = getResourceIcon(resource.resource_type);
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-muted-foreground">
        <ResourceIcon className="h-16 w-16 mb-4" />
        <p className="mb-2 font-medium">{resource.file_name || resource.title}</p>
        <p className="mb-4 text-sm">This file type cannot be previewed in the browser.</p>
        {resource.downloadable ? (
          <Button onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" />
            Download File
          </Button>
        ) : (
          <p className="text-sm flex items-center gap-1">
            <Lock className="h-4 w-4" />
            Downloads are disabled for this resource
          </p>
        )}
      </div>
    );
  };

  const ResourceIcon = resource ? getResourceIcon(resource.resource_type) : File;

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-6xl mx-auto py-6 px-4">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                {resource && <ResourceIcon className="h-6 w-6 text-muted-foreground mt-1" />}
                <div>
                  <CardTitle>{resource?.title || "Loading..."}</CardTitle>
                  {resource?.description && (
                    <p className="text-sm text-muted-foreground mt-1">{resource.description}</p>
                  )}
                </div>
              </div>
              {resource && !resource.downloadable && (
                <span className="text-xs text-muted-foreground flex items-center gap-1 bg-muted px-2 py-1 rounded">
                  <Lock className="h-3 w-3" />
                  View only
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent>{renderContent()}</CardContent>
        </Card>
      </div>
    </div>
  );
}
