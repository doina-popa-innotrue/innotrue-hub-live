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
 * For HTML/CSS files, relative URLs (src, href, url()) are rewritten server-side
 * to route through this same edge function. A runtime script also intercepts
 * dynamic fetch/XHR calls for resources loaded by JavaScript.
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

/**
 * Resolve a relative path against a directory base, handling ./ and ../
 * e.g. resolvePath("content/scormcontent/", "../lib/main.js") => "content/lib/main.js"
 */
function resolvePath(base: string, relative: string): string {
  // Strip query string and fragment from relative path for resolution
  const [relClean] = relative.split(/[?#]/, 1);
  const suffix = relative.substring(relClean.length); // preserve ?query#hash

  const parts = base.split("/").filter(Boolean);
  const relParts = relClean.split("/");

  for (const part of relParts) {
    if (part === "." || part === "") continue;
    if (part === "..") {
      parts.pop();
    } else {
      parts.push(part);
    }
  }

  return parts.join("/") + suffix;
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
  // Support token via Authorization header OR query param (iframes can't send headers)
  let authHeader = req.headers.get("Authorization");
  const tokenParam = url.searchParams.get("token");
  if (!authHeader && tokenParam) {
    authHeader = `Bearer ${tokenParam}`;
  }
  if (!authHeader) {
    return errorResponse.unauthorized("Missing Authorization header or token param", cors);
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

  // For HTML files, rewrite relative URLs so all sub-resources route through this proxy
  if (isHtml) {
    let html = await fileData.text();

    // Build the proxy base URL for resolving sub-resources
    const tokenForSubResources = tokenParam || "";
    const proxyBase = `${supabaseUrl}/functions/v1/serve-content-package?module=${moduleId}&token=${tokenForSubResources}&path=`;

    // Strip any CSP meta tags from the Rise HTML that would block iframe embedding
    html = html.replace(
      /<meta\s+http-equiv=["']Content-Security-Policy["'][^>]*>/gi,
      ""
    );
    html = html.replace(
      /<meta\s+http-equiv=["']X-Frame-Options["'][^>]*>/gi,
      ""
    );

    // Remove any existing <base> tags (Rise might set its own)
    html = html.replace(/<base\s[^>]*>/gi, "");

    // Rewrite relative URLs in HTML attributes (src, href, action, poster, data)
    // Matches relative paths — skips absolute URLs (http/https/data/blob/mailto/javascript/#)
    html = html.replace(
      /((?:src|href|action|poster|data)\s*=\s*["'])(?!https?:\/\/|data:|blob:|mailto:|javascript:|#)([^"']+)(["'])/gi,
      (_match, prefix, relPath, suffix) => {
        // Resolve the relative path against the current file's directory
        const currentDir = filePath.includes("/") ? filePath.substring(0, filePath.lastIndexOf("/") + 1) : "";
        const resolvedPath = resolvePath(currentDir, relPath);
        return `${prefix}${proxyBase}${resolvedPath}${suffix}`;
      }
    );

    // Rewrite url() references in inline styles and <style> blocks
    html = html.replace(
      /url\(\s*["']?(?!https?:\/\/|data:|blob:)([^"')]+)["']?\s*\)/gi,
      (_match, relPath) => {
        const currentDir = filePath.includes("/") ? filePath.substring(0, filePath.lastIndexOf("/") + 1) : "";
        const resolvedPath = resolvePath(currentDir, relPath);
        return `url("${proxyBase}${resolvedPath}")`;
      }
    );

    // For xAPI content (scormcontent/index.html served directly, bypassing scormdriver),
    // inject a lightweight xAPI reporter that:
    // 1. Mocks the LMS API that Rise expects (IsLmsPresent, SetReachedEnd, etc.)
    // 2. Sends completion/progress xAPI statements to our xapi-statements endpoint
    const xapiEndpoint = url.searchParams.get("endpoint") || "";
    const xapiAuth = url.searchParams.get("auth") || "";
    const xapiActor = url.searchParams.get("actor") || "";
    const xapiActivityId = url.searchParams.get("activity_id") || "";

    let xapiParamScript = "";
    if (xapiEndpoint) {
      xapiParamScript = `<script>
(function() {
  // xAPI configuration injected by serve-content-package
  var XAPI_ENDPOINT = ${JSON.stringify(xapiEndpoint)};
  var XAPI_AUTH = ${JSON.stringify(xapiAuth)};
  var XAPI_ACTOR = ${JSON.stringify(xapiActor)};
  var XAPI_ACTIVITY_ID = ${JSON.stringify(xapiActivityId)};

  // Parse actor JSON
  var actor;
  try { actor = JSON.parse(XAPI_ACTOR); } catch(e) { actor = { name: "Unknown" }; }

  // Send an xAPI statement to our LRS endpoint
  function sendStatement(verbId, verbDisplay, result) {
    var stmt = {
      actor: actor,
      verb: { id: verbId, display: { "en-US": verbDisplay } },
      object: {
        objectType: "Activity",
        id: XAPI_ACTIVITY_ID,
        definition: { type: "http://adlnet.gov/expapi/activities/lesson" }
      },
      timestamp: new Date().toISOString()
    };
    if (result) stmt.result = result;

    fetch(XAPI_ENDPOINT, {
      method: "POST",
      headers: {
        "Authorization": XAPI_AUTH,
        "Content-Type": "application/json",
        "X-Experience-API-Version": "1.0.3"
      },
      body: JSON.stringify(stmt)
    }).catch(function(e) { console.warn("[xAPI] Statement send failed:", e); });
  }

  // Send "initialized" statement
  sendStatement("http://adlnet.gov/expapi/verbs/initialized", "initialized");

  // Mock the Rustici SCORM driver API that Rise content expects
  // Rise checks window.parent.IsLmsPresent to determine if it's in an LMS
  window.IsLmsPresent = function() { return true; };
  window.GetBookmark = function() { return ""; };
  window.SetBookmark = function() { return "true"; };
  window.GetDataChunk = function() { return ""; };
  window.SetDataChunk = function() { return "true"; };
  window.SetReachedEnd = function() {
    // Rise calls this when the learner reaches the end of the content
    sendStatement(
      "http://adlnet.gov/expapi/verbs/completed",
      "completed",
      { completion: true, duration: "PT0S" }
    );
    return "true";
  };
  window.SetFailed = function() {
    sendStatement(
      "http://adlnet.gov/expapi/verbs/failed",
      "failed",
      { success: false }
    );
    return "true";
  };
  window.SetPassed = function() {
    sendStatement(
      "http://adlnet.gov/expapi/verbs/passed",
      "passed",
      { success: true }
    );
    return "true";
  };
  window.SetScore = function() { return "true"; };
  window.GetScore = function() { return ""; };
  window.GetStatus = function() { return "incomplete"; };
  window.SetStatus = function() { return "true"; };
  window.GetProgressMeasure = function() { return ""; };
  window.SetProgressMeasure = function(val) {
    // Rise calls this with progress 0-1
    if (parseFloat(val) >= 1) {
      sendStatement(
        "http://adlnet.gov/expapi/verbs/completed",
        "completed",
        { completion: true }
      );
    }
    return "true";
  };
  window.GetMaxTimeAllowed = function() { return ""; };
  window.GetTimeLimitAction = function() { return ""; };
  window.SetSessionTime = function() { return "true"; };
  window.GetEntryMode = function() { return "ab-initio"; };
  window.GetLessonMode = function() { return "normal"; };
  window.GetTakingForCredit = function() { return "credit"; };
  window.FlushData = function() { return "true"; };
  window.ConcedeControl = function() {
    // Rise calls this when exiting
    sendStatement("http://adlnet.gov/expapi/verbs/terminated", "terminated");
    return "true";
  };

  // Handle page unload — send terminated if not already sent
  var terminated = false;
  window.addEventListener('beforeunload', function() {
    if (!terminated) {
      terminated = true;
      sendStatement("http://adlnet.gov/expapi/verbs/terminated", "terminated");
    }
  });
})();
</script>`;
    }

    // Inject a script that intercepts dynamic resource loading (fetch, XHR, dynamic imports)
    const rewriteScript = `${xapiParamScript}<script>
(function() {
  var BASE = ${JSON.stringify(proxyBase)};

  // Rewrite fetch()
  var origFetch = window.fetch;
  window.fetch = function(input, init) {
    if (typeof input === 'string' && !input.startsWith('http') && !input.startsWith('data:') && !input.startsWith('blob:')) {
      input = BASE + input;
    }
    return origFetch.call(this, input, init);
  };

  // Rewrite XMLHttpRequest.open()
  var origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url) {
    if (typeof url === 'string' && !url.startsWith('http') && !url.startsWith('data:') && !url.startsWith('blob:')) {
      url = BASE + url;
    }
    return origOpen.apply(this, [method, url].concat(Array.prototype.slice.call(arguments, 2)));
  };
})();
</script>`;

    if (html.includes("<head>")) {
      html = html.replace("<head>", `<head>${rewriteScript}`);
    } else if (html.includes("<HEAD>")) {
      html = html.replace("<HEAD>", `<HEAD>${rewriteScript}`);
    } else {
      html = `${rewriteScript}${html}`;
    }

    // Encode as bytes — Supabase Edge Runtime overrides Content-Type to
    // text/plain when the Response body is a string. Using Uint8Array avoids
    // the automatic content-type detection entirely.
    const htmlBytes = new TextEncoder().encode(html);
    const htmlHeaders = new Headers(cors);
    htmlHeaders.set("Content-Type", contentType);
    htmlHeaders.set("Cache-Control", "private, max-age=300");
    htmlHeaders.set("X-Content-Type-Options", "nosniff");
    htmlHeaders.set("Content-Security-Policy", "frame-ancestors *");
    htmlHeaders.set("X-Frame-Options", "ALLOWALL");

    return new Response(htmlBytes, { status: 200, headers: htmlHeaders });
  }

  // For CSS files, rewrite url() references to route through this proxy
  const isCss = filePath.endsWith(".css");
  if (isCss) {
    let css = await fileData.text();
    const tokenForSubResources = tokenParam || "";
    const proxyBase = `${supabaseUrl}/functions/v1/serve-content-package?module=${moduleId}&token=${tokenForSubResources}&path=`;
    const cssDir = filePath.includes("/") ? filePath.substring(0, filePath.lastIndexOf("/") + 1) : "";

    css = css.replace(
      /url\(\s*["']?(?!https?:\/\/|data:|blob:)([^"')]+)["']?\s*\)/gi,
      (_match, relPath) => {
        const resolvedPath = resolvePath(cssDir, relPath);
        return `url("${proxyBase}${resolvedPath}")`;
      }
    );

    const cssBytes = new TextEncoder().encode(css);
    const cssHeaders = new Headers(cors);
    cssHeaders.set("Content-Type", contentType);
    cssHeaders.set("Cache-Control", "public, max-age=86400, immutable");
    cssHeaders.set("X-Content-Type-Options", "nosniff");

    return new Response(cssBytes, { status: 200, headers: cssHeaders });
  }

  // For all other assets (JS, images, fonts, etc.), serve with aggressive caching
  const assetHeaders = new Headers(cors);
  assetHeaders.set("Content-Type", contentType);
  assetHeaders.set("Cache-Control", "public, max-age=86400, immutable");
  assetHeaders.set("X-Content-Type-Options", "nosniff");

  return new Response(fileData, { status: 200, headers: assetHeaders });
});
