import * as Sentry from "@sentry/react";
import { createRoot } from "react-dom/client";
import { getErrorFingerprint } from "@/lib/sentry-utils";
import App from "./App.tsx";
import "./index.css";

// Initialize Sentry error monitoring (production only)
const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
if (sentryDsn && import.meta.env.VITE_APP_ENV === "production") {
  Sentry.init({
    dsn: sentryDsn,
    environment: "production",
    release: import.meta.env.VITE_APP_VERSION || undefined,
    integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
    // Performance monitoring — low sample rate to stay within free tier
    tracesSampleRate: 0.1,
    // Session replay — only capture replays when errors occur
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    // Custom error fingerprinting for cleaner issue grouping
    beforeSend(event, hint) {
      const error = hint.originalException;
      if (error instanceof Error) {
        const fingerprint = getErrorFingerprint(error);
        if (fingerprint) {
          event.fingerprint = fingerprint;
        }
      }
      // Filter out ResizeObserver loop errors (browser noise, not actionable)
      if (event.exception?.values?.[0]?.value?.includes("ResizeObserver loop")) {
        return null;
      }
      return event;
    },
    // Ignore common browser noise errors
    ignoreErrors: [
      // Browser extensions
      "top.GLOBALS",
      "originalCreateNotification",
      "canvas.contentDocument",
      // Chrome extensions
      /^chrome-extension:\/\//,
      /^moz-extension:\/\//,
      // Network errors (captured separately via breadcrumbs)
      "Failed to fetch",
      "NetworkError when attempting to fetch resource",
      "Load failed",
      // Service worker lifecycle
      "The operation was aborted",
      // Auth session refresh (handled gracefully by AuthContext)
      "Auth session missing!",
    ],
  });
}

createRoot(document.getElementById("root")!).render(<App />);

// Report Core Web Vitals (CLS, INP, LCP, FCP, TTFB)
import("@/lib/vitals").then(({ reportWebVitals }) => reportWebVitals());
