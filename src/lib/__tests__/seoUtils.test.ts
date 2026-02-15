import { describe, it, expect } from "vitest";
import { buildOrganizationJsonLd, buildWebPageJsonLd } from "../seoUtils";

describe("buildOrganizationJsonLd", () => {
  it("uses dynamic origin in url and logo", () => {
    const origin = "https://app.innotrue.com";
    const json = buildOrganizationJsonLd(origin);
    expect(json.url).toBe(origin);
    expect(json.logo).toBe(`${origin}/pwa-512x512.png`);
  });

  it("uses localhost origin when provided", () => {
    const origin = "http://localhost:5173";
    const json = buildOrganizationJsonLd(origin);
    expect(json.url).toBe(origin);
    expect(json.logo).toBe("http://localhost:5173/pwa-512x512.png");
  });

  it("returns valid Organization schema shape", () => {
    const json = buildOrganizationJsonLd("https://example.com") as Record<string, unknown>;
    expect(json["@type"]).toBe("Organization");
    expect(json.name).toBe("InnoTrue");
    expect(Array.isArray(json.sameAs)).toBe(true);
  });
});

describe("buildWebPageJsonLd", () => {
  it("uses dynamic origin in isPartOf.url", () => {
    const origin = "https://app.innotrue.com";
    const json = buildWebPageJsonLd("Dashboard", "My dashboard", "https://app.innotrue.com/dashboard", origin);
    expect(json.isPartOf).toBeDefined();
    expect((json.isPartOf as { url: string }).url).toBe(origin);
  });

  it("uses pageUrl for the page url", () => {
    const pageUrl = "https://staging.example.com/custom-page";
    const json = buildWebPageJsonLd("Custom", "Desc", pageUrl, "https://staging.example.com");
    expect(json.url).toBe(pageUrl);
  });

  it("returns valid WebPage schema shape", () => {
    const json = buildWebPageJsonLd("FAQ", "Frequently asked", "https://x.com/faq", "https://x.com");
    expect(json["@type"]).toBe("WebPage");
    expect(json.name).toBe("FAQ");
    expect(json.description).toBe("Frequently asked");
    const isPartOf = json.isPartOf as Record<string, string>;
    expect(isPartOf["@type"]).toBe("WebSite");
  });
});
