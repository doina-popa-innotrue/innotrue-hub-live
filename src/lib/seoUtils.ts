/**
 * Pure helpers for SEO JSON-LD generation with explicit origin.
 * Use these when you need testable, environment-agnostic output (e.g. origin from config or window).
 */

/**
 * Generate JSON-LD for an Organization. Uses the given origin for url and logo.
 */
export function buildOrganizationJsonLd(origin: string): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "InnoTrue",
    url: origin,
    logo: `${origin}/pwa-512x512.png`,
    sameAs: [],
  };
}

/**
 * Generate JSON-LD for a WebPage. Uses the given origin for isPartOf.url.
 */
export function buildWebPageJsonLd(
  title: string,
  description: string,
  pageUrl: string,
  origin: string,
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: title,
    description,
    url: pageUrl,
    isPartOf: {
      "@type": "WebSite",
      name: "InnoTrue Hub",
      url: origin,
    },
  };
}
