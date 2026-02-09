import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UserContext {
  recentModuleCompletions: Array<{ title: string; completed_at: string }>;
  recentMilestones: Array<{ title: string; completed_at: string }>;
  activeGoals: Array<{ title: string; progress: number }>;
  recentReflections: Array<{ content: string; created_at: string }>;
  wheelDomains: Array<{ name: string; score: number }>;
  upcomingDeadlines: Array<{ title: string; due_date: string }>;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const { getAIApiKey, AI_ENDPOINT, AI_MODEL } = await import('../_shared/ai-config.ts');
    const aiApiKey = getAIApiKey();

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { periodType = 'weekly', forceGenerate = false } = await req.json().catch(() => ({}));

    // Calculate period start
    const now = new Date();
    let periodStart: Date;
    if (periodType === 'weekly') {
      // Start of current week (Monday)
      const dayOfWeek = now.getDay();
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      periodStart = new Date(now);
      periodStart.setDate(now.getDate() - daysToMonday);
      periodStart.setHours(0, 0, 0, 0);
    } else {
      // Start of current month
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const periodStartStr = periodStart.toISOString().split('T')[0];

    // Check if we already have a pending prompt for this period
    if (!forceGenerate) {
      const { data: existingPrompt } = await supabase
        .from('generated_prompts')
        .select('*')
        .eq('user_id', user.id)
        .eq('period_type', periodType)
        .eq('period_start', periodStartStr)
        .eq('status', 'pending')
        .single();

      if (existingPrompt) {
        console.log('Returning existing prompt for period:', periodStartStr);
        return new Response(JSON.stringify({ prompt: existingPrompt, isNew: false }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Gather user context for personalized prompt
    console.log('Gathering user context for:', user.id);

    // Recent module completions (last 30 days)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: moduleCompletions } = await supabase
      .from('module_progress')
      .select(`
        completed_at,
        program_modules!inner(title)
      `)
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .gte('completed_at', thirtyDaysAgo)
      .order('completed_at', { ascending: false })
      .limit(5);

    // Recent milestone completions
    const { data: milestoneCompletions } = await supabase
      .from('goal_milestones')
      .select(`
        title,
        completed_at,
        goals!inner(user_id)
      `)
      .eq('goals.user_id', user.id)
      .eq('status', 'completed')
      .gte('completed_at', thirtyDaysAgo)
      .order('completed_at', { ascending: false })
      .limit(5);

    // Active goals
    const { data: activeGoals } = await supabase
      .from('goals')
      .select('title, progress_percentage')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .limit(5);

    // Recent reflections (to avoid repetition)
    const { data: recentReflections } = await supabase
      .from('development_items')
      .select('content, created_at')
      .eq('user_id', user.id)
      .eq('item_type', 'reflection')
      .order('created_at', { ascending: false })
      .limit(3);

    // Latest wheel of life scores
    const { data: wheelScores } = await supabase
      .from('wheel_of_life_scores')
      .select('domain, score')
      .eq('user_id', user.id)
      .order('assessed_at', { ascending: false })
      .limit(10);

    // Upcoming deadlines (next 14 days)
    const fourteenDaysFromNow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const { data: upcomingDeadlines } = await supabase
      .from('goals')
      .select('title, target_date')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .not('target_date', 'is', null)
      .lte('target_date', fourteenDaysFromNow)
      .gte('target_date', now.toISOString())
      .limit(5);

    // Build context for AI
    const context: UserContext = {
      recentModuleCompletions: (moduleCompletions || []).map(m => ({
        title: (m.program_modules as any)?.title || 'Unknown module',
        completed_at: m.completed_at || '',
      })),
      recentMilestones: (milestoneCompletions || []).map(m => ({
        title: m.title,
        completed_at: m.completed_at || '',
      })),
      activeGoals: (activeGoals || []).map(g => ({
        title: g.title,
        progress: g.progress_percentage || 0,
      })),
      recentReflections: (recentReflections || []).map(r => ({
        content: r.content?.substring(0, 200) || '',
        created_at: r.created_at,
      })),
      wheelDomains: (wheelScores || []).map(w => ({
        name: w.domain,
        score: w.score,
      })),
      upcomingDeadlines: (upcomingDeadlines || []).map(d => ({
        title: d.title,
        due_date: d.target_date || '',
      })),
    };

    console.log('Context gathered:', JSON.stringify(context, null, 2));

    // Generate prompt using OpenAI
    const systemPrompt = `You are a thoughtful personal development coach helping users reflect on their growth journey. Generate a single, personalized reflection prompt for the user based on their recent activity and goals.

Guidelines:
- Keep the prompt concise (1-2 sentences)
- Make it specific to their situation, not generic
- Focus on growth, learning, or self-awareness
- If they completed something recently, acknowledge it
- If they have upcoming deadlines, gently reference them
- Vary the angle: sometimes ask about feelings, sometimes about actions, sometimes about learnings
- Don't repeat themes from their recent reflections
- Be warm and encouraging, not preachy

Respond with ONLY the prompt text, nothing else.`;

    const userMessage = `Generate a ${periodType} reflection prompt for this user.

Recent Activity:
- Completed modules: ${context.recentModuleCompletions.map(m => m.title).join(', ') || 'None recently'}
- Completed milestones: ${context.recentMilestones.map(m => m.title).join(', ') || 'None recently'}
- Active goals: ${context.activeGoals.map(g => `${g.title} (${g.progress}%)`).join(', ') || 'No active goals'}
- Upcoming deadlines: ${context.upcomingDeadlines.map(d => `${d.title} by ${d.due_date}`).join(', ') || 'None'}
- Life areas (wheel scores): ${context.wheelDomains.map(w => `${w.name}: ${w.score}/10`).join(', ') || 'Not assessed'}

Recent reflection themes (avoid repeating):
${context.recentReflections.map(r => `- "${r.content}"`).join('\n') || 'No recent reflections'}`;

    console.log('Calling AI for prompt generation...');

    const aiResponse = await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${aiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        max_tokens: 150,
        temperature: 0.8,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const promptText = aiData.choices?.[0]?.message?.content?.trim() || 
      "What's one thing you learned about yourself this week that you'd like to explore further?";

    console.log('Generated prompt:', promptText);

    // Save the generated prompt
    const { data: newPrompt, error: insertError } = await supabase
      .from('generated_prompts')
      .insert({
        user_id: user.id,
        prompt_text: promptText,
        prompt_context: context,
        period_type: periodType,
        period_start: periodStartStr,
        status: 'pending',
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error saving prompt:', insertError);
      throw insertError;
    }

    return new Response(JSON.stringify({ prompt: newPrompt, isNew: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in generate-reflection-prompt:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
