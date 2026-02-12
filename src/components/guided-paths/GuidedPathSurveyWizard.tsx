import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Json } from "@/integrations/supabase/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface SurveyQuestion {
  id: string;
  question_text: string;
  question_type: string;
  options: { value: string; label: string }[] | null;
  help_text: string | null;
  is_required: boolean;
}

interface Template {
  id: string;
  name: string;
  description: string | null;
  is_base_template?: boolean;
  conditions?: {
    question_id: string;
    operator: string;
    value: unknown;
  }[];
}

interface Props {
  familyId: string;
  familyName: string;
  questions: SurveyQuestion[];
  templates: Template[];
  onComplete: (selectedTemplateIds: string[]) => void;
  onCancel: () => void;
}

export function GuidedPathSurveyWizard({
  familyId,
  familyName,
  questions,
  templates,
  onComplete,
  onCancel,
}: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(0);
  const [responses, setResponses] = useState<Record<string, unknown>>({});

  const totalSteps = questions.length;
  const currentQuestion = questions[currentStep];
  const progress = totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0;

  // Evaluate template conditions based on responses
  function evaluateConditions(): string[] {
    const matchedTemplateIds: string[] = [];

    for (const template of templates) {
      // Base templates are always included
      if (template.is_base_template) {
        matchedTemplateIds.push(template.id);
        continue;
      }

      const conditions = template.conditions || [];

      // Check if all conditions are met
      const allConditionsMet = conditions.every((condition) => {
        const userAnswer = responses[condition.question_id];
        const conditionValue = condition.value;

        switch (condition.operator) {
          case "equals":
            return userAnswer === conditionValue;
          case "not_equals":
            return userAnswer !== conditionValue;
          case "in":
            if (Array.isArray(conditionValue)) {
              return conditionValue.includes(userAnswer);
            }
            return false;
          case "not_in":
            if (Array.isArray(conditionValue)) {
              return !conditionValue.includes(userAnswer);
            }
            return true;
          case "contains":
            if (Array.isArray(userAnswer)) {
              return userAnswer.includes(conditionValue);
            }
            return false;
          case "before": {
            // Date comparison: user's date is before condition date
            if (typeof userAnswer === "string" && typeof conditionValue === "string") {
              const userDate = new Date(userAnswer);
              const condDate = new Date(conditionValue);
              // Validate dates are valid before comparing
              if (!isNaN(userDate.getTime()) && !isNaN(condDate.getTime())) {
                return userDate < condDate;
              }
            }
            return false;
          }
          case "after": {
            // Date comparison: user's date is after condition date
            if (typeof userAnswer === "string" && typeof conditionValue === "string") {
              const userDate = new Date(userAnswer);
              const condDate = new Date(conditionValue);
              // Validate dates are valid before comparing
              if (!isNaN(userDate.getTime()) && !isNaN(condDate.getTime())) {
                return userDate > condDate;
              }
            }
            return false;
          }
          default:
            // Unknown operator - log warning and fail closed (don't match)
            console.warn(`Unknown condition operator: ${condition.operator}`);
            return false;
        }
      });

      // If template has no conditions but isn't base, it matches
      if (conditions.length === 0 || allConditionsMet) {
        matchedTemplateIds.push(template.id);
      }
    }

    return matchedTemplateIds;
  }

  const saveSurveyMutation = useMutation({
    mutationFn: async () => {
      if (!user) {
        throw new Error("You must be logged in to complete this survey");
      }

      const selectedTemplateIds = evaluateConditions();

      const { error } = await supabase.from("guided_path_survey_responses").insert([
        {
          user_id: user.id,
          family_id: familyId,
          responses: responses as Json,
          selected_template_ids: selectedTemplateIds,
          completed_at: new Date().toISOString(),
        },
      ]);

      if (error) throw error;
      return selectedTemplateIds;
    },
    onSuccess: (selectedTemplateIds) => {
      queryClient.invalidateQueries({ queryKey: ["guided-path-survey-responses"] });
      toast.success("Survey completed! Generating your personalized path...");
      onComplete(selectedTemplateIds);
    },
    onError: (error: Error) => {
      toast.error(`Failed to save survey: ${error.message}`);
    },
  });

  function handleBooleanChange(value: string) {
    setResponses((prev) => ({
      ...prev,
      [currentQuestion.id]: value === "true",
    }));
  }

  function handleSingleChoiceChange(value: string) {
    setResponses((prev) => ({
      ...prev,
      [currentQuestion.id]: value,
    }));
  }

  function handleMultiChoiceChange(value: string, checked: boolean) {
    setResponses((prev) => {
      const currentValues = (prev[currentQuestion.id] as string[]) || [];
      if (checked) {
        return { ...prev, [currentQuestion.id]: [...currentValues, value] };
      }
      return { ...prev, [currentQuestion.id]: currentValues.filter((v) => v !== value) };
    });
  }

  function handleDateChange(value: string) {
    setResponses((prev) => ({
      ...prev,
      [currentQuestion.id]: value,
    }));
  }

  function canProceed(): boolean {
    if (!currentQuestion.is_required) return true;
    const answer = responses[currentQuestion.id];
    if (answer === undefined || answer === null || answer === "") return false;
    if (Array.isArray(answer) && answer.length === 0) return false;
    return true;
  }

  function handleNext() {
    if (currentStep < totalSteps - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      // Submit survey
      saveSurveyMutation.mutate();
    }
  }

  function handleBack() {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    } else {
      onCancel();
    }
  }

  if (questions.length === 0) {
    // No survey questions - just show matched templates
    return (
      <Card>
        <CardHeader>
          <CardTitle>{familyName}</CardTitle>
          <CardDescription>Ready to start your guided path</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            This path has {templates.length} template{templates.length !== 1 ? "s" : ""} ready for
            you.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              onClick={() => saveSurveyMutation.mutate()}
              disabled={saveSurveyMutation.isPending}
            >
              {saveSurveyMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Start Path
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">
            Question {currentStep + 1} of {totalSteps}
          </span>
          <span className="text-sm font-medium">{familyName}</span>
        </div>
        <Progress value={progress} className="h-2" />
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-2">
            {currentQuestion.question_text}
            {currentQuestion.is_required && <span className="text-destructive ml-1">*</span>}
          </h3>
          {currentQuestion.help_text && (
            <p className="text-sm text-muted-foreground">{currentQuestion.help_text}</p>
          )}
        </div>

        <div className="space-y-3">
          {currentQuestion.question_type === "boolean" && (
            <RadioGroup
              value={String(responses[currentQuestion.id] ?? "")}
              onValueChange={handleBooleanChange}
            >
              <div className="flex items-center space-x-2 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="true" id="yes" />
                <Label htmlFor="yes" className="cursor-pointer flex-1">
                  Yes
                </Label>
              </div>
              <div className="flex items-center space-x-2 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="false" id="no" />
                <Label htmlFor="no" className="cursor-pointer flex-1">
                  No
                </Label>
              </div>
            </RadioGroup>
          )}

          {currentQuestion.question_type === "single_choice" && currentQuestion.options && (
            <RadioGroup
              value={String(responses[currentQuestion.id] ?? "")}
              onValueChange={handleSingleChoiceChange}
            >
              {currentQuestion.options.map((option) => (
                <div
                  key={option.value}
                  className="flex items-center space-x-2 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
                >
                  <RadioGroupItem value={option.value} id={option.value} />
                  <Label htmlFor={option.value} className="cursor-pointer flex-1">
                    {option.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          )}

          {currentQuestion.question_type === "multi_choice" && currentQuestion.options && (
            <div className="space-y-2">
              {currentQuestion.options.map((option) => {
                const currentValues = (responses[currentQuestion.id] as string[]) || [];
                const isChecked = currentValues.includes(option.value);
                return (
                  <div
                    key={option.value}
                    className="flex items-center space-x-2 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
                    onClick={() => handleMultiChoiceChange(option.value, !isChecked)}
                  >
                    <Checkbox
                      id={option.value}
                      checked={isChecked}
                      onCheckedChange={(checked) =>
                        handleMultiChoiceChange(option.value, checked as boolean)
                      }
                    />
                    <Label htmlFor={option.value} className="cursor-pointer flex-1">
                      {option.label}
                    </Label>
                  </div>
                );
              })}
            </div>
          )}

          {currentQuestion.question_type === "date" && (
            <Input
              type="date"
              value={(responses[currentQuestion.id] as string) || ""}
              onChange={(e) => handleDateChange(e.target.value)}
            />
          )}
        </div>

        <div className="flex justify-between pt-4">
          <Button variant="outline" onClick={handleBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {currentStep === 0 ? "Cancel" : "Back"}
          </Button>
          <Button onClick={handleNext} disabled={!canProceed() || saveSurveyMutation.isPending}>
            {saveSurveyMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : currentStep === totalSteps - 1 ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                Complete
              </>
            ) : (
              <>
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
