import * as Sentry from '@sentry/react';
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Initialize Sentry error monitoring (production only)
const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
if (sentryDsn && import.meta.env.VITE_APP_ENV === 'production') {
  Sentry.init({
    dsn: sentryDsn,
    environment: 'production',
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
    // Performance monitoring — low sample rate to stay within free tier
    tracesSampleRate: 0.1,
    // Session replay — only capture replays when errors occur
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
  });
}

// Temporary: expose Sentry on window for verification (remove after confirming)
(window as any).__SENTRY_API__ = Sentry;

createRoot(document.getElementById("root")!).render(<App />);
