import { describe, it, expect, vi } from "vitest";
import {
  validateFile,
  validateFileCustom,
  sanitizeFilename,
  formatFileSize,
  acceptStringForBucket,
  ALLOWED_MIME_TYPES,
  FILE_SIZE_LIMITS,
  UPLOAD_PRESETS,
} from "../fileValidation";

// ---------------------------------------------------------------------------
// Helper: create a mock File with specified name, size, and MIME type
// ---------------------------------------------------------------------------
function mockFile(name: string, size: number, type: string): File {
  // Create ArrayBuffer of the desired size (cap at 1KB for tests; size is
  // checked via the `.size` property which `new File` sets from the blob).
  const buffer = new ArrayBuffer(Math.min(size, 1024));
  const blob = new Blob([buffer], { type });
  // Use the File constructor (supported by jsdom)
  return new File([blob], name, { type });
}

/**
 * For very large files we need a File whose `.size` matches without
 * actually allocating memory. We override via Object.defineProperty.
 */
function mockFileWithSize(name: string, size: number, type: string): File {
  const file = mockFile(name, 1, type);
  Object.defineProperty(file, "size", { value: size });
  return file;
}

// ===========================================================================
// validateFile
// ===========================================================================

describe("validateFile", () => {
  it("accepts a valid JPEG for the avatars bucket", () => {
    const file = mockFile("photo.jpg", 500_000, "image/jpeg");
    const result = validateFile(file, "avatars");
    expect(result).toEqual({ valid: true });
  });

  it("accepts a valid PNG for the avatars bucket", () => {
    const file = mockFile("icon.png", 100_000, "image/png");
    expect(validateFile(file, "avatars")).toEqual({ valid: true });
  });

  it("accepts a valid PDF for the resource-library bucket", () => {
    const file = mockFile("guide.pdf", 1_000_000, "application/pdf");
    expect(validateFile(file, "resource-library")).toEqual({ valid: true });
  });

  it("accepts a ZIP for the module-content-packages bucket", () => {
    const file = mockFile("package.zip", 10_000_000, "application/zip");
    expect(validateFile(file, "module-content-packages")).toEqual({ valid: true });
  });

  it("accepts a valid PDF for the psychometric-assessments bucket", () => {
    const file = mockFile("assessment.pdf", 5_000_000, "application/pdf");
    expect(validateFile(file, "psychometric-assessments")).toEqual({ valid: true });
  });

  it("rejects a PDF in an image-only bucket (avatars)", () => {
    const file = mockFile("doc.pdf", 500_000, "application/pdf");
    const result = validateFile(file, "avatars");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("not allowed");
  });

  it("rejects an oversized file for the avatars bucket (>2 MB)", () => {
    const file = mockFileWithSize("huge.jpg", 3 * 1024 * 1024, "image/jpeg");
    const result = validateFile(file, "avatars");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("too large");
  });

  it("rejects an empty file (size 0)", () => {
    const file = new File([], "empty.png", { type: "image/png" });
    const result = validateFile(file, "avatars");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("empty");
  });

  it("falls back to document defaults for an unknown bucket name", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    // A PDF should pass against document defaults
    const file = mockFile("doc.pdf", 1_000_000, "application/pdf");
    const result = validateFile(file, "non-existent-bucket");
    expect(result).toEqual({ valid: true });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("unknown bucket"),
    );
    warnSpy.mockRestore();
  });

  it("rejects wrong MIME for unknown bucket (falls back to document defaults)", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const file = mockFile("file.xyz", 1000, "application/x-unknown");
    const result = validateFile(file, "non-existent-bucket");
    expect(result.valid).toBe(false);
    warnSpy.mockRestore();
  });

  it("accepts a file exactly at the size limit for avatars", () => {
    const file = mockFileWithSize("exact.png", FILE_SIZE_LIMITS.image, "image/png");
    expect(validateFile(file, "avatars")).toEqual({ valid: true });
  });

  it("rejects a file 1 byte over the limit for avatars", () => {
    const file = mockFileWithSize("over.png", FILE_SIZE_LIMITS.image + 1, "image/png");
    const result = validateFile(file, "avatars");
    expect(result.valid).toBe(false);
  });
});

// ===========================================================================
// validateFileCustom
// ===========================================================================

describe("validateFileCustom", () => {
  const imageMimes = ALLOWED_MIME_TYPES.image;
  const maxSize = 2 * 1024 * 1024; // 2 MB

  it("accepts a valid file matching MIME and size", () => {
    const file = mockFile("photo.jpg", 500_000, "image/jpeg");
    expect(validateFileCustom(file, imageMimes, maxSize)).toEqual({ valid: true });
  });

  it("rejects a disallowed MIME type", () => {
    const file = mockFile("doc.pdf", 500_000, "application/pdf");
    const result = validateFileCustom(file, imageMimes, maxSize);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("not allowed");
    // Error should mention friendly MIME names
    expect(result.error).toContain("JPG");
  });

  it("rejects an oversized file with formatted sizes in error", () => {
    const file = mockFileWithSize("big.png", 5 * 1024 * 1024, "image/png");
    const result = validateFileCustom(file, imageMimes, maxSize);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("too large");
    expect(result.error).toContain("MB"); // formatted size
  });

  it("rejects an empty file (size 0)", () => {
    const file = new File([], "empty.jpg", { type: "image/jpeg" });
    const result = validateFileCustom(file, imageMimes, maxSize);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("File is empty.");
  });

  it("accepts a file exactly at the size limit", () => {
    const file = mockFileWithSize("exact.png", maxSize, "image/png");
    expect(validateFileCustom(file, imageMimes, maxSize)).toEqual({ valid: true });
  });

  it("rejects a file 1 byte over the limit", () => {
    const file = mockFileWithSize("over.png", maxSize + 1, "image/png");
    const result = validateFileCustom(file, imageMimes, maxSize);
    expect(result.valid).toBe(false);
  });

  it("handles a file with empty string MIME type", () => {
    const file = mockFile("noext", 100, "");
    const result = validateFileCustom(file, imageMimes, maxSize);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("unknown");
  });

  it("works with a single-item MIME list", () => {
    const file = mockFile("doc.pdf", 1000, "application/pdf");
    expect(validateFileCustom(file, ["application/pdf"], maxSize)).toEqual({ valid: true });
  });

  it("checks MIME before size (MIME error shown for wrong type even if also too large)", () => {
    const file = mockFileWithSize("doc.pdf", 100 * 1024 * 1024, "application/pdf");
    const result = validateFileCustom(file, imageMimes, maxSize);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("not allowed"); // MIME error, not size
  });
});

// ===========================================================================
// sanitizeFilename
// ===========================================================================

describe("sanitizeFilename", () => {
  it("passes through a clean filename unchanged", () => {
    expect(sanitizeFilename("my-document.pdf")).toBe("my-document.pdf");
  });

  it("replaces forward slashes with underscores", () => {
    expect(sanitizeFilename("path/to/file.txt")).toBe("path_to_file.txt");
  });

  it("replaces backslashes with underscores", () => {
    expect(sanitizeFilename("path\\to\\file.txt")).toBe("path_to_file.txt");
  });

  it("removes non-ASCII characters (replaces with underscore)", () => {
    const result = sanitizeFilename("café résumé.pdf");
    expect(result).not.toContain("é");
    expect(result).toContain(".pdf");
  });

  it("collapses multiple underscores to a single one", () => {
    expect(sanitizeFilename("a___b___c.txt")).toBe("a_b_c.txt");
  });

  it("collapses multiple spaces", () => {
    const result = sanitizeFilename("a   b   c.txt");
    expect(result).toBe("a b c.txt");
  });

  it("prepends underscore to hidden files (starting with dot)", () => {
    const result = sanitizeFilename(".htaccess");
    expect(result.startsWith("_")).toBe(true);
    expect(result).toContain(".htaccess");
  });

  it("truncates to 200 chars while preserving the extension", () => {
    const longName = "a".repeat(250) + ".pdf";
    const result = sanitizeFilename(longName);
    expect(result.length).toBeLessThanOrEqual(200);
    expect(result.endsWith(".pdf")).toBe(true);
  });

  it("truncates to 200 chars when no extension present", () => {
    const longName = "a".repeat(250);
    const result = sanitizeFilename(longName);
    expect(result.length).toBe(200);
  });

  it("returns 'unnamed_file' for empty string result", () => {
    // Characters that all get stripped to empty
    expect(sanitizeFilename("")).toBe("unnamed_file");
  });

  it("neutralizes path traversal attempts (removes slashes)", () => {
    const result = sanitizeFilename("../../etc/passwd");
    expect(result).not.toContain("/");
    expect(result).not.toContain("\\");
    // Dots remain (valid in filenames) but slashes are gone
    expect(result).toContain("passwd");
  });

  it("preserves parentheses in filenames", () => {
    expect(sanitizeFilename("report (final).pdf")).toBe("report (final).pdf");
  });
});

// ===========================================================================
// formatFileSize
// ===========================================================================

describe("formatFileSize", () => {
  it("formats bytes (< 1024)", () => {
    expect(formatFileSize(500)).toBe("500 B");
  });

  it("formats 0 bytes", () => {
    expect(formatFileSize(0)).toBe("0 B");
  });

  it("formats exactly 1024 bytes as KB", () => {
    expect(formatFileSize(1024)).toBe("1.0 KB");
  });

  it("formats kilobytes", () => {
    expect(formatFileSize(1536)).toBe("1.5 KB");
  });

  it("formats megabytes", () => {
    expect(formatFileSize(2 * 1024 * 1024)).toBe("2.0 MB");
  });

  it("formats gigabytes", () => {
    expect(formatFileSize(1.5 * 1024 * 1024 * 1024)).toBe("1.5 GB");
  });
});

// ===========================================================================
// acceptStringForBucket
// ===========================================================================

describe("acceptStringForBucket", () => {
  it("returns comma-separated MIME types for the avatars bucket", () => {
    const result = acceptStringForBucket("avatars");
    expect(result).toContain("image/jpeg");
    expect(result).toContain("image/png");
    expect(result.split(",").length).toBe(ALLOWED_MIME_TYPES.image.length);
  });

  it("returns MIME types for a document bucket", () => {
    const result = acceptStringForBucket("resource-library");
    expect(result).toContain("application/pdf");
    expect(result).toContain("video/mp4");
  });

  it("returns empty string for an unknown bucket", () => {
    expect(acceptStringForBucket("unknown-bucket-xyz")).toBe("");
  });

  it("matches the preset's allowedMimeTypes for psychometric-assessments", () => {
    const result = acceptStringForBucket("psychometric-assessments");
    const expected = UPLOAD_PRESETS["psychometric-assessments"].allowedMimeTypes.join(",");
    expect(result).toBe(expected);
  });

  it("returns ZIP MIME types for module-content-packages", () => {
    const result = acceptStringForBucket("module-content-packages");
    expect(result).toContain("application/zip");
  });
});

// ===========================================================================
// Constants sanity checks
// ===========================================================================

describe("UPLOAD_PRESETS", () => {
  it("has all expected bucket presets", () => {
    const expectedBuckets = [
      "avatars",
      "program-logos",
      "email-assets",
      "client-badges",
      "resource-library",
      "module-client-content",
      "module-assignment-attachments",
      "module-reflection-resources",
      "module-content-packages",
      "coach-feedback-attachments",
      "task-note-resources",
      "goal-resources",
      "development-item-files",
      "group-notes",
      "psychometric-assessments",
    ];
    for (const bucket of expectedBuckets) {
      expect(UPLOAD_PRESETS).toHaveProperty(bucket);
    }
  });

  it("each preset has required properties", () => {
    for (const [key, preset] of Object.entries(UPLOAD_PRESETS)) {
      expect(preset.allowedMimeTypes).toBeDefined();
      expect(preset.allowedMimeTypes.length).toBeGreaterThan(0);
      expect(preset.maxSizeBytes).toBeGreaterThan(0);
      expect(preset.label).toBeTruthy();
      expect(preset.friendlyTypes).toBeTruthy();
    }
  });
});
