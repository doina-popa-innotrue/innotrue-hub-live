import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// ---------- Type definitions ----------

interface EnrollmentStats {
  total: number;
  active: number;
  completed: number;
  paused: number;
  cancelled: number;
  completion_rate: number;
  new_in_period: number;
  completed_in_period: number;
  unique_learners: number;
  avg_enrollments_per_member: number;
}

interface ModuleStats {
  total: number;
  completed: number;
  in_progress: number;
  not_started: number;
  completion_rate: number;
  completed_in_period: number;
  avg_completion_days: number;
}

interface ScenarioStats {
  total: number;
  draft: number;
  submitted: number;
  in_review: number;
  evaluated: number;
  completion_rate: number;
  submitted_in_period: number;
  evaluated_in_period: number;
  unique_participants: number;
}

interface CapabilityStats {
  total: number;
  completed: number;
  in_progress: number;
  self_assessments: number;
  evaluator_assessments: number;
  completed_in_period: number;
  unique_assessed: number;
}

interface CreditTransaction {
  type: string;
  amount: number;
  description: string | null;
  created_at: string;
}

interface CreditStats {
  total_purchased: number;
  total_consumed: number;
  available: number;
  reserved: number;
  consumed_in_period: number;
  recent_transactions: CreditTransaction[];
}

interface ProgramBreakdown {
  program_id: string;
  program_name: string;
  total_enrolled: number;
  active: number;
  completed: number;
  completion_rate: number;
  module_completion_rate: number;
}

interface MemberEngagement {
  user_id: string;
  enrollment_count: number;
  completed_enrollments: number;
  modules_completed: number;
  scenarios_evaluated: number;
  assessments_completed: number;
  last_activity: string | null;
  joined_at: string | null;
}

interface EnrollmentTrend {
  week_start: string;
  new_enrollments: number;
  completions: number;
}

export interface OrgAnalyticsSummary {
  total_members: number;
  date_from: string;
  date_to: string;
  enrollment_stats: EnrollmentStats;
  module_stats: ModuleStats;
  scenario_stats: ScenarioStats;
  capability_stats: CapabilityStats;
  credit_stats: CreditStats;
  program_breakdown: ProgramBreakdown[];
  member_engagement: MemberEngagement[];
  enrollment_trends: EnrollmentTrend[];
}

// ---------- Hook ----------

interface UseOrgAnalyticsSummaryOptions {
  dateFrom?: string; // ISO date string (YYYY-MM-DD)
  dateTo?: string;   // ISO date string (YYYY-MM-DD)
}

export function useOrgAnalyticsSummary(
  organizationId: string | undefined,
  options: UseOrgAnalyticsSummaryOptions = {},
) {
  const { user } = useAuth();

  return useQuery({
    queryKey: [
      "org-analytics-summary",
      organizationId,
      options.dateFrom,
      options.dateTo,
    ],
    queryFn: async (): Promise<OrgAnalyticsSummary | null> => {
      if (!organizationId) return null;

      const { data, error } = await supabase.rpc(
        "get_org_analytics_summary" as never,
        {
          p_org_id: organizationId,
          p_date_from: options.dateFrom ?? null,
          p_date_to: options.dateTo ?? null,
        } as never,
      );

      if (error) {
        console.error("Error fetching org analytics summary:", error);
        throw error;
      }

      return data as unknown as OrgAnalyticsSummary;
    },
    enabled: !!organizationId && !!user,
    staleTime: 60_000, // 1 minute — analytics data doesn't change rapidly
    retry: 1,
  });
}
