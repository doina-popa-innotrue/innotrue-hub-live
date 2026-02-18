import { useState, useEffect, useCallback, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { ChevronDown, ChevronRight, Save, X, CloudOff, Cloud, Loader2 } from "lucide-react";
import { useClientStaffRelationships } from "@/hooks/useClientStaffRelationships";
import {
  parseQuestionTypes,
  calculateDomainScore,
  type ScoredQuestion,
} from "@/lib/assessmentScoring";

interface Domain {
  id: string;
  name: string;
  description: string | null;
  order_index: number;
  capability_domain_questions: {
    id: string;
    question_text: string;
    description: string | null;
    order_index: number;
    question_type?: string | null;
    type_weight?: number | null;
  }[];
}

interface Assessment {
  id: string;
  name: string;
  rating_scale: number;
  instructions: string | null;
  instructions_self: string | null;
  instructions_evaluator: string | null;
  assessment_mode: "self" | "evaluator" | "both";
  question_types?: unknown;
  capability_domains: Domain[];
}

interface CapabilitySnapshotFormProps {
  assessment: Assessment;
  onCancel: () => void;
  onComplete: () => void;
  existingDraftId?: string;
}

const AUTO_SAVE_DELAY = 3000; // 3 seconds after last change

export function CapabilitySnapshotForm({
  assessment,
  onCancel,
  onComplete,
  existingDraftId,
}: CapabilitySnapshotFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: staffRelationships } = useClientStaffRelationships();
  const [expandedDomains, setExpandedDomains] = useState<string[]>(
    assessment.capability_domains.map((d) => d.id),
  );
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [shareWithCoach, setShareWithCoach] = useState(false);
  const [shareWithInstructor, setShareWithInstructor] = useState(false);
  const [ratings, setRatings] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    assessment.capability_domains.forEach((domain) => {
      domain.capability_domain_questions.forEach((q) => {
        initial[q.id] = Math.ceil(assessment.rating_scale / 2);
      });
    });
    return initial;
  });
  const [domainNotes, setDomainNotes] = useState<Record<string, string>>({});
  const [questionNotes, setQuestionNotes] = useState<Record<string, string>>({});
  const [draftId, setDraftId] = useState<string | null>(existingDraftId || null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch existing draft by ID if resuming
  const { data: draftById, isLoading: draftByIdLoading } = useQuery({
    queryKey: ["capability-draft-by-id", existingDraftId],
    queryFn: async () => {
      if (!existingDraftId) return null;

      const { data, error } = await supabase
        .from("capability_snapshots")
        .select(
          `
          *,
          capability_snapshot_ratings(*),
          capability_domain_notes(*),
          capability_question_notes(*)
        `,
        )
        .eq("id", existingDraftId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!existingDraftId,
  });

  // Fetch existing self-assessment draft if not given an ID
  // This only looks for self-assessments (where user is both subject and evaluator)
  const { data: draftByAssessment, isLoading: draftByAssessmentLoading } = useQuery({
    queryKey: ["capability-draft", assessment.id, user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .from("capability_snapshots")
        .select(
          `
          *,
          capability_snapshot_ratings(*),
          capability_domain_notes(*),
          capability_question_notes(*)
        `,
        )
        .eq("assessment_id", assessment.id)
        .eq("user_id", user.id)
        .eq("is_self_assessment", true)
        .eq("status", "draft")
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user && !existingDraftId,
  });

  const existingDraft = draftById || draftByAssessment;
  const draftLoading = draftByIdLoading || draftByAssessmentLoading;

  // Determine evaluator mode:
  // - If we have a loaded draft, use its is_self_assessment flag
  // - If we have an existingDraftId but draft hasn't loaded yet, assume evaluator mode
  //   (this prevents incorrectly showing self-assessment UI while loading peer assessments)
  const isEvaluatorMode = existingDraft ? existingDraft.is_self_assessment === false : false;

  // Load draft data when found
  useEffect(() => {
    if (existingDraft) {
      setDraftId(existingDraft.id);
      setTitle(existingDraft.title || "");
      setNotes(existingDraft.notes || "");
      setShareWithCoach(existingDraft.shared_with_coach);
      setShareWithInstructor((existingDraft as any).shared_with_instructor || false);
      setLastSaved(new Date(existingDraft.updated_at));

      // Load ratings
      if (existingDraft.capability_snapshot_ratings) {
        const loadedRatings: Record<string, number> = {};
        existingDraft.capability_snapshot_ratings.forEach(
          (r: { question_id: string; rating: number }) => {
            loadedRatings[r.question_id] = r.rating;
          },
        );
        setRatings((prev) => ({ ...prev, ...loadedRatings }));
      }

      // Load domain notes
      if (existingDraft.capability_domain_notes) {
        const loadedNotes: Record<string, string> = {};
        existingDraft.capability_domain_notes.forEach(
          (n: { domain_id: string; content: string }) => {
            loadedNotes[n.domain_id] = n.content;
          },
        );
        setDomainNotes(loadedNotes);
      }

      // Load question notes
      if (existingDraft.capability_question_notes) {
        const loadedQuestionNotes: Record<string, string> = {};
        existingDraft.capability_question_notes.forEach(
          (n: { question_id: string; content: string }) => {
            loadedQuestionNotes[n.question_id] = n.content;
          },
        );
        setQuestionNotes(loadedQuestionNotes);
      }
    }
  }, [existingDraft]);

  const toggleDomain = (domainId: string) => {
    setExpandedDomains((prev) =>
      prev.includes(domainId) ? prev.filter((id) => id !== domainId) : [...prev, domainId],
    );
  };

  // Save draft mutation
  const saveDraftMutation = useMutation({
    mutationFn: async (): Promise<string> => {
      if (!user) throw new Error("Not authenticated");

      // Use existingDraftId (from URL) or loaded draftId from state
      // This ensures we update the correct snapshot even if the draft hasn't loaded yet
      const snapshotIdToUpdate = existingDraftId || draftId;

      if (snapshotIdToUpdate) {
        // Update existing draft
        const { error: updateError } = await supabase
          .from("capability_snapshots")
          .update({
            title: title || null,
            notes: notes || null,
            shared_with_coach: shareWithCoach,
            shared_with_instructor: shareWithInstructor,
            updated_at: new Date().toISOString(),
          } as any)
          .eq("id", snapshotIdToUpdate);

        if (updateError) throw updateError;

        // Build lookup for question text and domain name
        const questionLookup = new Map<string, { questionText: string; domainName: string }>();
        assessment.capability_domains.forEach((domain) => {
          domain.capability_domain_questions.forEach((q) => {
            questionLookup.set(q.id, { questionText: q.question_text, domainName: domain.name });
          });
        });

        // Upsert ratings with snapshot text - use proper upsert to avoid race conditions
        const ratingsToUpsert = Object.entries(ratings).map(([questionId, rating]) => {
          const lookup = questionLookup.get(questionId);
          return {
            snapshot_id: snapshotIdToUpdate,
            question_id: questionId,
            rating,
            question_text_snapshot: lookup?.questionText || null,
            domain_name_snapshot: lookup?.domainName || null,
          };
        });

        if (ratingsToUpsert.length > 0) {
          const { error: ratingsError } = await supabase
            .from("capability_snapshot_ratings")
            .upsert(ratingsToUpsert, { onConflict: "snapshot_id,question_id" });

          if (ratingsError) throw ratingsError;
        }

        // Upsert domain notes - use proper upsert to avoid race conditions
        const notesToUpsert = Object.entries(domainNotes)
          .filter(([, content]) => content.trim())
          .map(([domainId, content]) => ({
            snapshot_id: snapshotIdToUpdate,
            domain_id: domainId,
            content: content.trim(),
          }));

        if (notesToUpsert.length > 0) {
          const { error: notesError } = await supabase
            .from("capability_domain_notes")
            .upsert(notesToUpsert, { onConflict: "snapshot_id,domain_id" });
          if (notesError) throw notesError;
        }

        // Delete domain notes that were cleared
        const existingDomainIds = Object.entries(domainNotes)
          .filter(([, content]) => content.trim())
          .map(([domainId]) => domainId);

        if (existingDomainIds.length === 0) {
          await supabase
            .from("capability_domain_notes")
            .delete()
            .eq("snapshot_id", snapshotIdToUpdate);
        }

        // Upsert question notes - use proper upsert to avoid race conditions
        const questionNotesToUpsert = Object.entries(questionNotes)
          .filter(([, content]) => content.trim())
          .map(([questionId, content]) => ({
            snapshot_id: snapshotIdToUpdate,
            question_id: questionId,
            content: content.trim(),
          }));

        if (questionNotesToUpsert.length > 0) {
          const { error: qNotesError } = await supabase
            .from("capability_question_notes")
            .upsert(questionNotesToUpsert, { onConflict: "snapshot_id,question_id" });
          if (qNotesError) throw qNotesError;
        }

        // Update local draftId state if it wasn't set
        if (!draftId) {
          setDraftId(snapshotIdToUpdate);
        }

        return snapshotIdToUpdate;
      } else {
        // Create new draft
        const { data: snapshot, error: snapshotError } = await supabase
          .from("capability_snapshots")
          .insert({
            assessment_id: assessment.id,
            user_id: user.id,
            title: title || null,
            notes: notes || null,
            shared_with_coach: shareWithCoach,
            shared_with_instructor: shareWithInstructor,
            status: "draft",
            completed_at: null,
          } as any)
          .select()
          .single();

        if (snapshotError) throw snapshotError;

        // Build lookup for question text and domain name
        const questionLookup = new Map<string, { questionText: string; domainName: string }>();
        assessment.capability_domains.forEach((domain) => {
          domain.capability_domain_questions.forEach((q) => {
            questionLookup.set(q.id, { questionText: q.question_text, domainName: domain.name });
          });
        });

        // Insert ratings with snapshot text
        const ratingsToInsert = Object.entries(ratings).map(([questionId, rating]) => {
          const lookup = questionLookup.get(questionId);
          return {
            snapshot_id: snapshot.id,
            question_id: questionId,
            rating,
            question_text_snapshot: lookup?.questionText || null,
            domain_name_snapshot: lookup?.domainName || null,
          };
        });

        const { error: ratingsError } = await supabase
          .from("capability_snapshot_ratings")
          .insert(ratingsToInsert);

        if (ratingsError) throw ratingsError;

        // Insert domain notes
        const notesToInsert = Object.entries(domainNotes)
          .filter(([, content]) => content.trim())
          .map(([domainId, content]) => ({
            snapshot_id: snapshot.id,
            domain_id: domainId,
            content: content.trim(),
          }));

        if (notesToInsert.length > 0) {
          const { error: notesError } = await supabase
            .from("capability_domain_notes")
            .insert(notesToInsert);
          if (notesError) throw notesError;
        }

        // Insert question notes
        const questionNotesToInsert = Object.entries(questionNotes)
          .filter(([, content]) => content.trim())
          .map(([questionId, content]) => ({
            snapshot_id: snapshot.id,
            question_id: questionId,
            content: content.trim(),
          }));

        if (questionNotesToInsert.length > 0) {
          const { error: qNotesError } = await supabase
            .from("capability_question_notes")
            .insert(questionNotesToInsert);
          if (qNotesError) throw qNotesError;
        }

        setDraftId(snapshot.id);
        return snapshot.id;
      }
    },
    onSuccess: () => {
      setLastSaved(new Date());
      setHasUnsavedChanges(false);
    },
    onError: (error: Error) => {
      console.error("Draft save error:", error);
    },
  });

  // Complete/submit mutation
  const completeMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");

      // First save current state
      const savedDraftId = await saveDraftMutation.mutateAsync();
      if (!savedDraftId) throw new Error("Unable to save draft");

      // Then mark as completed
      const { error } = await supabase
        .from("capability_snapshots")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", savedDraftId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["capability-snapshots"] });
      queryClient.invalidateQueries({ queryKey: ["capability-draft"] });
      toast({ description: "Assessment completed successfully" });
      onComplete();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Track changes for auto-save
  const markChanged = useCallback(() => {
    setHasUnsavedChanges(true);

    // Clear existing timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    // Set new auto-save timer
    autoSaveTimerRef.current = setTimeout(() => {
      saveDraftMutation.mutate();
    }, AUTO_SAVE_DELAY);
  }, [saveDraftMutation]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  // Wrap state setters to track changes
  const handleRatingChange = (questionId: string, value: number) => {
    setRatings((prev) => ({ ...prev, [questionId]: value }));
    markChanged();
  };

  const handleDomainNoteChange = (domainId: string, value: string) => {
    setDomainNotes((prev) => ({ ...prev, [domainId]: value }));
    markChanged();
  };

  const handleQuestionNoteChange = (questionId: string, value: string) => {
    setQuestionNotes((prev) => ({ ...prev, [questionId]: value }));
    markChanged();
  };

  const handleTitleChange = (value: string) => {
    setTitle(value);
    markChanged();
  };

  const handleNotesChange = (value: string) => {
    setNotes(value);
    markChanged();
  };

  const handleShareWithCoachChange = (value: boolean) => {
    setShareWithCoach(value);
    markChanged();
  };

  const handleShareWithInstructorChange = (value: boolean) => {
    setShareWithInstructor(value);
    markChanged();
  };

  // Parse question types from assessment
  const questionTypes = parseQuestionTypes(assessment.question_types);

  const getDomainScoreData = (domain: Domain) => {
    const scoredQuestions: ScoredQuestion[] = domain.capability_domain_questions.map((q) => ({
      questionId: q.id,
      rating: ratings[q.id] || 0,
      questionType: q.question_type || null,
      typeWeight: q.type_weight ?? null,
    }));
    return calculateDomainScore(scoredQuestions, questionTypes);
  };

  const getDomainAverage = (domain: Domain) => {
    const score = getDomainScoreData(domain);
    return score.weightedAverage ?? score.simpleAverage;
  };

  const getOverallAverage = () => {
    const allRatings = Object.values(ratings);
    if (allRatings.length === 0) return 0;
    return allRatings.reduce((a, b) => a + b, 0) / allRatings.length;
  };

  const handleManualSave = () => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    saveDraftMutation.mutate();
    toast({ description: "Draft saved" });
  };

  if (draftLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Loading draft...</span>
        </CardContent>
      </Card>
    );
  }

  // Get the appropriate instructions based on mode
  const getInstructions = () => {
    if (isEvaluatorMode) {
      return (assessment as any).instructions_evaluator || assessment.instructions;
    }
    return (assessment as any).instructions_self || assessment.instructions;
  };

  const currentInstructions = getInstructions();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{isEvaluatorMode ? "Evaluate Participant" : "Self-Assessment"}</CardTitle>
            <CardDescription>
              {isEvaluatorMode
                ? `Rate the participant on each capability question from 1 to ${assessment.rating_scale}`
                : `Rate yourself on each capability question from 1 to ${assessment.rating_scale}`}
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            {/* Auto-save indicator */}
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {saveDraftMutation.isPending ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : hasUnsavedChanges ? (
                <>
                  <CloudOff className="h-3 w-3" />
                  <span>Unsaved</span>
                </>
              ) : lastSaved ? (
                <>
                  <Cloud className="h-3 w-3 text-primary" />
                  <span>Saved</span>
                </>
              ) : null}
            </div>
            <Badge variant="outline" className="text-lg px-3 py-1">
              Overall: {getOverallAverage().toFixed(1)}/{assessment.rating_scale}
            </Badge>
          </div>
        </div>
        {currentInstructions && (
          <p className="text-sm text-muted-foreground mt-2">{currentInstructions}</p>
        )}
        {existingDraft && (
          <p className="text-xs text-muted-foreground mt-1">
            Resuming draft from {new Date(existingDraft.updated_at).toLocaleDateString()}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="title">Snapshot Title (optional)</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="e.g., Q1 2024 Assessment"
            />
          </div>
          <div className="flex flex-col gap-3 pt-6">
            {staffRelationships?.hasInstructor && (
              <div className="flex items-center gap-3">
                <Switch
                  id="share-instructor"
                  checked={shareWithInstructor}
                  onCheckedChange={handleShareWithInstructorChange}
                />
                <Label htmlFor="share-instructor">Share with instructor</Label>
              </div>
            )}
            {staffRelationships?.hasCoach && (
              <div className="flex items-center gap-3">
                <Switch
                  id="share-coach"
                  checked={shareWithCoach}
                  onCheckedChange={handleShareWithCoachChange}
                />
                <Label htmlFor="share-coach">Share with coach</Label>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {assessment.capability_domains.map((domain) => (
            <Collapsible
              key={domain.id}
              open={expandedDomains.includes(domain.id)}
              onOpenChange={() => toggleDomain(domain.id)}
            >
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {expandedDomains.includes(domain.id) ? (
                          <ChevronDown className="h-5 w-5" />
                        ) : (
                          <ChevronRight className="h-5 w-5" />
                        )}
                        <div>
                          <CardTitle className="text-base">{domain.name}</CardTitle>
                          {domain.description && (
                            <CardDescription className="text-xs mt-1">
                              {domain.description}
                            </CardDescription>
                          )}
                        </div>
                      </div>
                      <Badge variant="secondary">
                        {questionTypes ? "Weighted" : "Avg"}: {getDomainAverage(domain).toFixed(1)}
                      </Badge>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="space-y-6 pt-0">
                    {domain.capability_domain_questions.map((question) => (
                      <div key={question.id} className="space-y-3">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Label className="text-sm font-medium">{question.question_text}</Label>
                              {question.question_type && (
                                <Badge variant="secondary" className="text-xs font-normal">
                                  {question.question_type}
                                </Badge>
                              )}
                            </div>
                            {question.description && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {question.description}
                              </p>
                            )}
                          </div>
                          <Badge variant="outline" className="shrink-0">
                            {ratings[question.id]}/{assessment.rating_scale}
                          </Badge>
                        </div>
                        <Slider
                          value={[ratings[question.id]]}
                          onValueChange={([value]) => handleRatingChange(question.id, value)}
                          min={1}
                          max={assessment.rating_scale}
                          step={1}
                          className="w-full"
                        />
                        <Textarea
                          value={questionNotes[question.id] || ""}
                          onChange={(e) => handleQuestionNoteChange(question.id, e.target.value)}
                          placeholder="Add notes for this question (optional)"
                          rows={2}
                          className="text-sm"
                        />
                      </div>
                    ))}
                    {/* Type subtotals — shown when question types are configured */}
                    {questionTypes && questionTypes.length > 0 && (() => {
                      const scoreData = getDomainScoreData(domain);
                      return scoreData.typeSubtotals.length > 0 ? (
                        <div className="flex flex-wrap gap-3 pt-2 border-t">
                          {scoreData.typeSubtotals.map((ts) => (
                            <div key={ts.typeName} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <span className="font-medium">{ts.typeName}:</span>
                              <span>{ts.average.toFixed(1)}/{assessment.rating_scale}</span>
                              <span className="text-muted-foreground/60">({ts.typeWeight}%)</span>
                            </div>
                          ))}
                        </div>
                      ) : null;
                    })()}
                    <div className="space-y-2 pt-2 border-t">
                      <Label htmlFor={`notes-${domain.id}`}>
                        Reflections on {domain.name} (optional)
                      </Label>
                      <Textarea
                        id={`notes-${domain.id}`}
                        value={domainNotes[domain.id] || ""}
                        onChange={(e) => handleDomainNoteChange(domain.id, e.target.value)}
                        placeholder="What's going well? What do you want to improve?"
                        rows={2}
                      />
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))}
        </div>

        <div className="space-y-2">
          <Label htmlFor="overall-notes">Overall Notes (optional)</Label>
          <Textarea
            id="overall-notes"
            value={notes}
            onChange={(e) => handleNotesChange(e.target.value)}
            placeholder="Any overall thoughts or reflections..."
            rows={3}
          />
        </div>

        <div className="flex flex-col sm:flex-row justify-between gap-3">
          <Button
            variant="outline"
            onClick={handleManualSave}
            disabled={saveDraftMutation.isPending}
            className="w-full sm:w-auto"
          >
            <Save className="mr-2 h-4 w-4" />
            Save Draft
          </Button>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={onCancel} className="w-full sm:w-auto">
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
            <Button
              onClick={() => completeMutation.mutate()}
              disabled={completeMutation.isPending || !draftId}
              className="w-full sm:w-auto"
            >
              <Save className="mr-2 h-4 w-4" />
              {completeMutation.isPending ? "Completing..." : "Complete"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
