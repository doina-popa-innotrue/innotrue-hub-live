/**
 * Shared file upload validation utility.
 *
 * Provides consistent file type, size, and name validation
 * across all upload interfaces in the application.
 */

// ---------------------------------------------------------------------------
// Allowed MIME types per bucket context
// ---------------------------------------------------------------------------

export const ALLOWED_MIME_TYPES = {
  /** Image-only buckets: avatars, program-logos, email-assets, client-badges */
  image: [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
  ],
  /** Document buckets: resource-library, module content, assignments, etc. */
  document: [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/plain",
    "text/csv",
    "application/json",
    "video/mp4",
    "video/webm",
    "audio/mpeg",
    "audio/wav",
    "audio/ogg",
  ],
  /** Assessment documents: PDFs and images */
  assessment: [
    "application/pdf",
    "image/jpeg",
    "image/png",
  ],
} as const;

// ---------------------------------------------------------------------------
// Size limits (bytes)
// ---------------------------------------------------------------------------

export const FILE_SIZE_LIMITS = {
  /** Avatar / logo images: 2 MB */
  image: 2 * 1024 * 1024,
  /** Documents / resources: 25 MB */
  document: 25 * 1024 * 1024,
  /** Video files: 100 MB */
  video: 100 * 1024 * 1024,
  /** Assessment PDFs: 10 MB */
  assessment: 10 * 1024 * 1024,
} as const;

// ---------------------------------------------------------------------------
// Bucket-specific presets
// ---------------------------------------------------------------------------

export interface FileValidationPreset {
  allowedMimeTypes: readonly string[];
  maxSizeBytes: number;
  label: string;
  /** Human-readable list of allowed extensions for toast messages */
  friendlyTypes: string;
}

export const UPLOAD_PRESETS: Record<string, FileValidationPreset> = {
  // Image-only buckets
  avatars: {
    allowedMimeTypes: ALLOWED_MIME_TYPES.image,
    maxSizeBytes: FILE_SIZE_LIMITS.image,
    label: "Avatar",
    friendlyTypes: "JPG, PNG, GIF, WebP, SVG",
  },
  "program-logos": {
    allowedMimeTypes: ALLOWED_MIME_TYPES.image,
    maxSizeBytes: FILE_SIZE_LIMITS.image,
    label: "Program logo",
    friendlyTypes: "JPG, PNG, GIF, WebP, SVG",
  },
  "email-assets": {
    allowedMimeTypes: ALLOWED_MIME_TYPES.image,
    maxSizeBytes: FILE_SIZE_LIMITS.image,
    label: "Email asset",
    friendlyTypes: "JPG, PNG, GIF, WebP, SVG",
  },
  "client-badges": {
    allowedMimeTypes: ALLOWED_MIME_TYPES.image,
    maxSizeBytes: FILE_SIZE_LIMITS.image,
    label: "Badge image",
    friendlyTypes: "JPG, PNG, GIF, WebP, SVG",
  },

  // Document buckets
  "resource-library": {
    allowedMimeTypes: ALLOWED_MIME_TYPES.document,
    maxSizeBytes: FILE_SIZE_LIMITS.document,
    label: "Resource",
    friendlyTypes: "Images, PDF, Office docs, text, CSV, video, audio",
  },
  "module-client-content": {
    allowedMimeTypes: ALLOWED_MIME_TYPES.document,
    maxSizeBytes: FILE_SIZE_LIMITS.document,
    label: "Module content",
    friendlyTypes: "Images, PDF, Office docs, text, CSV, video, audio",
  },
  "module-assignment-attachments": {
    allowedMimeTypes: ALLOWED_MIME_TYPES.document,
    maxSizeBytes: FILE_SIZE_LIMITS.document,
    label: "Assignment attachment",
    friendlyTypes: "Images, PDF, Office docs, text, CSV, video, audio",
  },
  "module-reflection-resources": {
    allowedMimeTypes: ALLOWED_MIME_TYPES.document,
    maxSizeBytes: FILE_SIZE_LIMITS.document,
    label: "Reflection resource",
    friendlyTypes: "Images, PDF, Office docs, text, CSV, video, audio",
  },
  "module-content-packages": {
    allowedMimeTypes: ["application/zip", "application/x-zip-compressed"],
    maxSizeBytes: 500 * 1024 * 1024, // 500 MB
    label: "Content package",
    friendlyTypes: "ZIP archive",
  },
  "coach-feedback-attachments": {
    allowedMimeTypes: ALLOWED_MIME_TYPES.document,
    maxSizeBytes: FILE_SIZE_LIMITS.document,
    label: "Feedback attachment",
    friendlyTypes: "Images, PDF, Office docs, text, CSV, video, audio",
  },
  "task-note-resources": {
    allowedMimeTypes: ALLOWED_MIME_TYPES.document,
    maxSizeBytes: FILE_SIZE_LIMITS.document,
    label: "Task resource",
    friendlyTypes: "Images, PDF, Office docs, text, CSV, video, audio",
  },
  "goal-resources": {
    allowedMimeTypes: ALLOWED_MIME_TYPES.document,
    maxSizeBytes: FILE_SIZE_LIMITS.document,
    label: "Goal resource",
    friendlyTypes: "Images, PDF, Office docs, text, CSV, video, audio",
  },
  "development-item-files": {
    allowedMimeTypes: ALLOWED_MIME_TYPES.document,
    maxSizeBytes: FILE_SIZE_LIMITS.document,
    label: "Development file",
    friendlyTypes: "Images, PDF, Office docs, text, CSV, video, audio",
  },
  "group-notes": {
    allowedMimeTypes: ALLOWED_MIME_TYPES.document,
    maxSizeBytes: FILE_SIZE_LIMITS.document,
    label: "Group note attachment",
    friendlyTypes: "Images, PDF, Office docs, text, CSV, video, audio",
  },

  // Assessment bucket
  "psychometric-assessments": {
    allowedMimeTypes: ALLOWED_MIME_TYPES.assessment,
    maxSizeBytes: FILE_SIZE_LIMITS.assessment,
    label: "Assessment document",
    friendlyTypes: "PDF, JPG, PNG",
  },
};

// ---------------------------------------------------------------------------
// Validation result
// ---------------------------------------------------------------------------

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

// ---------------------------------------------------------------------------
// Core validation function
// ---------------------------------------------------------------------------

/**
 * Validate a file against a bucket preset.
 *
 * @param file     The File to validate
 * @param bucket   Storage bucket name (key of UPLOAD_PRESETS)
 * @returns        { valid: true } or { valid: false, error: "…" }
 */
export function validateFile(
  file: File,
  bucket: string,
): FileValidationResult {
  const preset = UPLOAD_PRESETS[bucket];
  if (!preset) {
    console.warn(`validateFile: unknown bucket "${bucket}", using document defaults`);
    return validateFileCustom(file, ALLOWED_MIME_TYPES.document, FILE_SIZE_LIMITS.document);
  }

  return validateFileCustom(file, preset.allowedMimeTypes, preset.maxSizeBytes);
}

/**
 * Validate a file against custom rules (for one-off usage).
 */
export function validateFileCustom(
  file: File,
  allowedMimeTypes: readonly string[],
  maxSizeBytes: number,
): FileValidationResult {
  // 1. Check MIME type
  if (!allowedMimeTypes.includes(file.type)) {
    return {
      valid: false,
      error: `File type "${file.type || "unknown"}" is not allowed. Accepted types: ${friendlyMimeList(allowedMimeTypes)}.`,
    };
  }

  // 2. Check file size
  if (file.size > maxSizeBytes) {
    return {
      valid: false,
      error: `File is too large (${formatFileSize(file.size)}). Maximum allowed: ${formatFileSize(maxSizeBytes)}.`,
    };
  }

  // 3. Check for empty files
  if (file.size === 0) {
    return { valid: false, error: "File is empty." };
  }

  return { valid: true };
}

// ---------------------------------------------------------------------------
// Filename sanitization
// ---------------------------------------------------------------------------

/**
 * Sanitize a filename for safe storage.
 * Removes path traversal characters and special characters.
 */
export function sanitizeFilename(filename: string): string {
  // Remove path separators
  let safe = filename.replace(/[/\\]/g, "_");
  // Remove non-ASCII and control characters
  safe = safe.replace(/[^\w\s.\-()]/g, "_");
  // Collapse multiple underscores / spaces
  safe = safe.replace(/_{2,}/g, "_").replace(/\s+/g, " ").trim();
  // Ensure it doesn't start with a dot (hidden files)
  if (safe.startsWith(".")) safe = `_${safe}`;
  // Limit length (preserve extension)
  if (safe.length > 200) {
    const ext = safe.lastIndexOf(".");
    if (ext > 0) {
      const extension = safe.slice(ext);
      safe = safe.slice(0, 200 - extension.length) + extension;
    } else {
      safe = safe.slice(0, 200);
    }
  }
  return safe || "unnamed_file";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format bytes to human-readable string */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/** Build a human-readable MIME list for error messages */
function friendlyMimeList(types: readonly string[]): string {
  const extensions = types.map((t) => {
    const ext = MIME_TO_EXTENSION[t];
    return ext || t;
  });
  return extensions.join(", ");
}

const MIME_TO_EXTENSION: Record<string, string> = {
  "image/jpeg": "JPG",
  "image/png": "PNG",
  "image/gif": "GIF",
  "image/webp": "WebP",
  "image/svg+xml": "SVG",
  "application/pdf": "PDF",
  "application/msword": "DOC",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
  "application/vnd.ms-excel": "XLS",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLSX",
  "application/vnd.ms-powerpoint": "PPT",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PPTX",
  "text/plain": "TXT",
  "text/csv": "CSV",
  "application/json": "JSON",
  "video/mp4": "MP4",
  "video/webm": "WebM",
  "audio/mpeg": "MP3",
  "audio/wav": "WAV",
  "audio/ogg": "OGG",
};

/**
 * Build an `accept` string for file inputs based on a bucket preset.
 * E.g. "image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
 */
export function acceptStringForBucket(bucket: string): string {
  const preset = UPLOAD_PRESETS[bucket];
  if (!preset) return "";
  return preset.allowedMimeTypes.join(",");
}
