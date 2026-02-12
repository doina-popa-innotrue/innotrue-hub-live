import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { analyticsData, focusArea } = await req.json();

    if (!analyticsData) {
      return new Response(JSON.stringify({ error: "Analytics data required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Guard against oversized payloads being sent to AI
    const analyticsJson = JSON.stringify(analyticsData);
    if (analyticsJson.length > 50_000) {
      return new Response(JSON.stringify({ error: "Analytics data too large. Please narrow your date range or filters." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { getAIApiKey, AI_ENDPOINT, AI_MODEL } = await import('../_shared/ai-config.ts');
    let aiApiKey: string;
    try {
      aiApiKey = getAIApiKey();
    } catch {
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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

    const response = await fetch(AI_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${aiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        stream: false,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please top up your workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "Failed to generate insights" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResponse = await response.json();
    const insights = aiResponse.choices?.[0]?.message?.content;

    if (!insights) {
      return new Response(JSON.stringify({ error: "No insights generated" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ insights }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Analytics insights error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
