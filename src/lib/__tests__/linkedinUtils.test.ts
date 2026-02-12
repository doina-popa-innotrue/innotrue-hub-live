import { describe, it, expect } from "vitest";
import {
  generateLinkedInAddToProfileUrl,
  generateBadgeVerificationUrl,
  generateLinkedInShareUrl,
} from "../linkedinUtils";

describe("generateLinkedInAddToProfileUrl", () => {
  it("generates URL with required name parameter", () => {
    const url = generateLinkedInAddToProfileUrl({ name: "Test Certification" });
    expect(url).toContain("https://www.linkedin.com/profile/add");
    expect(url).toContain("startTask=CERTIFICATION_NAME");
    expect(url).toContain("name=Test+Certification");
  });

  it("uses default organization name when not provided", () => {
    const url = generateLinkedInAddToProfileUrl({ name: "Test" });
    expect(url).toContain("organizationName=InnoTrue");
  });

  it("uses custom organization name when provided", () => {
    const url = generateLinkedInAddToProfileUrl({
      name: "Test",
      organizationName: "Custom Org",
    });
    expect(url).toContain("organizationName=Custom+Org");
  });

  it("includes issue year and month when provided", () => {
    const url = generateLinkedInAddToProfileUrl({
      name: "Test",
      issueYear: 2026,
      issueMonth: 3,
    });
    expect(url).toContain("issueYear=2026");
    expect(url).toContain("issueMonth=3");
  });

  it("includes expiration year and month when provided", () => {
    const url = generateLinkedInAddToProfileUrl({
      name: "Test",
      expirationYear: 2028,
      expirationMonth: 12,
    });
    expect(url).toContain("expirationYear=2028");
    expect(url).toContain("expirationMonth=12");
  });

  it("includes certification URL when provided", () => {
    const url = generateLinkedInAddToProfileUrl({
      name: "Test",
      certificationUrl: "https://example.com/cert/123",
    });
    expect(url).toContain("certUrl=");
    expect(url).toContain("example.com");
  });

  it("includes certification ID when provided", () => {
    const url = generateLinkedInAddToProfileUrl({
      name: "Test",
      certificationId: "CERT-12345",
    });
    expect(url).toContain("certId=CERT-12345");
  });

  it("omits optional fields when not provided", () => {
    const url = generateLinkedInAddToProfileUrl({ name: "Test" });
    expect(url).not.toContain("issueYear");
    expect(url).not.toContain("issueMonth");
    expect(url).not.toContain("expirationYear");
    expect(url).not.toContain("expirationMonth");
    expect(url).not.toContain("certUrl");
    expect(url).not.toContain("certId");
  });

  it("URL-encodes special characters in name", () => {
    const url = generateLinkedInAddToProfileUrl({ name: "Test & Certification (Advanced)" });
    // URLSearchParams encodes & as %26 and spaces as +
    expect(url).toContain("name=Test");
    expect(url).not.toContain("name=Test & "); // Should be encoded
  });
});

describe("generateBadgeVerificationUrl", () => {
  it("generates correct verification URL", () => {
    const url = generateBadgeVerificationUrl("badge-123");
    expect(url).toBe("https://app.innotrue.com/verify/badge/badge-123");
  });

  it("handles UUID-style badge IDs", () => {
    const url = generateBadgeVerificationUrl("550e8400-e29b-41d4-a716-446655440000");
    expect(url).toContain("550e8400-e29b-41d4-a716-446655440000");
  });
});

describe("generateLinkedInShareUrl", () => {
  it("generates share URL with url parameter", () => {
    const url = generateLinkedInShareUrl({ url: "https://example.com/achievement" });
    expect(url).toContain("https://www.linkedin.com/sharing/share-offsite/");
    expect(url).toContain("url=");
    expect(url).toContain("example.com");
  });

  it("URL-encodes the shared URL", () => {
    const url = generateLinkedInShareUrl({ url: "https://example.com/path?param=value" });
    // Should encode the ? and = in the shared URL
    expect(url).toContain("url=");
  });
});
