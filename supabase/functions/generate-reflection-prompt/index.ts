import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { truncateArray, truncateString, enforcePromptLimit } from "../_shared/ai-input-limits.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { errorResponse, successResponse } from "../_shared/error-response.ts";
import { aiChatCompletion, AI_MODEL } from "../_shared/ai-config.ts";

interface UserContext {
  recentModuleCompletions: Array<{ title: string; completed_at: string }>;
  recentMilestones: Array<{ title: string; completed_at: string }>;
  activeGoals: Array<{ title: string; progress: number }>;
  recentReflections: Array<{ content: string; created_at: string }>;
  wheelDomains: Array<{ name: string; score: number }>;
  upcomingDeadlines: Array<{ title: string; due_date: string }>;
}

serve(async (req) => {
  const cors = getCorsHeaders(req);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: cors });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return errorResponse.unauthorized("Missing authorization header", cors);
    }

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return errorResponse.unauthorized("Invalid token", cors);
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
        return successResponse.ok({ prompt: existingPrompt, isNew: false }, cors);
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

    // Build context for AI (with truncation safety)
    const context: UserContext = {
      recentModuleCompletions: truncateArray((moduleCompletions || []).map(m => ({
        title: truncateString((m.program_modules as any)?.title || 'Unknown module', 200),
        completed_at: m.completed_at || '',
      })), 10),
      recentMilestones: truncateArray((milestoneCompletions || []).map(m => ({
        title: truncateString(m.title, 200),
        completed_at: m.completed_at || '',
      })), 10),
      activeGoals: truncateArray((activeGoals || []).map(g => ({
        title: truncateString(g.title, 200),
        progress: g.progress_percentage || 0,
      })), 10),
      recentReflections: truncateArray((recentReflections || []).map(r => ({
        content: truncateString(r.content, 200),
        created_at: r.created_at,
      })), 5),
      wheelDomains: truncateArray((wheelScores || []).map(w => ({
        name: w.domain,
        score: w.score,
      })), 10),
      upcomingDeadlines: truncateArray((upcomingDeadlines || []).map(d => ({
        title: truncateString(d.title, 200),
        due_date: d.target_date || '',
      })), 10),
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

    const rawUserMessage = `Generate a ${periodType} reflection prompt for this user.

Recent Activity:
- Completed modules: ${context.recentModuleCompletions.map(m => m.title).join(', ') || 'None recently'}
- Completed milestones: ${context.recentMilestones.map(m => m.title).join(', ') || 'None recently'}
- Active goals: ${context.activeGoals.map(g => `${g.title} (${g.progress}%)`).join(', ') || 'No active goals'}
- Upcoming deadlines: ${context.upcomingDeadlines.map(d => `${d.title} by ${d.due_date}`).join(', ') || 'None'}
- Life areas (wheel scores): ${context.wheelDomains.map(w => `${w.name}: ${w.score}/10`).join(', ') || 'Not assessed'}

Recent reflection themes (avoid repeating):
${context.recentReflections.map(r => `- "${r.content}"`).join('\n') || 'No recent reflections'}`;

    const { prompt: userMessage, wasTruncated } = enforcePromptLimit(rawUserMessage);
    if (wasTruncated) {
      console.warn('generate-reflection-prompt: user message was truncated to fit AI input limits');
    }

    console.log('Calling AI for prompt generation...');

    const aiResponse = await aiChatCompletion(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      { model: AI_MODEL, max_tokens: 150, temperature: 0.8 },
    );

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);

      if (aiResponse.status === 429) {
        return errorResponse.rateLimit("AI service is temporarily busy. Please try again in a few minutes.", cors);
      }
      if (aiResponse.status === 402) {
        return errorResponse.badRequest("AI credits exhausted. Please upgrade your plan or purchase additional credits.", cors);
      }

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

    return successResponse.ok({ prompt: newPrompt, isNew: true }, cors);

  } catch (error: unknown) {
    return errorResponse.serverError("GENERATE-REFLECTION-PROMPT", error, cors);
  }
});
