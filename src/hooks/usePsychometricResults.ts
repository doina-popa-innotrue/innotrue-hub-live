import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { SchemaDimension } from "@/hooks/usePsychometricSchemas";

export interface PsychometricResult {
  id: string;
  user_id: string;
  assessment_id: string;
  schema_id: string;
  user_assessment_id: string | null;
  scores: Record<string, number>;
  entered_by: string;
  source_description: string | null;
  notes: string | null;
  assessed_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  assessment_name?: string;
  dimensions?: SchemaDimension[];
  entered_by_name?: string | null;
}

/**
 * Fetch all psychometric results for a user, ordered by most recent.
 */
export function usePsychometricResults(userId: string | undefined) {
  return useQuery({
    queryKey: ["psychometric-results", userId],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from("psychometric_results" as string)
        .select(
          `
          *,
          psychometric_assessments:assessment_id(name),
          psychometric_result_schemas:schema_id(dimensions),
          entered_by_profile:entered_by(full_name)
        `,
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data || []).map((row: any) => ({
        ...row,
        scores: row.scores && typeof row.scores === "object" ? row.scores : {},
        assessment_name: row.psychometric_assessments?.name ?? null,
        dimensions: Array.isArray(row.psychometric_result_schemas?.dimensions)
          ? row.psychometric_result_schemas.dimensions
          : [],
        entered_by_name: row.entered_by_profile?.full_name ?? null,
      })) as PsychometricResult[];
    },
    enabled: !!userId,
  });
}

/**
 * Fetch the latest psychometric result per assessment for a user.
 * Used for Development Profile display.
 */
export function useLatestPsychometricResults(userId: string | undefined) {
  const { data: allResults, ...rest } = usePsychometricResults(userId);

  // Keep only the latest result per assessment_id
  const latestMap = new Map<string, PsychometricResult>();
  if (allResults) {
    for (const result of allResults) {
      if (!latestMap.has(result.assessment_id)) {
        latestMap.set(result.assessment_id, result);
      }
    }
  }

  // Also build a "previous" map for trend comparison
  const previousMap = new Map<string, PsychometricResult>();
  if (allResults) {
    const seen = new Set<string>();
    for (const result of allResults) {
      if (seen.has(result.assessment_id)) {
        if (!previousMap.has(result.assessment_id)) {
          previousMap.set(result.assessment_id, result);
        }
      } else {
        seen.add(result.assessment_id);
      }
    }
  }

  return {
    latestResults: Array.from(latestMap.values()),
    previousResults: previousMap,
    ...rest,
  };
}

interface CreatePsychometricResultParams {
  user_id: string;
  assessment_id: string;
  schema_id: string;
  user_assessment_id?: string | null;
  scores: Record<string, number>;
  entered_by: string;
  source_description?: string | null;
  notes?: string | null;
  assessed_at?: string | null;
}

export function useCreatePsychometricResult() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreatePsychometricResultParams) => {
      const { data, error } = await supabase
        .from("psychometric_results" as string)
        .insert({
          user_id: params.user_id,
          assessment_id: params.assessment_id,
          schema_id: params.schema_id,
          user_assessment_id: params.user_assessment_id || null,
          scores: params.scores,
          entered_by: params.entered_by,
          source_description: params.source_description || null,
          notes: params.notes || null,
          assessed_at: params.assessed_at || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["psychometric-results", variables.user_id],
      });
      toast.success("Psychometric scores saved");
    },
    onError: (error: Error) => {
      toast.error("Failed to save scores", {
        description: error.message,
      });
    },
  });
}

interface UpdatePsychometricResultParams {
  id: string;
  userId: string;
  scores?: Record<string, number>;
  source_description?: string | null;
  notes?: string | null;
  assessed_at?: string | null;
}

export function useUpdatePsychometricResult() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, scores, source_description, notes, assessed_at }: UpdatePsychometricResultParams) => {
      const updateData: Record<string, unknown> = {};
      if (scores !== undefined) updateData.scores = scores;
      if (source_description !== undefined) updateData.source_description = source_description;
      if (notes !== undefined) updateData.notes = notes;
      if (assessed_at !== undefined) updateData.assessed_at = assessed_at;

      const { data, error } = await supabase
        .from("psychometric_results" as string)
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["psychometric-results", variables.userId],
      });
      toast.success("Psychometric scores updated");
    },
    onError: (error: Error) => {
      toast.error("Failed to update scores", {
        description: error.message,
      });
    },
  });
}
