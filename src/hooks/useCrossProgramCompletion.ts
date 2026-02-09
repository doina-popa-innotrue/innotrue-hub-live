import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface CrossProgramModule {
  moduleId: string;
  moduleTitle: string;
  programId: string;
  programName: string;
  completedAt: string;
  completedVia: 'canonical_code' | 'talentlms';
}

interface CrossProgramCompletion {
  moduleId: string;
  completedModules: CrossProgramModule[];
}

/**
 * Hook to check if modules have been completed through other programs
 * Uses canonical_code for linked modules and talentlms_course_id for TalentLMS courses
 */
export function useCrossProgramCompletion(userId?: string, programId?: string) {
  const [crossProgramCompletions, setCrossProgramCompletions] = useState<Map<string, CrossProgramModule[]>>(new Map());
  const [loading, setLoading] = useState(true);

  const fetchCrossCompletions = useCallback(async () => {
    if (!userId || !programId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const completionsMap = new Map<string, CrossProgramModule[]>();

      // Get all modules for the current program with their canonical codes and talentlms links
      const { data: programModules, error: modulesError } = await supabase
        .from('program_modules')
        .select('id, title, canonical_code, links')
        .eq('program_id', programId)
        .eq('is_active', true);

      if (modulesError) throw modulesError;
      if (!programModules?.length) {
        setLoading(false);
        return;
      }

      // Get user's TalentLMS progress
      const { data: talentLmsProgress } = await supabase
        .from('talentlms_progress')
        .select('talentlms_course_id, completed_at')
        .eq('user_id', userId)
        .eq('completion_status', 'completed');

      const completedTlmsCourses = new Map(
        talentLmsProgress?.map(p => [p.talentlms_course_id, p.completed_at]) || []
      );

      // Get all user's completed module progress across ALL programs (not current one)
      const { data: allCompletedProgress } = await supabase
        .from('module_progress')
        .select(`
          module_id,
          completed_at,
          client_enrollments!inner (
            program_id,
            programs!inner (
              name
            )
          ),
          program_modules!inner (
            title,
            canonical_code
          )
        `)
        .eq('status', 'completed')
        .neq('client_enrollments.program_id', programId);

      // Filter to only get completions for this user
      const { data: userEnrollments } = await supabase
        .from('client_enrollments')
        .select('id')
        .eq('client_user_id', userId);

      const userEnrollmentIds = new Set(userEnrollments?.map(e => e.id) || []);

      // Get completed progress for user's enrollments only
      const { data: userCompletedProgress } = await supabase
        .from('module_progress')
        .select(`
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
        `)
        .eq('status', 'completed');

      const userCompletions = userCompletedProgress?.filter(
        p => userEnrollmentIds.has(p.enrollment_id) && p.program_modules.program_id !== programId
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
            completedAt: completion.completed_at || '',
            completedVia: 'canonical_code',
          };
          if (!canonicalCodeCompletions.has(code)) {
            canonicalCodeCompletions.set(code, []);
          }
          canonicalCodeCompletions.get(code)!.push(entry);
        }
      }

      // For each module in current program, check for cross-completions
      for (const module of programModules) {
        const crossCompletions: CrossProgramModule[] = [];

        // Check canonical code matches
        if (module.canonical_code && canonicalCodeCompletions.has(module.canonical_code)) {
          crossCompletions.push(...canonicalCodeCompletions.get(module.canonical_code)!);
        }

        // Check TalentLMS course matches
        const links = module.links as Array<{ type: string; url: string }> | null;
        const talentLmsLink = links?.find(l => l.type === 'talentlms');
        if (talentLmsLink) {
          const match = talentLmsLink.url.match(/id:(\d+)/);
          const courseId = match?.[1];
          if (courseId && completedTlmsCourses.has(courseId)) {
            // Find which program this was completed in
            for (const completion of userCompletions) {
              const completionLinks = (completion.program_modules as any).links as Array<{ type: string; url: string }> | null;
              const completionTlmsLink = completionLinks?.find(l => l.type === 'talentlms');
              if (completionTlmsLink) {
                const completionMatch = completionTlmsLink.url.match(/id:(\d+)/);
                if (completionMatch?.[1] === courseId) {
                  crossCompletions.push({
                    moduleId: completion.program_modules.id,
                    moduleTitle: completion.program_modules.title,
                    programId: completion.program_modules.programs.id,
                    programName: completion.program_modules.programs.name,
                    completedAt: completedTlmsCourses.get(courseId) || '',
                    completedVia: 'talentlms',
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
      console.error('Error fetching cross-program completions:', error);
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
