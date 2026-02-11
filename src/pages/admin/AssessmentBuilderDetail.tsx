import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit, Trash2, Loader2, ArrowLeft, GripVertical, Target, HelpCircle, Lightbulb } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Dimension = {
  id: string;
  name: string;
  description: string | null;
  order_index: number;
};

type Question = {
  id: string;
  question_text: string;
  question_type: string;
  order_index: number;
  is_required: boolean;
};

type Option = {
  id: string;
  question_id: string;
  option_text: string;
  order_index: number;
};

type OptionScore = {
  id: string;
  option_id: string;
  dimension_id: string;
  score: number;
};

type Interpretation = {
  id: string;
  name: string;
  description: string | null;
  interpretation_text: string;
  conditions: Record<string, unknown>;
  priority: number;
};

export default function AssessmentBuilderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Dimension state
  const [dimensionDialogOpen, setDimensionDialogOpen] = useState(false);
  const [editingDimension, setEditingDimension] = useState<Dimension | null>(null);
  const [dimensionForm, setDimensionForm] = useState({ name: "", description: "" });

  // Question state
  const [questionDialogOpen, setQuestionDialogOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [questionForm, setQuestionForm] = useState({ question_text: "", question_type: "single_choice" });

  // Option state
  const [optionDialogOpen, setOptionDialogOpen] = useState(false);
  const [editingOption, setEditingOption] = useState<{ questionId: string; option: Option | null }>({ questionId: "", option: null });
  const [optionForm, setOptionForm] = useState({ option_text: "" });

  // Score state
  const [scoreDialogOpen, setScoreDialogOpen] = useState(false);
  const [editingOptionForScore, setEditingOptionForScore] = useState<Option | null>(null);

  // Interpretation state
  const [interpretationDialogOpen, setInterpretationDialogOpen] = useState(false);
  const [editingInterpretation, setEditingInterpretation] = useState<Interpretation | null>(null);
  const [interpretationForm, setInterpretationForm] = useState({
    name: "",
    description: "",
    interpretation_text: "",
    conditions: "{}",
    priority: 0,
  });

  // Fetch assessment
  const { data: assessment, isLoading: assessmentLoading } = useQuery({
    queryKey: ["assessment-definition", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessment_definitions")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch dimensions
  const { data: dimensions = [] } = useQuery({
    queryKey: ["assessment-dimensions", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessment_dimensions")
        .select("*")
        .eq("assessment_id", id!)
        .order("order_index");
      if (error) throw error;
      return data as Dimension[];
    },
    enabled: !!id,
  });

  // Fetch questions
  const { data: questions = [] } = useQuery({
    queryKey: ["assessment-questions", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessment_questions")
        .select("*")
        .eq("assessment_id", id!)
        .order("order_index");
      if (error) throw error;
      return data as Question[];
    },
    enabled: !!id,
  });

  // Fetch options
  const { data: options = [] } = useQuery({
    queryKey: ["assessment-options", id],
    queryFn: async () => {
      const questionIds = questions.map(q => q.id);
      if (questionIds.length === 0) return [];
      const { data, error } = await supabase
        .from("assessment_options")
        .select("*")
        .in("question_id", questionIds)
        .order("order_index");
      if (error) throw error;
      return data as Option[];
    },
    enabled: questions.length > 0,
  });

  // Fetch option scores
  const { data: optionScores = [] } = useQuery({
    queryKey: ["assessment-option-scores", id],
    queryFn: async () => {
      const optionIds = options.map(o => o.id);
      if (optionIds.length === 0) return [];
      const { data, error } = await supabase
        .from("assessment_option_scores")
        .select("*")
        .in("option_id", optionIds);
      if (error) throw error;
      return data as OptionScore[];
    },
    enabled: options.length > 0,
  });

  // Fetch interpretations
  const { data: interpretations = [] } = useQuery({
    queryKey: ["assessment-interpretations", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessment_interpretations")
        .select("*")
        .eq("assessment_id", id!)
        .order("priority", { ascending: false });
      if (error) throw error;
      return data as Interpretation[];
    },
    enabled: !!id,
  });

  // Mutations
  const createDimension = useMutation({
    mutationFn: async (data: { name: string; description: string }) => {
      const { error } = await supabase.from("assessment_dimensions").insert([{
        assessment_id: id!,
        name: data.name,
        description: data.description || null,
        order_index: dimensions.length,
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assessment-dimensions", id] });
      toast({ description: "Dimension created" });
      setDimensionDialogOpen(false);
      setDimensionForm({ name: "", description: "" });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateDimension = useMutation({
    mutationFn: async ({ dimId, data }: { dimId: string; data: { name: string; description: string } }) => {
      const { error } = await supabase.from("assessment_dimensions").update({
        name: data.name,
        description: data.description || null,
      }).eq("id", dimId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assessment-dimensions", id] });
      toast({ description: "Dimension updated" });
      setDimensionDialogOpen(false);
      setEditingDimension(null);
      setDimensionForm({ name: "", description: "" });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteDimension = useMutation({
    mutationFn: async (dimId: string) => {
      const { error } = await supabase.from("assessment_dimensions").delete().eq("id", dimId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assessment-dimensions", id] });
      toast({ description: "Dimension deleted" });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const createQuestion = useMutation({
    mutationFn: async (data: { question_text: string; question_type: string }) => {
      const { error } = await supabase.from("assessment_questions").insert([{
        assessment_id: id!,
        question_text: data.question_text,
        question_type: data.question_type,
        order_index: questions.length,
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assessment-questions", id] });
      toast({ description: "Question created" });
      setQuestionDialogOpen(false);
      setQuestionForm({ question_text: "", question_type: "single_choice" });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateQuestion = useMutation({
    mutationFn: async ({ qId, data }: { qId: string; data: { question_text: string; question_type: string } }) => {
      const { error } = await supabase.from("assessment_questions").update({
        question_text: data.question_text,
        question_type: data.question_type,
      }).eq("id", qId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assessment-questions", id] });
      toast({ description: "Question updated" });
      setQuestionDialogOpen(false);
      setEditingQuestion(null);
      setQuestionForm({ question_text: "", question_type: "single_choice" });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteQuestion = useMutation({
    mutationFn: async (qId: string) => {
      const { error } = await supabase.from("assessment_questions").delete().eq("id", qId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assessment-questions", id] });
      queryClient.invalidateQueries({ queryKey: ["assessment-options", id] });
      toast({ description: "Question deleted" });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const createOption = useMutation({
    mutationFn: async (data: { question_id: string; option_text: string }) => {
      const existingOptions = options.filter(o => o.question_id === data.question_id);
      const { error } = await supabase.from("assessment_options").insert([{
        question_id: data.question_id,
        option_text: data.option_text,
        order_index: existingOptions.length,
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assessment-options", id] });
      toast({ description: "Option created" });
      setOptionDialogOpen(false);
      setOptionForm({ option_text: "" });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateOption = useMutation({
    mutationFn: async ({ optId, data }: { optId: string; data: { option_text: string } }) => {
      const { error } = await supabase.from("assessment_options").update({
        option_text: data.option_text,
      }).eq("id", optId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assessment-options", id] });
      toast({ description: "Option updated" });
      setOptionDialogOpen(false);
      setEditingOption({ questionId: "", option: null });
      setOptionForm({ option_text: "" });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteOption = useMutation({
    mutationFn: async (optId: string) => {
      const { error } = await supabase.from("assessment_options").delete().eq("id", optId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assessment-options", id] });
      queryClient.invalidateQueries({ queryKey: ["assessment-option-scores", id] });
      toast({ description: "Option deleted" });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const upsertOptionScore = useMutation({
    mutationFn: async (data: { option_id: string; dimension_id: string; score: number }) => {
      const { error } = await supabase.from("assessment_option_scores").upsert({
        option_id: data.option_id,
        dimension_id: data.dimension_id,
        score: data.score,
      }, { onConflict: "option_id,dimension_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assessment-option-scores", id] });
      toast({ description: "Score saved" });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteOptionScore = useMutation({
    mutationFn: async ({ optionId, dimensionId }: { optionId: string; dimensionId: string }) => {
      const { error } = await supabase.from("assessment_option_scores")
        .delete()
        .eq("option_id", optionId)
        .eq("dimension_id", dimensionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assessment-option-scores", id] });
      toast({ description: "Score removed" });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const createInterpretation = useMutation({
    mutationFn: async (data: typeof interpretationForm) => {
      let conditions = {};
      try {
        conditions = JSON.parse(data.conditions);
      } catch {
        throw new Error("Invalid JSON in conditions");
      }
      const { error } = await supabase.from("assessment_interpretations").insert([{
        assessment_id: id!,
        name: data.name,
        description: data.description || null,
        interpretation_text: data.interpretation_text,
        conditions,
        priority: data.priority,
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assessment-interpretations", id] });
      toast({ description: "Interpretation rule created" });
      setInterpretationDialogOpen(false);
      setInterpretationForm({ name: "", description: "", interpretation_text: "", conditions: "{}", priority: 0 });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateInterpretation = useMutation({
    mutationFn: async ({ intId, data }: { intId: string; data: typeof interpretationForm }) => {
      let conditions = {};
      try {
        conditions = JSON.parse(data.conditions);
      } catch {
        throw new Error("Invalid JSON in conditions");
      }
      const { error } = await supabase.from("assessment_interpretations").update({
        name: data.name,
        description: data.description || null,
        interpretation_text: data.interpretation_text,
        conditions,
        priority: data.priority,
      }).eq("id", intId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assessment-interpretations", id] });
      toast({ description: "Interpretation rule updated" });
      setInterpretationDialogOpen(false);
      setEditingInterpretation(null);
      setInterpretationForm({ name: "", description: "", interpretation_text: "", conditions: "{}", priority: 0 });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteInterpretation = useMutation({
    mutationFn: async (intId: string) => {
      const { error } = await supabase.from("assessment_interpretations").delete().eq("id", intId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assessment-interpretations", id] });
      toast({ description: "Interpretation rule deleted" });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const getScoreForOptionDimension = (optionId: string, dimensionId: string) => {
    return optionScores.find(s => s.option_id === optionId && s.dimension_id === dimensionId);
  };

  if (assessmentLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Assessment not found</p>
        <Button variant="link" onClick={() => navigate("/admin/assessment-builder")}>
          Go back
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/assessment-builder")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">{assessment.name}</h1>
          <p className="text-muted-foreground">Configure questions, dimensions, and interpretation rules</p>
        </div>
      </div>

      <Tabs defaultValue="dimensions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="dimensions" className="gap-2">
            <Target className="h-4 w-4" />
            Dimensions
          </TabsTrigger>
          <TabsTrigger value="questions" className="gap-2">
            <HelpCircle className="h-4 w-4" />
            Questions
          </TabsTrigger>
          <TabsTrigger value="interpretations" className="gap-2">
            <Lightbulb className="h-4 w-4" />
            Interpretations
          </TabsTrigger>
        </TabsList>

        {/* DIMENSIONS TAB */}
        <TabsContent value="dimensions" className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              Dimensions are the traits or categories being measured (e.g., "Strategic Thinking", "Team Leadership")
            </p>
            <Dialog open={dimensionDialogOpen} onOpenChange={(open) => {
              setDimensionDialogOpen(open);
              if (!open) {
                setEditingDimension(null);
                setDimensionForm({ name: "", description: "" });
              }
            }}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Dimension
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingDimension ? "Edit Dimension" : "Add Dimension"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={(e) => {
                  e.preventDefault();
                  if (editingDimension) {
                    updateDimension.mutate({ dimId: editingDimension.id, data: dimensionForm });
                  } else {
                    createDimension.mutate(dimensionForm);
                  }
                }} className="space-y-4">
                  <div>
                    <Label>Name *</Label>
                    <Input value={dimensionForm.name} onChange={(e) => setDimensionForm({ ...dimensionForm, name: e.target.value })} required />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Textarea value={dimensionForm.description} onChange={(e) => setDimensionForm({ ...dimensionForm, description: e.target.value })} />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setDimensionDialogOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={createDimension.isPending || updateDimension.isPending}>
                      {(createDimension.isPending || updateDimension.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      {editingDimension ? "Update" : "Create"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {dimensions.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No dimensions yet. Add dimensions to define what you're measuring.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {dimensions.map((dim) => (
                <Card key={dim.id}>
                  <CardContent className="flex items-center justify-between py-4">
                    <div className="flex items-center gap-3">
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{dim.name}</p>
                        {dim.description && <p className="text-sm text-muted-foreground">{dim.description}</p>}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" onClick={() => {
                        setEditingDimension(dim);
                        setDimensionForm({ name: dim.name, description: dim.description || "" });
                        setDimensionDialogOpen(true);
                      }}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => {
                        if (confirm("Delete this dimension?")) deleteDimension.mutate(dim.id);
                      }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* QUESTIONS TAB */}
        <TabsContent value="questions" className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              Add situational questions with answer options. Each option can contribute points to different dimensions.
            </p>
            <Dialog open={questionDialogOpen} onOpenChange={(open) => {
              setQuestionDialogOpen(open);
              if (!open) {
                setEditingQuestion(null);
                setQuestionForm({ question_text: "", question_type: "single_choice" });
              }
            }}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Question
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingQuestion ? "Edit Question" : "Add Question"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={(e) => {
                  e.preventDefault();
                  if (editingQuestion) {
                    updateQuestion.mutate({ qId: editingQuestion.id, data: questionForm });
                  } else {
                    createQuestion.mutate(questionForm);
                  }
                }} className="space-y-4">
                  <div>
                    <Label>Question Text *</Label>
                    <Textarea value={questionForm.question_text} onChange={(e) => setQuestionForm({ ...questionForm, question_text: e.target.value })} required rows={3} />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setQuestionDialogOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={createQuestion.isPending || updateQuestion.isPending}>
                      {(createQuestion.isPending || updateQuestion.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      {editingQuestion ? "Update" : "Create"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {questions.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <HelpCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No questions yet. Add your first question to start building the assessment.</p>
              </CardContent>
            </Card>
          ) : (
            <Accordion type="multiple" className="space-y-2">
              {questions.map((q, idx) => {
                const qOptions = options.filter(o => o.question_id === q.id);
                return (
                  <AccordionItem key={q.id} value={q.id} className="border rounded-lg px-4">
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-3 text-left">
                        <Badge variant="outline">{idx + 1}</Badge>
                        <span className="font-medium">{q.question_text}</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-4">
                      <div className="flex justify-between items-center">
                        <p className="text-sm text-muted-foreground">Answer options ({qOptions.length})</p>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => {
                            setEditingOption({ questionId: q.id, option: null });
                            setOptionForm({ option_text: "" });
                            setOptionDialogOpen(true);
                          }}>
                            <Plus className="h-4 w-4 mr-2" />
                            Add Option
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => {
                            setEditingQuestion(q);
                            setQuestionForm({ question_text: q.question_text, question_type: q.question_type });
                            setQuestionDialogOpen(true);
                          }}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => {
                            if (confirm("Delete this question and all its options?")) deleteQuestion.mutate(q.id);
                          }}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {qOptions.length === 0 ? (
                        <p className="text-sm text-muted-foreground italic">No options yet</p>
                      ) : (
                        <div className="space-y-2">
                          {qOptions.map((opt) => {
                            const scores = optionScores.filter(s => s.option_id === opt.id);
                            return (
                              <Card key={opt.id} className="bg-muted/30">
                                <CardContent className="py-3 flex items-start justify-between">
                                  <div className="space-y-2">
                                    <p className="font-medium">{opt.option_text}</p>
                                    {scores.length > 0 ? (
                                      <div className="flex flex-wrap gap-1">
                                        {scores.map(s => {
                                          const dim = dimensions.find(d => d.id === s.dimension_id);
                                          return (
                                            <Badge key={s.id} variant="secondary" className="text-xs">
                                              {dim?.name}: +{s.score}
                                            </Badge>
                                          );
                                        })}
                                      </div>
                                    ) : (
                                      <p className="text-xs text-muted-foreground">No scoring configured</p>
                                    )}
                                  </div>
                                  <div className="flex gap-1">
                                    <Button variant="ghost" size="sm" onClick={() => {
                                      setEditingOptionForScore(opt);
                                      setScoreDialogOpen(true);
                                    }}>
                                      <Target className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => {
                                      setEditingOption({ questionId: q.id, option: opt });
                                      setOptionForm({ option_text: opt.option_text });
                                      setOptionDialogOpen(true);
                                    }}>
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => {
                                      if (confirm("Delete this option?")) deleteOption.mutate(opt.id);
                                    }}>
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}

          {/* Option Dialog */}
          <Dialog open={optionDialogOpen} onOpenChange={(open) => {
            setOptionDialogOpen(open);
            if (!open) {
              setEditingOption({ questionId: "", option: null });
              setOptionForm({ option_text: "" });
            }
          }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingOption.option ? "Edit Option" : "Add Option"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={(e) => {
                e.preventDefault();
                if (editingOption.option) {
                  updateOption.mutate({ optId: editingOption.option.id, data: optionForm });
                } else {
                  createOption.mutate({ question_id: editingOption.questionId, option_text: optionForm.option_text });
                }
              }} className="space-y-4">
                <div>
                  <Label>Option Text *</Label>
                  <Textarea value={optionForm.option_text} onChange={(e) => setOptionForm({ option_text: e.target.value })} required rows={2} />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setOptionDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={createOption.isPending || updateOption.isPending}>
                    {(createOption.isPending || updateOption.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {editingOption.option ? "Update" : "Create"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          {/* Score Dialog */}
          <Dialog open={scoreDialogOpen} onOpenChange={(open) => {
            setScoreDialogOpen(open);
            if (!open) setEditingOptionForScore(null);
          }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Configure Scoring</DialogTitle>
              </DialogHeader>
              {editingOptionForScore && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Set how many points this option contributes to each dimension
                  </p>
                  <p className="font-medium">"{editingOptionForScore.option_text}"</p>
                  <div className="space-y-3">
                    {dimensions.map(dim => {
                      const existing = getScoreForOptionDimension(editingOptionForScore.id, dim.id);
                      return (
                        <div key={dim.id} className="flex items-center justify-between gap-4">
                          <span className="text-sm">{dim.name}</span>
                          <div className="flex items-center gap-2">
                            <Select
                              value={existing?.score?.toString() || "0"}
                              onValueChange={(val) => {
                                const score = parseInt(val);
                                if (score === 0 && existing) {
                                  deleteOptionScore.mutate({ optionId: editingOptionForScore.id, dimensionId: dim.id });
                                } else if (score > 0) {
                                  upsertOptionScore.mutate({ option_id: editingOptionForScore.id, dimension_id: dim.id, score });
                                }
                              }}
                            >
                              <SelectTrigger className="w-20">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {[0, 1, 2, 3, 4, 5].map(n => (
                                  <SelectItem key={n} value={n.toString()}>{n === 0 ? "None" : `+${n}`}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {dimensions.length === 0 && (
                    <p className="text-sm text-muted-foreground italic">Add dimensions first to configure scoring</p>
                  )}
                </div>
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* INTERPRETATIONS TAB */}
        <TabsContent value="interpretations" className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              Define interpretation rules based on dimension scores. Conditions use JSON format.
            </p>
            <Dialog open={interpretationDialogOpen} onOpenChange={(open) => {
              setInterpretationDialogOpen(open);
              if (!open) {
                setEditingInterpretation(null);
                setInterpretationForm({ name: "", description: "", interpretation_text: "", conditions: "{}", priority: 0 });
              }
            }}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Interpretation
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{editingInterpretation ? "Edit Interpretation" : "Add Interpretation"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={(e) => {
                  e.preventDefault();
                  if (editingInterpretation) {
                    updateInterpretation.mutate({ intId: editingInterpretation.id, data: interpretationForm });
                  } else {
                    createInterpretation.mutate(interpretationForm);
                  }
                }} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Name *</Label>
                      <Input value={interpretationForm.name} onChange={(e) => setInterpretationForm({ ...interpretationForm, name: e.target.value })} required placeholder="e.g., High Strategic Thinker" />
                    </div>
                    <div>
                      <Label>Priority</Label>
                      <Input type="number" value={interpretationForm.priority} onChange={(e) => setInterpretationForm({ ...interpretationForm, priority: parseInt(e.target.value) || 0 })} />
                      <p className="text-xs text-muted-foreground mt-1">Higher priority rules are shown first</p>
                    </div>
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Input value={interpretationForm.description} onChange={(e) => setInterpretationForm({ ...interpretationForm, description: e.target.value })} placeholder="Brief internal description" />
                  </div>
                  <div>
                    <Label>Conditions (JSON) *</Label>
                    <Textarea
                      value={interpretationForm.conditions}
                      onChange={(e) => setInterpretationForm({ ...interpretationForm, conditions: e.target.value })}
                      rows={4}
                      placeholder='{"dimension_name": {"min": 3, "max": 5}}'
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Example: {`{"Strategic Thinking": {"min": 4}}`} means this applies when Strategic Thinking score is ≥4
                    </p>
                  </div>
                  <div>
                    <Label>Interpretation Text *</Label>
                    <Textarea
                      value={interpretationForm.interpretation_text}
                      onChange={(e) => setInterpretationForm({ ...interpretationForm, interpretation_text: e.target.value })}
                      required
                      rows={4}
                      placeholder="You demonstrate strong strategic thinking abilities..."
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setInterpretationDialogOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={createInterpretation.isPending || updateInterpretation.isPending}>
                      {(createInterpretation.isPending || updateInterpretation.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      {editingInterpretation ? "Update" : "Create"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {interpretations.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Lightbulb className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No interpretation rules yet. Add rules to generate personalized insights based on scores.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {interpretations.map((int) => (
                <Card key={int.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{int.name}</CardTitle>
                        {int.description && <CardDescription>{int.description}</CardDescription>}
                        <div className="mt-2">
                          <Badge variant="outline">Priority: {int.priority}</Badge>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" onClick={() => {
                          setEditingInterpretation(int);
                          setInterpretationForm({
                            name: int.name,
                            description: int.description || "",
                            interpretation_text: int.interpretation_text,
                            conditions: JSON.stringify(int.conditions, null, 2),
                            priority: int.priority,
                          });
                          setInterpretationDialogOpen(true);
                        }}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => {
                          if (confirm("Delete this interpretation rule?")) deleteInterpretation.mutate(int.id);
                        }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Conditions:</p>
                      <code className="text-xs bg-muted p-2 rounded block mt-1">
                        {JSON.stringify(int.conditions)}
                      </code>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Interpretation:</p>
                      <p className="text-sm mt-1">{int.interpretation_text}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
