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
 * Send an xAPI statement to our LRS endpoint.
 * Runs from the parent window (app origin) so no CORS issues.
 */
function sendXapiStatement(
  endpoint: string,
  auth: string,
  actor: object,
  activityId: string,
  verbId: string,
  verbDisplay: string,
  result?: Record<string, unknown>,
) {
  const stmt: Record<string, unknown> = {
    actor,
    verb: { id: verbId, display: { "en-US": verbDisplay } },
    object: {
      objectType: "Activity",
      id: activityId,
      definition: { type: "http://adlnet.gov/expapi/activities/lesson" },
    },
    timestamp: new Date().toISOString(),
  };
  if (result) stmt.result = result;

  fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: auth,
      "Content-Type": "application/json",
      "X-Experience-API-Version": "1.0.3",
    },
    body: JSON.stringify(stmt),
  }).catch((e) => console.warn("[xAPI] Statement send failed:", e));
}

/**
 * Install the LMS API mock on the parent window so Rise content in the
 * blob-URL iframe can find it via window.parent.IsLmsPresent(), etc.
 *
 * Rise's scormcontent/index.html walks up the frame hierarchy checking
 * window.parent, window.parent.parent, etc. for these global functions.
 * Since our iframe is a blob: URL, window.parent is the React app's window.
 *
 * Returns a cleanup function that removes all the globals.
 */
function installLmsApiOnWindow(
  endpoint: string,
  auth: string,
  actor: object,
  activityId: string,
): () => void {
  const win = window as Record<string, unknown>;
  const installedKeys: string[] = [];

  function install(name: string, fn: (...args: unknown[]) => unknown) {
    win[name] = fn;
    installedKeys.push(name);
  }

  const send = (
    verbId: string,
    verbDisplay: string,
    result?: Record<string, unknown>,
  ) => sendXapiStatement(endpoint, auth, actor, activityId, verbId, verbDisplay, result);

  // Send "initialized" on install
  send("http://adlnet.gov/expapi/verbs/initialized", "initialized");

  // ── Core SCORM/xAPI driver API that Rise expects ──
  install("IsLmsPresent", () => true);
  install("GetBookmark", () => "");
  install("SetBookmark", () => "true");
  install("GetDataChunk", () => "");
  install("SetDataChunk", () => "true");
  install("CommitData", () => "true");
  install("Finish", () => {
    send("http://adlnet.gov/expapi/verbs/terminated", "terminated");
    return "true";
  });
  install("SetReachedEnd", () => {
    send("http://adlnet.gov/expapi/verbs/completed", "completed", {
      completion: true,
      duration: "PT0S",
    });
    return "true";
  });
  install("SetFailed", () => {
    send("http://adlnet.gov/expapi/verbs/failed", "failed", { success: false });
    return "true";
  });
  install("SetPassed", () => {
    send("http://adlnet.gov/expapi/verbs/passed", "passed", { success: true });
    return "true";
  });
  install("SetScore", () => "true");
  install("GetScore", () => "");
  install("GetStatus", () => "incomplete");
  install("SetStatus", () => "true");
  install("GetProgressMeasure", () => "");
  install("SetProgressMeasure", (val: unknown) => {
    if (parseFloat(String(val)) >= 1) {
      send("http://adlnet.gov/expapi/verbs/completed", "completed", {
        completion: true,
      });
    }
    return "true";
  });
  install("GetMaxTimeAllowed", () => "");
  install("GetTimeLimitAction", () => "");
  install("SetSessionTime", () => "true");
  install("GetEntryMode", () => "ab-initio");
  install("GetLessonMode", () => "normal");
  install("GetTakingForCredit", () => "credit");
  install("FlushData", () => "true");
  install("ConcedeControl", () => {
    send("http://adlnet.gov/expapi/verbs/terminated", "terminated");
    return "true";
  });

  // ── Additional functions Rise xAPI exports look for ──
  install("GetStudentID", () => "");
  install("SetLanguagePreference", () => "true");
  install("SetObjectiveStatus", () => "true");
  install("CreateResponseIdentifier", () => "");
  install("MatchingResponse", () => "");
  install("RecordFillInInteraction", () => "true");
  install("RecordMatchingInteraction", () => "true");
  install("RecordMultipleChoiceInteraction", () => "true");
  install("WriteToDebug", () => "");

  // ── xAPI-specific TCAPI functions ──
  install("TCAPI_SetCompleted", () => {
    send("http://adlnet.gov/expapi/verbs/completed", "completed", {
      completion: true,
    });
    return "true";
  });
  install("TCAPI_SetProgressMeasure", (val: unknown) => {
    if (parseFloat(String(val)) >= 1) {
      send("http://adlnet.gov/expapi/verbs/completed", "completed", {
        completion: true,
      });
    }
    return "true";
  });

  // Handle page unload — send terminated
  let terminated = false;
  const onBeforeUnload = () => {
    if (!terminated) {
      terminated = true;
      send("http://adlnet.gov/expapi/verbs/terminated", "terminated");
    }
  };
  window.addEventListener("beforeunload", onBeforeUnload);

  // Return cleanup function
  return () => {
    window.removeEventListener("beforeunload", onBeforeUnload);
    for (const key of installedKeys) {
      delete win[key];
    }
  };
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
 *    credentials. The LMS API mock is installed on the parent window (this window)
 *    so Rise content in the blob iframe can find it via window.parent.XXX().
 *    xAPI statements are sent from the parent window (app origin) to avoid CORS.
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
  const lmsCleanupRef = useRef<(() => void) | null>(null);

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

          const launchData = (await launchResp.json()) as {
            launchUrl: string;
            sessionId: string;
            xapiConfig: {
              endpoint: string;
              auth: string;
              actor: object;
              activityId: string;
            };
          };
          sessionIdRef.current = launchData.sessionId;

          // Install the LMS API mock on THIS window (the parent of the iframe).
          // Rise content in the blob iframe calls window.parent.IsLmsPresent() etc.
          // xAPI statements are sent from here (app origin) — no CORS issues.
          if (lmsCleanupRef.current) lmsCleanupRef.current();
          lmsCleanupRef.current = installLmsApiOnWindow(
            launchData.xapiConfig.endpoint,
            launchData.xapiConfig.auth,
            launchData.xapiConfig.actor,
            launchData.xapiConfig.activityId,
          );

          // Fetch the content HTML (without xAPI query params — those are no longer needed
          // since the LMS mock lives on the parent window, not injected into the HTML).
          const contentUrl =
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/serve-content-package` +
            `?module=${moduleId}&path=scormcontent/index.html&token=${accessToken}`;
          const htmlResp = await fetch(contentUrl);
          if (!htmlResp.ok) {
            const errText = await htmlResp.text();
            throw new Error(errText || `HTTP ${htmlResp.status}`);
          }

          const html = await htmlResp.text();
          if (!cancelled) {
            const blob = new Blob([html], { type: "text/html" });
            objectUrl = URL.createObjectURL(blob);
            setBlobUrl(objectUrl);
            startCompletionPolling(launchData.sessionId);
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

  // Clean up polling and LMS API on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      if (lmsCleanupRef.current) {
        lmsCleanupRef.current();
        lmsCleanupRef.current = null;
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
