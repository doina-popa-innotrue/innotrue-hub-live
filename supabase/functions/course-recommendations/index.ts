import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { truncateArray, truncateString, truncateJson, enforcePromptLimit } from "../_shared/ai-input-limits.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { errorResponse, successResponse } from "../_shared/error-response.ts";
import { aiChatCompletion, AI_MODEL } from "../_shared/ai-config.ts";

// Per-user rate limiting (in-memory, per instance)
const userRateLimits = new Map<string, { count: number; resetTime: number }>();
const USER_RATE_LIMIT = 5;
const USER_RATE_WINDOW = 60000;

function checkUserRateLimit(userId: string): boolean {
  const now = Date.now();
  const record = userRateLimits.get(userId);
  
  if (!record || now > record.resetTime) {
    userRateLimits.set(userId, { count: 1, resetTime: now + USER_RATE_WINDOW });
    return true;
  }
  
  if (record.count >= USER_RATE_LIMIT) {
    return false;
  }
  
  record.count++;
  return true;
}

// deno-lint-ignore no-explicit-any
async function checkPlatformAILimit(supabaseAdmin: any): Promise<{ allowed: boolean; message?: string }> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const { data: consumption } = await supabaseAdmin
    .from('add_on_consumption_log')
    .select('quantity_consumed')
    .gte('created_at', monthStart);

  const totalUsed = (consumption || []).reduce((sum: number, c: { quantity_consumed?: number }) => sum + (c.quantity_consumed || 0), 0);

  const { data: limitSetting } = await supabaseAdmin
    .from('system_settings')
    .select('value')
    .eq('key', 'ai_monthly_credit_limit')
    .single();

  const settingValue = limitSetting as { value?: string } | null;
  const monthlyLimit = parseInt(settingValue?.value || '1000', 10);

  if (totalUsed >= monthlyLimit) {
    return { allowed: false, message: 'Platform AI credit limit reached for this month.' };
  }

  return { allowed: true };
}

serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return errorResponse.unauthorized("Unauthorized", cors);
    }

    if (!checkUserRateLimit(user.id)) {
      return errorResponse.rateLimit("Too many requests. Please try again in a minute.", cors);
    }

    const limitCheck = await checkPlatformAILimit(supabaseAdmin);
    if (!limitCheck.allowed) {
      return errorResponse.rateLimit(limitCheck.message, cors);
    }

    const { data: providerSetting } = await supabaseAdmin
      .from('system_settings').select('value').eq('key', 'ai_recommendation_providers').single();

    let allowedProviders: string[] = [];
    try { allowedProviders = JSON.parse((providerSetting as { value?: string })?.value || '[]'); } catch { allowedProviders = []; }

    const { data: enrollments } = await supabase
      .from("client_enrollments")
      .select(`id, status, program_id, programs!inner (id, name, description, category)`)
      .eq("client_user_id", user.id);

    const enrolledProgramIds = (enrollments || []).map((e: { program_id: string }) => e.program_id);
    const completedProgramIds = (enrollments || [])
      .filter((e: { status: string }) => e.status === 'completed')
      .map((e: { program_id: string }) => e.program_id);

    // Use empty array check instead of hardcoded nil UUID
    const excludeIds = completedProgramIds.length > 0 ? completedProgramIds : [];
    
    let availableProgramsQuery = supabaseAdmin
      .from("programs").select(`id, name, description, category, status`).eq('status', 'active');
    
    if (excludeIds.length > 0) {
      availableProgramsQuery = availableProgramsQuery.not('id', 'in', `(${excludeIds.join(',')})`);
    }
    
    const { data: availablePrograms } = await availableProgramsQuery;

    const enrolledPrograms = (availablePrograms || []).filter((p: { id: string }) => 
      enrolledProgramIds.includes(p.id) && !completedProgramIds.includes(p.id));
    const notEnrolledPrograms = (availablePrograms || []).filter((p: { id: string }) => !enrolledProgramIds.includes(p.id));

    const { data: completedModules } = await supabase
      .from("module_progress")
      .select(`id, program_modules!inner (id, title, module_type, module_skills (skills (name, category)))`)
      .eq("status", "completed");

    const { data: externalCourses } = await supabase
      .from("external_courses")
      .select(`id, title, provider, status, external_course_skills (skills (name, category))`)
      .eq("user_id", user.id);

    const { data: userInterests } = await supabase
      .from("user_interests").select("interests, values, drives, preferred_categories").eq("user_id", user.id).single();

    const { data: userProfile } = await supabase
      .from("profiles").select("desired_target_role, future_vision, constraints").eq("id", user.id).single();

    // deno-lint-ignore no-explicit-any
    const completedProgramsData = (enrollments || [])
      .filter((e: any) => e.status === 'completed')
      .map((e: any) => ({
        name: e.programs?.name || '',
        category: e.programs?.category || ''
      }));

    // deno-lint-ignore no-explicit-any
    const acquiredSkills = (completedModules || []).flatMap((m: any) => 
      (m.program_modules?.module_skills || []).map((ms: any) => ms.skills)
    );

    // deno-lint-ignore no-explicit-any
    const externalCoursesData = (externalCourses || []).map((c: any) => ({
      title: c.title, provider: c.provider, status: c.status,
      skills: (c.external_course_skills || []).map((ecs: any) => ecs.skills)
    }));

    const cataloguePrograms = {
      currentlyEnrolled: truncateArray(enrolledPrograms.map((p: { name: string; description: string; category: string }) => ({ name: p.name, description: truncateString(p.description, 200), category: p.category })), 30),
      availableToEnroll: truncateArray(notEnrolledPrograms.map((p: { name: string; description: string; category: string }) => ({ name: p.name, description: truncateString(p.description, 200), category: p.category })), 30)
    };

    // Apply truncation safety to assembled data
    const safeCompletedPrograms = truncateArray(completedProgramsData, 20);
    const safeAcquiredSkills = truncateArray(acquiredSkills, 50);
    const safeExternalCourses = truncateArray(externalCoursesData, 20);

    const providerInstruction = allowedProviders.length > 0
      ? `For external courses, ONLY suggest from these providers: ${allowedProviders.join(', ')}.`
      : 'You may suggest external courses from any reputable provider.';

    const rawUserMessage = `Recommend 5 courses. Platform catalogue: ${truncateJson(cataloguePrograms)}. History: ${truncateJson(safeCompletedPrograms)}. Skills: ${truncateJson(safeAcquiredSkills)}. External: ${truncateJson(safeExternalCourses)}. Interests: ${truncateJson(userInterests?.interests || [])}. Values: ${truncateJson(userInterests?.values || [])}. Role: ${truncateString(userProfile?.desired_target_role, 200) || 'Not specified'}. ${providerInstruction}`;

    const { prompt: userMessage, wasTruncated } = enforcePromptLimit(rawUserMessage);
    if (wasTruncated) {
      console.warn('course-recommendations: user message was truncated to fit AI input limits');
    }

    const aiResponse = await aiChatCompletion(
      [
        { role: "system", content: `You are a learning advisor. Prioritize platform programs first.` },
        { role: "user", content: userMessage }
      ],
      { model: AI_MODEL },
    );

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) return errorResponse.rateLimit("AI rate limit exceeded", cors);
      throw new Error("AI gateway error");
    }

    const aiData = await aiResponse.json();
    return successResponse.ok({ recommendations: aiData.choices[0]?.message?.content || "" }, cors);
  } catch (error) {
    return errorResponse.serverError("COURSE-RECOMMENDATIONS", error, cors);
  }
});
