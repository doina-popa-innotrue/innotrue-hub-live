import { supabase } from "@/integrations/supabase/client";

/**
 * Awards skills to a user when they complete a module.
 * This function fetches the skills associated with the module and inserts them into user_skills.
 */
export async function awardSkillsForModuleCompletion(
  userId: string,
  moduleId: string,
  moduleProgressId: string,
): Promise<{ awarded: number; error: Error | null }> {
  try {
    // Get skills associated with this module
    const { data: moduleSkills, error: fetchError } = await supabase
      .from("module_skills")
      .select("skill_id")
      .eq("module_id", moduleId);

    if (fetchError) throw fetchError;
    if (!moduleSkills || moduleSkills.length === 0) {
      return { awarded: 0, error: null };
    }

    // Insert user skills (ignoring duplicates via ON CONFLICT)
    const skillsToInsert = moduleSkills.map((ms) => ({
      user_id: userId,
      skill_id: ms.skill_id,
      source_type: "module_completion",
      source_id: moduleProgressId,
      is_public: false,
    }));

    let awardedCount = 0;
    for (const skill of skillsToInsert) {
      const { error: insertError } = await supabase
        .from("user_skills")
        .upsert(skill, { onConflict: "user_id,skill_id", ignoreDuplicates: true });

      if (!insertError) {
        awardedCount++;
      }
    }

    return { awarded: awardedCount, error: null };
  } catch (error) {
    console.error("Error awarding skills:", error);
    return { awarded: 0, error: error as Error };
  }
}

/**
 * Hook to get user's skill count
 */
export async function getUserSkillCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("user_skills")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  if (error) {
    console.error("Error fetching skill count:", error);
    return 0;
  }

  return count || 0;
}
