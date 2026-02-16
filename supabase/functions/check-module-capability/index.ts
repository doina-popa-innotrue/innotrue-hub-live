import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { errorResponse, successResponse } from "../_shared/error-response.ts";

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  try {
    // Validate request method
    if (req.method !== "POST") {
      return errorResponse.badRequest("Method not allowed", cors);
    }

    // Parse request body
    const { moduleType, moduleId } = await req.json();

    if (!moduleType && !moduleId) {
      return errorResponse.badRequest("Either moduleType or moduleId is required", cors);
    }

    // Create Supabase client with service role for database access
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let resolvedModuleType = moduleType;

    // If moduleId provided but no moduleType, look up the module type first
    if (!resolvedModuleType && moduleId) {
      const { data: moduleData, error: moduleError } = await supabase
        .from("program_modules")
        .select("module_type")
        .eq("id", moduleId)
        .single();

      if (moduleError) {
        console.error("Error fetching module:", moduleError);
        return successResponse.ok({ hasMapping: false, error: "Module not found" }, cors);
      }

      resolvedModuleType = moduleData?.module_type;
    }

    if (!resolvedModuleType) {
      return successResponse.ok({ hasMapping: false }, cors);
    }

    // Use the secure RPC function to check capability
    const { data, error } = await supabase.rpc("module_type_has_session_capability", {
      _module_type: resolvedModuleType,
    });

    if (error) {
      console.error("Error checking session capability:", error);
      return successResponse.ok({ hasMapping: false, error: error.message }, cors);
    }

    console.log(`Module capability check for ${resolvedModuleType}: hasMapping=${!!data}`);

    return successResponse.ok({
      hasMapping: !!data,
      moduleType: resolvedModuleType,
    }, cors);
  } catch (error) {
    return errorResponse.serverError("check-module-capability", error, cors);
  }
});
