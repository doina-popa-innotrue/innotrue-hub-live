import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import type {
  ScenarioTemplate,
  ScenarioSection,
  SectionParagraph,
  ParagraphQuestionLink,
  ScenarioTemplateFormData,
  ScenarioSectionFormData,
  SectionParagraphFormData,
} from "@/types/scenarios";

// ============================================================================
// Template Hooks
// ============================================================================

export function useScenarioTemplates() {
  return useQuery({
    queryKey: ["scenario-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scenario_templates")
        .select(
          `
          *,
           capability_assessments(id, name, slug, rating_scale),
           scenario_categories(id, name, color)
        `,
        )
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as ScenarioTemplate[];
    },
  });
}

export function useScenarioTemplate(id: string | undefined) {
  return useQuery({
    queryKey: ["scenario-template", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("scenario_templates")
        .select(
          `
          *,
           capability_assessments(id, name, slug, rating_scale),
           scenario_categories(id, name, color)
        `,
        )
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as ScenarioTemplate;
    },
    enabled: !!id,
  });
}

export function useScenarioTemplateMutations() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const createMutation = useMutation({
    mutationFn: async (data: ScenarioTemplateFormData) => {
      const { data: result, error } = await supabase
        .from("scenario_templates")
        .insert({
          ...data,
          description: data.description || null,
          capability_assessment_id:
            data.capability_assessment_id && data.capability_assessment_id !== "none"
              ? data.capability_assessment_id
              : null,
          category_id:
            data.category_id && data.category_id !== "none" ? data.category_id : null,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scenario-templates"] });
      toast({ description: "Scenario template created" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ScenarioTemplateFormData> }) => {
      const { error } = await supabase
        .from("scenario_templates")
        .update({
          ...data,
          description: data.description || null,
          capability_assessment_id:
            data.capability_assessment_id && data.capability_assessment_id !== "none"
              ? data.capability_assessment_id
              : null,
          category_id:
            data.category_id && data.category_id !== "none" ? data.category_id : null,
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scenario-templates"] });
      queryClient.invalidateQueries({ queryKey: ["scenario-template"] });
      toast({ description: "Scenario template updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const lockMutation = useMutation({
    mutationFn: async ({ id, lock }: { id: string; lock: boolean }) => {
      const { error } = await supabase
        .from("scenario_templates")
        .update({
          is_locked: lock,
          locked_by: lock ? user?.id : null,
          locked_at: lock ? new Date().toISOString() : null,
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_, { lock }) => {
      queryClient.invalidateQueries({ queryKey: ["scenario-templates"] });
      queryClient.invalidateQueries({ queryKey: ["scenario-template"] });
      toast({ description: lock ? "Template locked" : "Template unlocked" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("scenario_templates").delete().eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scenario-templates"] });
      toast({ description: "Scenario template deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return { createMutation, updateMutation, lockMutation, deleteMutation };
}

// ============================================================================
// Section Hooks
// ============================================================================

export function useScenarioSections(templateId: string | undefined) {
  return useQuery({
    queryKey: ["scenario-sections", templateId],
    queryFn: async () => {
      if (!templateId) return [];
      const { data, error } = await supabase
        .from("scenario_sections")
        .select("*")
        .eq("template_id", templateId)
        .order("order_index");

      if (error) throw error;
      return data as ScenarioSection[];
    },
    enabled: !!templateId,
  });
}

export function useScenarioSectionMutations(templateId: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (data: ScenarioSectionFormData) => {
      const { data: result, error } = await supabase
        .from("scenario_sections")
        .insert({
          template_id: templateId,
          ...data,
          instructions: data.instructions || null,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scenario-sections", templateId] });
      toast({ description: "Section created" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ScenarioSectionFormData> }) => {
      const { error } = await supabase
        .from("scenario_sections")
        .update({
          ...data,
          instructions: data.instructions || null,
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scenario-sections", templateId] });
      toast({ description: "Section updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("scenario_sections").delete().eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scenario-sections", templateId] });
      toast({ description: "Section deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const updates = orderedIds.map((id, index) =>
        supabase.from("scenario_sections").update({ order_index: index }).eq("id", id),
      );
      await Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scenario-sections", templateId] });
    },
  });

  return { createMutation, updateMutation, deleteMutation, reorderMutation };
}

// ============================================================================
// Paragraph Hooks
// ============================================================================

export function useSectionParagraphs(sectionId: string | undefined) {
  return useQuery({
    queryKey: ["section-paragraphs", sectionId],
    queryFn: async () => {
      if (!sectionId) return [];

      // First, fetch paragraphs with only direct question links (no deep nesting)
      // to avoid statement timeouts from 4-level nested RLS evaluation.
      const { data: paragraphs, error: pError } = await supabase
        .from("section_paragraphs")
        .select("*")
        .eq("section_id", sectionId)
        .order("order_index");

      if (pError) throw pError;
      if (!paragraphs || paragraphs.length === 0) return [] as (SectionParagraph & { paragraph_question_links: ParagraphQuestionLink[] })[];

      // Fetch question links for these paragraphs separately
      const paragraphIds = paragraphs.map((p) => p.id);
      const { data: links, error: lError } = await supabase
        .from("paragraph_question_links")
        .select(
          `
          *,
          capability_domain_questions(
            id,
            question_text,
            description,
            domain_id,
            capability_domains(id, name)
          )
        `,
        )
        .in("paragraph_id", paragraphIds);

      if (lError) {
        // Links failed but paragraphs loaded — return paragraphs without links
        console.error("Failed to load paragraph question links:", lError);
        return paragraphs.map((p) => ({
          ...p,
          paragraph_question_links: [] as ParagraphQuestionLink[],
        })) as (SectionParagraph & { paragraph_question_links: ParagraphQuestionLink[] })[];
      }

      // Group links by paragraph_id
      const linksByParagraph = new Map<string, ParagraphQuestionLink[]>();
      for (const link of links || []) {
        const existing = linksByParagraph.get(link.paragraph_id) || [];
        existing.push(link as ParagraphQuestionLink);
        linksByParagraph.set(link.paragraph_id, existing);
      }

      return paragraphs.map((p) => ({
        ...p,
        paragraph_question_links: linksByParagraph.get(p.id) || [],
      })) as (SectionParagraph & { paragraph_question_links: ParagraphQuestionLink[] })[];
    },
    enabled: !!sectionId,
    retry: 1,
  });
}

export function useSectionParagraphMutations(sectionId: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (data: SectionParagraphFormData) => {
      const { data: result, error } = await supabase
        .from("section_paragraphs")
        .insert({
          section_id: sectionId,
          ...data,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["section-paragraphs", sectionId] });
      toast({ description: "Paragraph created" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<SectionParagraphFormData> }) => {
      const { error } = await supabase.from("section_paragraphs").update(data).eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["section-paragraphs", sectionId] });
      toast({ description: "Paragraph updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("section_paragraphs").delete().eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["section-paragraphs", sectionId] });
      toast({ description: "Paragraph deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return { createMutation, updateMutation, deleteMutation };
}

// ============================================================================
// Question Link Hooks
// ============================================================================

export function useQuestionLinkMutations(paragraphId: string, sectionId: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const addLinkMutation = useMutation({
    mutationFn: async ({ questionId, weight = 1.0 }: { questionId: string; weight?: number }) => {
      const { error } = await supabase.from("paragraph_question_links").insert({
        paragraph_id: paragraphId,
        question_id: questionId,
        weight,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["section-paragraphs", sectionId] });
      toast({ description: "Question linked" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const removeLinkMutation = useMutation({
    mutationFn: async (linkId: string) => {
      const { error } = await supabase.from("paragraph_question_links").delete().eq("id", linkId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["section-paragraphs", sectionId] });
      toast({ description: "Question unlinked" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateLinkMutation = useMutation({
    mutationFn: async ({ linkId, rubric_text }: { linkId: string; rubric_text: string | null }) => {
      const { error } = await supabase
        .from("paragraph_question_links")
        .update({ rubric_text })
        .eq("id", linkId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["section-paragraphs", sectionId] });
      toast({ description: "Rubric saved" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return { addLinkMutation, removeLinkMutation, updateLinkMutation };
}
