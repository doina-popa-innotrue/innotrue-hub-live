import { useEffect } from "react";

interface SEOHeadProps {
  /** Page title - will be appended with site name */
  title?: string;
  /** Meta description (max 160 chars recommended) */
  description?: string;
  /** Canonical URL for the page */
  canonicalUrl?: string;
  /** Open Graph image URL */
  ogImage?: string;
  /** Open Graph type (default: website) */
  ogType?: "website" | "article" | "product";
  /** Twitter card type (default: summary_large_image) */
  twitterCard?: "summary" | "summary_large_image";
  /** Disable indexing for this page */
  noIndex?: boolean;
  /** Disable following links for this page */
  noFollow?: boolean;
  /** Article published date (for articles) */
  publishedTime?: string;
  /** Article modified date (for articles) */
  modifiedTime?: string;
  /** Article author (for articles) */
  author?: string;
  /** JSON-LD structured data */
  jsonLd?: Record<string, unknown>;
}

const SITE_NAME = "InnoTrue Hub";
const DEFAULT_DESCRIPTION =
  "InnoTrue Hub - Your learning and development platform for personal and professional growth.";
const DEFAULT_OG_IMAGE = "/pwa-512x512.png";

/**
 * SEO component for managing page-specific meta tags.
 * Updates document head with SEO-relevant meta tags.
 *
 * @example
 * ```tsx
 * <SEOHead
 *   title="Dashboard"
 *   description="View your learning progress and upcoming sessions"
 *   canonicalUrl="https://app.innotrue.com/dashboard"
 * />
 * ```
 */
export function SEOHead({
  title,
  description = DEFAULT_DESCRIPTION,
  canonicalUrl,
  ogImage = DEFAULT_OG_IMAGE,
  ogType = "website",
  twitterCard = "summary_large_image",
  noIndex = false,
  noFollow = false,
  publishedTime,
  modifiedTime,
  author,
  jsonLd,
}: SEOHeadProps): null {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : SITE_NAME;
  const truncatedDescription = description.slice(0, 160);

  useEffect(() => {
    // Update document title
    document.title = fullTitle;

    // Helper to update or create meta tag
    const updateMeta = (selector: string, attribute: string, content: string) => {
      let element = document.querySelector(selector) as HTMLMetaElement | null;
      if (!element) {
        element = document.createElement("meta");
        const attrName = selector.includes("property=") ? "property" : "name";
        const attrValue = selector.match(/["']([^"']+)["']/)?.[1];
        if (attrValue) {
          element.setAttribute(attrName, attrValue);
        }
        document.head.appendChild(element);
      }
      element.setAttribute(attribute, content);
    };

    // Basic meta tags
    updateMeta('meta[name="description"]', "content", truncatedDescription);

    // Robots
    const robotsContent = [noIndex ? "noindex" : "index", noFollow ? "nofollow" : "follow"].join(
      ", ",
    );
    updateMeta('meta[name="robots"]', "content", robotsContent);

    // Open Graph
    updateMeta('meta[property="og:title"]', "content", fullTitle);
    updateMeta('meta[property="og:description"]', "content", truncatedDescription);
    updateMeta('meta[property="og:type"]', "content", ogType);
    if (ogImage) {
      const absoluteOgImage = ogImage.startsWith("http")
        ? ogImage
        : `${window.location.origin}${ogImage}`;
      updateMeta('meta[property="og:image"]', "content", absoluteOgImage);
    }
    if (canonicalUrl) {
      updateMeta('meta[property="og:url"]', "content", canonicalUrl);
    }

    // Twitter
    updateMeta('meta[name="twitter:card"]', "content", twitterCard);
    updateMeta('meta[name="twitter:title"]', "content", fullTitle);
    updateMeta('meta[name="twitter:description"]', "content", truncatedDescription);
    if (ogImage) {
      const absoluteOgImage = ogImage.startsWith("http")
        ? ogImage
        : `${window.location.origin}${ogImage}`;
      updateMeta('meta[name="twitter:image"]', "content", absoluteOgImage);
    }

    // Article meta (for blog posts, etc.)
    if (ogType === "article") {
      if (publishedTime) {
        updateMeta('meta[property="article:published_time"]', "content", publishedTime);
      }
      if (modifiedTime) {
        updateMeta('meta[property="article:modified_time"]', "content", modifiedTime);
      }
      if (author) {
        updateMeta('meta[property="article:author"]', "content", author);
      }
    }

    // Canonical URL
    let canonicalLink = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (canonicalUrl) {
      if (!canonicalLink) {
        canonicalLink = document.createElement("link");
        canonicalLink.rel = "canonical";
        document.head.appendChild(canonicalLink);
      }
      canonicalLink.href = canonicalUrl;
    } else if (canonicalLink) {
      canonicalLink.remove();
    }

    // JSON-LD structured data
    const existingJsonLd = document.querySelector('script[type="application/ld+json"][data-seo]');
    if (jsonLd) {
      const jsonLdScript = existingJsonLd || document.createElement("script");
      jsonLdScript.setAttribute("type", "application/ld+json");
      jsonLdScript.setAttribute("data-seo", "true");
      jsonLdScript.textContent = JSON.stringify({
        "@context": "https://schema.org",
        ...jsonLd,
      });
      if (!existingJsonLd) {
        document.head.appendChild(jsonLdScript);
      }
    } else if (existingJsonLd) {
      existingJsonLd.remove();
    }

    // Cleanup on unmount
    return () => {
      // Reset title to default
      document.title = SITE_NAME;
    };
  }, [
    fullTitle,
    truncatedDescription,
    canonicalUrl,
    ogImage,
    ogType,
    twitterCard,
    noIndex,
    noFollow,
    publishedTime,
    modifiedTime,
    author,
    jsonLd,
  ]);

  return null;
}

/**
 * Generate JSON-LD for an Organization
 */
export function generateOrganizationJsonLd() {
  return {
    "@type": "Organization",
    name: "InnoTrue",
    url: "https://app.innotrue.com",
    logo: "https://app.innotrue.com/pwa-512x512.png",
    sameAs: [] as string[],
  };
}

/**
 * Generate JSON-LD for a WebPage
 */
export function generateWebPageJsonLd(title: string, description: string, url: string) {
  return {
    "@type": "WebPage",
    name: title,
    description,
    url,
    isPartOf: {
      "@type": "WebSite",
      name: "InnoTrue Hub",
      url: "https://app.innotrue.com",
    },
  };
}

/**
 * Generate JSON-LD for a Course
 */
export function generateCourseJsonLd(course: {
  name: string;
  description: string;
  provider?: string;
  url?: string;
}) {
  return {
    "@type": "Course",
    name: course.name,
    description: course.description,
    provider: {
      "@type": "Organization",
      name: course.provider || "InnoTrue",
    },
    url: course.url,
  };
}

/**
 * Generate JSON-LD for FAQPage
 */
export function generateFAQJsonLd(faqs: Array<{ question: string; answer: string }>) {
  return {
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}
