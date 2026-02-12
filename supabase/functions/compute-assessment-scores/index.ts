import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { isValidUUID } from "../_shared/validation.ts";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { assessment_id, answers, email, name, newsletter_consent } = await req.json();

    // --- Validation ---
    if (!assessment_id || !isValidUUID(assessment_id)) {
      return new Response(
        JSON.stringify({ error: "Invalid assessment_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!answers || typeof answers !== "object" || Object.keys(answers).length === 0) {
      return new Response(
        JSON.stringify({ error: "Answers are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!email || typeof email !== "string") {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate all answer values are UUIDs
    for (const [questionId, optionId] of Object.entries(answers)) {
      if (!isValidUUID(questionId) || !isValidUUID(optionId as string)) {
        return new Response(
          JSON.stringify({ error: "Invalid answer format" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // --- Fetch assessment (verify it's active + public) ---
    const { data: assessment, error: assessmentError } = await supabase
      .from("assessment_definitions")
      .select("id, name")
      .eq("id", assessment_id)
      .eq("is_active", true)
      .eq("is_public", true)
      .single();

    if (assessmentError || !assessment) {
      return new Response(
        JSON.stringify({ error: "Assessment not found or not available" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- Fetch questions to validate answers ---
    const { data: questions } = await supabase
      .from("assessment_questions")
      .select("id")
      .eq("assessment_id", assessment_id);

    if (!questions || questions.length === 0) {
      return new Response(
        JSON.stringify({ error: "Assessment has no questions" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const questionIds = new Set(questions.map((q: { id: string }) => q.id));
    for (const questionId of Object.keys(answers)) {
      if (!questionIds.has(questionId)) {
        return new Response(
          JSON.stringify({ error: "Answer references unknown question" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // --- Fetch option scores (server-side only, not exposed to client) ---
    const optionIds = Object.values(answers) as string[];
    const { data: optionScores } = await supabase
      .from("assessment_option_scores")
      .select("option_id, dimension_id, score")
      .in("option_id", optionIds);

    // --- Fetch dimensions ---
    const { data: dimensions } = await supabase
      .from("assessment_dimensions")
      .select("id, name, description")
      .eq("assessment_id", assessment_id)
      .order("order_index");

    if (!dimensions || dimensions.length === 0) {
      return new Response(
        JSON.stringify({ error: "Assessment has no dimensions" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- Compute scores ---
    const scores: Record<string, number> = {};
    for (const dim of dimensions) {
      scores[dim.name] = 0;
    }

    if (optionScores) {
      for (const os of optionScores) {
        const dim = dimensions.find((d: { id: string }) => d.id === os.dimension_id);
        if (dim) {
          scores[dim.name] = (scores[dim.name] || 0) + os.score;
        }
      }
    }

    // --- Fetch interpretations and evaluate ---
    const { data: interpretations } = await supabase
      .from("assessment_interpretations")
      .select("id, name, interpretation_text, conditions, priority")
      .eq("assessment_id", assessment_id)
      .order("priority", { ascending: false });

    const matched: Array<{ id: string; name: string; interpretation_text: string; priority: number }> = [];

    if (interpretations) {
      for (const int of interpretations) {
        const conditions = int.conditions as Record<string, { min?: number; max?: number }>;
        if (!conditions || Object.keys(conditions).length === 0) continue;

        let matches = true;
        for (const [dimName, cond] of Object.entries(conditions)) {
          const score = scores[dimName] || 0;
          if (cond.min !== undefined && score < cond.min) matches = false;
          if (cond.max !== undefined && score > cond.max) matches = false;
        }

        if (matches) {
          matched.push({
            id: int.id,
            name: int.name,
            interpretation_text: int.interpretation_text,
            priority: int.priority,
          });
        }
      }
    }

    matched.sort((a, b) => b.priority - a.priority);

    // --- Save response to database ---
    const { error: insertError } = await supabase
      .from("assessment_responses")
      .insert({
        assessment_id,
        email,
        name: name || null,
        responses: answers,
        dimension_scores: scores,
        interpretations: matched.map((i) => ({ name: i.name, text: i.interpretation_text })),
        newsletter_consent: newsletter_consent || false,
      });

    if (insertError) {
      console.error("Error saving assessment response:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to save response" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- Return results (scores + interpretations, NOT the scoring matrix) ---
    return new Response(
      JSON.stringify({
        dimension_scores: scores,
        dimensions: dimensions.map((d: { id: string; name: string; description: string | null }) => ({
          name: d.name,
          description: d.description,
        })),
        interpretations: matched.map((i) => ({
          name: i.name,
          interpretation_text: i.interpretation_text,
        })),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in compute-assessment-scores:", error);
    return new Response(
      JSON.stringify({ error: "Unexpected error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
