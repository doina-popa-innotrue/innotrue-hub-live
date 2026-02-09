import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Validate request method
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const { moduleType, moduleId } = await req.json();

    if (!moduleType && !moduleId) {
      return new Response(
        JSON.stringify({ error: "Either moduleType or moduleId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
        return new Response(
          JSON.stringify({ hasMapping: false, error: "Module not found" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      resolvedModuleType = moduleData?.module_type;
    }

    if (!resolvedModuleType) {
      return new Response(
        JSON.stringify({ hasMapping: false }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use the secure RPC function to check capability
    const { data, error } = await supabase.rpc("module_type_has_session_capability", {
      _module_type: resolvedModuleType,
    });

    if (error) {
      console.error("Error checking session capability:", error);
      return new Response(
        JSON.stringify({ hasMapping: false, error: error.message }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Module capability check for ${resolvedModuleType}: hasMapping=${!!data}`);

    return new Response(
      JSON.stringify({ 
        hasMapping: !!data,
        moduleType: resolvedModuleType,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in check-module-capability:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage, hasMapping: false }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
