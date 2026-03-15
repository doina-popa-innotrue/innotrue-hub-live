import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Printer, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { RichTextDisplay } from "@/components/ui/rich-text-display";
import { ProtectedContent } from "@/components/ui/protected-content";
import { PrintWatermark } from "@/components/ui/print-watermark";
import {
  useScenarioAssignment,
  useScenarioSections,
  useSectionParagraphs,
  useParagraphResponses,
  useParagraphEvaluations,
  useParagraphQuestionScores,
  useScenarioScoreSummary,
} from "@/hooks/useScenarios";
import type { ScenarioSection } from "@/types/scenarios";

// ============================================================================
// Print-friendly scenario page — no sidebar, clean layout, Cmd+P ready
// ============================================================================

export default function ScenarioPrintPage() {
  const { id } = useParams<{ id: string }>();

  const { data: assignment, isLoading: assignmentLoading } = useScenarioAssignment(id);
  const { data: sections, isLoading: sectionsLoading } = useScenarioSections(
    assignment?.template_id,
  );
  const { data: responses } = useParagraphResponses(id);
  const { data: evaluations } = useParagraphEvaluations(id);
  const { data: scores } = useParagraphQuestionScores(id);

  const ratingScale =
    assignment?.scenario_templates?.capability_assessments?.rating_scale || 5;
  const scoreSummary = useScenarioScoreSummary(id, ratingScale);

  // Fetch client profile separately (PostgREST FK hint rule — user_id FKs to auth.users)
  const { data: clientProfile } = useQuery({
    queryKey: ["profile-for-print", assignment?.user_id],
    queryFn: async () => {
      if (!assignment?.user_id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, email")
        .eq("id", assignment.user_id)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!assignment?.user_id,
  });

  // Fetch evaluator profile if evaluated
  const { data: evaluatorProfile } = useQuery({
    queryKey: ["evaluator-profile-for-print", assignment?.evaluated_by],
    queryFn: async () => {
      if (!assignment?.evaluated_by) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name")
        .eq("id", assignment.evaluated_by)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!assignment?.evaluated_by,
  });

  if (assignmentLoading || sectionsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Scenario assignment not found.</p>
      </div>
    );
  }

  const template = assignment.scenario_templates;
  const statusLabels: Record<string, string> = {
    draft: "Draft",
    submitted: "Submitted",
    in_review: "In Review",
    evaluated: "Evaluated",
  };

  return (
    <ProtectedContent className="max-w-4xl mx-auto px-6 py-8 bg-background min-h-screen">
      <PrintWatermark />
      {/* Print button — hidden when printing */}
      <div className="print:hidden mb-6 flex items-center justify-between">
        <Button variant="outline" onClick={() => window.history.back()}>
          Back
        </Button>
        <Button onClick={() => window.print()} className="gap-2">
          <Printer className="h-4 w-4" />
          Print / Save as PDF
        </Button>
      </div>

      {/* Document Header */}
      <header className="mb-8 border-b pb-6">
        <h1 className="text-2xl font-bold mb-2">{template?.title || "Untitled Scenario"}</h1>
        {template?.description && (
          <p className="text-muted-foreground mb-4">{template.description}</p>
        )}
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
          <div>
            <span className="text-muted-foreground">Client:</span>{" "}
            <span className="font-medium">{clientProfile?.name || "—"}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Status:</span>{" "}
            <Badge variant={assignment.status === "evaluated" ? "default" : "outline"}>
              {statusLabels[assignment.status] || assignment.status}
            </Badge>
          </div>
          {assignment.submitted_at && (
            <div>
              <span className="text-muted-foreground">Submitted:</span>{" "}
              {format(new Date(assignment.submitted_at), "PPP")}
            </div>
          )}
          {assignment.evaluated_at && (
            <div>
              <span className="text-muted-foreground">Evaluated:</span>{" "}
              {format(new Date(assignment.evaluated_at), "PPP")}
            </div>
          )}
          {(assignment.attempt_number ?? 1) > 1 && (
            <div>
              <span className="text-muted-foreground">Attempt:</span>{" "}
              #{assignment.attempt_number}
            </div>
          )}
          {evaluatorProfile && (
            <div>
              <span className="text-muted-foreground">Evaluator:</span>{" "}
              {evaluatorProfile.name}
            </div>
          )}
          {assignment.program_modules?.title && (
            <div>
              <span className="text-muted-foreground">Module:</span>{" "}
              {assignment.program_modules.title}
            </div>
          )}
          {assignment.client_enrollments?.programs?.name && (
            <div>
              <span className="text-muted-foreground">Program:</span>{" "}
              {assignment.client_enrollments.programs.name}
            </div>
          )}
        </div>
      </header>

      {/* Score Summary (if evaluated) */}
      {scoreSummary && (
        <section className="mb-8 border rounded-lg p-4 break-inside-avoid">
          <h2 className="text-lg font-semibold mb-3">Score Summary</h2>
          <div className="flex items-center gap-4 mb-4">
            <div className="text-3xl font-bold">
              {Math.round(scoreSummary.overall_percentage)}%
            </div>
            <div className="flex-1">
              <Progress value={scoreSummary.overall_percentage} className="h-3" />
            </div>
          </div>
          {scoreSummary.domain_scores.length > 0 && (
            <div className="grid gap-2">
              {scoreSummary.domain_scores.map((domain) => (
                <div key={domain.domain_id} className="flex items-center gap-3 text-sm">
                  <span className="w-40 truncate font-medium">{domain.domain_name}</span>
                  <Progress value={domain.percentage} className="flex-1 h-2" />
                  <span className="w-16 text-right text-muted-foreground">
                    {Math.round(domain.percentage)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Overall Evaluator Notes */}
      {assignment.overall_notes && (
        <section className="mb-8 border rounded-lg p-4 break-inside-avoid">
          <h2 className="text-lg font-semibold mb-2">Evaluator Notes</h2>
          <div className="border-l-4 border-blue-400 pl-4">
            <RichTextDisplay content={assignment.overall_notes} className="text-sm" />
          </div>
        </section>
      )}

      {/* Revision Notes (if attempt > 1) */}
      {assignment.revision_notes && (
        <section className="mb-8 border rounded-lg border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/30 p-4 break-inside-avoid">
          <h2 className="text-lg font-semibold mb-2">Revision Notes</h2>
          <p className="text-sm">{assignment.revision_notes}</p>
        </section>
      )}

      {/* Sections + Paragraphs */}
      {sections?.map((section, sectionIndex) => (
        <PrintSection
          key={section.id}
          section={section}
          sectionIndex={sectionIndex}
          assignmentId={id!}
          responses={responses || []}
          evaluations={evaluations || []}
          scores={scores || []}
          ratingScale={ratingScale}
        />
      ))}

      {/* Footer */}
      <footer className="mt-12 pt-4 border-t text-xs text-muted-foreground text-center">
        Printed from InnoTrue Hub &mdash;{" "}
        {format(new Date(), "PPP 'at' HH:mm")}
      </footer>
    </ProtectedContent>
  );
}

// ============================================================================
// PrintSection — renders paragraphs for a single section
// ============================================================================

function PrintSection({
  section,
  sectionIndex,
  assignmentId,
  responses,
  evaluations,
  scores,
  ratingScale,
}: {
  section: ScenarioSection;
  sectionIndex: number;
  assignmentId: string;
  responses: { paragraph_id: string; response_text: string | null }[];
  evaluations: { paragraph_id: string; feedback: string | null }[];
  scores: {
    paragraph_id: string;
    question_id: string;
    score: number;
    capability_domain_questions?: {
      id: string;
      question_text: string;
      domain_id: string;
      capability_domains?: { id: string; name: string };
    };
  }[];
  ratingScale: number;
}) {
  const { data: paragraphs, isLoading } = useSectionParagraphs(section.id);

  if (isLoading) {
    return (
      <div className="mb-6 text-sm text-muted-foreground">
        Loading section...
      </div>
    );
  }

  if (!paragraphs || paragraphs.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="text-xl font-semibold mb-1">
        Section {sectionIndex + 1}: {section.title}
      </h2>
      {section.instructions && (
        <p className="text-sm text-muted-foreground mb-4 italic">
          {section.instructions}
        </p>
      )}

      <div className="space-y-6">
        {paragraphs.map((paragraph, pIndex) => {
          const response = responses.find(
            (r) => r.paragraph_id === paragraph.id,
          );
          const evaluation = evaluations.find(
            (e) => e.paragraph_id === paragraph.id,
          );
          const paragraphScores = scores.filter(
            (s) => s.paragraph_id === paragraph.id,
          );

          return (
            <div
              key={paragraph.id}
              className="border rounded-lg p-4 break-inside-avoid-page"
            >
              {/* Paragraph content */}
              <div className="mb-3">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="text-xs">
                    ¶{pIndex + 1}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Scenario Content
                  </span>
                </div>
                <div className="text-sm bg-muted/50 p-3 rounded">
                  <RichTextDisplay content={paragraph.content} />
                </div>
              </div>

              {/* Client Response */}
              {paragraph.requires_response && (
                <div className="mb-3">
                  <div className="text-xs font-medium text-muted-foreground mb-1">
                    Client Response:
                  </div>
                  {response?.response_text ? (
                    <div className="border-l-4 border-primary pl-4 py-2">
                      <RichTextDisplay
                        content={response.response_text}
                        className="text-sm"
                      />
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      No response provided
                    </p>
                  )}
                </div>
              )}

              {/* Domain Scores (if evaluated) */}
              {paragraphScores.length > 0 && (
                <div className="mb-3">
                  <div className="text-xs font-medium text-muted-foreground mb-1">
                    Domain Scores:
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {paragraphScores.map((s) => (
                      <Badge
                        key={s.question_id}
                        variant="secondary"
                        className="text-xs"
                      >
                        {s.capability_domain_questions?.capability_domains
                          ?.name || "Domain"}
                        : {s.score}/{ratingScale}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Evaluator Feedback */}
              {evaluation?.feedback && (
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-1">
                    Evaluator Feedback:
                  </div>
                  <div className="border-l-4 border-blue-400 pl-4 py-1">
                    <RichTextDisplay
                      content={evaluation.feedback}
                      className="text-sm"
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
