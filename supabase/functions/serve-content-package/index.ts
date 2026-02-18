/**
 * serve-content-package — Auth-gated proxy for Rise/web content packages
 *
 * Serves files from the private module-content-packages storage bucket.
 * Every asset request (HTML, CSS, JS, images, fonts) goes through this function
 * which verifies the user's JWT and checks enrollment/role access.
 *
 * GET /serve-content-package?module={moduleId}&path={relative/path}
 *
 * Browser caches assets after first load via Cache-Control headers.
 * For index.html, a <base> tag is injected so relative asset paths resolve
 * back through this same edge function.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { errorResponse } from "../_shared/error-response.ts";

// MIME type lookup by extension
const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
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
  ".eot": "application/vnd.ms-fontobject",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".pdf": "application/pdf",
  ".xml": "application/xml",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json",
};

function getMimeType(filePath: string): string {
  const ext = filePath.substring(filePath.lastIndexOf(".")).toLowerCase();
  return MIME_TYPES[ext] || "application/octet-stream";
}

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  if (req.method !== "GET") {
    return errorResponse.badRequest("Only GET requests are supported", cors);
  }

  const url = new URL(req.url);
  const moduleId = url.searchParams.get("module");
  const filePath = url.searchParams.get("path");

  if (!moduleId || !filePath) {
    return errorResponse.badRequest("Missing required params: module, path", cors);
  }

  // Prevent path traversal
  if (filePath.includes("..") || filePath.startsWith("/")) {
    return errorResponse.badRequest("Invalid file path", cors);
  }

  // --- Auth check ---
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return errorResponse.unauthorized("Missing Authorization header", cors);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Create user-scoped client to verify JWT
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return errorResponse.unauthorized("Invalid or expired token", cors);
  }

  // --- Access check: enrolled in program OR admin/instructor/coach ---
  const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

  // Get the module's program_id and content_package_path
  const { data: moduleData, error: moduleError } = await serviceClient
    .from("program_modules")
    .select("program_id, content_package_path")
    .eq("id", moduleId)
    .single();

  if (moduleError || !moduleData) {
    return errorResponse.notFound("Module not found", cors);
  }

  if (!moduleData.content_package_path) {
    return errorResponse.notFound("No content package for this module", cors);
  }

  // Check user roles
  const { data: roles } = await serviceClient
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  const userRoles = (roles || []).map((r: any) => r.role);
  const isStaff = userRoles.includes("admin") || userRoles.includes("instructor") || userRoles.includes("coach");

  if (!isStaff) {
    // Must be enrolled in the program
    const { data: enrollment } = await serviceClient
      .from("client_enrollments")
      .select("id")
      .eq("client_user_id", user.id)
      .eq("program_id", moduleData.program_id)
      .eq("status", "active")
      .limit(1);

    if (!enrollment || enrollment.length === 0) {
      return errorResponse.forbidden("Not enrolled in this program", cors);
    }
  }

  // --- Serve the file from private storage ---
  const storagePath = `${moduleData.content_package_path}/${filePath}`;

  const { data: fileData, error: storageError } = await serviceClient.storage
    .from("module-content-packages")
    .download(storagePath);

  if (storageError || !fileData) {
    return errorResponse.notFound(`File not found: ${filePath}`, cors);
  }

  const contentType = getMimeType(filePath);
  const isHtml = filePath.endsWith(".html") || filePath.endsWith(".htm");

  // For HTML files, inject a <base> tag so relative asset paths resolve through this proxy
  if (isHtml) {
    let html = await fileData.text();

    // Build base URL that points back to this edge function with the same module param
    // All relative paths will resolve as: /serve-content-package?module=xxx&path={relative_path}
    // We use a <base> with a special URL that gets intercepted by a service worker injected below
    const baseHref = `${supabaseUrl}/functions/v1/serve-content-package?module=${moduleId}&path=`;

    // Inject <base> tag and a tiny script that rewrites relative resource URLs
    const baseTag = `<base href="${baseHref}">`;
    const rewriteScript = `<script>
// Rewrite relative fetch/XHR calls to go through the content proxy
(function() {
  const BASE = "${baseHref}";
  const origFetch = window.fetch;
  window.fetch = function(input, init) {
    if (typeof input === 'string' && !input.startsWith('http') && !input.startsWith('data:') && !input.startsWith('blob:')) {
      input = BASE + input;
    }
    return origFetch.call(this, input, init);
  };
})();
</script>`;

    if (html.includes("<head>")) {
      html = html.replace("<head>", `<head>${baseTag}${rewriteScript}`);
    } else if (html.includes("<HEAD>")) {
      html = html.replace("<HEAD>", `<HEAD>${baseTag}${rewriteScript}`);
    } else {
      // Fallback: prepend
      html = `${baseTag}${rewriteScript}${html}`;
    }

    return new Response(html, {
      status: 200,
      headers: {
        ...cors,
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=300", // 5 min cache for HTML
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  // For non-HTML assets, serve with aggressive caching
  return new Response(fileData, {
    status: 200,
    headers: {
      ...cors,
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400, immutable", // 24h cache for assets
      "X-Content-Type-Options": "nosniff",
    },
  });
});
