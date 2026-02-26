import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus,
  Edit,
  Trash2,
  Loader2,
  ArrowLeft,
  GripVertical,
  ChevronDown,
  ChevronUp,
  Sliders,
  List,
  CheckSquare,
  Type,
  User,
  Calendar,
  Eye,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import { format } from "date-fns";
import { CapabilitySnapshotView } from "@/components/capabilities/CapabilitySnapshotView";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { GuidedLearningLinksEditor } from "@/components/admin/GuidedLearningLinksEditor";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
import { PageLoadingState } from "@/components/ui/page-loading-state";
import { ErrorState } from "@/components/ui/error-state";
import {
  parseQuestionTypes,
  validateTypeWeights,
  type QuestionTypeDefinition,
} from "@/lib/assessmentScoring";

type Domain = {
  id: string;
  assessment_id: string;
  name: string;
  description: string | null;
  order_index: number;
  created_at: string;
};

type Question = {
  id: string;
  domain_id: string;
  question_text: string;
  description: string | null;
  input_type: string;
  options: { label: string; value: string }[] | null;
  question_type: string | null;
  type_weight: number | null;
  order_index: number;
  created_at: string;
};

export default function CapabilityAssessmentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [domainDialogOpen, setDomainDialogOpen] = useState(false);
  const [questionDialogOpen, setQuestionDialogOpen] = useState(false);
  const [editingDomain, setEditingDomain] = useState<Domain | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [selectedDomainId, setSelectedDomainId] = useState<string | null>(null);
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set());
  const [selectedSnapshots, setSelectedSnapshots] = useState<Set<string>>(new Set());
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [snapshotPage, setSnapshotPage] = useState(0);
  const SNAPSHOT_PAGE_SIZE = 25;

  const [domainForm, setDomainForm] = useState({ name: "", description: "" });
  const [questionForm, setQuestionForm] = useState({
    question_text: "",
    description: "",
    input_type: "slider",
    options: [] as { label: string; value: string }[],
    question_type: "" as string,
    type_weight: "" as string,
  });
  const [newOptionLabel, setNewOptionLabel] = useState("");

  // Question types configuration state
  const [typeDialogOpen, setTypeDialogOpen] = useState(false);
  const [editingTypeIndex, setEditingTypeIndex] = useState<number | null>(null);
  const [typeForm, setTypeForm] = useState({ name: "", weight: "" });

  // Fetch assessment
  const { data: assessment, isLoading: assessmentLoading } = useQuery({
    queryKey: ["capability-assessment", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("capability_assessments")
        .select("*")
        .eq("id", id!)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch domains
  const { data: domains, isLoading: domainsLoading } = useQuery({
    queryKey: ["capability-domains", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("capability_domains")
        .select("*")
        .eq("assessment_id", id!)
        .order("order_index");

      if (error) throw error;
      return data as Domain[];
    },
    enabled: !!id,
  });

  // Fetch questions
  const { data: questions } = useQuery({
    queryKey: ["capability-questions", id],
    queryFn: async () => {
      if (!domains?.length) return [];
      const domainIds = domains.map((d) => d.id);
      const { data, error } = await supabase
        .from("capability_domain_questions")
        .select("*")
        .in("domain_id", domainIds)
        .order("order_index");

      if (error) throw error;
      return data as Question[];
    },
    enabled: !!domains?.length,
  });

  // Fetch user snapshots for this assessment (admin view)
  // user_id = the person being assessed (self or by instructor)
  // evaluator_id = the instructor doing the evaluation (null for self-assessments)
  const {
    data: snapshotResult,
    isLoading: snapshotsLoading,
    error: snapshotsError,
  } = useQuery({
    queryKey: ["admin-capability-snapshots", id, snapshotPage],
    queryFn: async () => {
      const countQuery = supabase
        .from("capability_snapshots")
        .select("id", { count: "exact", head: true })
        .eq("assessment_id", id!);

      const dataQuery = supabase
        .from("capability_snapshots")
        .select(
          `
          *,
          profiles!capability_snapshots_user_id_fkey (
            id,
            name,
            avatar_url
          ),
          evaluator:profiles!capability_snapshots_evaluator_id_fkey (
            id,
            name,
            avatar_url
          ),
          capability_snapshot_ratings (
            id,
            question_id,
            rating,
            domain_name_snapshot,
            question_text_snapshot
          ),
          capability_domain_notes (
            id,
            domain_id,
            content
          ),
          capability_question_notes (
            id,
            question_id,
            content
          )
        `,
        )
        .eq("assessment_id", id!)
        .order("completed_at", { ascending: false })
        .range(snapshotPage * SNAPSHOT_PAGE_SIZE, (snapshotPage + 1) * SNAPSHOT_PAGE_SIZE - 1);

      const [countResult, dataResult] = await Promise.all([countQuery, dataQuery]);

      if (dataResult.error) {
        console.error("Error fetching user snapshots:", dataResult.error);
        throw dataResult.error;
      }
      return {
        snapshots: dataResult.data,
        totalCount: countResult.count ?? 0,
      };
    },
    enabled: !!id,
  });

  const userSnapshots = snapshotResult?.snapshots || [];
  const snapshotTotalCount = snapshotResult?.totalCount || 0;
  const snapshotTotalPages = Math.ceil(snapshotTotalCount / SNAPSHOT_PAGE_SIZE);

  const getSnapshotPageNumbers = () => {
    const pages: (number | "ellipsis")[] = [];
    if (snapshotTotalPages <= 7) {
      for (let i = 0; i < snapshotTotalPages; i++) pages.push(i);
    } else {
      pages.push(0);
      if (snapshotPage > 2) pages.push("ellipsis");
      for (let i = Math.max(1, snapshotPage - 1); i <= Math.min(snapshotTotalPages - 2, snapshotPage + 1); i++) pages.push(i);
      if (snapshotPage < snapshotTotalPages - 3) pages.push("ellipsis");
      pages.push(snapshotTotalPages - 1);
    }
    return pages;
  };

  const [selectedSnapshot, setSelectedSnapshot] = useState<any | null>(null);

  // Parsed question types from assessment
  const assessmentQuestionTypes = parseQuestionTypes(assessment?.question_types);
  const typeWeightValidation = assessmentQuestionTypes
    ? validateTypeWeights(assessmentQuestionTypes)
    : null;

  // Question types mutation
  const updateQuestionTypesMutation = useMutation({
    mutationFn: async (types: QuestionTypeDefinition[] | null) => {
      const { error } = await supabase
        .from("capability_assessments")
        .update({ question_types: types })
        .eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["capability-assessment", id] });
      toast({ description: "Question types updated" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleAddType = () => {
    if (!typeForm.name.trim() || !typeForm.weight) return;
    const current = assessmentQuestionTypes || [];
    const newTypes = [...current, { name: typeForm.name.trim(), weight: parseFloat(typeForm.weight) }];
    updateQuestionTypesMutation.mutate(newTypes);
    setTypeForm({ name: "", weight: "" });
    setTypeDialogOpen(false);
  };

  const handleUpdateType = () => {
    if (editingTypeIndex === null || !typeForm.name.trim() || !typeForm.weight) return;
    const current = assessmentQuestionTypes || [];
    const newTypes = [...current];
    newTypes[editingTypeIndex] = { name: typeForm.name.trim(), weight: parseFloat(typeForm.weight) };
    updateQuestionTypesMutation.mutate(newTypes);
    setTypeForm({ name: "", weight: "" });
    setEditingTypeIndex(null);
    setTypeDialogOpen(false);
  };

  const handleDeleteType = (index: number) => {
    const current = assessmentQuestionTypes || [];
    const typeName = current[index].name;
    if (!confirm(`Delete type "${typeName}"? Questions assigned to this type will become untyped.`)) return;
    const newTypes = current.filter((_, i) => i !== index);
    updateQuestionTypesMutation.mutate(newTypes.length > 0 ? newTypes : null);
  };

  // Domain mutations
  const createDomainMutation = useMutation({
    mutationFn: async (data: typeof domainForm) => {
      const maxOrder = domains?.length ? Math.max(...domains.map((d) => d.order_index)) + 1 : 0;
      const { error } = await supabase
        .from("capability_domains")
        .insert([{ ...data, assessment_id: id!, order_index: maxOrder }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["capability-domains", id] });
      toast({ description: "Domain created successfully" });
      setDomainDialogOpen(false);
      setDomainForm({ name: "", description: "" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateDomainMutation = useMutation({
    mutationFn: async ({ domainId, data }: { domainId: string; data: typeof domainForm }) => {
      const { error } = await supabase.from("capability_domains").update(data).eq("id", domainId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["capability-domains", id] });
      toast({ description: "Domain updated successfully" });
      setDomainDialogOpen(false);
      setEditingDomain(null);
      setDomainForm({ name: "", description: "" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteDomainMutation = useMutation({
    mutationFn: async (domainId: string) => {
      const { error } = await supabase.from("capability_domains").delete().eq("id", domainId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["capability-domains", id] });
      queryClient.invalidateQueries({ queryKey: ["capability-questions", id] });
      toast({ description: "Domain deleted successfully" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Question mutations
  const createQuestionMutation = useMutation({
    mutationFn: async (data: typeof questionForm & { domain_id: string }) => {
      const domainQuestions = questions?.filter((q) => q.domain_id === data.domain_id) || [];
      const maxOrder = domainQuestions.length
        ? Math.max(...domainQuestions.map((q) => q.order_index)) + 1
        : 0;
      const insertData: Record<string, unknown> = {
        domain_id: data.domain_id,
        question_text: data.question_text,
        description: data.description || null,
        input_type: data.input_type,
        options: data.input_type !== "slider" && data.options.length > 0 ? data.options : null,
        order_index: maxOrder,
        question_type: data.question_type || null,
        type_weight: data.type_weight ? parseFloat(data.type_weight) : null,
      };
      const { error } = await supabase.from("capability_domain_questions").insert([insertData]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["capability-questions", id] });
      toast({ description: "Question created successfully" });
      setQuestionDialogOpen(false);
      setSelectedDomainId(null);
      resetQuestionForm();
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateQuestionMutation = useMutation({
    mutationFn: async ({ questionId, data }: { questionId: string; data: typeof questionForm }) => {
      const updateData: Record<string, unknown> = {
        question_text: data.question_text,
        description: data.description || null,
        input_type: data.input_type,
        options: data.input_type !== "slider" && data.options.length > 0 ? data.options : null,
        question_type: data.question_type || null,
        type_weight: data.type_weight ? parseFloat(data.type_weight) : null,
      };
      const { error } = await supabase
        .from("capability_domain_questions")
        .update(updateData)
        .eq("id", questionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["capability-questions", id] });
      toast({ description: "Question updated successfully" });
      setQuestionDialogOpen(false);
      setEditingQuestion(null);
      resetQuestionForm();
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteQuestionMutation = useMutation({
    mutationFn: async (questionId: string) => {
      const { error } = await supabase
        .from("capability_domain_questions")
        .delete()
        .eq("id", questionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["capability-questions", id] });
      toast({ description: "Question deleted successfully" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const reorderQuestionMutation = useMutation({
    mutationFn: async ({
      questionId,
      domainId,
      direction,
    }: {
      questionId: string;
      domainId: string;
      direction: "up" | "down";
    }) => {
      const domainQuestions =
        questions
          ?.filter((q) => q.domain_id === domainId)
          .sort((a, b) => a.order_index - b.order_index) || [];
      const currentIndex = domainQuestions.findIndex((q) => q.id === questionId);

      if (currentIndex === -1) return;
      if (direction === "up" && currentIndex === 0) return;
      if (direction === "down" && currentIndex === domainQuestions.length - 1) return;

      const swapIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
      const currentQuestion = domainQuestions[currentIndex];
      const swapQuestion = domainQuestions[swapIndex];

      // Swap order_index values
      const { error: error1 } = await supabase
        .from("capability_domain_questions")
        .update({ order_index: swapQuestion.order_index })
        .eq("id", currentQuestion.id);
      if (error1) throw error1;

      const { error: error2 } = await supabase
        .from("capability_domain_questions")
        .update({ order_index: currentQuestion.order_index })
        .eq("id", swapQuestion.id);
      if (error2) throw error2;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["capability-questions", id] });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Delete individual snapshot mutation
  const deleteSnapshotMutation = useMutation({
    mutationFn: async (snapshotId: string) => {
      // Delete related data first
      await supabase.from("capability_snapshot_ratings").delete().eq("snapshot_id", snapshotId);
      await supabase.from("capability_domain_notes").delete().eq("snapshot_id", snapshotId);
      await supabase.from("capability_question_notes").delete().eq("snapshot_id", snapshotId);

      const { error } = await supabase.from("capability_snapshots").delete().eq("id", snapshotId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-capability-snapshots", id] });
      queryClient.invalidateQueries({ queryKey: ["admin-capability-assessment-snapshot-counts"] });
      toast({ description: "Snapshot deleted successfully" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Bulk delete snapshots mutation
  const bulkDeleteSnapshotsMutation = useMutation({
    mutationFn: async (snapshotIds: string[]) => {
      for (const snapshotId of snapshotIds) {
        // Delete related data first
        await supabase.from("capability_snapshot_ratings").delete().eq("snapshot_id", snapshotId);
        await supabase.from("capability_domain_notes").delete().eq("snapshot_id", snapshotId);
        await supabase.from("capability_question_notes").delete().eq("snapshot_id", snapshotId);

        const { error } = await supabase.from("capability_snapshots").delete().eq("id", snapshotId);

        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-capability-snapshots", id] });
      queryClient.invalidateQueries({ queryKey: ["admin-capability-assessment-snapshot-counts"] });
      setSelectedSnapshots(new Set());
      setBulkDeleteDialogOpen(false);
      toast({ description: `${variables.length} snapshot(s) deleted successfully` });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const toggleSnapshotSelection = (snapshotId: string) => {
    const newSelection = new Set(selectedSnapshots);
    if (newSelection.has(snapshotId)) {
      newSelection.delete(snapshotId);
    } else {
      newSelection.add(snapshotId);
    }
    setSelectedSnapshots(newSelection);
  };

  const toggleAllSnapshots = () => {
    if (selectedSnapshots.size === userSnapshots.length) {
      setSelectedSnapshots(new Set());
    } else {
      setSelectedSnapshots(new Set(userSnapshots.map((s: any) => s.id)));
    }
  };

  const resetQuestionForm = () => {
    setQuestionForm({ question_text: "", description: "", input_type: "slider", options: [], question_type: "", type_weight: "" });
    setNewOptionLabel("");
  };

  const addOption = () => {
    if (newOptionLabel.trim()) {
      setQuestionForm({
        ...questionForm,
        options: [
          ...questionForm.options,
          {
            label: newOptionLabel.trim(),
            value: newOptionLabel.trim().toLowerCase().replace(/\s+/g, "_"),
          },
        ],
      });
      setNewOptionLabel("");
    }
  };

  const removeOption = (index: number) => {
    setQuestionForm({
      ...questionForm,
      options: questionForm.options.filter((_, i) => i !== index),
    });
  };

  const handleEditDomain = (domain: Domain) => {
    setEditingDomain(domain);
    setDomainForm({ name: domain.name, description: domain.description || "" });
    setDomainDialogOpen(true);
  };

  const handleEditQuestion = (question: Question) => {
    setEditingQuestion(question);
    setQuestionForm({
      question_text: question.question_text,
      description: question.description || "",
      input_type: question.input_type || "slider",
      options: (question.options as { label: string; value: string }[]) || [],
      question_type: question.question_type || "",
      type_weight: question.type_weight != null ? String(question.type_weight) : "",
    });
    setQuestionDialogOpen(true);
  };

  const handleAddQuestion = (domainId: string) => {
    setSelectedDomainId(domainId);
    setEditingQuestion(null);
    resetQuestionForm();
    setQuestionDialogOpen(true);
  };

  const handleDomainSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingDomain) {
      updateDomainMutation.mutate({ domainId: editingDomain.id, data: domainForm });
    } else {
      createDomainMutation.mutate(domainForm);
    }
  };

  const handleQuestionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingQuestion) {
      updateQuestionMutation.mutate({ questionId: editingQuestion.id, data: questionForm });
    } else if (selectedDomainId) {
      createQuestionMutation.mutate({ ...questionForm, domain_id: selectedDomainId });
    }
  };

  const toggleDomain = (domainId: string) => {
    const newExpanded = new Set(expandedDomains);
    if (newExpanded.has(domainId)) {
      newExpanded.delete(domainId);
    } else {
      newExpanded.add(domainId);
    }
    setExpandedDomains(newExpanded);
  };

  const getQuestionsForDomain = (domainId: string) => {
    return questions?.filter((q) => q.domain_id === domainId) || [];
  };

  if (assessmentLoading) {
    return <PageLoadingState />;
  }

  if (!assessment) {
    return (
      <ErrorState title="Not Found" description="The requested assessment could not be found." />
    );
  }

  const totalQuestions = questions?.length || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/admin/capability-assessments")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{assessment.name}</h1>
          <p className="text-muted-foreground">
            {domains?.length || 0} domains • {totalQuestions} questions • Scale: 1-
            {assessment.rating_scale}
          </p>
        </div>
      </div>

      <Tabs defaultValue="domains" className="space-y-4">
        <TabsList>
          <TabsTrigger value="domains">Domains & Questions</TabsTrigger>
          <TabsTrigger value="snapshots">User Snapshots</TabsTrigger>
        </TabsList>

        <TabsContent value="domains" className="space-y-4">
          {/* Question Types Configuration */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Question Types</CardTitle>
                  <CardDescription>
                    Define question categories with weights for weighted scoring. Leave empty for simple averaging.
                  </CardDescription>
                </div>
                <Dialog
                  open={typeDialogOpen}
                  onOpenChange={(open) => {
                    setTypeDialogOpen(open);
                    if (!open) {
                      setEditingTypeIndex(null);
                      setTypeForm({ name: "", weight: "" });
                    }
                  }}
                >
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Type
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-sm">
                    <DialogHeader>
                      <DialogTitle>
                        {editingTypeIndex !== null ? "Edit Question Type" : "Add Question Type"}
                      </DialogTitle>
                      <DialogDescription>
                        Define a question category and its weight percentage.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                      <div>
                        <Label htmlFor="type-name">Type Name *</Label>
                        <Input
                          id="type-name"
                          value={typeForm.name}
                          onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })}
                          placeholder="e.g., Knowledge"
                        />
                      </div>
                      <div>
                        <Label htmlFor="type-weight">Weight (%) *</Label>
                        <Input
                          id="type-weight"
                          type="number"
                          min="1"
                          max="100"
                          value={typeForm.weight}
                          onChange={(e) => setTypeForm({ ...typeForm, weight: e.target.value })}
                          placeholder="e.g., 30"
                        />
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button variant="outline" onClick={() => setTypeDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button
                          onClick={editingTypeIndex !== null ? handleUpdateType : handleAddType}
                          disabled={!typeForm.name.trim() || !typeForm.weight || updateQuestionTypesMutation.isPending}
                        >
                          {updateQuestionTypesMutation.isPending && (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          )}
                          {editingTypeIndex !== null ? "Update" : "Add"}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {!assessmentQuestionTypes || assessmentQuestionTypes.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No question types configured. All questions are weighted equally (simple averaging).
                </p>
              ) : (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {assessmentQuestionTypes.map((t, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-lg"
                      >
                        <span className="text-sm font-medium">{t.name}</span>
                        <Badge variant="secondary" className="text-xs">
                          {t.weight}%
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => {
                            setEditingTypeIndex(i);
                            setTypeForm({ name: t.name, weight: String(t.weight) });
                            setTypeDialogOpen(true);
                          }}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleDeleteType(i)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  {typeWeightValidation && !typeWeightValidation.valid && (
                    <p className="text-sm text-amber-600">
                      Weights sum to {typeWeightValidation.total}% (should be 100%)
                    </p>
                  )}
                  {typeWeightValidation?.valid && (
                    <p className="text-sm text-green-600">
                      Weights sum to 100% ✓
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Knowledge Domains</h2>
            <Dialog
              open={domainDialogOpen}
              onOpenChange={(open) => {
                setDomainDialogOpen(open);
                if (!open) {
                  setEditingDomain(null);
                  setDomainForm({ name: "", description: "" });
                }
              }}
            >
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Domain
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>{editingDomain ? "Edit Domain" : "Add Domain"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleDomainSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="domain-name">Domain Name *</Label>
                    <Input
                      id="domain-name"
                      value={domainForm.name}
                      onChange={(e) => setDomainForm({ ...domainForm, name: e.target.value })}
                      required
                      placeholder="e.g., Technical Architecture"
                    />
                  </div>
                  <div>
                    <Label htmlFor="domain-description">Description</Label>
                    <Textarea
                      id="domain-description"
                      value={domainForm.description}
                      onChange={(e) =>
                        setDomainForm({ ...domainForm, description: e.target.value })
                      }
                      rows={3}
                      placeholder="What this domain covers..."
                    />
                  </div>

                  {/* Guided Learning Resources - only show when editing an existing domain */}
                  {editingDomain && (
                    <GuidedLearningLinksEditor
                      entityType="domain"
                      entityId={editingDomain.id}
                      entityName={editingDomain.name}
                    />
                  )}

                  <div className="flex gap-2 justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setDomainDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={createDomainMutation.isPending || updateDomainMutation.isPending}
                    >
                      {(createDomainMutation.isPending || updateDomainMutation.isPending) && (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      )}
                      {editingDomain ? "Update" : "Create"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {domainsLoading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </CardContent>
            </Card>
          ) : domains?.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <h3 className="text-lg font-medium">No domains yet</h3>
                <p className="text-muted-foreground mb-4">
                  Add your first knowledge domain to organize questions
                </p>
                <Button onClick={() => setDomainDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Domain
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {domains?.map((domain, index) => {
                const domainQuestions = getQuestionsForDomain(domain.id);
                const isExpanded = expandedDomains.has(domain.id);

                return (
                  <Collapsible
                    key={domain.id}
                    open={isExpanded}
                    onOpenChange={() => toggleDomain(domain.id)}
                  >
                    <Card>
                      <CardHeader className="pb-2">
                        <div className="flex items-center gap-3">
                          <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm" className="p-0 h-auto">
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                          </CollapsibleTrigger>
                          <div className="flex-1">
                            <CardTitle className="text-lg flex items-center gap-2">
                              {index + 1}. {domain.name}
                              <Badge variant="outline">{domainQuestions.length} questions</Badge>
                            </CardTitle>
                            {domain.description && (
                              <CardDescription>{domain.description}</CardDescription>
                            )}
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleAddQuestion(domain.id)}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditDomain(domain)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                if (
                                  confirm(
                                    `Delete "${domain.name}"? This will also delete all questions in this domain.`,
                                  )
                                ) {
                                  deleteDomainMutation.mutate(domain.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CollapsibleContent>
                        <CardContent className="pt-2">
                          {domainQuestions.length === 0 ? (
                            <div className="text-center py-4 text-muted-foreground">
                              <p className="mb-2">No questions in this domain yet</p>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleAddQuestion(domain.id)}
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                Add Question
                              </Button>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {domainQuestions.map((question, qIndex) => (
                                <div
                                  key={question.id}
                                  className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg"
                                >
                                  <div className="flex flex-col gap-0.5">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6"
                                      disabled={qIndex === 0 || reorderQuestionMutation.isPending}
                                      onClick={() =>
                                        reorderQuestionMutation.mutate({
                                          questionId: question.id,
                                          domainId: domain.id,
                                          direction: "up",
                                        })
                                      }
                                    >
                                      <ArrowUp className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6"
                                      disabled={
                                        qIndex === domainQuestions.length - 1 ||
                                        reorderQuestionMutation.isPending
                                      }
                                      onClick={() =>
                                        reorderQuestionMutation.mutate({
                                          questionId: question.id,
                                          domainId: domain.id,
                                          direction: "down",
                                        })
                                      }
                                    >
                                      <ArrowDown className="h-3 w-3" />
                                    </Button>
                                  </div>
                                  <span className="text-sm text-muted-foreground mt-0.5">
                                    {qIndex + 1}.
                                  </span>
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <p className="text-sm font-medium">
                                        {question.question_text}
                                      </p>
                                      <Badge variant="outline" className="text-xs">
                                        {question.input_type === "slider" && (
                                          <>
                                            <Sliders className="h-3 w-3 mr-1" />
                                            Slider
                                          </>
                                        )}
                                        {question.input_type === "single_choice" && (
                                          <>
                                            <List className="h-3 w-3 mr-1" />
                                            Single
                                          </>
                                        )}
                                        {question.input_type === "multi_choice" && (
                                          <>
                                            <CheckSquare className="h-3 w-3 mr-1" />
                                            Multi
                                          </>
                                        )}
                                        {question.input_type === "text" && (
                                          <>
                                            <Type className="h-3 w-3 mr-1" />
                                            Text
                                          </>
                                        )}
                                      </Badge>
                                      {question.question_type && (
                                        <Badge variant="secondary" className="text-xs">
                                          {question.question_type}
                                          {question.type_weight != null && ` (${question.type_weight}%)`}
                                        </Badge>
                                      )}
                                    </div>
                                    {question.description && (
                                      <p className="text-xs text-muted-foreground mt-1">
                                        {question.description}
                                      </p>
                                    )}
                                    {question.options && question.options.length > 0 && (
                                      <p className="text-xs text-muted-foreground mt-1">
                                        Options: {question.options.map((o) => o.label).join(", ")}
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => handleEditQuestion(question)}
                                    >
                                      <Edit className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => {
                                        if (confirm("Delete this question?")) {
                                          deleteQuestionMutation.mutate(question.id);
                                        }
                                      }}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="snapshots" className="space-y-4">
          {snapshotsLoading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </CardContent>
            </Card>
          ) : snapshotsError ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <User className="h-12 w-12 mx-auto mb-4 opacity-50 text-destructive" />
                <h3 className="text-lg font-medium text-destructive">Error loading snapshots</h3>
                <p className="text-sm mt-1">{(snapshotsError as Error).message}</p>
              </CardContent>
            </Card>
          ) : !userSnapshots?.length ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium">No snapshots yet</h3>
                <p className="text-sm mt-1">
                  User snapshots will appear here once clients start or complete this assessment.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Bulk actions bar */}
              {selectedSnapshots.size > 0 && (
                <div className="flex items-center gap-4 p-3 bg-muted rounded-lg">
                  <span className="text-sm font-medium">
                    {selectedSnapshots.size} snapshot(s) selected
                  </span>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setBulkDeleteDialogOpen(true)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Selected
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedSnapshots(new Set())}
                  >
                    Clear Selection
                  </Button>
                </div>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">User Snapshots ({snapshotTotalCount})</CardTitle>
                  <CardDescription>
                    All users who have started or completed this assessment
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={
                              selectedSnapshots.size === userSnapshots?.length &&
                              userSnapshots.length > 0
                            }
                            onCheckedChange={toggleAllSnapshots}
                          />
                        </TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Completed</TableHead>
                        <TableHead>Shared</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {userSnapshots.map((snapshot: any) => (
                        <TableRow key={snapshot.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedSnapshots.has(snapshot.id)}
                              onCheckedChange={() => toggleSnapshotSelection(snapshot.id)}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <p className="font-medium">
                                  {snapshot.profiles?.name || "Unknown User"}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={snapshot.status === "completed" ? "default" : "secondary"}
                            >
                              {snapshot.status === "completed"
                                ? "Completed"
                                : snapshot.status === "in_progress"
                                  ? "In Progress"
                                  : snapshot.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              {snapshot.completed_at
                                ? format(new Date(snapshot.completed_at), "MMM d, yyyy 'at' h:mm a")
                                : "—"}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={snapshot.shared_with_coach ? "default" : "secondary"}>
                              {snapshot.shared_with_coach ? "Shared" : "Private"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedSnapshot(snapshot)}
                                disabled={snapshot.status !== "completed"}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                View
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                onClick={() => {
                                  if (confirm("Delete this snapshot? This cannot be undone.")) {
                                    deleteSnapshotMutation.mutate(snapshot.id);
                                  }
                                }}
                                disabled={deleteSnapshotMutation.isPending}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {snapshotTotalPages > 1 && (
                    <div className="flex items-center justify-between pt-4">
                      <p className="text-sm text-muted-foreground">
                        Showing {snapshotPage * SNAPSHOT_PAGE_SIZE + 1}–
                        {Math.min((snapshotPage + 1) * SNAPSHOT_PAGE_SIZE, snapshotTotalCount)} of{" "}
                        {snapshotTotalCount}
                      </p>
                      <Pagination>
                        <PaginationContent>
                          <PaginationItem>
                            <PaginationPrevious
                              onClick={() => setSnapshotPage((p) => Math.max(0, p - 1))}
                              className={snapshotPage === 0 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                            />
                          </PaginationItem>
                          {getSnapshotPageNumbers().map((p, i) =>
                            p === "ellipsis" ? (
                              <PaginationItem key={`e${i}`}>
                                <PaginationEllipsis />
                              </PaginationItem>
                            ) : (
                              <PaginationItem key={p}>
                                <PaginationLink
                                  isActive={p === snapshotPage}
                                  onClick={() => setSnapshotPage(p)}
                                  className="cursor-pointer"
                                >
                                  {p + 1}
                                </PaginationLink>
                              </PaginationItem>
                            ),
                          )}
                          <PaginationItem>
                            <PaginationNext
                              onClick={() => setSnapshotPage((p) => Math.min(snapshotTotalPages - 1, p + 1))}
                              className={snapshotPage >= snapshotTotalPages - 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                            />
                          </PaginationItem>
                        </PaginationContent>
                      </Pagination>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Bulk Delete Confirmation Dialog */}
              <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Delete {selectedSnapshots.size} Snapshot(s)?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete the selected
                      assessment snapshots and all associated ratings and notes.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() =>
                        bulkDeleteSnapshotsMutation.mutate(Array.from(selectedSnapshots))
                      }
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      disabled={bulkDeleteSnapshotsMutation.isPending}
                    >
                      {bulkDeleteSnapshotsMutation.isPending && (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      )}
                      Delete {selectedSnapshots.size} Snapshot(s)
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              {/* Snapshot Detail Dialog */}
              <Dialog
                open={!!selectedSnapshot}
                onOpenChange={(open) => !open && setSelectedSnapshot(null)}
              >
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>
                      Snapshot: {selectedSnapshot?.profiles?.first_name}{" "}
                      {selectedSnapshot?.profiles?.last_name}
                    </DialogTitle>
                  </DialogHeader>
                  {selectedSnapshot && assessment && domains && (
                    <CapabilitySnapshotView
                      snapshot={{
                        id: selectedSnapshot.id,
                        title: selectedSnapshot.title,
                        notes: selectedSnapshot.notes,
                        completed_at: selectedSnapshot.completed_at,
                        shared_with_coach: selectedSnapshot.shared_with_coach,
                        capability_snapshot_ratings:
                          selectedSnapshot.capability_snapshot_ratings || [],
                        capability_domain_notes: selectedSnapshot.capability_domain_notes || [],
                        capability_question_notes: selectedSnapshot.capability_question_notes || [],
                      }}
                      assessment={{
                        id: assessment.id,
                        name: assessment.name,
                        rating_scale: assessment.rating_scale,
                        pass_fail_enabled: assessment.pass_fail_enabled,
                        pass_fail_mode: assessment.pass_fail_mode,
                        pass_fail_threshold: assessment.pass_fail_threshold,
                        capability_domains: domains.map((d) => ({
                          id: d.id,
                          name: d.name,
                          description: d.description,
                          capability_domain_questions: (
                            questions?.filter((q) => q.domain_id === d.id) || []
                          ).map((q) => ({
                            id: q.id,
                            question_text: q.question_text,
                            description: q.description,
                          })),
                        })),
                      }}
                      compact={false}
                    />
                  )}
                </DialogContent>
              </Dialog>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Question Dialog */}
      <Dialog
        open={questionDialogOpen}
        onOpenChange={(open) => {
          setQuestionDialogOpen(open);
          if (!open) {
            setEditingQuestion(null);
            setSelectedDomainId(null);
            resetQuestionForm();
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingQuestion ? "Edit Question" : "Add Question"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleQuestionSubmit} className="space-y-4">
            <div>
              <Label htmlFor="question-text">Question *</Label>
              <Textarea
                id="question-text"
                value={questionForm.question_text}
                onChange={(e) =>
                  setQuestionForm({ ...questionForm, question_text: e.target.value })
                }
                required
                rows={2}
                placeholder="e.g., How would you rate your knowledge of API design patterns?"
              />
            </div>
            <div>
              <Label htmlFor="question-description">Description / Help Text</Label>
              <Textarea
                id="question-description"
                value={questionForm.description}
                onChange={(e) => setQuestionForm({ ...questionForm, description: e.target.value })}
                rows={2}
                placeholder="Additional context to help users understand what this question covers..."
              />
            </div>
            <div>
              <Label htmlFor="input-type">Input Type</Label>
              <Select
                value={questionForm.input_type}
                onValueChange={(value) => setQuestionForm({ ...questionForm, input_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="slider">
                    <span className="flex items-center gap-2">
                      <Sliders className="h-4 w-4" /> Slider (1-N scale)
                    </span>
                  </SelectItem>
                  <SelectItem value="single_choice">
                    <span className="flex items-center gap-2">
                      <List className="h-4 w-4" /> Single Choice
                    </span>
                  </SelectItem>
                  <SelectItem value="multi_choice">
                    <span className="flex items-center gap-2">
                      <CheckSquare className="h-4 w-4" /> Multiple Choice
                    </span>
                  </SelectItem>
                  <SelectItem value="text">
                    <span className="flex items-center gap-2">
                      <Type className="h-4 w-4" /> Free Text
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Question Type — only shown when assessment has types configured */}
            {assessmentQuestionTypes && assessmentQuestionTypes.length > 0 && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="question-type">Question Type</Label>
                  <Select
                    value={questionForm.question_type}
                    onValueChange={(value) =>
                      setQuestionForm({ ...questionForm, question_type: value === "__none__" ? "" : value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None (untyped)</SelectItem>
                      {assessmentQuestionTypes.map((t) => (
                        <SelectItem key={t.name} value={t.name}>
                          {t.name} ({t.weight}%)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="type-weight-override">Weight Override</Label>
                  <Input
                    id="type-weight-override"
                    type="number"
                    min="0"
                    max="100"
                    value={questionForm.type_weight}
                    onChange={(e) =>
                      setQuestionForm({ ...questionForm, type_weight: e.target.value })
                    }
                    placeholder="Equal (default)"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Leave blank for equal weighting within this type
                  </p>
                </div>
              </div>
            )}
            {(questionForm.input_type === "single_choice" ||
              questionForm.input_type === "multi_choice") && (
              <div className="space-y-2">
                <Label>Options</Label>
                <div className="flex gap-2">
                  <Input
                    value={newOptionLabel}
                    onChange={(e) => setNewOptionLabel(e.target.value)}
                    placeholder="Add option..."
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addOption();
                      }
                    }}
                  />
                  <Button type="button" variant="outline" onClick={addOption}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {questionForm.options.length > 0 && (
                  <div className="space-y-1">
                    {questionForm.options.map((opt, i) => (
                      <div key={i} className="flex items-center gap-2 p-2 bg-muted rounded">
                        <span className="flex-1 text-sm">{opt.label}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => removeOption(i)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Guided Learning Resources - only show when editing an existing question */}
            {editingQuestion && (
              <GuidedLearningLinksEditor
                entityType="question"
                entityId={editingQuestion.id}
                entityName={editingQuestion.question_text}
              />
            )}

            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setQuestionDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createQuestionMutation.isPending || updateQuestionMutation.isPending}
              >
                {(createQuestionMutation.isPending || updateQuestionMutation.isPending) && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                {editingQuestion ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
