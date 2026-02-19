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

    // Rewrite relative URLs in HTML attributes and CSS url() references.
    // IMPORTANT: We must skip <script>...</script> blocks so we don't accidentally
    // rewrite JavaScript string literals that happen to match `src = '...'`.
    const currentDir = filePath.includes("/") ? filePath.substring(0, filePath.lastIndexOf("/") + 1) : "";

    const attrRegex = /((?:src|href|action|poster|data)\s*=\s*["'])(?!https?:\/\/|data:|blob:|mailto:|javascript:|#)([^"']+)(["'])/gi;
    const urlRegex = /url\(\s*["']?(?!https?:\/\/|data:|blob:)([^"')]+)["']?\s*\)/gi;

    function rewriteHtmlChunk(chunk: string): string {
      let result = chunk.replace(
        attrRegex,
        (_match: string, prefix: string, relPath: string, suffix: string) => {
          const resolvedPath = resolvePath(currentDir, relPath);
          return `${prefix}${proxyBase}${resolvedPath}${suffix}`;
        }
      );
      result = result.replace(
        urlRegex,
        (_match: string, relPath: string) => {
          const resolvedPath = resolvePath(currentDir, relPath);
          return `url("${proxyBase}${resolvedPath}")`;
        }
      );
      return result;
    }

    // Split on <script...>...</script> blocks.
    // Rewrite the opening <script ...> tag's attributes (e.g. src="...") but skip
    // the JS content between > and </script> to avoid rewriting JS string literals.
    {
      const parts: string[] = [];
      let pos = 0;
      const scriptOpenRe = /<script([\s>])/gi;
      let openMatch: RegExpExecArray | null;
      while ((openMatch = scriptOpenRe.exec(html)) !== null) {
        // Everything before this <script> tag is HTML — rewrite it
        if (openMatch.index > pos) {
          parts.push(rewriteHtmlChunk(html.substring(pos, openMatch.index)));
        }
        // Find the closing > of the opening tag
        const tagStart = openMatch.index;
        const tagContentStart = html.indexOf(">", tagStart);
        if (tagContentStart === -1) {
          parts.push(html.substring(tagStart));
          pos = html.length;
          break;
        }
        // Rewrite the opening <script ...> tag (may contain src="...")
        const openingTag = html.substring(tagStart, tagContentStart + 1);
        parts.push(rewriteHtmlChunk(openingTag));

        // Find the matching </script>
        const closeIdx = html.indexOf("</script>", tagContentStart + 1);
        if (closeIdx === -1) {
          // No closing tag — push rest unchanged
          parts.push(html.substring(tagContentStart + 1));
          pos = html.length;
          break;
        }
        // Push the script content UNCHANGED (between > and </script>)
        parts.push(html.substring(tagContentStart + 1, closeIdx + "</script>".length));
        pos = closeIdx + "</script>".length;
        scriptOpenRe.lastIndex = pos;
      }
      // Remaining HTML after the last </script>
      if (pos < html.length) {
        parts.push(rewriteHtmlChunk(html.substring(pos)));
      }
      html = parts.join("");
    }

    // Rise content discovers LMS API functions by checking both window and window.parent.
    // The real xAPI-capable mock lives on window.parent (installed by ContentPackageViewer).
    // But some Rise functions also check the current window, so we install lightweight
    // stubs here that delegate to window.parent when available, and also work standalone.
    const lmsMockScript = `<script>
(function() {
  // List of all LMS API functions Rise expects.
  // If parent has the real implementation (xAPI mode), delegate to it.
  // Otherwise provide no-op stubs so Rise doesn't error out.
  var fns = [
    "IsLmsPresent","GetBookmark","SetBookmark","GetDataChunk","SetDataChunk",
    "CommitData","Finish","SetReachedEnd","SetFailed","SetPassed",
    "SetScore","GetScore","GetStatus","SetStatus","GetProgressMeasure",
    "SetProgressMeasure","GetMaxTimeAllowed","GetTimeLimitAction",
    "SetSessionTime","GetEntryMode","GetLessonMode","GetTakingForCredit",
    "FlushData","ConcedeControl","GetStudentID","SetLanguagePreference",
    "SetObjectiveStatus","CreateResponseIdentifier","MatchingResponse",
    "RecordFillInInteraction","RecordMatchingInteraction",
    "RecordMultipleChoiceInteraction","WriteToDebug",
    "TCAPI_SetCompleted","TCAPI_SetProgressMeasure"
  ];
  var defaults = {
    "IsLmsPresent": function() { return true; },
    "GetBookmark": function() { return ""; },
    "GetDataChunk": function() { return ""; },
    "GetScore": function() { return ""; },
    "GetStatus": function() { return "incomplete"; },
    "GetProgressMeasure": function() { return ""; },
    "GetMaxTimeAllowed": function() { return ""; },
    "GetTimeLimitAction": function() { return ""; },
    "GetEntryMode": function() { return "ab-initio"; },
    "GetLessonMode": function() { return "normal"; },
    "GetTakingForCredit": function() { return "credit"; },
    "GetStudentID": function() { return ""; },
    "CreateResponseIdentifier": function() { return ""; },
    "MatchingResponse": function() { return ""; }
  };
  for (var i = 0; i < fns.length; i++) {
    (function(name) {
      if (typeof window[name] === "function") return; // already defined
      window[name] = function() {
        // Delegate to parent if available (parent has the real xAPI implementation)
        try {
          if (window.parent && typeof window.parent[name] === "function") {
            return window.parent[name].apply(window.parent, arguments);
          }
        } catch(e) {}
        // Fallback: return default or "true"
        if (defaults[name]) return defaults[name].apply(this, arguments);
        return "true";
      };
    })(fns[i]);
  }
})();
</script>`;

    // Inject a script that intercepts dynamic resource loading (fetch, XHR, dynamic elements)
    // BASE includes the current HTML file's directory so relative paths resolve correctly.
    // e.g. if serving scormcontent/index.html, BASE ends with "&path=scormcontent/"
    // so "lib/rise/c7972c8d.js" becomes "&path=scormcontent/lib/rise/c7972c8d.js"
    const rewriteScript = `${lmsMockScript}<script>
(function() {
  var PROXY_BASE = ${JSON.stringify(proxyBase)};
  var CURRENT_DIR = ${JSON.stringify(currentDir)};

  function needsRewrite(url) {
    return typeof url === 'string' && url.length > 0
      && !url.startsWith('http') && !url.startsWith('data:')
      && !url.startsWith('blob:') && !url.startsWith('javascript:')
      && !url.startsWith('#') && !url.startsWith('mailto:');
  }

  // Resolve a relative path against the current HTML file's directory.
  // Handles ./ and ../ prefixes. E.g. resolvePath("scormcontent/", "../tc-config.js") => "tc-config.js"
  function resolvePath(rel) {
    var parts = CURRENT_DIR.split('/').filter(Boolean);
    var relClean = rel.split('?')[0].split('#')[0];
    var suffix = rel.substring(relClean.length);
    var segs = relClean.split('/');
    for (var i = 0; i < segs.length; i++) {
      if (segs[i] === '.' || segs[i] === '') continue;
      if (segs[i] === '..') parts.pop();
      else parts.push(segs[i]);
    }
    return parts.join('/') + suffix;
  }

  function rewriteUrl(url) {
    if (!needsRewrite(url)) return url;
    return PROXY_BASE + resolvePath(url);
  }

  // Rewrite fetch()
  var origFetch = window.fetch;
  window.fetch = function(input, init) {
    if (needsRewrite(input)) input = rewriteUrl(input);
    return origFetch.call(this, input, init);
  };

  // Rewrite XMLHttpRequest.open()
  var origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url) {
    if (needsRewrite(url)) url = rewriteUrl(url);
    return origOpen.apply(this, [method, url].concat(Array.prototype.slice.call(arguments, 2)));
  };

  // Webpack chunk URL detection: webpack derives __webpack_public_path__ from
  // the loading script's URL pathname, producing URLs like:
  //   https://xxx.supabase.co/functions/v1/cff2e6f1.css
  // instead of routing through serve-content-package. We detect and fix these.
  var SUPABASE_FN_BASE = PROXY_BASE.split('?')[0];
  var SUPABASE_ORIGIN = SUPABASE_FN_BASE.substring(0, SUPABASE_FN_BASE.indexOf('/functions/'));
  var BAD_PREFIX = SUPABASE_ORIGIN + '/functions/v1/';

  function fixWebpackChunkUrl(url) {
    if (typeof url !== 'string') return url;
    if (url.startsWith(BAD_PREFIX) && !url.includes('serve-content-package')) {
      var filename = url.substring(BAD_PREFIX.length);
      return PROXY_BASE + resolvePath('lib/rise/' + filename);
    }
    return url;
  }

  // Master rewrite: handles relative paths, and fixes webpack absolute URLs
  function masterRewrite(url) {
    if (needsRewrite(url)) return rewriteUrl(url);
    return fixWebpackChunkUrl(url);
  }

  // Intercept dynamic element creation: script.src, link.href, img.src, etc.
  function wrapProp(proto, prop) {
    var desc = Object.getOwnPropertyDescriptor(proto, prop);
    if (!desc || !desc.set) return;
    var origSet = desc.set;
    Object.defineProperty(proto, prop, {
      get: desc.get,
      set: function(val) {
        val = masterRewrite(val);
        return origSet.call(this, val);
      },
      enumerable: desc.enumerable,
      configurable: desc.configurable
    });
  }

  wrapProp(HTMLScriptElement.prototype, 'src');
  wrapProp(HTMLImageElement.prototype, 'src');
  wrapProp(HTMLLinkElement.prototype, 'href');

  var origSetAttr = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function(name, value) {
    if (name === 'src' || name === 'href') value = masterRewrite(value);
    return origSetAttr.call(this, name, value);
  };

  // Set webpack public path before webpack initializes
  window.__webpack_public_path__ = PROXY_BASE + resolvePath('lib/rise/');
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
