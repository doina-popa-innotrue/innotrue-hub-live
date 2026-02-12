import { onCLS, onINP, onLCP, onFCP, onTTFB, type Metric } from "web-vitals";

/**
 * Reports Core Web Vitals metrics.
 * - In production: sends metrics to Sentry as custom measurements
 * - In development: logs metrics to the console
 *
 * Metrics tracked:
 * - CLS (Cumulative Layout Shift) — visual stability
 * - INP (Interaction to Next Paint) — responsiveness (replaces FID)
 * - LCP (Largest Contentful Paint) — loading performance
 * - FCP (First Contentful Paint) — perceived load speed
 * - TTFB (Time to First Byte) — server responsiveness
 */
function sendToAnalytics(metric: Metric) {
  if (import.meta.env.DEV) {
    console.log(`[Web Vital] ${metric.name}: ${metric.value.toFixed(2)} (${metric.rating})`);
    return;
  }

  // Send to Sentry as custom measurement if available
  try {
    import("@sentry/react").then((Sentry) => {
      Sentry.metrics?.distribution(metric.name, metric.value, {
        unit: metric.name === "CLS" ? "" : "millisecond",
      });
    });
  } catch {
    // Sentry not available, silently skip
  }
}

export function reportWebVitals() {
  onCLS(sendToAnalytics);
  onINP(sendToAnalytics);
  onLCP(sendToAnalytics);
  onFCP(sendToAnalytics);
  onTTFB(sendToAnalytics);
}
