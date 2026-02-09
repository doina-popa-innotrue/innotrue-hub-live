import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface CrossProgramModule {
  moduleId: string;
  moduleTitle: string;
  completedInProgram: string;
  completedAt: string | null;
  completionSource: 'internal' | 'talentlms';
}

interface ProgramCompletionInfo {
  totalModules: number;
  completedElsewhere: CrossProgramModule[];
  suggestedDiscountPercent: number;
}

export function useExploreModuleCompletions(userId: string | undefined) {
  const [loading, setLoading] = useState(false);

  const checkProgramCompletions = useCallback(async (
    programId: string
  ): Promise<ProgramCompletionInfo> => {
    if (!userId) {
      return { totalModules: 0, completedElsewhere: [], suggestedDiscountPercent: 0 };
    }

    setLoading(true);
    try {
      // Fetch program modules with their canonical codes
      const { data: modules } = await supabase
        .from('program_modules')
        .select('id, title, canonical_code, links')
        .eq('program_id', programId)
        .eq('is_active', true);

      if (!modules || modules.length === 0) {
        return { totalModules: 0, completedElsewhere: [], suggestedDiscountPercent: 0 };
      }

      // Get user's enrollments (to filter module progress by user)
      const { data: userEnrollments } = await supabase
        .from('client_enrollments')
        .select('id, program_id')
        .eq('client_user_id', userId);

      const userEnrollmentIds = new Set(userEnrollments?.map(e => e.id) || []);

      // Fetch user's completed modules in OTHER programs
      const { data: otherProgramProgress } = await supabase
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
              name
            )
          )
        `)
        .eq('status', 'completed');

      // Filter to user's enrollments only and not current program
      const userCompletedProgress = (otherProgramProgress || []).filter((p: any) => 
        userEnrollmentIds.has(p.enrollment_id) &&
        p.program_modules.program_id !== programId
      );

      // Build map of canonical codes to completion info
      const canonicalCodeToCompletion = new Map<string, { programName: string; completedAt: string | null }>();
      userCompletedProgress.forEach((progress: any) => {
        const module = progress.program_modules;
        if (module.canonical_code) {
          canonicalCodeToCompletion.set(module.canonical_code, {
            programName: module.programs?.name || 'Unknown Program',
            completedAt: progress.completed_at,
          });
        }
      });

      // Fetch TalentLMS progress
      const { data: talentLmsProgress } = await supabase
        .from('talentlms_progress')
        .select('talentlms_course_id, completion_status, completed_at')
        .eq('user_id', userId)
        .eq('completion_status', 'completed');

      const talentLmsToCompletion = new Map<string, { completedAt: string | null }>();
      talentLmsProgress?.forEach((tlms: any) => {
        talentLmsToCompletion.set(tlms.talentlms_course_id, {
          completedAt: tlms.completed_at,
        });
      });

      // Check which modules in the target program are already completed elsewhere
      const completedElsewhere: CrossProgramModule[] = [];

      modules.forEach((module) => {
        // Check by canonical code
        if (module.canonical_code && canonicalCodeToCompletion.has(module.canonical_code)) {
          const completion = canonicalCodeToCompletion.get(module.canonical_code)!;
          completedElsewhere.push({
            moduleId: module.id,
            moduleTitle: module.title,
            completedInProgram: completion.programName,
            completedAt: completion.completedAt,
            completionSource: 'internal',
          });
        }
        // Check by TalentLMS link in module links field
        else if (module.links) {
          try {
            const links = typeof module.links === 'string' ? JSON.parse(module.links) : module.links;
            const tlmsLink = Array.isArray(links) 
              ? links.find((l: any) => l.type === 'talentlms' && l.course_id)
              : null;
            
            if (tlmsLink && talentLmsToCompletion.has(tlmsLink.course_id)) {
              const completion = talentLmsToCompletion.get(tlmsLink.course_id)!;
              completedElsewhere.push({
                moduleId: module.id,
                moduleTitle: module.title,
                completedInProgram: 'TalentLMS',
                completedAt: completion.completedAt,
                completionSource: 'talentlms',
              });
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      });

      // Calculate suggested discount
      const completionRatio = completedElsewhere.length / modules.length;
      let suggestedDiscountPercent = 0;
      
      if (completionRatio >= 0.75) {
        suggestedDiscountPercent = 50;
      } else if (completionRatio >= 0.5) {
        suggestedDiscountPercent = 35;
      } else if (completionRatio >= 0.25) {
        suggestedDiscountPercent = 20;
      } else if (completionRatio > 0) {
        suggestedDiscountPercent = 10;
      }

      return {
        totalModules: modules.length,
        completedElsewhere,
        suggestedDiscountPercent,
      };
    } catch (error) {
      console.error('Error checking program completions:', error);
      return { totalModules: 0, completedElsewhere: [], suggestedDiscountPercent: 0 };
    } finally {
      setLoading(false);
    }
  }, [userId]);

  return {
    loading,
    checkProgramCompletions,
  };
}
