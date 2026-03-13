import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// ---------- Type definitions ----------

// ROI Metrics

interface ProgramROI {
  program_id: string;
  program_name: string;
  total_investment: number;
  completions: number;
  total_enrolled: number;
  cost_per_completion: number | null;
  avg_completion_days: number;
  skills_granted: number;
}

export interface ROIMetrics {
  total_credit_investment: number;
  cost_per_completion: number | null;
  cost_per_active_learner: number | null;
  avg_enrollment_completion_days: number;
  skills_acquired_in_period: number;
  credits_per_skill: number | null;
  completion_efficiency: number;
  total_completions: number;
  total_enrollments: number;
  active_learners: number;
  credits_consumed_in_period: number;
  program_roi: ProgramROI[];
}

// Capability / Skills Gap

interface DomainGap {
  domain_id: string;
  domain_name: string;
  org_avg_score: number;
  min_score: number;
  max_score: number;
  self_avg: number | null;
  evaluator_avg: number | null;
  self_evaluator_gap: number | null;
}

interface AssessmentGap {
  assessment_id: string;
  assessment_name: string;
  rating_scale: number;
  members_assessed: number;
  members_total: number;
  coverage_pct: number;
  org_avg_score: number;
  domains: DomainGap[];
}

interface SkillGap {
  skill_id: string;
  skill_name: string;
  required_by_programs: number;
  members_acquired: number;
  members_enrolled: number;
  acquisition_pct: number;
}

interface SkillsCoverage {
  total_program_skills: number;
  total_acquired: number;
  coverage_pct: number;
  top_gaps: SkillGap[];
}

export interface CapabilityGapData {
  assessments: AssessmentGap[];
  skills_coverage: SkillsCoverage;
}

// Cohort Retention

interface CohortRetentionRow {
  cohort_id: string;
  cohort_name: string;
  program_name: string;
  start_date: string | null;
  end_date: string | null;
  capacity: number | null;
  cohort_status: string;
  total_enrolled: number;
  active: number;
  completed: number;
  paused: number;
  cancelled: number;
  completion_rate: number;
  dropout_rate: number;
  attendance_rate: number;
  total_sessions: number;
  module_completion_rate: number;
}

interface CohortOverall {
  avg_completion_rate: number;
  avg_dropout_rate: number;
  avg_attendance_rate: number;
  avg_module_completion_rate: number;
  total_cohorts: number;
}

export interface CohortRetentionData {
  cohorts: CohortRetentionRow[];
  overall: CohortOverall;
}

// Combined

export interface OrgAnalyticsAdvanced {
  total_members: number;
  date_from: string;
  date_to: string;
  roi_metrics: ROIMetrics;
  capability_gap: CapabilityGapData;
  cohort_retention: CohortRetentionData;
}

// ---------- Hook ----------

interface UseOrgAnalyticsAdvancedOptions {
  dateFrom?: string;
  dateTo?: string;
  enabled?: boolean; // extra gate for tab-based lazy loading
}

export function useOrgAnalyticsAdvanced(
  organizationId: string | undefined,
  options: UseOrgAnalyticsAdvancedOptions = {},
) {
  const { user } = useAuth();
  const { dateFrom, dateTo, enabled: extraEnabled = true } = options;

  return useQuery({
    queryKey: [
      "org-analytics-advanced",
      organizationId,
      dateFrom,
      dateTo,
    ],
    queryFn: async (): Promise<OrgAnalyticsAdvanced | null> => {
      if (!organizationId) return null;

      const { data, error } = await supabase.rpc(
        "get_org_analytics_advanced" as never,
        {
          p_org_id: organizationId,
          p_date_from: dateFrom ?? null,
          p_date_to: dateTo ?? null,
        } as never,
      );

      if (error) {
        console.error("Error fetching org analytics advanced:", error);
        throw error;
      }

      return data as unknown as OrgAnalyticsAdvanced;
    },
    enabled: !!organizationId && !!user && extraEnabled,
    staleTime: 60_000,
    retry: 1,
  });
}
