import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { useToast } from '@/hooks/use-toast';
import { AdminPageHeader, AdminLoadingState, AdminEmptyState } from '@/components/admin';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { 
  Plus, ChevronDown, ChevronRight, Target, Flag, CheckSquare, 
  Pencil, Trash2, GripVertical, Clock, Map, Filter, AlertCircle
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useWheelCategories } from '@/hooks/useWheelCategories';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface SurveyQuestion {
  id: string;
  family_id: string;
  question_text: string;
  question_type: string;
  options: { value: string; label: string }[] | null;
  order_index: number;
}

interface TemplateCondition {
  id: string;
  template_id: string;
  question_id: string;
  operator: string;
  value: unknown;
  question?: SurveyQuestion;
}

interface TemplateTask {
  id: string;
  title: string;
  description: string | null;
  importance: boolean;
  urgency: boolean;
  order_index: number;
}

interface TemplateMilestone {
  id: string;
  title: string;
  description: string | null;
  order_index: number;
  recommended_days_min: number | null;
  recommended_days_max: number | null;
  guided_path_template_tasks: TemplateTask[];
}

interface TemplateGoal {
  id: string;
  title: string;
  description: string | null;
  category: string;
  timeframe_type: string;
  priority: string;
  order_index: number;
  guided_path_template_milestones: TemplateMilestone[];
}

interface Template {
  id: string;
  name: string;
  description: string | null;
  program_id: string | null;
  family_id: string | null;
  is_active: boolean;
  is_base_template: boolean;
  programs?: { name: string } | null;
  guided_path_template_families?: { name: string; id: string } | null;
  guided_path_template_goals: TemplateGoal[];
}

type ItemType = 'goal' | 'milestone' | 'task';

const CONDITION_OPERATORS = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Does not equal' },
  { value: 'in', label: 'Is one of' },
  { value: 'not_in', label: 'Is not one of' },
  { value: 'before', label: 'Is before (date)' },
  { value: 'after', label: 'Is after (date)' },
];

export default function GuidedPathTemplateDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: categories = [] } = useWheelCategories({ includeLegacy: false });

  const [expandedGoals, setExpandedGoals] = useState<Set<string>>(new Set());
  const [expandedMilestones, setExpandedMilestones] = useState<Set<string>>(new Set());

  // Dialog states
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [milestoneDialogOpen, setMilestoneDialogOpen] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const [editingGoal, setEditingGoal] = useState<TemplateGoal | null>(null);
  const [editingMilestone, setEditingMilestone] = useState<TemplateMilestone | null>(null);
  const [editingTask, setEditingTask] = useState<TemplateTask | null>(null);
  const [parentGoalId, setParentGoalId] = useState<string | null>(null);
  const [parentMilestoneId, setParentMilestoneId] = useState<string | null>(null);

  const [deletingItem, setDeletingItem] = useState<{ type: ItemType; id: string; name: string } | null>(null);

  // Condition editing states
  const [conditionDialogOpen, setConditionDialogOpen] = useState(false);
  const [editingCondition, setEditingCondition] = useState<TemplateCondition | null>(null);
  const [deletingCondition, setDeletingCondition] = useState<TemplateCondition | null>(null);
  const [conditionForm, setConditionForm] = useState({
    question_id: '',
    operator: 'equals',
    value: '' as string | string[],
  });

  // Form states
  const [goalForm, setGoalForm] = useState({
    title: '',
    description: '',
    category: '',
    timeframe_type: 'medium_term',
    priority: 'medium',
  });

  const [milestoneForm, setMilestoneForm] = useState({
    title: '',
    description: '',
    recommended_days_min: '',
    recommended_days_max: '',
  });

  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    importance: false,
    urgency: false,
  });

  const { data: template, isLoading } = useQuery({
    queryKey: ['guided-path-template', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('guided_path_templates')
        .select(`
          *,
          programs(name),
          guided_path_template_families(id, name),
          guided_path_template_goals(
            *,
            guided_path_template_milestones(
              *,
              guided_path_template_tasks(*)
            )
          )
        `)
        .eq('id', id!)
        .single();

      if (error) throw error;

      // Sort nested data by order_index
      const sorted = {
        ...data,
        guided_path_template_goals: (data.guided_path_template_goals || [])
          .sort((a: TemplateGoal, b: TemplateGoal) => a.order_index - b.order_index)
          .map((goal: TemplateGoal) => ({
            ...goal,
            guided_path_template_milestones: (goal.guided_path_template_milestones || [])
              .sort((a: TemplateMilestone, b: TemplateMilestone) => a.order_index - b.order_index)
              .map((milestone: TemplateMilestone) => ({
                ...milestone,
                guided_path_template_tasks: (milestone.guided_path_template_tasks || [])
                  .sort((a: TemplateTask, b: TemplateTask) => a.order_index - b.order_index),
              })),
          })),
      };

      return sorted as Template;
    },
    enabled: !!id,
  });

  // Fetch conditions for this template
  const { data: conditions = [] } = useQuery({
    queryKey: ['template-conditions', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('template_conditions')
        .select('*, question:family_survey_questions(*)')
        .eq('template_id', id!);
      if (error) throw error;
      return (data || []).map(c => ({
        ...c,
        question: c.question ? {
          ...c.question,
          options: c.question.options as { value: string; label: string }[] | null,
        } : undefined,
      })) as TemplateCondition[];
    },
    enabled: !!id,
  });

  // Fetch survey questions from the family (if template belongs to a family)
  const { data: surveyQuestions = [] } = useQuery({
    queryKey: ['family-survey-questions', template?.family_id],
    queryFn: async () => {
      if (!template?.family_id) return [];
      const { data, error } = await supabase
        .from('family_survey_questions')
        .select('*')
        .eq('family_id', template.family_id)
        .order('order_index');
      if (error) throw error;
      return (data || []).map(q => ({
        ...q,
        options: q.options as { value: string; label: string }[] | null,
      })) as SurveyQuestion[];
    },
    enabled: !!template?.family_id,
  });

  // Goal mutations
  const saveGoalMutation = useMutation({
    mutationFn: async (data: typeof goalForm) => {
      const goalsCount = template?.guided_path_template_goals?.length || 0;
      const payload = {
        template_id: id!,
        title: data.title,
        description: data.description || null,
        category: data.category,
        timeframe_type: data.timeframe_type,
        priority: data.priority,
        order_index: editingGoal ? editingGoal.order_index : goalsCount,
      };

      if (editingGoal) {
        const { error } = await supabase
          .from('guided_path_template_goals')
          .update(payload)
          .eq('id', editingGoal.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('guided_path_template_goals')
          .insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guided-path-template', id] });
      toast({ title: 'Success', description: `Goal ${editingGoal ? 'updated' : 'created'}` });
      setGoalDialogOpen(false);
      setEditingGoal(null);
      resetGoalForm();
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Milestone mutations
  const saveMilestoneMutation = useMutation({
    mutationFn: async (data: typeof milestoneForm) => {
      const goal = template?.guided_path_template_goals?.find(g => g.id === parentGoalId);
      const milestonesCount = goal?.guided_path_template_milestones?.length || 0;
      const payload = {
        template_goal_id: parentGoalId!,
        title: data.title,
        description: data.description || null,
        recommended_days_min: data.recommended_days_min ? parseInt(data.recommended_days_min) : null,
        recommended_days_max: data.recommended_days_max ? parseInt(data.recommended_days_max) : null,
        order_index: editingMilestone ? editingMilestone.order_index : milestonesCount,
      };

      if (editingMilestone) {
        const { error } = await supabase
          .from('guided_path_template_milestones')
          .update(payload)
          .eq('id', editingMilestone.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('guided_path_template_milestones')
          .insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guided-path-template', id] });
      toast({ title: 'Success', description: `Milestone ${editingMilestone ? 'updated' : 'created'}` });
      setMilestoneDialogOpen(false);
      setEditingMilestone(null);
      setParentGoalId(null);
      resetMilestoneForm();
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Task mutations
  const saveTaskMutation = useMutation({
    mutationFn: async (data: typeof taskForm) => {
      const goal = template?.guided_path_template_goals?.find(g =>
        g.guided_path_template_milestones?.some(m => m.id === parentMilestoneId)
      );
      const milestone = goal?.guided_path_template_milestones?.find(m => m.id === parentMilestoneId);
      const tasksCount = milestone?.guided_path_template_tasks?.length || 0;

      const payload = {
        template_milestone_id: parentMilestoneId!,
        title: data.title,
        description: data.description || null,
        importance: data.importance,
        urgency: data.urgency,
        order_index: editingTask ? editingTask.order_index : tasksCount,
      };

      if (editingTask) {
        const { error } = await supabase
          .from('guided_path_template_tasks')
          .update(payload)
          .eq('id', editingTask.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('guided_path_template_tasks')
          .insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guided-path-template', id] });
      toast({ title: 'Success', description: `Task ${editingTask ? 'updated' : 'created'}` });
      setTaskDialogOpen(false);
      setEditingTask(null);
      setParentMilestoneId(null);
      resetTaskForm();
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ type, id: itemId }: { type: ItemType; id: string }) => {
      const table = type === 'goal' ? 'guided_path_template_goals'
        : type === 'milestone' ? 'guided_path_template_milestones'
        : 'guided_path_template_tasks';

      const { error } = await supabase.from(table).delete().eq('id', itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guided-path-template', id] });
      toast({ title: 'Success', description: 'Item deleted' });
      setDeleteDialogOpen(false);
      setDeletingItem(null);
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Condition mutations
  const saveConditionMutation = useMutation({
    mutationFn: async (data: typeof conditionForm) => {
      // Parse value based on question type and operator
      let parsedValue: Json = data.value as Json;
      const question = surveyQuestions.find(q => q.id === data.question_id);
      
      if (question?.question_type === 'boolean') {
        parsedValue = data.value === 'true';
      } else if (['in', 'not_in'].includes(data.operator)) {
        // For array operators, ensure value is an array
        parsedValue = Array.isArray(data.value) ? data.value : [data.value];
      }

      const payload = {
        template_id: id!,
        question_id: data.question_id,
        operator: data.operator,
        value: parsedValue,
      };

      if (editingCondition) {
        const { error } = await supabase
          .from('template_conditions')
          .update(payload)
          .eq('id', editingCondition.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('template_conditions')
          .insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['template-conditions', id] });
      toast({ title: 'Success', description: `Condition ${editingCondition ? 'updated' : 'created'}` });
      setConditionDialogOpen(false);
      setEditingCondition(null);
      resetConditionForm();
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const deleteConditionMutation = useMutation({
    mutationFn: async (conditionId: string) => {
      const { error } = await supabase
        .from('template_conditions')
        .delete()
        .eq('id', conditionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['template-conditions', id] });
      toast({ title: 'Success', description: 'Condition deleted' });
      setDeletingCondition(null);
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const resetGoalForm = () => setGoalForm({ title: '', description: '', category: '', timeframe_type: 'medium_term', priority: 'medium' });
  const resetMilestoneForm = () => setMilestoneForm({ title: '', description: '', recommended_days_min: '', recommended_days_max: '' });
  const resetTaskForm = () => setTaskForm({ title: '', description: '', importance: false, urgency: false });
  const resetConditionForm = () => setConditionForm({ question_id: '', operator: 'equals', value: '' });

  const openAddCondition = () => {
    setEditingCondition(null);
    resetConditionForm();
    setConditionDialogOpen(true);
  };

  const openEditCondition = (condition: TemplateCondition) => {
    setEditingCondition(condition);
    setConditionForm({
      question_id: condition.question_id,
      operator: condition.operator,
      value: typeof condition.value === 'object' && Array.isArray(condition.value) 
        ? condition.value 
        : String(condition.value),
    });
    setConditionDialogOpen(true);
  };

  const getConditionValueDisplay = (condition: TemplateCondition) => {
    const question = condition.question;
    if (!question) return String(condition.value);

    if (question.question_type === 'boolean') {
      return condition.value === true ? 'Yes' : 'No';
    }

    if (Array.isArray(condition.value)) {
      const labels = condition.value.map(v => {
        const opt = question.options?.find(o => o.value === v);
        return opt?.label || v;
      });
      return labels.join(', ');
    }

    if (question.options) {
      const opt = question.options.find(o => o.value === condition.value);
      return opt?.label || String(condition.value);
    }

    return String(condition.value);
  };

  const toggleGoal = (goalId: string) => {
    const newSet = new Set(expandedGoals);
    if (newSet.has(goalId)) newSet.delete(goalId);
    else newSet.add(goalId);
    setExpandedGoals(newSet);
  };

  const toggleMilestone = (milestoneId: string) => {
    const newSet = new Set(expandedMilestones);
    if (newSet.has(milestoneId)) newSet.delete(milestoneId);
    else newSet.add(milestoneId);
    setExpandedMilestones(newSet);
  };

  const openAddGoal = () => {
    setEditingGoal(null);
    resetGoalForm();
    setGoalDialogOpen(true);
  };

  const openEditGoal = (goal: TemplateGoal) => {
    setEditingGoal(goal);
    setGoalForm({
      title: goal.title,
      description: goal.description || '',
      category: goal.category,
      timeframe_type: goal.timeframe_type,
      priority: goal.priority,
    });
    setGoalDialogOpen(true);
  };

  const openAddMilestone = (goalId: string) => {
    setParentGoalId(goalId);
    setEditingMilestone(null);
    resetMilestoneForm();
    setMilestoneDialogOpen(true);
  };

  const openEditMilestone = (milestone: TemplateMilestone, goalId: string) => {
    setParentGoalId(goalId);
    setEditingMilestone(milestone);
    setMilestoneForm({
      title: milestone.title,
      description: milestone.description || '',
      recommended_days_min: milestone.recommended_days_min?.toString() || '',
      recommended_days_max: milestone.recommended_days_max?.toString() || '',
    });
    setMilestoneDialogOpen(true);
  };

  const openAddTask = (milestoneId: string) => {
    setParentMilestoneId(milestoneId);
    setEditingTask(null);
    resetTaskForm();
    setTaskDialogOpen(true);
  };

  const openEditTask = (task: TemplateTask, milestoneId: string) => {
    setParentMilestoneId(milestoneId);
    setEditingTask(task);
    setTaskForm({
      title: task.title,
      description: task.description || '',
      importance: task.importance,
      urgency: task.urgency,
    });
    setTaskDialogOpen(true);
  };

  const formatTimeDistance = (min: number | null, max: number | null) => {
    if (!min && !max) return null;
    if (min && max) {
      if (min >= 30 && max >= 30) {
        const minMonths = Math.round(min / 30);
        const maxMonths = Math.round(max / 30);
        return `${minMonths}-${maxMonths} months`;
      }
      if (min >= 7 && max >= 7) {
        const minWeeks = Math.round(min / 7);
        const maxWeeks = Math.round(max / 7);
        return `${minWeeks}-${maxWeeks} weeks`;
      }
      return `${min}-${max} days`;
    }
    const days = min || max;
    if (days! >= 30) return `~${Math.round(days! / 30)} months`;
    if (days! >= 7) return `~${Math.round(days! / 7)} weeks`;
    return `~${days} days`;
  };

  if (isLoading) return <AdminLoadingState />;
  if (!template) return <AdminEmptyState icon={Map} title="Template Not Found" description="The requested template could not be found" />;

  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/admin">Admin</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/admin/guided-path-templates">Guided Path Templates</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{template.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <AdminPageHeader
        title={template.name}
        description={template.description || 'No description'}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant={template.is_active ? 'default' : 'secondary'}>
              {template.is_active ? 'Active' : 'Inactive'}
            </Badge>
            {template.programs?.name && (
              <Badge variant="outline">{template.programs.name}</Badge>
            )}
          </div>
        }
      />

      {/* Conditions Section - Only show for non-base templates that belong to a family */}
      {template.family_id && !template.is_base_template && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Conditions
              </CardTitle>
              <CardDescription>
                Define when this template block should be included based on survey responses
              </CardDescription>
            </div>
            <Button onClick={openAddCondition} size="sm" disabled={surveyQuestions.length === 0}>
              <Plus className="h-4 w-4 mr-1" />
              Add Condition
            </Button>
          </CardHeader>
          <CardContent>
            {surveyQuestions.length === 0 ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No survey questions defined for this family. Add questions in the{' '}
                  <a 
                    href={`/admin/guided-path-families/${template.family_id}`}
                    className="text-primary hover:underline"
                  >
                    family configuration
                  </a>{' '}
                  first.
                </AlertDescription>
              </Alert>
            ) : conditions.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No conditions set.</p>
                <p className="text-sm">This template block won't be included unless you add conditions.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {conditions.map((condition) => (
                  <div key={condition.id} className="flex items-center justify-between p-3 border rounded-lg bg-muted/20">
                    <div className="flex-1">
                      <p className="font-medium text-sm">
                        {condition.question?.question_text || 'Unknown question'}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-xs">
                          {CONDITION_OPERATORS.find(o => o.value === condition.operator)?.label || condition.operator}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {getConditionValueDisplay(condition)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditCondition(condition)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeletingCondition(condition)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {template.is_base_template && template.family_id && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            This is a <strong>base template</strong> and will always be included regardless of survey answers. 
            Base templates don't use conditions.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Goals
            </CardTitle>
            <CardDescription>
              Define the goals that clients will work towards
            </CardDescription>
          </div>
          <Button onClick={openAddGoal} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Add Goal
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {template.guided_path_template_goals.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No goals yet. Add your first goal to get started.
            </div>
          ) : (
            template.guided_path_template_goals.map((goal) => (
              <Collapsible
                key={goal.id}
                open={expandedGoals.has(goal.id)}
                onOpenChange={() => toggleGoal(goal.id)}
              >
                <div className="border rounded-lg">
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50">
                      <div className="flex items-center gap-3">
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                        {expandedGoals.has(goal.id) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        <Target className="h-4 w-4 text-primary" />
                        <div>
                          <div className="font-medium">{goal.title}</div>
                          <div className="text-sm text-muted-foreground">
                            {goal.category} • {goal.timeframe_type.replace('_', ' ')} • {goal.priority} priority
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge variant="outline">
                          {goal.guided_path_template_milestones.length} milestones
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => { e.stopPropagation(); openEditGoal(goal); }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => { e.stopPropagation(); setDeletingItem({ type: 'goal', id: goal.id, name: goal.title }); setDeleteDialogOpen(true); }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="border-t px-4 py-3 bg-muted/30 space-y-3">
                      {goal.description && (
                        <p className="text-sm text-muted-foreground">{goal.description}</p>
                      )}
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium flex items-center gap-2">
                          <Flag className="h-4 w-4" />
                          Milestones
                        </h4>
                        <Button size="sm" variant="outline" onClick={() => openAddMilestone(goal.id)}>
                          <Plus className="h-3 w-3 mr-1" />
                          Add Milestone
                        </Button>
                      </div>

                      {goal.guided_path_template_milestones.length === 0 ? (
                        <p className="text-sm text-muted-foreground italic">No milestones yet</p>
                      ) : (
                        <div className="space-y-2 ml-4">
                          {goal.guided_path_template_milestones.map((milestone, mIdx) => (
                            <Collapsible
                              key={milestone.id}
                              open={expandedMilestones.has(milestone.id)}
                              onOpenChange={() => toggleMilestone(milestone.id)}
                            >
                              <div className="border rounded-lg bg-background">
                                <CollapsibleTrigger asChild>
                                  <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50">
                                    <div className="flex items-center gap-3">
                                      <GripVertical className="h-3 w-3 text-muted-foreground" />
                                      {expandedMilestones.has(milestone.id) ? (
                                        <ChevronDown className="h-3 w-3" />
                                      ) : (
                                        <ChevronRight className="h-3 w-3" />
                                      )}
                                      <Flag className="h-4 w-4 text-amber-500" />
                                      <div>
                                        <div className="font-medium text-sm">{milestone.title}</div>
                                        {(milestone.recommended_days_min || milestone.recommended_days_max) && (
                                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                                            <Clock className="h-3 w-3" />
                                            {mIdx > 0 ? 'After previous: ' : 'Start: '}
                                            {formatTimeDistance(milestone.recommended_days_min, milestone.recommended_days_max)}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Badge variant="outline" className="text-xs">
                                        {milestone.guided_path_template_tasks.length} tasks
                                      </Badge>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={(e) => { e.stopPropagation(); openEditMilestone(milestone, goal.id); }}
                                      >
                                        <Pencil className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={(e) => { e.stopPropagation(); setDeletingItem({ type: 'milestone', id: milestone.id, name: milestone.title }); setDeleteDialogOpen(true); }}
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </div>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                  <div className="border-t px-3 py-2 bg-muted/20 space-y-2">
                                    {milestone.description && (
                                      <p className="text-xs text-muted-foreground">{milestone.description}</p>
                                    )}
                                    <div className="flex items-center justify-between">
                                      <h5 className="text-xs font-medium flex items-center gap-1">
                                        <CheckSquare className="h-3 w-3" />
                                        Tasks
                                      </h5>
                                      <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => openAddTask(milestone.id)}>
                                        <Plus className="h-3 w-3 mr-1" />
                                        Add Task
                                      </Button>
                                    </div>
                                    {milestone.guided_path_template_tasks.length === 0 ? (
                                      <p className="text-xs text-muted-foreground italic">No tasks yet</p>
                                    ) : (
                                      <div className="space-y-1 ml-4">
                                        {milestone.guided_path_template_tasks.map((task) => (
                                          <div key={task.id} className="flex items-center justify-between p-2 border rounded bg-background">
                                            <div className="flex items-center gap-2">
                                              <GripVertical className="h-3 w-3 text-muted-foreground" />
                                              <CheckSquare className="h-3 w-3 text-blue-500" />
                                              <span className="text-sm">{task.title}</span>
                                              {(task.importance || task.urgency) && (
                                                <div className="flex gap-1">
                                                  {task.importance && <Badge variant="secondary" className="text-xs">Important</Badge>}
                                                  {task.urgency && <Badge variant="secondary" className="text-xs">Urgent</Badge>}
                                                </div>
                                              )}
                                            </div>
                                            <div className="flex items-center gap-1">
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6"
                                                onClick={() => openEditTask(task, milestone.id)}
                                              >
                                                <Pencil className="h-3 w-3" />
                                              </Button>
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6"
                                                onClick={() => { setDeletingItem({ type: 'task', id: task.id, name: task.title }); setDeleteDialogOpen(true); }}
                                              >
                                                <Trash2 className="h-3 w-3" />
                                              </Button>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </CollapsibleContent>
                              </div>
                            </Collapsible>
                          ))}
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            ))
          )}
        </CardContent>
      </Card>

      {/* Goal Dialog */}
      <Dialog open={goalDialogOpen} onOpenChange={setGoalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingGoal ? 'Edit Goal' : 'Add Goal'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); saveGoalMutation.mutate(goalForm); }} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="goal-title">Title *</Label>
              <Input
                id="goal-title"
                value={goalForm.title}
                onChange={(e) => setGoalForm({ ...goalForm, title: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="goal-description">Description</Label>
              <Textarea
                id="goal-description"
                value={goalForm.description}
                onChange={(e) => setGoalForm({ ...goalForm, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category *</Label>
                <Select value={goalForm.category} onValueChange={(v) => setGoalForm({ ...goalForm, category: v })} required>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Timeframe</Label>
                <Select value={goalForm.timeframe_type} onValueChange={(v) => setGoalForm({ ...goalForm, timeframe_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="short_term">Short Term</SelectItem>
                    <SelectItem value="medium_term">Medium Term</SelectItem>
                    <SelectItem value="long_term">Long Term</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={goalForm.priority} onValueChange={(v) => setGoalForm({ ...goalForm, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setGoalDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saveGoalMutation.isPending}>
                {saveGoalMutation.isPending ? 'Saving...' : editingGoal ? 'Update' : 'Add'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Milestone Dialog */}
      <Dialog open={milestoneDialogOpen} onOpenChange={setMilestoneDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingMilestone ? 'Edit Milestone' : 'Add Milestone'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); saveMilestoneMutation.mutate(milestoneForm); }} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="milestone-title">Title *</Label>
              <Input
                id="milestone-title"
                value={milestoneForm.title}
                onChange={(e) => setMilestoneForm({ ...milestoneForm, title: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="milestone-description">Description</Label>
              <Textarea
                id="milestone-description"
                value={milestoneForm.description}
                onChange={(e) => setMilestoneForm({ ...milestoneForm, description: e.target.value })}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Recommended Time from Previous Milestone</Label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="days-min" className="text-xs text-muted-foreground">Minimum (days)</Label>
                  <Input
                    id="days-min"
                    type="number"
                    min="0"
                    value={milestoneForm.recommended_days_min}
                    onChange={(e) => setMilestoneForm({ ...milestoneForm, recommended_days_min: e.target.value })}
                    placeholder="e.g., 14"
                  />
                </div>
                <div>
                  <Label htmlFor="days-max" className="text-xs text-muted-foreground">Maximum (days)</Label>
                  <Input
                    id="days-max"
                    type="number"
                    min="0"
                    value={milestoneForm.recommended_days_max}
                    onChange={(e) => setMilestoneForm({ ...milestoneForm, recommended_days_max: e.target.value })}
                    placeholder="e.g., 28"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Leave blank if no specific timing recommendation
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setMilestoneDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saveMilestoneMutation.isPending}>
                {saveMilestoneMutation.isPending ? 'Saving...' : editingMilestone ? 'Update' : 'Add'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Task Dialog */}
      <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTask ? 'Edit Task' : 'Add Task'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); saveTaskMutation.mutate(taskForm); }} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="task-title">Title *</Label>
              <Input
                id="task-title"
                value={taskForm.title}
                onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-description">Description</Label>
              <Textarea
                id="task-description"
                value={taskForm.description}
                onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <Label htmlFor="task-importance" className="text-sm">Important</Label>
                <Switch
                  id="task-importance"
                  checked={taskForm.importance}
                  onCheckedChange={(checked) => setTaskForm({ ...taskForm, importance: checked })}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <Label htmlFor="task-urgency" className="text-sm">Urgent</Label>
                <Switch
                  id="task-urgency"
                  checked={taskForm.urgency}
                  onCheckedChange={(checked) => setTaskForm({ ...taskForm, urgency: checked })}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setTaskDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saveTaskMutation.isPending}>
                {saveTaskMutation.isPending ? 'Saving...' : editingTask ? 'Update' : 'Add'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Condition Dialog */}
      <Dialog open={conditionDialogOpen} onOpenChange={setConditionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCondition ? 'Edit Condition' : 'Add Condition'}</DialogTitle>
            <DialogDescription>
              Define when this template block should be included
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); saveConditionMutation.mutate(conditionForm); }} className="space-y-4">
            <div className="space-y-2">
              <Label>Survey Question *</Label>
              <Select
                value={conditionForm.question_id}
                onValueChange={(v) => {
                  setConditionForm({ ...conditionForm, question_id: v, value: '' });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a question" />
                </SelectTrigger>
                <SelectContent>
                  {surveyQuestions.map((q) => (
                    <SelectItem key={q.id} value={q.id}>
                      {q.question_text}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Operator *</Label>
              <Select
                value={conditionForm.operator}
                onValueChange={(v) => setConditionForm({ ...conditionForm, operator: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONDITION_OPERATORS.map((op) => (
                    <SelectItem key={op.value} value={op.value}>
                      {op.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {conditionForm.question_id && (() => {
              const selectedQuestion = surveyQuestions.find(q => q.id === conditionForm.question_id);
              if (!selectedQuestion) return null;

              if (selectedQuestion.question_type === 'boolean') {
                return (
                  <div className="space-y-2">
                    <Label>Expected Answer *</Label>
                    <Select
                      value={String(conditionForm.value)}
                      onValueChange={(v) => setConditionForm({ ...conditionForm, value: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select answer" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Yes</SelectItem>
                        <SelectItem value="false">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                );
              }

              if (selectedQuestion.options && selectedQuestion.options.length > 0) {
                return (
                  <div className="space-y-2">
                    <Label>Expected Value(s) *</Label>
                    {['in', 'not_in'].includes(conditionForm.operator) ? (
                      <div className="space-y-2">
                        {selectedQuestion.options.map((opt) => {
                          const values = Array.isArray(conditionForm.value) ? conditionForm.value : [];
                          const isChecked = values.includes(opt.value);
                          return (
                            <div key={opt.value} className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                id={`opt-${opt.value}`}
                                checked={isChecked}
                                onChange={(e) => {
                                  const newValues = e.target.checked
                                    ? [...values, opt.value]
                                    : values.filter(v => v !== opt.value);
                                  setConditionForm({ ...conditionForm, value: newValues });
                                }}
                                className="h-4 w-4 rounded border-input"
                              />
                              <Label htmlFor={`opt-${opt.value}`} className="font-normal">
                                {opt.label}
                              </Label>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <Select
                        value={String(conditionForm.value)}
                        onValueChange={(v) => setConditionForm({ ...conditionForm, value: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select value" />
                        </SelectTrigger>
                        <SelectContent>
                          {selectedQuestion.options.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                );
              }

              // Date or other text-based input
              return (
                <div className="space-y-2">
                  <Label htmlFor="condition-value">Value *</Label>
                  <Input
                    id="condition-value"
                    type={selectedQuestion.question_type === 'date' ? 'date' : 'text'}
                    value={String(conditionForm.value)}
                    onChange={(e) => setConditionForm({ ...conditionForm, value: e.target.value })}
                    required
                  />
                </div>
              );
            })()}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setConditionDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={saveConditionMutation.isPending || !conditionForm.question_id || !conditionForm.value}
              >
                {saveConditionMutation.isPending ? 'Saving...' : editingCondition ? 'Update' : 'Add'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Condition Dialog */}
      <AlertDialog open={!!deletingCondition} onOpenChange={() => setDeletingCondition(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Condition</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this condition? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingCondition && deleteConditionMutation.mutate(deletingCondition.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteConditionMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Item Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deletingItem?.type}</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingItem?.name}"? 
              {deletingItem?.type === 'goal' && ' This will also delete all milestones and tasks within it.'}
              {deletingItem?.type === 'milestone' && ' This will also delete all tasks within it.'}
              {' '}This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingItem && deleteMutation.mutate({ type: deletingItem.type, id: deletingItem.id })}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
