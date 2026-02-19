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
 * Supabase Edge Functions rewrite `Content-Type: text/html` to `text/plain`
 * on the default domain (gateway-level enforcement). To work around this we
 * fetch the HTML via JS (where Content-Type doesn't affect rendering) and
 * inject it into the iframe via `srcdoc`.
 */
export function ContentPackageViewer({
  moduleId,
  accessToken,
  title,
}: ContentPackageViewerProps) {
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchHtml = async () => {
      try {
        setLoading(true);
        setError(null);

        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/serve-content-package?module=${moduleId}&path=index.html&token=${accessToken}`;
        const resp = await fetch(url);

        if (!resp.ok) {
          const errText = await resp.text();
          throw new Error(errText || `HTTP ${resp.status}`);
        }

        const text = await resp.text();
        if (!cancelled) {
          setHtml(text);
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

    fetchHtml();

    return () => {
      cancelled = true;
    };
  }, [moduleId, accessToken]);

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

  if (!html) return null;

  return (
    <iframe
      ref={iframeRef}
      srcDoc={html}
      className="w-full border-0 rounded-lg"
      style={{ minHeight: "75vh" }}
      title={title}
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      allow="autoplay; fullscreen"
    />
  );
}
