import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

interface ContentPackageViewerProps {
  moduleId: string;
  accessToken: string;
  title: string;
}

/**
 * Renders a Rise/web content package inside an iframe.
 *
 * Supabase Edge Functions rewrite Content-Type: text/html → text/plain
 * on the default domain (gateway-level enforcement). Direct iframe src
 * to the edge function renders raw HTML source as text.
 *
 * Workaround: fetch the HTML via JS, create a Blob URL with the correct
 * MIME type, and use that as the iframe src. The Blob URL:
 *  - Has its own origin (not subject to parent CSP)
 *  - Correctly serves text/html so the browser renders it
 *  - Allows the Rise JS to load sub-resources from the proxy
 */
export function ContentPackageViewer({
  moduleId,
  accessToken,
  title,
}: ContentPackageViewerProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    const fetchContent = async () => {
      try {
        setLoading(true);
        setError(null);

        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/serve-content-package?module=${moduleId}&path=index.html&token=${accessToken}`;
        const resp = await fetch(url);

        if (!resp.ok) {
          const errText = await resp.text();
          throw new Error(errText || `HTTP ${resp.status}`);
        }

        const html = await resp.text();

        if (!cancelled) {
          const blob = new Blob([html], { type: "text/html" });
          objectUrl = URL.createObjectURL(blob);
          setBlobUrl(objectUrl);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load content"
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchContent();

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [moduleId, accessToken]);

  // Clean up blob URL on unmount
  useEffect(() => {
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [blobUrl]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">
          Loading learning content...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-destructive">
        <p>Failed to load learning content</p>
        <p className="text-sm text-muted-foreground mt-1">{error}</p>
      </div>
    );
  }

  if (!blobUrl) return null;

  return (
    <iframe
      ref={iframeRef}
      src={blobUrl}
      className="w-full border-0 rounded-lg"
      style={{ minHeight: "75vh" }}
      title={title}
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      allow="autoplay; fullscreen"
    />
  );
}
