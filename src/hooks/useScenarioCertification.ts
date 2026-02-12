import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MissingScenario {
  template_id: string;
  scenario_title: string;
  module_title: string;
}

export interface CertificationRequirements {
  all_requirements_met: boolean;
  total_required: number;
  completed_count: number;
  missing_scenarios: MissingScenario[];
}

/**
 * Hook to check if all required scenario assessments for an enrollment are completed
 */
export function useScenarioCertificationCheck(enrollmentId: string | undefined) {
  return useQuery({
    queryKey: ["scenario-certification-check", enrollmentId],
    queryFn: async (): Promise<CertificationRequirements> => {
      if (!enrollmentId) {
        return {
          all_requirements_met: true,
          total_required: 0,
          completed_count: 0,
          missing_scenarios: [],
        };
      }

      const { data, error } = await supabase
        .rpc("check_scenario_certification_requirements", { p_enrollment_id: enrollmentId })
        .single();

      if (error) throw error;

      return {
        all_requirements_met: data?.all_requirements_met ?? true,
        total_required: data?.total_required ?? 0,
        completed_count: data?.completed_count ?? 0,
        missing_scenarios: (data?.missing_scenarios as unknown as MissingScenario[]) ?? [],
      };
    },
    enabled: !!enrollmentId,
  });
}

/**
 * Hook to check certification requirements for multiple enrollments
 */
export function useBulkScenarioCertificationCheck(enrollmentIds: string[]) {
  return useQuery({
    queryKey: ["scenario-certification-check-bulk", enrollmentIds],
    queryFn: async (): Promise<Map<string, CertificationRequirements>> => {
      const results = new Map<string, CertificationRequirements>();

      // Query each enrollment (could be optimized with a bulk function later)
      await Promise.all(
        enrollmentIds.map(async (enrollmentId) => {
          const { data, error } = await supabase
            .rpc("check_scenario_certification_requirements", { p_enrollment_id: enrollmentId })
            .single();

          if (!error && data) {
            results.set(enrollmentId, {
              all_requirements_met: data.all_requirements_met ?? true,
              total_required: data.total_required ?? 0,
              completed_count: data.completed_count ?? 0,
              missing_scenarios: (data.missing_scenarios as unknown as MissingScenario[]) ?? [],
            });
          }
        }),
      );

      return results;
    },
    enabled: enrollmentIds.length > 0,
  });
}
