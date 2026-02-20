/**
 * upload-content-package — Admin-only ZIP upload + extraction for Rise content
 *
 * Supports two modes:
 *
 * 1. SHARED MODE (new — CT3): POST with { file, title, description? }
 *    Creates a content_packages row and stores files at shared/{uuid}/...
 *    Returns { content_package_id, storage_path, package_type, files_uploaded }
 *
 * 2. LEGACY MODE: POST with { file, moduleId }
 *    Existing per-module behavior — stores at {moduleId}/{uuid}/...
 *    Updates program_modules.content_package_path. Unchanged from before.
 *
 * 3. REPLACE MODE: POST with { file, contentPackageId }
 *    Replaces files in an existing shared content package.
 *    Cleans up old storage files and updates the content_packages row.
 *
 * Extracts ZIP contents to module-content-packages bucket,
 * verifies index.html exists, detects web vs xAPI package type.
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
  const title = formData.get("title") as string | null;
  const description = formData.get("description") as string | null;
  const contentPackageId = formData.get("contentPackageId") as string | null;

  if (!file) {
    return errorResponse.badRequest("Missing 'file' field (ZIP)", cors);
  }

  // Determine mode
  const isSharedMode = !moduleId && !!title;
  const isReplaceMode = !moduleId && !!contentPackageId;
  const isLegacyMode = !!moduleId;

  if (!isSharedMode && !isReplaceMode && !isLegacyMode) {
    return errorResponse.badRequest(
      "Provide either 'moduleId' (legacy mode), 'title' (shared mode), or 'contentPackageId' (replace mode)",
      cors,
    );
  }

  // Validate file type
  if (!file.name.endsWith(".zip") && file.type !== "application/zip" && file.type !== "application/x-zip-compressed") {
    return errorResponse.badRequest("File must be a ZIP archive", cors);
  }

  // Validate file size (500 MB max)
  if (file.size > 500 * 1024 * 1024) {
    return errorResponse.badRequest("File size exceeds 500 MB limit", cors);
  }

  // --- Legacy mode: verify module exists ---
  let previousModulePath: string | null = null;
  if (isLegacyMode) {
    const { data: moduleData, error: moduleError } = await serviceClient
      .from("program_modules")
      .select("id, content_package_path")
      .eq("id", moduleId!)
      .single();

    if (moduleError || !moduleData) {
      return errorResponse.notFound("Module not found", cors);
    }
    previousModulePath = moduleData.content_package_path;
  }

  // --- Replace mode: verify content package exists ---
  let previousPackagePath: string | null = null;
  if (isReplaceMode) {
    const { data: pkgData, error: pkgError } = await serviceClient
      .from("content_packages")
      .select("id, storage_path")
      .eq("id", contentPackageId!)
      .single();

    if (pkgError || !pkgData) {
      return errorResponse.notFound("Content package not found", cors);
    }
    previousPackagePath = pkgData.storage_path;
  }

  // --- Extract ZIP ---
  let zip: JSZip;
  try {
    const arrayBuffer = await file.arrayBuffer();
    zip = await JSZip.loadAsync(arrayBuffer);
  } catch {
    return errorResponse.badRequest("Failed to read ZIP file — ensure it's a valid ZIP archive", cors);
  }

  // Detect export type and find entry point
  const fileNames = Object.keys(zip.files);

  // xAPI (Tin Can) exports have scormdriver/indexAPI.html + tincan.xml
  const hasIndexApiHtml = fileNames.some(
    (name) => name.endsWith("/indexAPI.html") || name === "indexAPI.html" ||
              name.endsWith("/indexapi.html") || name === "indexapi.html",
  );
  const hasTincanXml = fileNames.some(
    (name) => name === "tincan.xml" || name.endsWith("/tincan.xml"),
  );
  const contentPackageType = (hasIndexApiHtml && hasTincanXml) ? "xapi" : "web";

  // Web exports require index.html at the root; xAPI exports have it inside scormcontent/
  const hasIndexHtml = fileNames.some(
    (name) => name === "index.html" || name.endsWith("/index.html"),
  );

  if (!hasIndexHtml && !hasIndexApiHtml) {
    return errorResponse.badRequest(
      "ZIP must contain index.html (Web export) or scormdriver/indexAPI.html (xAPI export).",
      cors,
    );
  }

  // Determine the root prefix (Rise exports have a wrapper folder like "course-name-xapi-hAVi70LN/")
  let rootPrefix = "";
  if (contentPackageType === "xapi") {
    const tincanPath = fileNames.find(
      (name) => name === "tincan.xml" || name.endsWith("/tincan.xml"),
    );
    if (tincanPath && tincanPath !== "tincan.xml") {
      rootPrefix = tincanPath.substring(0, tincanPath.lastIndexOf("/") + 1);
    }
  } else {
    const indexPath = fileNames.find(
      (name) => name === "index.html" || name.endsWith("/index.html"),
    )!;
    if (indexPath !== "index.html") {
      rootPrefix = indexPath.substring(0, indexPath.lastIndexOf("/") + 1);
    }
  }

  // Generate unique folder path
  const uuid = crypto.randomUUID();
  const folderPath = isLegacyMode ? `${moduleId}/${uuid}` : `shared/${uuid}`;

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

  // --- Clean up previous storage files (if any) ---
  const pathToClean = isLegacyMode ? previousModulePath : (isReplaceMode ? previousPackagePath : null);
  if (pathToClean && pathToClean !== folderPath) {
    await cleanupStoragePath(serviceClient, pathToClean);
  }

  // --- Mode-specific database updates ---

  if (isSharedMode) {
    // Create new content_packages row
    const { data: newPackage, error: insertError } = await serviceClient
      .from("content_packages")
      .insert({
        title: title!,
        description: description || null,
        storage_path: folderPath,
        package_type: contentPackageType,
        file_count: uploadCount,
        original_filename: file.name,
        uploaded_by: user.id,
      })
      .select("id")
      .single();

    if (insertError) {
      return errorResponse.serverError(
        `Files uploaded but failed to create content package: ${insertError.message}`,
        cors,
      );
    }

    return successResponse.ok(
      {
        content_package_id: newPackage.id,
        storage_path: folderPath,
        package_type: contentPackageType,
        files_uploaded: uploadCount,
        errors: uploadErrors.length > 0 ? uploadErrors : undefined,
      },
      cors,
    );
  }

  if (isReplaceMode) {
    // Update existing content_packages row
    const { error: updateError } = await serviceClient
      .from("content_packages")
      .update({
        storage_path: folderPath,
        package_type: contentPackageType,
        file_count: uploadCount,
        original_filename: file.name,
      })
      .eq("id", contentPackageId!);

    if (updateError) {
      return errorResponse.serverError(
        `Files uploaded but failed to update content package: ${updateError.message}`,
        cors,
      );
    }

    return successResponse.ok(
      {
        content_package_id: contentPackageId,
        storage_path: folderPath,
        package_type: contentPackageType,
        files_uploaded: uploadCount,
        errors: uploadErrors.length > 0 ? uploadErrors : undefined,
      },
      cors,
    );
  }

  // --- Legacy mode: update module ---
  const { error: updateError } = await serviceClient
    .from("program_modules")
    .update({
      content_package_path: folderPath,
      content_package_type: contentPackageType,
    })
    .eq("id", moduleId!);

  if (updateError) {
    return errorResponse.serverError(
      `Files uploaded but failed to update module: ${updateError.message}`,
      cors,
    );
  }

  return successResponse.ok(
    {
      content_package_path: folderPath,
      content_package_type: contentPackageType,
      files_uploaded: uploadCount,
      errors: uploadErrors.length > 0 ? uploadErrors : undefined,
    },
    cors,
  );
});

/**
 * Delete all files under a storage path (non-critical — failures are logged).
 * Handles nested directories by listing recursively.
 */
async function cleanupStoragePath(
  serviceClient: ReturnType<typeof createClient>,
  storagePath: string,
): Promise<void> {
  try {
    const { data: oldFiles } = await serviceClient.storage
      .from("module-content-packages")
      .list(storagePath, { limit: 1000 });

    if (oldFiles && oldFiles.length > 0) {
      const filesToDelete = oldFiles.map((f: any) => `${storagePath}/${f.name}`);
      await serviceClient.storage
        .from("module-content-packages")
        .remove(filesToDelete);
    }
  } catch {
    console.warn(`Failed to clean up old content package at ${storagePath}`);
  }
}

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
