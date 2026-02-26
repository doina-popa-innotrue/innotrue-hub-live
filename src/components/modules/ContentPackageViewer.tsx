import { useEffect, useRef, useState, useCallback } from "react";
import { Loader2, CheckCircle2, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface ContentPackageViewerProps {
  moduleId: string;
  accessToken: string;
  title: string;
  /** "web" = Rise Web embed (blob URL proxy), "xapi" = Rise xAPI with tracking */
  contentPackageType?: "web" | "xapi";
  /** Callback when xAPI reports module completion */
  onXapiComplete?: () => void;
  /** When true, suppress xAPI statement sending and show alumni read-only banner */
  readOnly?: boolean;
  /** Whether the viewer is in expanded (fullscreen overlay) mode */
  isExpanded?: boolean;
  /** Toggle expanded mode — keeps the component in the same React tree to avoid iframe reload */
  onToggleExpand?: () => void;
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
 * Save a state value (bookmark or suspend_data) to the xAPI session.
 * Uses the xapi-statements endpoint with ?stateId= parameter.
 */
function saveState(
  endpoint: string,
  auth: string,
  stateId: "bookmark" | "suspend_data",
  value: string,
) {
  fetch(`${endpoint}?stateId=${stateId}`, {
    method: "PUT",
    headers: {
      Authorization: auth,
      "Content-Type": "application/json",
      "X-Experience-API-Version": "1.0.3",
    },
    body: JSON.stringify({ value }),
  }).catch((e) => console.warn(`[xAPI] State save (${stateId}) failed:`, e));
}

/**
 * Install the LMS API mock on the parent window so Rise content in the
 * blob-URL iframe can find it via window.parent.IsLmsPresent(), etc.
 *
 * Rise's scormcontent/index.html walks up the frame hierarchy checking
 * window.parent, window.parent.parent, etc. for these global functions.
 * Since our iframe is a blob: URL, window.parent is the React app's window.
 *
 * When resuming a session, savedBookmark and savedSuspendData contain the
 * learner's previous position so Rise can restore where they left off.
 *
 * Returns a cleanup function that removes all the globals.
 */
function installLmsApiOnWindow(
  endpoint: string,
  auth: string,
  actor: object,
  activityId: string,
  savedBookmark = "",
  savedSuspendData = "",
  isResume = false,
  alumniReadOnly = false,
): () => void {
  const win = window as Record<string, unknown>;
  const installedKeys: string[] = [];

  // In-memory cache of bookmark and suspend_data.
  // Initialized from saved values (if resuming) and updated by Set calls.
  let currentBookmark = savedBookmark;
  let currentSuspendData = savedSuspendData;

  function install(name: string, fn: (...args: unknown[]) => unknown) {
    win[name] = fn;
    installedKeys.push(name);
  }

  const send = (
    verbId: string,
    verbDisplay: string,
    result?: Record<string, unknown>,
  ) => {
    // Suppress xAPI statement sending for alumni read-only access
    if (alumniReadOnly) return;
    sendXapiStatement(endpoint, auth, actor, activityId, verbId, verbDisplay, result);
  };

  // Send "initialized" (or "resumed") on install
  if (isResume) {
    send("http://adlnet.gov/expapi/verbs/resumed", "resumed");
  } else {
    send("http://adlnet.gov/expapi/verbs/initialized", "initialized");
  }

  // ── Core SCORM/xAPI driver API that Rise expects ──
  install("IsLmsPresent", () => true);

  // Bookmark = scroll/page position (cmi.core.lesson_location)
  install("GetBookmark", () => currentBookmark);
  install("SetBookmark", (val: unknown) => {
    currentBookmark = String(val ?? "");
    saveState(endpoint, auth, "bookmark", currentBookmark);
    return "true";
  });

  // DataChunk = full suspend data blob (cmi.suspend_data)
  install("GetDataChunk", () => currentSuspendData);
  install("SetDataChunk", (val: unknown) => {
    currentSuspendData = String(val ?? "");
    saveState(endpoint, auth, "suspend_data", currentSuspendData);
    return "true";
  });

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
  // "resume" tells Rise to restore from bookmark/suspend_data; "ab-initio" means fresh start
  install("GetEntryMode", () => (isResume ? "resume" : "ab-initio"));
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
  readOnly = false,
  isExpanded = false,
  onToggleExpand,
}: ContentPackageViewerProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [xapiCompleted, setXapiCompleted] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const sessionIdRef = useRef<string | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lmsCleanupRef = useRef<(() => void) | null>(null);

  // Keep a stable ref to the onXapiComplete callback so polling
  // doesn't trigger content-loading effect re-runs.
  const onXapiCompleteRef = useRef(onXapiComplete);
  useEffect(() => {
    onXapiCompleteRef.current = onXapiComplete;
  }, [onXapiComplete]);

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
            onXapiCompleteRef.current?.();
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
    [], // stable — no external dependencies; uses ref for callback
  );

  // Store the initial accessToken in a ref so JWT refreshes don't
  // cause the content-loading effect to re-run and destroy the iframe.
  const accessTokenRef = useRef(accessToken);
  useEffect(() => {
    // Only capture the first non-null token. Subsequent refreshes
    // shouldn't tear down the running Rise content.
    if (accessToken && !accessTokenRef.current) {
      accessTokenRef.current = accessToken;
    }
  }, [accessToken]);

  // ─── Load content ─────────────────────────────────────────────
  useEffect(() => {
    const token = accessTokenRef.current || accessToken;
    if (!token) return; // wait until we have an access token

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
            sessionId: string;
            resumed: boolean;
            bookmark: string;
            suspendData: string;
            xapiConfig: {
              endpoint: string;
              auth: string;
              actor: object;
              activityId: string;
            };
          };
          sessionIdRef.current = launchData.sessionId;

          if (launchData.resumed) {
            // Session resumed with bookmark data
          }

          // Install the LMS API mock on THIS window (the parent of the iframe).
          // Rise content in the blob iframe calls window.parent.IsLmsPresent() etc.
          // xAPI statements are sent from here (app origin) — no CORS issues.
          // Pass saved bookmark/suspendData for resume support.
          if (lmsCleanupRef.current) lmsCleanupRef.current();
          lmsCleanupRef.current = installLmsApiOnWindow(
            launchData.xapiConfig.endpoint,
            launchData.xapiConfig.auth,
            launchData.xapiConfig.actor,
            launchData.xapiConfig.activityId,
            launchData.bookmark || "",
            launchData.suspendData || "",
            launchData.resumed || false,
            readOnly || launchData.readOnly || false,
          );

          // Fetch the content HTML (without xAPI query params — those are no longer needed
          // since the LMS mock lives on the parent window, not injected into the HTML).
          const contentUrl =
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/serve-content-package` +
            `?module=${moduleId}&path=scormcontent/index.html&token=${token}`;
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
          const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/serve-content-package?module=${moduleId}&path=index.html&token=${token}`;
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
    // Only re-load if the module changes or package type changes.
    // accessToken is captured via ref to prevent JWT refresh from tearing down the iframe.
    // startCompletionPolling is stable (no deps) so won't cause re-runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleId, contentPackageType, startCompletionPolling]);

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

  // Escape key to collapse expanded view
  useEffect(() => {
    if (!isExpanded || !onToggleExpand) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onToggleExpand();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isExpanded, onToggleExpand]);

  // Lock body scroll when expanded
  useEffect(() => {
    if (!isExpanded) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isExpanded]);

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
    <div
      className={
        isExpanded
          ? "fixed inset-0 z-50 bg-background flex flex-col"
          : "relative"
      }
    >
      {/* Expanded header bar */}
      {isExpanded && (
        <div className="flex items-center justify-between border-b px-4 py-2 shrink-0">
          <h3 className="text-sm font-medium truncate">{title}</h3>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={onToggleExpand}
            title="Exit fullscreen (Esc)"
          >
            <Minimize2 className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Expand button in normal mode */}
      {!isExpanded && onToggleExpand && (
        <div className="absolute top-2 right-2 z-10 flex items-center gap-2">
          {xapiCompleted && (
            <div className="flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1.5 text-sm font-medium text-green-800 shadow-sm">
              <CheckCircle2 className="h-4 w-4" />
              Completed
            </div>
          )}
          <Button
            variant="secondary"
            size="icon"
            className="h-8 w-8 shadow-sm"
            onClick={onToggleExpand}
            title="Expand to fullscreen"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Completed badge when expanded */}
      {isExpanded && xapiCompleted && (
        <div className="absolute top-2 right-12 z-10 flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1.5 text-sm font-medium text-green-800 shadow-sm">
          <CheckCircle2 className="h-4 w-4" />
          Completed
        </div>
      )}

      {/* Completed badge when no expand button */}
      {!isExpanded && !onToggleExpand && xapiCompleted && (
        <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1.5 text-sm font-medium text-green-800 shadow-sm">
          <CheckCircle2 className="h-4 w-4" />
          Completed
        </div>
      )}

      {readOnly && (
        <div className={`${isExpanded ? "mx-4 mt-2" : "mb-2"} flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm font-medium text-amber-800`}>
          <svg className="h-4 w-4 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
          </svg>
          Read-Only — Alumni Access
        </div>
      )}

      <iframe
        ref={iframeRef}
        src={blobUrl}
        className={
          isExpanded
            ? "flex-1 w-full border-0"
            : "w-full border-0 rounded-lg"
        }
        style={isExpanded ? undefined : { minHeight: "75vh" }}
        title={title}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        allow="autoplay; fullscreen"
      />
    </div>
  );
}
