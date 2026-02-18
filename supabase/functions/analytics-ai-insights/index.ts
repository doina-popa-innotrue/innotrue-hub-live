import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { errorResponse, successResponse } from "../_shared/error-response.ts";
import { aiChatCompletion, AI_MODEL } from "../_shared/ai-config.ts";

serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return errorResponse.unauthorized("Unauthorized", cors);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify user is admin
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return errorResponse.unauthorized("Unauthorized", cors);
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Check if user is admin
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    if (!roleData) {
      return errorResponse.forbidden("Admin access required", cors);
    }

    const { analyticsData, focusArea } = await req.json();

    if (!analyticsData) {
      return errorResponse.badRequest("Analytics data required", cors);
    }

    // Guard against oversized payloads being sent to AI
    const analyticsJson = JSON.stringify(analyticsData);
    if (analyticsJson.length > 50_000) {
      return errorResponse.badRequest("Analytics data too large. Please narrow your date range or filters.", cors);
    }



    // Build a focused prompt based on what the admin wants to analyze
    let focusPrompt = "";
    switch (focusArea) {
      case "engagement":
        focusPrompt = "Focus specifically on user engagement patterns, what features are most popular, and what content resonates with users.";
        break;
      case "drop-off":
        focusPrompt = "Focus specifically on where users are dropping off, potential friction points, and recommendations to improve retention.";
        break;
      case "errors":
        focusPrompt = "Focus specifically on error patterns, what's causing user frustration, and technical issues that need addressing.";
        break;
      case "growth":
        focusPrompt = "Focus specifically on growth opportunities, underutilized features, and recommendations to increase user adoption.";
        break;
      default:
        focusPrompt = "Provide a comprehensive analysis covering engagement, drop-offs, and actionable recommendations.";
    }

    const systemPrompt = `You are an expert product analytics consultant analyzing anonymized user behavior data for a professional development platform. Your role is to provide actionable insights that help improve user experience and engagement.

IMPORTANT: All data is anonymized - you should NEVER try to identify individual users. Focus on patterns and trends, not individuals.

${focusPrompt}

Structure your response with clear sections:
1. **Key Findings** (2-3 bullet points with the most important insights)
2. **Engagement Patterns** (what's working well)
3. **Areas of Concern** (friction points or drop-offs)
4. **Actionable Recommendations** (specific, prioritized suggestions)

Keep your analysis concise but insightful. Use percentages and comparisons where the data supports it.`;

    const userPrompt = `Analyze this platform usage data and provide insights:

**Summary Statistics:**
- Total Events: ${analyticsData.total_events}
- Unique Sessions: ${analyticsData.unique_sessions}
- Unique Users: ${analyticsData.unique_users}

**Events by Category:**
${JSON.stringify(analyticsData.events_by_category, null, 2)}

**Top Pages (by views):**
${JSON.stringify(analyticsData.top_pages, null, 2)}

**Feature Usage:**
${JSON.stringify(analyticsData.feature_usage, null, 2)}

**Daily Activity Trend:**
${JSON.stringify(analyticsData.events_by_day, null, 2)}

**Drop-off Points (pages where sessions ended):**
${JSON.stringify(analyticsData.drop_off_analysis, null, 2)}

**Error Summary:**
${JSON.stringify(analyticsData.error_summary, null, 2)}

Please provide actionable insights based on this data.`;

    const response = await aiChatCompletion(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { model: AI_MODEL },
    );

    if (!response.ok) {
      if (response.status === 429) {
        return errorResponse.rateLimit("Rate limit exceeded. Please try again later.", cors);
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please top up your workspace." }), {
          status: 402,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return errorResponse.serverErrorWithMessage("Failed to generate insights", cors);
    }

    const aiResponse = await response.json();
    const insights = aiResponse.choices?.[0]?.message?.content;

    if (!insights) {
      return errorResponse.serverErrorWithMessage("No insights generated", cors);
    }

    return successResponse.ok({ insights }, cors);
  } catch (error) {
    return errorResponse.serverError("analytics-ai-insights", error, cors);
  }
});
