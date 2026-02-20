import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface SchemaDimension {
  key: string;
  label: string;
  min: number;
  max: number;
}

export interface PsychometricResultSchema {
  id: string;
  assessment_id: string;
  dimensions: SchemaDimension[];
  version: number;
  created_at: string;
  updated_at: string;
  assessment_name?: string;
}

/**
 * Fetch all schemas (optionally with assessment name).
 */
export function usePsychometricSchemas() {
  return useQuery({
    queryKey: ["psychometric-result-schemas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("psychometric_result_schemas")
        .select(
          `
          *,
          psychometric_assessments:assessment_id(name)
        `,
        )
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data || []).map((row: any) => ({
        ...row,
        dimensions: Array.isArray(row.dimensions) ? row.dimensions : [],
        assessment_name: row.psychometric_assessments?.name ?? null,
      })) as PsychometricResultSchema[];
    },
  });
}

/**
 * Fetch the latest schema for a specific assessment.
 */
export function usePsychometricSchema(assessmentId: string | undefined) {
  return useQuery({
    queryKey: ["psychometric-result-schema", assessmentId],
    queryFn: async () => {
      if (!assessmentId) return null;

      const { data, error } = await supabase
        .from("psychometric_result_schemas")
        .select("*")
        .eq("assessment_id", assessmentId)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return {
        ...data,
        dimensions: Array.isArray(data.dimensions)
          ? data.dimensions
          : [],
      } as PsychometricResultSchema;
    },
    enabled: !!assessmentId,
  });
}

/**
 * Fetch schemas as a map keyed by assessment_id (for batch lookups).
 */
export function usePsychometricSchemaMap() {
  const { data: schemas, ...rest } = usePsychometricSchemas();

  const schemaMap = new Map<string, PsychometricResultSchema>();
  if (schemas) {
    // Keep latest version per assessment
    for (const schema of schemas) {
      const existing = schemaMap.get(schema.assessment_id);
      if (!existing || schema.version > existing.version) {
        schemaMap.set(schema.assessment_id, schema);
      }
    }
  }

  return { schemaMap, ...rest };
}

interface UpsertSchemaParams {
  assessmentId: string;
  dimensions: SchemaDimension[];
}

/**
 * Create or update a schema for an assessment.
 * If a schema exists, increments version. Otherwise creates version 1.
 */
export function useUpsertPsychometricSchema() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ assessmentId, dimensions }: UpsertSchemaParams) => {
      // Check if a schema already exists
      const { data: existing } = await supabase
        .from("psychometric_result_schemas")
        .select("version")
        .eq("assessment_id", assessmentId)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextVersion = existing ? existing.version + 1 : 1;

      const { data, error } = await supabase
        .from("psychometric_result_schemas")
        .insert({
          assessment_id: assessmentId,
          dimensions,
          version: nextVersion,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["psychometric-result-schemas"],
      });
      queryClient.invalidateQueries({
        queryKey: ["psychometric-result-schema"],
      });
      toast.success("Dimension schema saved");
    },
    onError: (error: Error) => {
      toast.error("Failed to save schema", {
        description: error.message,
      });
    },
  });
}
