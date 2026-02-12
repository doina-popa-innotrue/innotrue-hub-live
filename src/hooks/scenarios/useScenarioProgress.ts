import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useScenarioSections } from "./useScenarioTemplates";
import { useParagraphResponses } from "./useScenarioResponses";

// ============================================================================
// Progress Tracking Hook
// ============================================================================

export function useScenarioProgress(
  templateId: string | undefined,
  assignmentId: string | undefined,
) {
  const { data: sections } = useScenarioSections(templateId);
  const { data: responses } = useParagraphResponses(assignmentId);

  return useQuery({
    queryKey: ["scenario-progress", templateId, assignmentId],
    queryFn: async () => {
      if (!templateId || !sections) return { total: 0, answered: 0, percentage: 0 };

      // Fetch all paragraphs that require responses across all sections
      const sectionIds = sections.map((s) => s.id);
      if (sectionIds.length === 0) return { total: 0, answered: 0, percentage: 0 };

      const { data: paragraphs, error } = await supabase
        .from("section_paragraphs")
        .select("id")
        .in("section_id", sectionIds)
        .eq("requires_response", true);

      if (error) throw error;

      const total = paragraphs?.length || 0;
      const answeredParagraphIds = new Set(
        responses
          ?.filter((r) => r.response_text && r.response_text.trim().length > 0)
          .map((r) => r.paragraph_id) || [],
      );
      const answered = paragraphs?.filter((p) => answeredParagraphIds.has(p.id)).length || 0;
      const percentage = total > 0 ? (answered / total) * 100 : 0;

      return { total, answered, percentage };
    },
    enabled: !!templateId && !!sections,
  });
}
