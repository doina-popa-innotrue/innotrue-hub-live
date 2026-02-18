/**
 * upload-content-package — Admin-only ZIP upload + extraction for Rise content
 *
 * POST with multipart form data:
 *   - file: ZIP file containing Rise web export
 *   - moduleId: UUID of the target program_module
 *
 * Extracts ZIP contents to module-content-packages bucket,
 * verifies index.html exists, updates program_modules.content_package_path.
 * Cleans up any previous content package for the module.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import JSZip from "https://esm.sh/jszip@3.10.1";
import { getCorsHeaders } from "../_shared/cors.ts";
import { errorResponse, successResponse } from "../_shared/error-response.ts";

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  if (req.method !== "POST") {
    return errorResponse.badRequest("Only POST requests are supported", cors);
  }

  // --- Auth check: admin only ---
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return errorResponse.unauthorized("Missing Authorization header", cors);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return errorResponse.unauthorized("Invalid or expired token", cors);
  }

  const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

  // Verify admin role
  const { data: roles } = await serviceClient
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin");

  if (!roles || roles.length === 0) {
    return errorResponse.forbidden("Admin access required", cors);
  }

  // --- Parse multipart form ---
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return errorResponse.badRequest("Invalid multipart form data", cors);
  }

  const file = formData.get("file") as File | null;
  const moduleId = formData.get("moduleId") as string | null;

  if (!file) {
    return errorResponse.badRequest("Missing 'file' field (ZIP)", cors);
  }
  if (!moduleId) {
    return errorResponse.badRequest("Missing 'moduleId' field", cors);
  }

  // Validate file type
  if (!file.name.endsWith(".zip") && file.type !== "application/zip" && file.type !== "application/x-zip-compressed") {
    return errorResponse.badRequest("File must be a ZIP archive", cors);
  }

  // Validate file size (500 MB max)
  if (file.size > 500 * 1024 * 1024) {
    return errorResponse.badRequest("File size exceeds 500 MB limit", cors);
  }

  // --- Verify module exists ---
  const { data: moduleData, error: moduleError } = await serviceClient
    .from("program_modules")
    .select("id, content_package_path")
    .eq("id", moduleId)
    .single();

  if (moduleError || !moduleData) {
    return errorResponse.notFound("Module not found", cors);
  }

  // --- Extract ZIP ---
  let zip: JSZip;
  try {
    const arrayBuffer = await file.arrayBuffer();
    zip = await JSZip.loadAsync(arrayBuffer);
  } catch {
    return errorResponse.badRequest("Failed to read ZIP file — ensure it's a valid ZIP archive", cors);
  }

  // Check for index.html
  const fileNames = Object.keys(zip.files);
  const hasIndexHtml = fileNames.some(
    (name) => name === "index.html" || name.endsWith("/index.html"),
  );

  if (!hasIndexHtml) {
    return errorResponse.badRequest(
      "ZIP must contain index.html at the root level. This is required for Rise web exports.",
      cors,
    );
  }

  // Determine the root prefix (Rise exports sometimes have a wrapper folder)
  let rootPrefix = "";
  const indexPath = fileNames.find(
    (name) => name === "index.html" || name.endsWith("/index.html"),
  )!;
  if (indexPath !== "index.html") {
    rootPrefix = indexPath.substring(0, indexPath.lastIndexOf("/") + 1);
  }

  // Generate unique folder path
  const uuid = crypto.randomUUID();
  const folderPath = `${moduleId}/${uuid}`;

  // --- Upload extracted files to storage ---
  const uploadErrors: string[] = [];
  let uploadCount = 0;

  for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
    // Skip directories
    if (zipEntry.dir) continue;

    // Strip root prefix so files are at the top level
    let cleanPath = relativePath;
    if (rootPrefix && cleanPath.startsWith(rootPrefix)) {
      cleanPath = cleanPath.substring(rootPrefix.length);
    }

    // Skip empty paths
    if (!cleanPath) continue;

    try {
      const content = await zipEntry.async("uint8array");
      const storagePath = `${folderPath}/${cleanPath}`;

      const { error: uploadError } = await serviceClient.storage
        .from("module-content-packages")
        .upload(storagePath, content, {
          contentType: guessMimeType(cleanPath),
          upsert: true,
        });

      if (uploadError) {
        uploadErrors.push(`${cleanPath}: ${uploadError.message}`);
      } else {
        uploadCount++;
      }
    } catch (e) {
      uploadErrors.push(`${cleanPath}: ${(e as Error).message}`);
    }
  }

  if (uploadCount === 0) {
    return errorResponse.serverError(
      `No files were uploaded. Errors: ${uploadErrors.join(", ")}`,
      cors,
    );
  }

  // --- Clean up previous content package (if any) ---
  const previousPath = moduleData.content_package_path;
  if (previousPath && previousPath !== folderPath) {
    try {
      // List all files under the old path
      const { data: oldFiles } = await serviceClient.storage
        .from("module-content-packages")
        .list(previousPath, { limit: 1000 });

      if (oldFiles && oldFiles.length > 0) {
        const filesToDelete = oldFiles.map((f: any) => `${previousPath}/${f.name}`);
        await serviceClient.storage
          .from("module-content-packages")
          .remove(filesToDelete);
      }
    } catch {
      // Non-critical: old files may remain orphaned
      console.warn(`Failed to clean up old content package at ${previousPath}`);
    }
  }

  // --- Update module with new content package path ---
  const { error: updateError } = await serviceClient
    .from("program_modules")
    .update({ content_package_path: folderPath })
    .eq("id", moduleId);

  if (updateError) {
    return errorResponse.serverError(
      `Files uploaded but failed to update module: ${updateError.message}`,
      cors,
    );
  }

  return successResponse.ok(
    {
      content_package_path: folderPath,
      files_uploaded: uploadCount,
      errors: uploadErrors.length > 0 ? uploadErrors : undefined,
    },
    cors,
  );
});

// Simple MIME type guesser for storage uploads
function guessMimeType(filePath: string): string {
  const ext = filePath.substring(filePath.lastIndexOf(".")).toLowerCase();
  const types: Record<string, string> = {
    ".html": "text/html",
    ".htm": "text/html",
    ".css": "text/css",
    ".js": "application/javascript",
    ".mjs": "application/javascript",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".otf": "font/otf",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mp3": "audio/mpeg",
    ".ogg": "audio/ogg",
    ".wav": "audio/wav",
    ".pdf": "application/pdf",
    ".xml": "application/xml",
    ".txt": "text/plain",
    ".map": "application/json",
  };
  return types[ext] || "application/octet-stream";
}
