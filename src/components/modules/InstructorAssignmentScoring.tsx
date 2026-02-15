import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  ClipboardCheck,
  Save,
  CheckCircle,
  FileText,
  Plus,
  BookOpen,
  ExternalLink,
  Trash2,
  Lightbulb,
  StickyNote,
  Target,
  Link as LinkIcon,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { DevelopmentItemDialog } from "@/components/capabilities/DevelopmentItemDialog";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { RichTextDisplay } from "@/components/ui/rich-text-display";

interface Domain {
  id: string;
  name: string;
  description: string | null;
  order_index: number;
  questions: Question[];
}

interface Question {
  id: string;
  question_text: string;
  description: string | null;
  order_index: number;
}

interface InstructorAssignmentScoringProps {
  assignmentId: string;
  assignmentTypeId: string;
  moduleProgressId: string;
  linkedCapabilityAssessmentId?: string | null; // From module_assignment_configs - takes priority
  onComplete?: () => void;
}

export function InstructorAssignmentScoring({
  assignmentId,
  assignmentTypeId,
  moduleProgressId,
  linkedCapabilityAssessmentId,
  onComplete,
}: InstructorAssignmentScoringProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [domainNotes, setDomainNotes] = useState<Record<string, string>>({});
  const [instructorNotes, setInstructorNotes] = useState("");
  const [resourceDialogOpen, setResourceDialogOpen] = useState(false);
  const [devItemContext, setDevItemContext] = useState<{
    questionId?: string;
    domainId?: string;
  }>({});

  // Get the assignment type to find scoring assessment (fallback if no linked assessment)
  const { data: assignmentType } = useQuery({
    queryKey: ["assignment-type-scoring", assignmentTypeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("module_assignment_types")
        .select("scoring_assessment_id, name")
        .eq("id", assignmentTypeId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !linkedCapabilityAssessmentId, // Only fetch if no linked assessment provided
  });

  // Determine which assessment ID to use - linked takes priority
  const effectiveAssessmentId =
    linkedCapabilityAssessmentId || assignmentType?.scoring_assessment_id;

  // Get the scoring/evaluation assessment details
  const { data: assessment } = useQuery({
    queryKey: ["scoring-assessment", effectiveAssessmentId],
    queryFn: async () => {
      if (!effectiveAssessmentId) return null;
      const { data, error } = await supabase
        .from("capability_assessments")
        .select("id, name, description, rating_scale")
        .eq("id", effectiveAssessmentId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!effectiveAssessmentId,
  });

  // Get the domains and questions for scoring
  const { data: domains } = useQuery({
    queryKey: ["scoring-domains", assessment?.id],
    queryFn: async () => {
      if (!assessment?.id) return [];
      const { data: domainsData, error: domainsError } = await supabase
        .from("capability_domains")
        .select("id, name, description, order_index")
        .eq("assessment_id", assessment.id)
        .order("order_index");
      if (domainsError) throw domainsError;

      // Fetch questions for each domain
      const domainsWithQuestions = await Promise.all(
        domainsData.map(async (domain) => {
          const { data: questions } = await supabase
            .from("capability_domain_questions")
            .select("id, question_text, description, order_index")
            .eq("domain_id", domain.id)
            .order("order_index");
          return { ...domain, questions: questions || [] } as Domain;
        }),
      );
      return domainsWithQuestions;
    },
    enabled: !!assessment?.id,
  });

  // Get existing scoring snapshot for this assignment
  const { data: existingSnapshot } = useQuery({
    queryKey: ["assignment-scoring-snapshot", assignmentId],
    queryFn: async () => {
      const { data: assignment, error: assignmentError } = await supabase
        .from("module_assignments")
        .select("scoring_snapshot_id, instructor_notes, status")
        .eq("id", assignmentId)
        .single();
      if (assignmentError) throw assignmentError;

      if (!assignment.scoring_snapshot_id) {
        return {
          assignmentStatus: assignment.status,
          snapshot: null as { id: string; status: string } | null,
          ratings: [] as { question_id: string; rating: number }[],
          notes: [] as { question_id: string; content: string }[],
          instructorNotes: assignment.instructor_notes || "",
        };
      }

      const { data: snapshot, error: snapshotError } = await supabase
        .from("capability_snapshots")
        .select("id, status")
        .eq("id", assignment.scoring_snapshot_id)
        .single();
      if (snapshotError) throw snapshotError;

      // Get ratings
      const { data: ratingsData } = await supabase
        .from("capability_snapshot_ratings")
        .select("question_id, rating")
        .eq("snapshot_id", snapshot.id);

      // Get question notes
      const { data: notesData } = await supabase
        .from("capability_question_notes")
        .select("question_id, content")
        .eq("snapshot_id", snapshot.id);

      // Get domain notes
      const { data: domainNotesData } = await supabase
        .from("capability_domain_notes")
        .select("domain_id, content")
        .eq("snapshot_id", snapshot.id);

      return {
        assignmentStatus: assignment.status,
        snapshot,
        ratings: ratingsData || [],
        notes: notesData || [],
        domainNotes: domainNotesData || [],
        instructorNotes: assignment.instructor_notes || "",
      };
    },
  });

  // Load existing data
  useEffect(() => {
    if (existingSnapshot) {
      const ratingsMap: Record<string, number> = {};
      existingSnapshot.ratings.forEach((r) => {
        ratingsMap[r.question_id] = r.rating;
      });
      setRatings(ratingsMap);

      const notesMap: Record<string, string> = {};
      existingSnapshot.notes.forEach((n) => {
        notesMap[n.question_id] = n.content;
      });
      setNotes(notesMap);

      const domainNotesMap: Record<string, string> = {};
      existingSnapshot.domainNotes?.forEach((n: { domain_id: string; content: string }) => {
        domainNotesMap[n.domain_id] = n.content;
      });
      setDomainNotes(domainNotesMap);

      setInstructorNotes(existingSnapshot.instructorNotes);
    }
  }, [existingSnapshot]);

  // Get client user_id from module progress
  const { data: progressData } = useQuery({
    queryKey: ["module-progress-user", moduleProgressId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("module_progress")
        .select("module_id, client_enrollments(client_user_id, id)")
        .eq("id", moduleProgressId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const clientUserId = (progressData?.client_enrollments as any)?.client_user_id;
  const snapshotId = existingSnapshot?.snapshot?.id;

  const navigate = useNavigate();

  // Fetch development items (resources/notes) added by instructor for this snapshot (overall level)
  const { data: instructorResources } = useQuery({
    queryKey: ["instructor-resources", snapshotId],
    queryFn: async () => {
      if (!snapshotId) return [];

      // Get items linked to this snapshot
      const { data: links, error: linksError } = await supabase
        .from("development_item_snapshot_links")
        .select("development_item_id")
        .eq("snapshot_id", snapshotId);

      if (linksError) throw linksError;
      if (!links || links.length === 0) return [];

      const itemIds = links.map((l) => l.development_item_id);
      const { data: items, error: itemsError } = await supabase
        .from("development_items")
        .select(
          `
          id, 
          item_type, 
          title, 
          content, 
          resource_url, 
          author_id,
          resource_type,
          library_resource_id,
          library_resources (
            id,
            title,
            url,
            resource_type,
            file_path
          )
        `,
        )
        .in("id", itemIds)
        .in("item_type", ["resource", "note", "action_item", "reflection"]);

      if (itemsError) throw itemsError;
      return items || [];
    },
    enabled: !!snapshotId,
  });

  // Fetch development items linked to specific questions in this snapshot
  const { data: questionDevItems } = useQuery({
    queryKey: ["instructor-question-dev-items", snapshotId],
    queryFn: async () => {
      if (!snapshotId) return {};

      const { data: links, error: linksError } = await supabase
        .from("development_item_question_links")
        .select("question_id, development_item_id")
        .eq("snapshot_id", snapshotId);

      if (linksError) throw linksError;
      if (!links || links.length === 0) return {};

      const itemIds = [...new Set(links.map((l) => l.development_item_id))];
      const { data: items, error: itemsError } = await supabase
        .from("development_items")
        .select("id, item_type, title, content, resource_url, library_resource_id, file_path")
        .in("id", itemIds);

      if (itemsError) throw itemsError;

      // For items with library_resource_id, fetch the resource details
      const libraryResourceIds =
        items?.filter((i) => i.library_resource_id).map((i) => i.library_resource_id!) || [];
      let libraryResources: Record<string, { title: string; resource_url: string | null }> = {};

      if (libraryResourceIds.length > 0) {
        const { data: libRes } = await supabase
          .from("resource_library")
          .select("id, title, url")
          .in("id", libraryResourceIds);

        libraryResources = (libRes || []).reduce(
          (acc, r) => {
            acc[r.id] = { title: r.title, resource_url: r.url };
            return acc;
          },
          {} as Record<string, { title: string; resource_url: string | null }>,
        );
      }

      // Enhance items with library resource info
      const enhancedItems = items?.map((item) => {
        if (item.library_resource_id && libraryResources[item.library_resource_id]) {
          const libRes = libraryResources[item.library_resource_id];
          return {
            ...item,
            title: item.title || libRes.title,
            resource_url: item.resource_url || libRes.resource_url,
          };
        }
        return item;
      });

      // Group by question_id
      const grouped: Record<string, typeof enhancedItems> = {};
      for (const link of links) {
        const item = enhancedItems?.find((i) => i.id === link.development_item_id);
        if (item) {
          if (!grouped[link.question_id]) grouped[link.question_id] = [];
          grouped[link.question_id].push(item);
        }
      }
      return grouped;
    },
    enabled: !!snapshotId,
  });

  const deleteResourceMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.from("development_items").delete().eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["instructor-resources", snapshotId] });
      queryClient.invalidateQueries({ queryKey: ["instructor-question-dev-items", snapshotId] });
      toast({ description: "Resource removed" });
    },
    onError: (error) => {
      toast({
        title: "Error removing resource",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async ({ status }: { status: "draft" | "completed" }) => {
      if (!assessment || !user || !progressData) throw new Error("Missing data");

      // Guard: only allow grading if assignment is in "submitted" status
      // (prevents grading draft assignments or re-grading already reviewed ones)
      const currentStatus = existingSnapshot?.assignmentStatus;
      if (status === "completed" && currentStatus !== "submitted") {
        throw new Error(
          currentStatus === "reviewed"
            ? "This assignment has already been reviewed"
            : "This assignment has not been submitted yet",
        );
      }

      const clientUserId = (progressData.client_enrollments as any)?.client_user_id;
      const enrollmentId = (progressData.client_enrollments as any)?.id;
      if (!clientUserId) throw new Error("Could not find client user");

      let snapshotId = existingSnapshot?.snapshot?.id;

      // Create or update snapshot
      if (!snapshotId) {
        const { data: newSnapshot, error } = await supabase
          .from("capability_snapshots")
          .insert({
            assessment_id: assessment.id,
            user_id: clientUserId,
            enrollment_id: enrollmentId,
            evaluator_id: user.id,
            is_self_assessment: false,
            status,
            completed_at: status === "completed" ? new Date().toISOString() : null,
          })
          .select("id")
          .single();
        if (error) throw error;
        snapshotId = newSnapshot.id;
      } else {
        const { error } = await supabase
          .from("capability_snapshots")
          .update({
            status,
            completed_at: status === "completed" ? new Date().toISOString() : null,
          })
          .eq("id", snapshotId);
        if (error) throw error;
      }

      // Upsert ratings/notes (avoid duplicate key errors on repeat saves)
      const ratingsToUpsert = Object.entries(ratings).map(([questionId, rating]) => ({
        snapshot_id: snapshotId!,
        question_id: questionId,
        rating,
      }));

      if (ratingsToUpsert.length > 0) {
        const { error } = await supabase
          .from("capability_snapshot_ratings")
          .upsert(ratingsToUpsert, { onConflict: "snapshot_id,question_id" });
        if (error) throw error;
      }

      const notesToUpsert = Object.entries(notes)
        .filter(([, content]) => content && content.trim())
        .map(([questionId, content]) => ({
          snapshot_id: snapshotId!,
          question_id: questionId,
          content: content.trim(),
        }));

      // Persist question notes (use upsert, and clear content when blank)
      if (notesToUpsert.length > 0) {
        const { error } = await supabase
          .from("capability_question_notes")
          .upsert(notesToUpsert, { onConflict: "snapshot_id,question_id" });
        if (error) throw error;
      }

      // Persist domain notes
      const domainNotesToUpsert = Object.entries(domainNotes)
        .filter(([, content]) => content && content.trim())
        .map(([domainId, content]) => ({
          snapshot_id: snapshotId!,
          domain_id: domainId,
          content: content.trim(),
        }));

      if (domainNotesToUpsert.length > 0) {
        const { error } = await supabase
          .from("capability_domain_notes")
          .upsert(domainNotesToUpsert, { onConflict: "snapshot_id,domain_id" });
        if (error) throw error;
      }

      // Update assignment with scoring snapshot and notes
      const { error: updateError } = await supabase
        .from("module_assignments")
        .update({
          scoring_snapshot_id: snapshotId,
          scored_by: user.id,
          scored_at: new Date().toISOString(),
          instructor_notes: instructorNotes || null,
          status: status === "completed" ? "reviewed" : "submitted",
        })
        .eq("id", assignmentId);
      if (updateError) throw updateError;
    },
    onSuccess: async (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ["assignment-scoring-snapshot", assignmentId] });
      queryClient.invalidateQueries({ queryKey: ["module-assignment"] });
      toast({
        title: status === "completed" ? "Scoring completed" : "Scoring saved as draft",
      });

      // Send notification to client when scoring is completed
      if (status === "completed") {
        try {
          await supabase.functions.invoke("notify-assignment-graded", {
            body: {
              assignmentId,
              moduleProgressId,
              assignmentTypeName: assignmentType?.name || "Assignment",
            },
          });
        } catch (notifyError) {
          console.error("Failed to send grading notification:", notifyError);
        }

        if (onComplete) {
          onComplete();
        }
      }
    },
    onError: (error) => {
      toast({
        title: "Error saving scoring",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // No assessment to score against
  if (!effectiveAssessmentId) {
    return null;
  }

  if (!assessment || !domains) {
    return <div className="text-sm text-muted-foreground">Loading scoring template...</div>;
  }

  const ratingScale = assessment.rating_scale || 5;
  // "Completed" scoring means the instructor has finalized the review.
  // Assignment status is "reviewed" when scoring is complete, "submitted" while pending/draft.
  const assignmentStatus = existingSnapshot?.assignmentStatus;
  const snapshotStatus = existingSnapshot?.snapshot?.status;
  // Check both assignment status (reviewed) and snapshot status (completed) to determine if scoring is finalized
  const isCompleted = assignmentStatus === "reviewed" || snapshotStatus === "completed";
  // Allow adding resources unless the scoring is finalized
  const canAddResources = !isCompleted && clientUserId;

  return (
    <Card className="border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-amber-600" />
            <CardTitle className="text-lg">Instructor Scoring</CardTitle>
          </div>
          {isCompleted && (
            <Badge variant="default" className="flex items-center gap-1">
              <CheckCircle className="h-3 w-3" />
              Scored
            </Badge>
          )}
        </div>
        <CardDescription>
          Use the "{assessment.name}" template to evaluate this submission
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {domains.map((domain) => (
          <div key={domain.id} className="space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <h4 className="font-semibold text-base">{domain.name}</h4>
                {domain.description && (
                  <p className="text-sm text-muted-foreground">{domain.description}</p>
                )}
              </div>
              {canAddResources && snapshotId && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => {
                    setDevItemContext({ domainId: domain.id });
                    setResourceDialogOpen(true);
                  }}
                  title="Add development item for this domain"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              )}
            </div>

            {domain.questions.map((question) => (
              <div key={question.id} className="pl-4 border-l-2 border-muted space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <Label className="text-sm font-medium">{question.question_text}</Label>
                    {question.description && (
                      <p className="text-xs text-muted-foreground">{question.description}</p>
                    )}
                  </div>
                  {canAddResources && snapshotId && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => {
                        setDevItemContext({ questionId: question.id, domainId: domain.id });
                        setResourceDialogOpen(true);
                      }}
                      title="Add development item for this question"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="space-y-2 pt-1">
                  <Slider
                    value={[ratings[question.id] || 1]}
                    min={1}
                    max={ratingScale}
                    step={1}
                    onValueChange={([v]) => setRatings({ ...ratings, [question.id]: v })}
                    disabled={isCompleted}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>1</span>
                    <span className="font-medium text-foreground">
                      {ratings[question.id] || "-"} / {ratingScale}
                    </span>
                    <span>{ratingScale}</span>
                  </div>
                </div>

                {isCompleted ? (
                  notes[question.id] && (
                    <div className="text-sm">
                      <RichTextDisplay content={notes[question.id]} />
                    </div>
                  )
                ) : (
                  <RichTextEditor
                    placeholder="Add notes for this criterion..."
                    value={notes[question.id] || ""}
                    onChange={(value) => setNotes({ ...notes, [question.id]: value })}
                    disabled={isCompleted}
                    className="text-sm min-h-[80px]"
                  />
                )}

                {/* Show development items linked to this question */}
                {questionDevItems?.[question.id] && questionDevItems[question.id].length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <Lightbulb className="h-3 w-3" />
                      Resources & Items ({questionDevItems[question.id].length})
                    </p>
                    {questionDevItems[question.id].map((item) => {
                      const TypeIcon =
                        item.item_type === "reflection"
                          ? StickyNote
                          : item.item_type === "action_item"
                            ? Target
                            : item.item_type === "resource"
                              ? LinkIcon
                              : FileText;
                      const hasDirectUrl = !!item.resource_url;
                      const hasLibraryResource = !!item.library_resource_id;
                      const isClickable = hasDirectUrl || hasLibraryResource;

                      const handleItemClick = () => {
                        if (hasDirectUrl) {
                          window.open(item.resource_url!, "_blank");
                        } else if (hasLibraryResource) {
                          navigate(`/resources/${item.library_resource_id}`);
                        }
                      };

                      return (
                        <div
                          key={item.id}
                          className={`flex items-start gap-2 pl-4 py-1.5 rounded-md bg-muted/30 text-sm ${isClickable ? "cursor-pointer hover:bg-muted/50" : ""}`}
                          onClick={isClickable ? handleItemClick : undefined}
                        >
                          <TypeIcon className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <span
                              className={`font-medium ${isClickable ? "text-primary hover:underline" : ""}`}
                            >
                              {item.title}
                            </span>
                            {item.content && (
                              <p className="text-xs text-muted-foreground line-clamp-1">
                                {item.content}
                              </p>
                            )}
                            {isClickable && (
                              <span className="text-xs text-primary flex items-center gap-1 mt-0.5">
                                <ExternalLink className="h-3 w-3" />
                                {hasLibraryResource && !hasDirectUrl
                                  ? "View resource"
                                  : "Open resource"}
                              </span>
                            )}
                          </div>
                          {canAddResources && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 shrink-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteResourceMutation.mutate(item.id);
                              }}
                              title="Remove this item"
                            >
                              <Trash2 className="h-3 w-3 text-muted-foreground" />
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}

            {/* Domain-level notes */}
            <div className="pl-4 space-y-2">
              <Label className="text-sm font-medium text-muted-foreground">Domain Notes</Label>
              {isCompleted ? (
                domainNotes[domain.id] && (
                  <div className="text-sm">
                    <RichTextDisplay content={domainNotes[domain.id]} />
                  </div>
                )
              ) : (
                <RichTextEditor
                  placeholder={`Overall notes for ${domain.name}...`}
                  value={domainNotes[domain.id] || ""}
                  onChange={(value) => setDomainNotes({ ...domainNotes, [domain.id]: value })}
                  disabled={isCompleted}
                  className="text-sm min-h-[80px]"
                />
              )}
            </div>
            <Separator />
          </div>
        ))}

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <Label className="font-medium">Overall Instructor Notes</Label>
          </div>
          {isCompleted ? (
            instructorNotes && (
              <div className="text-sm">
                <RichTextDisplay content={instructorNotes} />
              </div>
            )
          ) : (
            <RichTextEditor
              placeholder="General feedback and comments for the client..."
              value={instructorNotes}
              onChange={setInstructorNotes}
              disabled={isCompleted}
              className="min-h-[120px]"
            />
          )}
        </div>

        {/* Resources Section - for adding resources/notes for the client */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              <Label className="font-medium">Resources for Client</Label>
            </div>
            {canAddResources && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (!snapshotId) {
                    // Need to save first to create snapshot
                    toast({
                      title: "Save Required",
                      description: "Please save your scoring first before adding resources.",
                    });
                  } else {
                    // Clear question/domain context for overall-level resource
                    setDevItemContext({});
                    setResourceDialogOpen(true);
                  }
                }}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Resource
              </Button>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Add helpful resources, links, or notes that will be visible to the client with their
            evaluation.
          </p>

          {instructorResources && instructorResources.length > 0 ? (
            <div className="space-y-2">
              {instructorResources.map((item) => {
                const libraryResource = (item as any).library_resources;
                const resourceType = (item as any).resource_type;
                const isLibraryResource = resourceType === "library" && libraryResource;

                return (
                  <div
                    key={item.id}
                    className="flex items-start gap-2 p-2 rounded-md bg-background border"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs shrink-0">
                          {item.item_type === "resource"
                            ? isLibraryResource
                              ? "Library"
                              : "Resource"
                            : "Note"}
                        </Badge>
                        <span className="font-medium text-sm truncate">{item.title}</span>
                      </div>
                      {item.content && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {item.content}
                        </p>
                      )}
                      {/* URL-based resource */}
                      {item.resource_url && (
                        <a
                          href={item.resource_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline flex items-center gap-1 mt-1"
                        >
                          <ExternalLink className="h-3 w-3" />
                          {item.resource_url}
                        </a>
                      )}
                      {/* Library resource */}
                      {isLibraryResource && libraryResource.url && (
                        <a
                          href={libraryResource.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline flex items-center gap-1 mt-1"
                        >
                          <ExternalLink className="h-3 w-3" />
                          {libraryResource.title || libraryResource.url}
                        </a>
                      )}
                    </div>
                    {canAddResources && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={() => deleteResourceMutation.mutate(item.id)}
                      >
                        <Trash2 className="h-3 w-3 text-muted-foreground" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">No resources added yet.</p>
          )}
        </div>

        {/* View Full Assessment Button - for completed scoring */}
        {isCompleted && snapshotId && assessment && (
          <>
            <Separator />
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex-1 space-y-2">
                  <h4 className="font-medium text-sm">View Full Assessment</h4>
                  <div className="space-y-1.5 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-3.5 w-3.5 shrink-0" />
                      <span>View evolution and comparison charts</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-3.5 w-3.5 shrink-0" />
                      <span>Access all resources in full context</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Lightbulb className="h-3.5 w-3.5 shrink-0" />
                      <span>View development items and actions</span>
                    </div>
                  </div>
                </div>
              </div>
              <Button asChild className="w-full sm:w-auto">
                <Link to={`/capabilities/${assessment.id}?snapshotId=${snapshotId}`}>
                  View Full Assessment
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </>
        )}

        {!isCompleted && (
          <div className="flex gap-2 justify-end pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => saveMutation.mutate({ status: "draft" })}
              disabled={saveMutation.isPending}
            >
              <Save className="h-4 w-4 mr-2" /> Save Draft
            </Button>
            <Button
              onClick={() => saveMutation.mutate({ status: "completed" })}
              disabled={saveMutation.isPending}
            >
              <CheckCircle className="h-4 w-4 mr-2" /> Complete Scoring
            </Button>
          </div>
        )}
      </CardContent>

      {/* Resource Dialog for instructors */}
      {snapshotId && clientUserId && (
        <DevelopmentItemDialog
          open={resourceDialogOpen}
          onOpenChange={(open) => {
            setResourceDialogOpen(open);
            if (!open) setDevItemContext({});
          }}
          snapshotId={snapshotId}
          moduleProgressId={moduleProgressId}
          questionId={devItemContext.questionId}
          domainId={devItemContext.domainId}
          forUserId={clientUserId}
          allowedTypes={["resource", "note", "action_item", "reflection"]}
          dialogTitle={
            devItemContext.questionId
              ? "Add Development Item for Question"
              : "Add Resource for Client"
          }
          dialogDescription={
            devItemContext.questionId
              ? "Add a development item linked to this specific question."
              : "Add a helpful resource or note that will be visible to the client with their evaluation results."
          }
        />
      )}
    </Card>
  );
}
