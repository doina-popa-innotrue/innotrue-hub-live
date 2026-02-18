import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface GoalAssessmentLink {
  id: string;
  goal_id: string;
  capability_assessment_id: string | null;
  capability_domain_id: string | null;
  capability_snapshot_id: string | null;
  assessment_definition_id: string | null;
  psychometric_assessment_id: string | null;
  score_at_creation: number | null;
  target_score: number | null;
  notes: string | null;
  created_at: string;
  // Joined fields
  domain_name?: string | null;
  assessment_name?: string | null;
}

export function useGoalAssessmentLink(goalId: string | undefined) {
  return useQuery({
    queryKey: ["goal-assessment-link", goalId],
    queryFn: async () => {
      if (!goalId) return null;

      const { data, error } = await supabase
        .from("goal_assessment_links" as string)
        .select(
          `
          *,
          capability_domains:capability_domain_id(name),
          capability_assessments:capability_assessment_id(name, rating_scale)
        `,
        )
        .eq("goal_id", goalId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return {
        ...data,
        domain_name: (data as any).capability_domains?.name ?? null,
        assessment_name: (data as any).capability_assessments?.name ?? null,
        rating_scale: (data as any).capability_assessments?.rating_scale ?? 10,
      } as GoalAssessmentLink & { rating_scale: number };
    },
    enabled: !!goalId,
  });
}

export function useGoalAssessmentLinks(goalIds: string[]) {
  return useQuery({
    queryKey: ["goal-assessment-links-batch", goalIds],
    queryFn: async () => {
      if (goalIds.length === 0) return {};

      const { data, error } = await supabase
        .from("goal_assessment_links" as string)
        .select(
          `
          *,
          capability_domains:capability_domain_id(name),
          capability_assessments:capability_assessment_id(name, rating_scale)
        `,
        )
        .in("goal_id", goalIds);

      if (error) throw error;

      const linkMap: Record<string, GoalAssessmentLink & { rating_scale: number }> = {};
      for (const row of data || []) {
        linkMap[row.goal_id] = {
          ...row,
          domain_name: (row as any).capability_domains?.name ?? null,
          assessment_name: (row as any).capability_assessments?.name ?? null,
          rating_scale: (row as any).capability_assessments?.rating_scale ?? 10,
        } as GoalAssessmentLink & { rating_scale: number };
      }
      return linkMap;
    },
    enabled: goalIds.length > 0,
  });
}

interface CreateLinkParams {
  goal_id: string;
  capability_assessment_id?: string | null;
  capability_domain_id?: string | null;
  capability_snapshot_id?: string | null;
  assessment_definition_id?: string | null;
  psychometric_assessment_id?: string | null;
  score_at_creation?: number | null;
  target_score?: number | null;
  notes?: string | null;
}

export function useCreateGoalAssessmentLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateLinkParams) => {
      const { data, error } = await supabase
        .from("goal_assessment_links" as string)
        .insert(params)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["goal-assessment-link", variables.goal_id],
      });
      queryClient.invalidateQueries({
        queryKey: ["goal-assessment-links-batch"],
      });
    },
  });
}

export function useDeleteGoalAssessmentLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, goalId }: { id: string; goalId: string }) => {
      const { error } = await supabase
        .from("goal_assessment_links" as string)
        .delete()
        .eq("id", id);

      if (error) throw error;
      return goalId;
    },
    onSuccess: (goalId) => {
      queryClient.invalidateQueries({
        queryKey: ["goal-assessment-link", goalId],
      });
      queryClient.invalidateQueries({
        queryKey: ["goal-assessment-links-batch"],
      });
    },
  });
}
