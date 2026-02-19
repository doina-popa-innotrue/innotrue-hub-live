import { useEffect, useRef, useState, useCallback } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ContentPackageViewerProps {
  moduleId: string;
  accessToken: string;
  title: string;
  /** "web" = Rise Web embed (blob URL proxy), "xapi" = Rise xAPI with tracking */
  contentPackageType?: "web" | "xapi";
  /** Callback when xAPI reports module completion */
  onXapiComplete?: () => void;
}

/**
 * Renders a Rise content package inside an iframe.
 *
 * Supports two modes:
 *
 * 1. **Web mode** (default): Fetches HTML via serve-content-package edge function,
 *    creates a Blob URL to bypass Supabase's text/html → text/plain rewrite.
 *
 * 2. **xAPI mode**: Calls xapi-launch to get a launch URL with embedded LRS
 *    credentials. Rise xAPI content sends completion statements to our
 *    xapi-statements endpoint, which auto-updates module_progress.
 *    The Blob URL workaround is used here too because the launch URL still
 *    goes through serve-content-package for auth-gated access.
 */
export function ContentPackageViewer({
  moduleId,
  accessToken,
  title,
  contentPackageType = "web",
  onXapiComplete,
}: ContentPackageViewerProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [xapiCompleted, setXapiCompleted] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const sessionIdRef = useRef<string | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── xAPI completion polling ──────────────────────────────────
  const startCompletionPolling = useCallback(
    (sessionId: string) => {
      // Poll xapi_sessions for completion status every 10 seconds
      pollIntervalRef.current = setInterval(async () => {
        try {
          const { data } = await supabase
            .from("xapi_sessions")
            .select("status")
            .eq("id", sessionId)
            .single();

          if (data?.status === "completed" || data?.status === "terminated") {
            setXapiCompleted(true);
            onXapiComplete?.();
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
          }
        } catch {
          // Ignore polling errors — session may not be accessible yet
        }
      }, 10_000);
    },
    [onXapiComplete],
  );

  // ─── Load content ─────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    const loadContent = async () => {
      try {
        setLoading(true);
        setError(null);

        if (contentPackageType === "xapi") {
          // ── xAPI mode: get launch URL from xapi-launch ──
          const { data: sessionData } = await supabase.auth.getSession();
          const jwt = sessionData?.session?.access_token;
          if (!jwt) throw new Error("Not authenticated");

          const launchResp = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/xapi-launch`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${jwt}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ moduleId }),
            },
          );

          if (!launchResp.ok) {
            const errBody = await launchResp.json().catch(() => ({}));
            throw new Error(
              (errBody as { error?: string }).error ||
                `Launch failed: HTTP ${launchResp.status}`,
            );
          }

          const { launchUrl, sessionId } = (await launchResp.json()) as {
            launchUrl: string;
            sessionId: string;
          };
          sessionIdRef.current = sessionId;

          // Fetch the xAPI HTML through the launch URL (which goes through
          // serve-content-package with xAPI query params appended).
          // We need the blob URL workaround here too for text/plain bypass.
          const htmlResp = await fetch(
            launchUrl + `&token=${accessToken}`,
          );
          if (!htmlResp.ok) {
            const errText = await htmlResp.text();
            throw new Error(errText || `HTTP ${htmlResp.status}`);
          }

          const html = await htmlResp.text();
          if (!cancelled) {
            const blob = new Blob([html], { type: "text/html" });
            objectUrl = URL.createObjectURL(blob);
            setBlobUrl(objectUrl);
            startCompletionPolling(sessionId);
          }
        } else {
          // ── Web mode: direct blob URL proxy ──
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
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load content",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadContent();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [moduleId, accessToken, contentPackageType, startCompletionPolling]);

  // Clean up blob URL on unmount
  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

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
    <div className="relative">
      {xapiCompleted && (
        <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1.5 text-sm font-medium text-green-800 shadow-sm">
          <CheckCircle2 className="h-4 w-4" />
          Completed
        </div>
      )}
      <iframe
        ref={iframeRef}
        src={blobUrl}
        className="w-full border-0 rounded-lg"
        style={{ minHeight: "75vh" }}
        title={title}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        allow="autoplay; fullscreen"
      />
    </div>
  );
}
