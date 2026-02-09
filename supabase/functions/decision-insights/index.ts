import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function checkPlatformAILimit(supabaseAdmin: any): Promise<{ allowed: boolean; message?: string }> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const { data: consumption } = await supabaseAdmin
    .from('add_on_consumption_log')
    .select('quantity_consumed')
    .gte('created_at', monthStart);

  const totalUsed = consumption?.reduce((sum: number, c: any) => sum + (c.quantity_consumed || 0), 0) || 0;

  const { data: limitSetting } = await supabaseAdmin
    .from('system_settings')
    .select('value')
    .eq('key', 'ai_monthly_credit_limit')
    .single();

  const monthlyLimit = parseInt(limitSetting?.value || '1000', 10);

  if (totalUsed >= monthlyLimit) {
    return { allowed: false, message: 'Platform AI credit limit reached for this month. Please contact support.' };
  }

  return { allowed: true };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check platform-wide AI limit
    const limitCheck = await checkPlatformAILimit(supabaseAdmin);
    if (!limitCheck.allowed) {
      return new Response(JSON.stringify({ error: limitCheck.message }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch user's profile data including values, motivators, desired role, future vision, and constraints
    const { data: userProfile } = await supabaseClient
      .from('profiles')
      .select('desired_target_role, future_vision, constraints')
      .eq('id', user.id)
      .single();

    // Fetch user's interests (including values and motivators)
    const { data: userInterests } = await supabaseClient
      .from('user_interests')
      .select('interests, values, drives, preferred_categories')
      .eq('user_id', user.id)
      .single();

    // Fetch user's decisions with related data
    const { data: decisions, error: decisionsError } = await supabaseClient
      .from('decisions')
      .select(`
        *,
        decision_values(*),
        decision_options(*),
        decision_reflections(*)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (decisionsError) {
      console.error('Error fetching decisions:', decisionsError);
      return new Response(JSON.stringify({ error: 'Failed to fetch decisions' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!decisions || decisions.length === 0) {
      return new Response(JSON.stringify({ 
        insights: 'Not enough decision data yet. Start by documenting a few decisions to see personalized insights!'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Prepare decision summary for AI analysis
    const decisionSummary = decisions.map(d => ({
      title: d.title,
      status: d.status,
      importance: d.importance,
      urgency: d.urgency,
      confidence: d.confidence_level,
      values_count: d.decision_values?.length || 0,
      options_count: d.decision_options?.length || 0,
      has_reflection: !!d.decision_reflections?.length,
      reflection_satisfaction: d.decision_reflections?.[0]?.satisfaction_score,
      created_months_ago: Math.floor((Date.now() - new Date(d.created_at).getTime()) / (1000 * 60 * 60 * 24 * 30))
    }));

    // Available decision frameworks in the system
    const availableFrameworks = [
      { name: "Buyer's Model", description: "Analyze what you're buying (gaining) vs selling (giving up) in each option" },
      { name: "10/10/10 Rule", description: "Consider impact in 10 minutes, 10 months, and 10 years" },
      { name: "Internal Check", description: "Gut-check alignment with intuition, values, and authentic self" },
      { name: "Stop Rule", description: "Pre-define criteria that would make you reconsider or stop" },
      { name: "Yes/No Rule", description: "Simple litmus tests - if X then no, if Y then yes" },
      { name: "Crossroads Model", description: "Compare different paths and their implications side-by-side" },
    ];

    // Build user context from profile and interests
    const userContext = {
      values: userInterests?.values || [],
      personalMotivators: userInterests?.drives || [],
      interests: userInterests?.interests || [],
      preferredCategories: userInterests?.preferred_categories || [],
      desiredTargetRole: userProfile?.desired_target_role || null,
      futureVision: userProfile?.future_vision || null,
      constraints: userProfile?.constraints || null,
    };

    const prompt = `Analyze these decision-making patterns and provide personalized insights based on the user's profile:

**User's Personal Context:**
- Core Values: ${JSON.stringify(userContext.values)}
- Personal Motivators: ${JSON.stringify(userContext.personalMotivators)}
- Interests: ${JSON.stringify(userContext.interests)}
- Preferred Categories: ${JSON.stringify(userContext.preferredCategories)}
- Desired Target Role: ${userContext.desiredTargetRole || 'Not specified'}
- Vision for Future Self: ${userContext.futureVision || 'Not specified'}
- Personal Constraints: ${userContext.constraints || 'None specified'}

**User's Decisions:**
${JSON.stringify(decisionSummary, null, 2)}

**Available Decision Frameworks in this platform:**
${availableFrameworks.map(f => `- ${f.name}: ${f.description}`).join('\n')}

Provide a detailed, personalized analysis covering:
1. **Decision-Making Patterns**: What patterns emerge in how they approach decisions? How do these relate to their stated values and motivators?
2. **Values Alignment**: How well do their decisions align with their stated core values and personal motivators? Are there any disconnects?
3. **Future Vision Alignment**: How do their decision patterns support or hinder their vision for their future self and desired target role?
4. **Constraints Consideration**: How might their personal constraints (family responsibilities, health, location, time, etc.) be affecting their decisions? What accommodations or alternative approaches should they consider?
5. **Framework Recommendations**: Based on their decision types, values, goals, and constraints, recommend which of the AVAILABLE FRAMEWORKS LISTED ABOVE would be most beneficial. Explain why each recommended framework aligns with their specific values and decision style. Only recommend from the frameworks listed above.
6. **Potential Blind Spots**: What areas might they be overlooking? Are there values or motivators they've stated but don't seem to be reflected in their decisions?
7. **Reflection Prompts**: 3-5 specific questions to deepen their decision-making practice, personalized to their values, future vision, and constraints
8. **Strengths to Leverage**: What are they doing well that aligns with their values and supports their future goals while respecting their constraints?

Format the response as structured markdown with clear sections.`;

    const { getAIApiKey, AI_ENDPOINT, AI_MODEL } = await import('../_shared/ai-config.ts');
    const aiApiKey = getAIApiKey();

    const aiResponse = await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${aiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { 
            role: 'system', 
            content: 'You are an expert decision-making coach analyzing patterns to provide actionable insights.' 
          },
          { role: 'user', content: prompt }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI gateway error:', aiResponse.status, errorText);
      return new Response(JSON.stringify({ error: 'AI analysis failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiData = await aiResponse.json();
    const insights = aiData.choices[0].message.content;

    return new Response(JSON.stringify({ insights }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in decision-insights function:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});