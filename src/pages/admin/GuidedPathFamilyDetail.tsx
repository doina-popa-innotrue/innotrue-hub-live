import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Pencil,
  Trash2,
  ArrowLeft,
  GripVertical,
  FileQuestion,
  FolderTree,
  Link2,
} from "lucide-react";
import { toast } from "sonner";
import { BackButton } from "@/components/navigation/BackButton";

interface SurveyQuestion {
  id: string;
  family_id: string;
  question_text: string;
  question_type: string;
  options: { value: string; label: string }[] | null;
  help_text: string | null;
  order_index: number;
  is_required: boolean;
}

interface Template {
  id: string;
  name: string;
  description: string | null;
  is_base_template: boolean;
  order_in_family: number;
  is_active: boolean;
  conditions: TemplateCondition[];
}

interface TemplateCondition {
  id: string;
  template_id: string;
  question_id: string;
  operator: string;
  value: unknown;
  question?: SurveyQuestion;
}

interface QuestionFormData {
  question_text: string;
  question_type: "boolean" | "single_choice" | "multi_choice" | "date";
  options: { value: string; label: string }[];
  help_text: string;
  is_required: boolean;
}

const defaultQuestionForm: QuestionFormData = {
  question_text: "",
  question_type: "boolean",
  options: [],
  help_text: "",
  is_required: true,
};

export default function GuidedPathFamilyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [questionDialogOpen, setQuestionDialogOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<SurveyQuestion | null>(null);
  const [deletingQuestion, setDeletingQuestion] = useState<SurveyQuestion | null>(null);
  const [questionForm, setQuestionForm] = useState<QuestionFormData>(defaultQuestionForm);
  const [newOption, setNewOption] = useState({ value: "", label: "" });

  // Fetch family details
  const { data: family, isLoading: familyLoading } = useQuery({
    queryKey: ["guided-path-family", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("guided_path_template_families")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch survey questions
  const { data: questions = [], isLoading: questionsLoading } = useQuery({
    queryKey: ["family-survey-questions", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("family_survey_questions")
        .select("*")
        .eq("family_id", id!)
        .order("order_index");
      if (error) throw error;
      return (data || []).map((q) => ({
        ...q,
        options: q.options as { value: string; label: string }[] | null,
      })) as SurveyQuestion[];
    },
    enabled: !!id,
  });

  // Fetch linked templates
  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ["family-templates", id],
    queryFn: async () => {
      const { data: templatesData, error } = await supabase
        .from("guided_path_templates")
        .select("id, name, description, is_base_template, order_in_family, is_active")
        .eq("family_id", id!)
        .order("order_in_family");
      if (error) throw error;

      // Fetch conditions for each template
      const templatesWithConditions = await Promise.all(
        (templatesData || []).map(async (template) => {
          const { data: conditions } = await supabase
            .from("template_conditions")
            .select("*, question:family_survey_questions(*)")
            .eq("template_id", template.id);

          const mappedConditions = (conditions || []).map((cond) => ({
            ...cond,
            question: cond.question
              ? {
                  ...cond.question,
                  options: cond.question.options as { value: string; label: string }[] | null,
                }
              : undefined,
          }));

          return { ...template, conditions: mappedConditions };
        }),
      );

      return templatesWithConditions as Template[];
    },
    enabled: !!id,
  });

  // Question mutations
  const createQuestionMutation = useMutation({
    mutationFn: async (data: QuestionFormData) => {
      const { error } = await supabase.from("family_survey_questions").insert({
        family_id: id!,
        question_text: data.question_text,
        question_type: data.question_type,
        options:
          data.question_type !== "boolean" && data.question_type !== "date" ? data.options : null,
        help_text: data.help_text || null,
        is_required: data.is_required,
        order_index: questions.length,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Question added");
      queryClient.invalidateQueries({ queryKey: ["family-survey-questions", id] });
      setQuestionDialogOpen(false);
      setQuestionForm(defaultQuestionForm);
    },
    onError: (error: Error) => {
      toast.error(`Failed to add question: ${error.message}`);
    },
  });

  const updateQuestionMutation = useMutation({
    mutationFn: async ({ questionId, data }: { questionId: string; data: QuestionFormData }) => {
      const { error } = await supabase
        .from("family_survey_questions")
        .update({
          question_text: data.question_text,
          question_type: data.question_type,
          options:
            data.question_type !== "boolean" && data.question_type !== "date" ? data.options : null,
          help_text: data.help_text || null,
          is_required: data.is_required,
        })
        .eq("id", questionId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Question updated");
      queryClient.invalidateQueries({ queryKey: ["family-survey-questions", id] });
      setQuestionDialogOpen(false);
      setEditingQuestion(null);
      setQuestionForm(defaultQuestionForm);
    },
    onError: (error: Error) => {
      toast.error(`Failed to update question: ${error.message}`);
    },
  });

  const deleteQuestionMutation = useMutation({
    mutationFn: async (questionId: string) => {
      const { error } = await supabase
        .from("family_survey_questions")
        .delete()
        .eq("id", questionId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Question deleted");
      queryClient.invalidateQueries({ queryKey: ["family-survey-questions", id] });
      setDeletingQuestion(null);
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete question: ${error.message}`);
    },
  });

  function openQuestionDialog(question?: SurveyQuestion) {
    if (question) {
      setEditingQuestion(question);
      setQuestionForm({
        question_text: question.question_text,
        question_type: question.question_type as QuestionFormData["question_type"],
        options: question.options || [],
        help_text: question.help_text || "",
        is_required: question.is_required,
      });
    } else {
      setEditingQuestion(null);
      setQuestionForm(defaultQuestionForm);
    }
    setQuestionDialogOpen(true);
  }

  function handleQuestionSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!questionForm.question_text.trim()) {
      toast.error("Question text is required");
      return;
    }

    if (editingQuestion) {
      updateQuestionMutation.mutate({ questionId: editingQuestion.id, data: questionForm });
    } else {
      createQuestionMutation.mutate(questionForm);
    }
  }

  function addOption() {
    if (!newOption.value.trim() || !newOption.label.trim()) {
      toast.error("Both value and label are required");
      return;
    }
    setQuestionForm((prev) => ({
      ...prev,
      options: [...prev.options, { ...newOption }],
    }));
    setNewOption({ value: "", label: "" });
  }

  function removeOption(index: number) {
    setQuestionForm((prev) => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index),
    }));
  }

  function getQuestionTypeLabel(type: string) {
    switch (type) {
      case "boolean":
        return "Yes/No";
      case "single_choice":
        return "Single Choice";
      case "multi_choice":
        return "Multiple Choice";
      case "date":
        return "Date";
      default:
        return type;
    }
  }

  if (familyLoading) {
    return <PageLoadingState />;
  }

  if (!family) {
    return <ErrorState title="Not Found" description="Family not found" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton />
        <div>
          <h1 className="text-3xl font-bold">{family.name}</h1>
          <p className="text-muted-foreground">
            {family.description || "Configure survey and template blocks"}
          </p>
        </div>
      </div>

      <Tabs defaultValue="questions">
        <TabsList>
          <TabsTrigger value="questions" className="gap-2">
            <FileQuestion className="h-4 w-4" />
            Survey Questions ({questions.length})
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-2">
            <FolderTree className="h-4 w-4" />
            Template Blocks ({templates.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="questions" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Survey Questions</CardTitle>
                <CardDescription>
                  Questions asked when a user selects this path family
                </CardDescription>
              </div>
              <Button onClick={() => openQuestionDialog()}>
                <Plus className="mr-2 h-4 w-4" />
                Add Question
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>Question</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Options</TableHead>
                    <TableHead>Required</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {questions.map((question, index) => (
                    <TableRow key={question.id}>
                      <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{question.question_text}</p>
                          {question.help_text && (
                            <p className="text-sm text-muted-foreground">{question.help_text}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {getQuestionTypeLabel(question.question_type)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {question.options && question.options.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {question.options.slice(0, 3).map((opt) => (
                              <Badge key={opt.value} variant="secondary" className="text-xs">
                                {opt.label}
                              </Badge>
                            ))}
                            {question.options.length > 3 && (
                              <Badge variant="secondary" className="text-xs">
                                +{question.options.length - 3} more
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {question.is_required ? (
                          <Badge>Required</Badge>
                        ) : (
                          <Badge variant="outline">Optional</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openQuestionDialog(question)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => setDeletingQuestion(question)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {questions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No survey questions defined. Add questions to customize path selection.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Template Blocks</CardTitle>
                <CardDescription>
                  Templates linked to this family. Configure conditions for each.
                </CardDescription>
              </div>
              <Button onClick={() => navigate("/admin/guided-path-templates")}>
                <Link2 className="mr-2 h-4 w-4" />
                Manage Templates
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Template</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Conditions</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map((template) => (
                    <TableRow key={template.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{template.name}</p>
                          {template.description && (
                            <p className="text-sm text-muted-foreground truncate max-w-[300px]">
                              {template.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {template.is_base_template ? (
                          <Badge>Base</Badge>
                        ) : (
                          <Badge variant="outline">Conditional</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {template.is_base_template ? (
                          <span className="text-muted-foreground">Always included</span>
                        ) : template.conditions.length > 0 ? (
                          <div className="space-y-1">
                            {template.conditions.map((cond) => (
                              <div key={cond.id} className="text-sm">
                                <span className="text-muted-foreground">
                                  {cond.question?.question_text?.slice(0, 30)}...
                                </span>
                                <Badge variant="secondary" className="ml-1 text-xs">
                                  {cond.operator} {JSON.stringify(cond.value)}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-amber-600">No conditions set</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={template.is_active ? "default" : "secondary"}>
                          {template.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/admin/guided-path-templates/${template.id}`)}
                        >
                          Configure
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {templates.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No templates linked to this family. Link templates from the Templates page.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Question Dialog */}
      <Dialog open={questionDialogOpen} onOpenChange={setQuestionDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingQuestion ? "Edit Question" : "Add Question"}</DialogTitle>
            <DialogDescription>Configure the survey question for path selection</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleQuestionSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="question_text">Question</Label>
              <Textarea
                id="question_text"
                value={questionForm.question_text}
                onChange={(e) =>
                  setQuestionForm((prev) => ({ ...prev, question_text: e.target.value }))
                }
                placeholder="e.g., Do you hold the System Architect credential?"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="question_type">Question Type</Label>
              <Select
                value={questionForm.question_type}
                onValueChange={(value: QuestionFormData["question_type"]) =>
                  setQuestionForm((prev) => ({ ...prev, question_type: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="boolean">Yes/No</SelectItem>
                  <SelectItem value="single_choice">Single Choice</SelectItem>
                  <SelectItem value="multi_choice">Multiple Choice</SelectItem>
                  <SelectItem value="date">Date</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(questionForm.question_type === "single_choice" ||
              questionForm.question_type === "multi_choice") && (
              <div className="space-y-2">
                <Label>Options</Label>
                <div className="space-y-2">
                  {questionForm.options.map((opt, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Badge variant="outline" className="flex-1">
                        {opt.label} ({opt.value})
                      </Badge>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeOption(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Input
                      placeholder="Value (e.g., not_scheduled)"
                      value={newOption.value}
                      onChange={(e) => setNewOption((prev) => ({ ...prev, value: e.target.value }))}
                    />
                    <Input
                      placeholder="Label (e.g., Not yet scheduled)"
                      value={newOption.label}
                      onChange={(e) => setNewOption((prev) => ({ ...prev, label: e.target.value }))}
                    />
                    <Button type="button" variant="outline" onClick={addOption}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="help_text">Help Text (optional)</Label>
              <Input
                id="help_text"
                value={questionForm.help_text}
                onChange={(e) =>
                  setQuestionForm((prev) => ({ ...prev, help_text: e.target.value }))
                }
                placeholder="Additional context or instructions"
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="is_required"
                checked={questionForm.is_required}
                onCheckedChange={(checked) =>
                  setQuestionForm((prev) => ({ ...prev, is_required: checked }))
                }
              />
              <Label htmlFor="is_required">Required</Label>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setQuestionDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createQuestionMutation.isPending || updateQuestionMutation.isPending}
              >
                {editingQuestion ? "Update" : "Add"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Question Dialog */}
      <AlertDialog open={!!deletingQuestion} onOpenChange={() => setDeletingQuestion(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Question</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this question? This will also remove any conditions
              using this question.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingQuestion && deleteQuestionMutation.mutate(deletingQuestion.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
