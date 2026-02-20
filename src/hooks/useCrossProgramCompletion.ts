import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface CrossProgramModule {
  moduleId: string;
  moduleTitle: string;
  programId: string;
  programName: string;
  completedAt: string;
  completedVia: "canonical_code" | "talentlms" | "content_package";
}

interface CrossProgramCompletion {
  moduleId: string;
  completedModules: CrossProgramModule[];
}

/**
 * Hook to check if modules have been completed through other programs.
 * Uses three sources:
 *   1. canonical_code — manual cross-program linking
 *   2. talentlms_course_id — TalentLMS course completion
 *   3. content_package_id — shared content package completion (CT3)
 */
export function useCrossProgramCompletion(userId?: string, programId?: string) {
  const [crossProgramCompletions, setCrossProgramCompletions] = useState<
    Map<string, CrossProgramModule[]>
  >(new Map());
  const [loading, setLoading] = useState(true);

  const fetchCrossCompletions = useCallback(async () => {
    if (!userId || !programId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const completionsMap = new Map<string, CrossProgramModule[]>();

      // Get all modules for the current program with their canonical codes, content package IDs, and talentlms links
      const { data: programModules, error: modulesError } = await supabase
        .from("program_modules")
        .select("id, title, canonical_code, content_package_id, links")
        .eq("program_id", programId)
        .eq("is_active", true);

      if (modulesError) throw modulesError;
      if (!programModules?.length) {
        setLoading(false);
        return;
      }

      // Get user's TalentLMS progress
      const { data: talentLmsProgress } = await supabase
        .from("talentlms_progress")
        .select("talentlms_course_id, completed_at")
        .eq("user_id", userId)
        .eq("completion_status", "completed");

      const completedTlmsCourses = new Map(
        talentLmsProgress?.map((p) => [p.talentlms_course_id, p.completed_at]) || [],
      );

      // ── CT3: Get user's content-level completions ──
      const contentPackageIds = programModules
        .map((m) => m.content_package_id)
        .filter(Boolean) as string[];

      const contentCompletionsMap = new Map<
        string,
        { completedAt: string; sourceModuleId: string | null }
      >();

      if (contentPackageIds.length > 0) {
        const { data: contentCompletions } = await supabase
          .from("content_completions")
          .select("content_package_id, completed_at, source_module_id")
          .eq("user_id", userId)
          .in("content_package_id", contentPackageIds);

        if (contentCompletions) {
          for (const cc of contentCompletions as any[]) {
            contentCompletionsMap.set(cc.content_package_id, {
              completedAt: cc.completed_at,
              sourceModuleId: cc.source_module_id,
            });
          }
        }
      }

      // Get all user's completed module progress across ALL programs (not current one)
      const { data: userEnrollments } = await supabase
        .from("client_enrollments")
        .select("id")
        .eq("client_user_id", userId);

      const userEnrollmentIds = new Set(userEnrollments?.map((e) => e.id) || []);

      // Get completed progress for user's enrollments only
      const { data: userCompletedProgress } = await supabase
        .from("module_progress")
        .select(
          `
          module_id,
          enrollment_id,
          completed_at,
          program_modules!inner (
            id,
            title,
            canonical_code,
            program_id,
            programs!inner (
              id,
              name
            )
          )
        `,
        )
        .eq("status", "completed");

      const userCompletions =
        userCompletedProgress?.filter(
          (p) =>
            userEnrollmentIds.has(p.enrollment_id) && p.program_modules.program_id !== programId,
        ) || [];

      // Build a map of canonical_code -> completed modules from other programs
      const canonicalCodeCompletions = new Map<string, CrossProgramModule[]>();
      for (const completion of userCompletions) {
        const code = completion.program_modules.canonical_code;
        if (code) {
          const entry: CrossProgramModule = {
            moduleId: completion.program_modules.id,
            moduleTitle: completion.program_modules.title,
            programId: completion.program_modules.programs.id,
            programName: completion.program_modules.programs.name,
            completedAt: completion.completed_at || "",
            completedVia: "canonical_code",
          };
          if (!canonicalCodeCompletions.has(code)) {
            canonicalCodeCompletions.set(code, []);
          }
          canonicalCodeCompletions.get(code)!.push(entry);
        }
      }

      // ── CT3: Build source module lookup for content completions ──
      // We need to look up the source module details to show where content was completed
      const sourceModuleIds = [...contentCompletionsMap.values()]
        .map((v) => v.sourceModuleId)
        .filter(Boolean) as string[];

      const sourceModulesMap = new Map<
        string,
        { title: string; programId: string; programName: string }
      >();

      if (sourceModuleIds.length > 0) {
        const { data: sourceModules } = await supabase
          .from("program_modules")
          .select("id, title, program_id, programs!inner(id, name)")
          .in("id", sourceModuleIds);

        if (sourceModules) {
          for (const sm of sourceModules as any[]) {
            sourceModulesMap.set(sm.id, {
              title: sm.title,
              programId: sm.programs.id,
              programName: sm.programs.name,
            });
          }
        }
      }

      // For each module in current program, check for cross-completions
      for (const module of programModules) {
        const crossCompletions: CrossProgramModule[] = [];

        // Check canonical code matches
        if (module.canonical_code && canonicalCodeCompletions.has(module.canonical_code)) {
          crossCompletions.push(...canonicalCodeCompletions.get(module.canonical_code)!);
        }

        // ── CT3: Check content package completion ──
        const cpId = module.content_package_id;
        if (cpId && contentCompletionsMap.has(cpId)) {
          const cc = contentCompletionsMap.get(cpId)!;
          // Only count as cross-completion if the source module is in a different program
          if (cc.sourceModuleId && cc.sourceModuleId !== module.id) {
            const source = sourceModulesMap.get(cc.sourceModuleId);
            if (source && source.programId !== programId) {
              crossCompletions.push({
                moduleId: cc.sourceModuleId,
                moduleTitle: source.title,
                programId: source.programId,
                programName: source.programName,
                completedAt: cc.completedAt,
                completedVia: "content_package",
              });
            }
          }
        }

        // Check TalentLMS course matches
        const links = module.links as Array<{ type: string; url: string }> | null;
        const talentLmsLink = links?.find((l) => l.type === "talentlms");
        if (talentLmsLink) {
          const match = talentLmsLink.url.match(/id:(\d+)/);
          const courseId = match?.[1];
          if (courseId && completedTlmsCourses.has(courseId)) {
            // Find which program this was completed in
            for (const completion of userCompletions) {
              const completionLinks = (completion.program_modules as any).links as Array<{
                type: string;
                url: string;
              }> | null;
              const completionTlmsLink = completionLinks?.find((l) => l.type === "talentlms");
              if (completionTlmsLink) {
                const completionMatch = completionTlmsLink.url.match(/id:(\d+)/);
                if (completionMatch?.[1] === courseId) {
                  crossCompletions.push({
                    moduleId: completion.program_modules.id,
                    moduleTitle: completion.program_modules.title,
                    programId: completion.program_modules.programs.id,
                    programName: completion.program_modules.programs.name,
                    completedAt: completedTlmsCourses.get(courseId) || "",
                    completedVia: "talentlms",
                  });
                  break; // Only need one match
                }
              }
            }
          }
        }

        if (crossCompletions.length > 0) {
          completionsMap.set(module.id, crossCompletions);
        }
      }

      setCrossProgramCompletions(completionsMap);
    } catch (error) {
      console.error("Error fetching cross-program completions:", error);
    } finally {
      setLoading(false);
    }
  }, [userId, programId]);

  useEffect(() => {
    fetchCrossCompletions();
  }, [fetchCrossCompletions]);

  /**
   * Get cross-program completions for a specific module
   */
  const getModuleCrossCompletions = (moduleId: string): CrossProgramModule[] => {
    return crossProgramCompletions.get(moduleId) || [];
  };

  /**
   * Check if a module has been completed in another program
   */
  const isCompletedElsewhere = (moduleId: string): boolean => {
    return crossProgramCompletions.has(moduleId);
  };

  /**
   * Get count of modules completed elsewhere
   */
  const crossCompletedCount = crossProgramCompletions.size;

  return {
    crossProgramCompletions,
    getModuleCrossCompletions,
    isCompletedElsewhere,
    crossCompletedCount,
    loading,
    refetch: fetchCrossCompletions,
  };
}
