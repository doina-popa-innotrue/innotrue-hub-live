import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usePsychometricSchema } from "@/hooks/usePsychometricSchemas";
import {
  useCreatePsychometricResult,
  useUpdatePsychometricResult,
} from "@/hooks/usePsychometricResults";
import type { PsychometricResult } from "@/hooks/usePsychometricResults";
import type { SchemaDimension } from "@/hooks/usePsychometricSchemas";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  assessmentId: string;
  assessmentName: string;
  existingResult?: PsychometricResult | null;
}

export function PsychometricScoreEntryDialog({
  open,
  onOpenChange,
  userId,
  assessmentId,
  assessmentName,
  existingResult,
}: Props) {
  const { user } = useAuth();
  const { data: schema, isLoading: schemaLoading } = usePsychometricSchema(assessmentId);
  const createResult = useCreatePsychometricResult();
  const updateResult = useUpdatePsychometricResult();

  const [scores, setScores] = useState<Record<string, number>>({});
  const [sourceDescription, setSourceDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [assessedAt, setAssessedAt] = useState("");

  // Initialize form when dialog opens or schema loads
  useEffect(() => {
    if (!open || !schema) return;

    if (existingResult) {
      setScores(existingResult.scores || {});
      setSourceDescription(existingResult.source_description || "");
      setNotes(existingResult.notes || "");
      setAssessedAt(
        existingResult.assessed_at
          ? existingResult.assessed_at.substring(0, 10)
          : "",
      );
    } else {
      // Initialize all dimensions to their midpoint
      const initial: Record<string, number> = {};
      for (const dim of schema.dimensions) {
        initial[dim.key] = Math.round((dim.min + dim.max) / 2);
      }
      setScores(initial);
      setSourceDescription("");
      setNotes("");
      setAssessedAt("");
    }
  }, [open, schema, existingResult]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schema || !user) return;

    if (existingResult) {
      await updateResult.mutateAsync({
        id: existingResult.id,
        userId,
        scores,
        source_description: sourceDescription || null,
        notes: notes || null,
        assessed_at: assessedAt || null,
      });
    } else {
      await createResult.mutateAsync({
        user_id: userId,
        assessment_id: assessmentId,
        schema_id: schema.id,
        scores,
        entered_by: user.id,
        source_description: sourceDescription || null,
        notes: notes || null,
        assessed_at: assessedAt || null,
      });
    }

    onOpenChange(false);
  };

  const updateScore = (key: string, value: number) => {
    setScores((prev) => ({ ...prev, [key]: value }));
  };

  const getScorePercent = (dim: SchemaDimension, value: number) => {
    const range = dim.max - dim.min;
    if (range === 0) return 0;
    return ((value - dim.min) / range) * 100;
  };

  const getScoreColor = (percent: number) => {
    if (percent >= 80) return "text-green-600";
    if (percent >= 50) return "text-amber-600";
    return "text-red-600";
  };

  const isPending = createResult.isPending || updateResult.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {existingResult ? "Edit Scores" : "Enter Scores"} — {assessmentName}
          </DialogTitle>
        </DialogHeader>

        {schemaLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !schema || schema.dimensions.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            No dimension schema defined for this assessment. An admin must define
            dimensions first.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Dimension scores */}
            <div className="space-y-4">
              <Label className="text-base font-medium">Dimension Scores</Label>
              {schema.dimensions.map((dim) => {
                const value = scores[dim.key] ?? dim.min;
                const percent = getScorePercent(dim, value);
                return (
                  <div key={dim.key} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">
                        {dim.label}{" "}
                        <span className="text-xs text-muted-foreground">
                          ({dim.key})
                        </span>
                      </Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={dim.min}
                          max={dim.max}
                          value={value}
                          onChange={(e) =>
                            updateScore(
                              dim.key,
                              Math.min(dim.max, Math.max(dim.min, parseFloat(e.target.value) || dim.min)),
                            )
                          }
                          className="h-7 w-20 text-right text-sm"
                        />
                        <span
                          className={`text-xs font-medium w-10 text-right ${getScoreColor(percent)}`}
                        >
                          {Math.round(percent)}%
                        </span>
                      </div>
                    </div>
                    <Slider
                      value={[value]}
                      min={dim.min}
                      max={dim.max}
                      step={1}
                      onValueChange={([v]) => updateScore(dim.key, v)}
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{dim.min}</span>
                      <span>{dim.max}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Metadata */}
            <div className="space-y-3 border-t pt-4">
              <div>
                <Label htmlFor="assessed_at">Assessment Date</Label>
                <Input
                  id="assessed_at"
                  type="date"
                  value={assessedAt}
                  onChange={(e) => setAssessedAt(e.target.value)}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  When was the original assessment taken?
                </p>
              </div>
              <div>
                <Label htmlFor="source_description">Source Description</Label>
                <Input
                  id="source_description"
                  value={sourceDescription}
                  onChange={(e) => setSourceDescription(e.target.value)}
                  placeholder="e.g., DISC assessment taken at coaching session"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any additional notes about these results..."
                  className="mt-1"
                  rows={2}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                {existingResult ? "Update Scores" : "Save Scores"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
