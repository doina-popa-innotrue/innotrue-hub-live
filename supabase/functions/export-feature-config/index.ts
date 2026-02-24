import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { errorResponse, successResponse } from "../_shared/error-response.ts";

serve(async (req) => {
  const cors = getCorsHeaders(req);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  try {
    // Get auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return errorResponse.unauthorized("Missing authorization header", cors);
    }

    // Create authenticated client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return errorResponse.unauthorized("Unauthorized", cors);
    }

    // Verify user has admin role (server-side check)
    const { data: userRoles, error: rolesError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    if (rolesError) {
      console.error("Error fetching user roles:", rolesError);
      return errorResponse.serverErrorWithMessage("Failed to verify permissions", cors);
    }

    const isAdmin = userRoles?.some((r) => r.role === "admin");
    if (!isAdmin) {
      return errorResponse.forbidden("Forbidden: Admin access required", cors);
    }

    // Parse request body for export type
    const { exportType } = await req.json();

    if (exportType === "feature-assignments") {
      // Export 1: Feature assignments to plans, program plans, tracks, add-ons
      const [
        { data: features },
        { data: plans },
        { data: programPlans },
        { data: tracks },
        { data: addOns },
        { data: planFeatures },
        { data: programPlanFeatures },
        { data: trackFeatures },
        { data: addOnFeatures },
      ] = await Promise.all([
        supabase.from("features").select("id, key, name, is_consumable, is_system, is_active"),
        supabase.from("plans").select("id, key, name, display_name, tier_level"),
        supabase.from("program_plans").select("id, name, display_name"),
        supabase.from("tracks").select("id, key, name, display_name"),
        supabase.from("add_ons").select("id, key, name, display_name, is_active"),
        supabase.from("plan_features").select("plan_id, feature_id, enabled, limit_value"),
        supabase.from("program_plan_features").select("program_plan_id, feature_id, enabled, limit_value"),
        supabase.from("track_features").select("track_id, feature_id, is_enabled, limit_value"),
        supabase.from("add_on_features").select("add_on_id, feature_id"),
      ]);

      // Build lookup maps
      const featureMap = new Map(features?.map((f) => [f.id, f]) || []);
      const planMap = new Map(plans?.map((p) => [p.id, p]) || []);
      const programPlanMap = new Map(programPlans?.map((pp) => [pp.id, pp]) || []);
      const trackMap = new Map(tracks?.map((t) => [t.id, t]) || []);
      const addOnMap = new Map(addOns?.map((a) => [a.id, a]) || []);

      const exportData = {
        exportedAt: new Date().toISOString(),
        exportedBy: user.email,
        type: "feature-assignments",
        features: features || [],
        plans: plans || [],
        programPlans: programPlans?.map((pp) => ({
          ...pp,
          programName: (pp.program as any)?.name || null,
        })) || [],
        tracks: tracks || [],
        addOns: addOns || [],
        assignments: {
          planFeatures: planFeatures?.map((pf) => ({
            planKey: planMap.get(pf.plan_id)?.key,
            planName: planMap.get(pf.plan_id)?.name,
            featureKey: featureMap.get(pf.feature_id)?.key,
            featureName: featureMap.get(pf.feature_id)?.name,
            enabled: pf.enabled,
            limitValue: pf.limit_value,
          })) || [],
          programPlanFeatures: programPlanFeatures?.map((ppf) => ({
            programPlanName: programPlanMap.get(ppf.program_plan_id)?.name,
            programName: (programPlanMap.get(ppf.program_plan_id)?.program as any)?.name,
            featureKey: featureMap.get(ppf.feature_id)?.key,
            featureName: featureMap.get(ppf.feature_id)?.name,
            enabled: ppf.enabled,
            limitValue: ppf.limit_value,
          })) || [],
          trackFeatures: trackFeatures?.map((tf) => ({
            trackKey: trackMap.get(tf.track_id)?.key,
            trackName: trackMap.get(tf.track_id)?.name,
            featureKey: featureMap.get(tf.feature_id)?.key,
            featureName: featureMap.get(tf.feature_id)?.name,
            isEnabled: tf.is_enabled,
            limitValue: tf.limit_value,
          })) || [],
          addOnFeatures: addOnFeatures?.map((af) => ({
            addOnKey: addOnMap.get(af.add_on_id)?.key,
            addOnName: addOnMap.get(af.add_on_id)?.name,
            featureKey: featureMap.get(af.feature_id)?.key,
            featureName: featureMap.get(af.feature_id)?.name,
          })) || [],
        },
      };

      return new Response(JSON.stringify(exportData, null, 2), {
        headers: {
          ...cors,
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="feature-assignments-${new Date().toISOString().split("T")[0]}.json"`,
        },
      });
    } else if (exportType === "credit-config") {
      // Export 2: Credit assignments and consumable feature costs
      const [
        { data: plans },
        { data: programPlans },
        { data: addOns },
        { data: creditServices },
        { data: features },
        { data: planFeatures },
      ] = await Promise.all([
        supabase.from("plans").select("id, key, name, display_name, credit_allowance, credit_validity_months"),
        supabase.from("program_plans").select("id, name, display_name, credit_allowance, program:programs(name)"),
        supabase.from("add_ons").select("id, key, name, display_name, is_consumable, initial_quantity, price_cents"),
        supabase.from("credit_services").select("id, name, category, credit_cost, feature_id, is_active, linked_entity_type, linked_entity_id"),
        supabase.from("features").select("id, key, name, is_consumable"),
        supabase.from("plan_features").select("plan_id, feature_id, limit_value, plans(key, name), features(key, name)").not("limit_value", "is", null),
      ]);

      const featureMap = new Map(features?.map((f) => [f.id, f]) || []);

      const exportData = {
        exportedAt: new Date().toISOString(),
        exportedBy: user.email,
        type: "credit-configuration",
        planCredits: plans?.map((p) => ({
          planKey: p.key,
          planName: p.name,
          displayName: p.display_name,
          creditAllowance: p.credit_allowance,
          validityMonths: p.credit_validity_months,
        })) || [],
        programPlanCredits: programPlans?.map((pp) => ({
          programPlanName: pp.name,
          programName: (pp.program as any)?.name || null,
          displayName: pp.display_name,
          creditAllowance: pp.credit_allowance,
        })) || [],
        addOnCredits: addOns?.filter((a) => a.is_consumable).map((a) => ({
          addOnKey: a.key,
          addOnName: a.name,
          displayName: a.display_name,
          initialQuantity: a.initial_quantity,
          priceCents: a.price_cents,
        })) || [],
        creditServices: creditServices?.map((cs) => ({
          serviceName: cs.name,
          category: cs.category,
          creditCost: cs.credit_cost,
          linkedFeatureKey: featureMap.get(cs.feature_id)?.key || null,
          linkedFeatureName: featureMap.get(cs.feature_id)?.name || null,
          linkedEntityType: cs.linked_entity_type,
          linkedEntityId: cs.linked_entity_id,
          isActive: cs.is_active,
        })) || [],
        consumableFeatureLimits: planFeatures?.map((pf) => ({
          planKey: (pf.plans as any)?.key,
          planName: (pf.plans as any)?.name,
          featureKey: (pf.features as any)?.key,
          featureName: (pf.features as any)?.name,
          monthlyLimit: pf.limit_value,
        })) || [],
      };

      return new Response(JSON.stringify(exportData, null, 2), {
        headers: {
          ...cors,
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="credit-config-${new Date().toISOString().split("T")[0]}.json"`,
        },
      });
    } else {
      return errorResponse.badRequest("Invalid export type. Use 'feature-assignments' or 'credit-config'", cors);
    }
  } catch (error) {
    return errorResponse.serverError("export-feature-config", error, cors);
  }
});
