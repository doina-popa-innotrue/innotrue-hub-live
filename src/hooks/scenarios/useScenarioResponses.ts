import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import type {
  ParagraphResponse,
  ParagraphEvaluation,
  ParagraphQuestionScore,
  DomainScoreAggregate,
  ScenarioScoreSummary,
} from '@/types/scenarios';

// ============================================================================
// Response Hooks
// ============================================================================

export function useParagraphResponses(assignmentId: string | undefined) {
  return useQuery({
    queryKey: ['paragraph-responses', assignmentId],
    queryFn: async () => {
      if (!assignmentId) return [];
      const { data, error } = await supabase
        .from('paragraph_responses')
        .select('*')
        .eq('assignment_id', assignmentId);

      if (error) throw error;
      return data as ParagraphResponse[];
    },
    enabled: !!assignmentId,
  });
}

export function useParagraphResponseMutations(assignmentId: string) {
  const queryClient = useQueryClient();

  const upsertMutation = useMutation({
    mutationFn: async ({ paragraphId, responseText }: { paragraphId: string; responseText: string }) => {
      const { error } = await supabase
        .from('paragraph_responses')
        .upsert({
          assignment_id: assignmentId,
          paragraph_id: paragraphId,
          response_text: responseText,
        }, {
          onConflict: 'assignment_id,paragraph_id',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paragraph-responses', assignmentId] });
    },
  });

  return { upsertMutation };
}

// ============================================================================
// Evaluation Hooks
// ============================================================================

export function useParagraphEvaluations(assignmentId: string | undefined) {
  return useQuery({
    queryKey: ['paragraph-evaluations', assignmentId],
    queryFn: async () => {
      if (!assignmentId) return [];
      const { data, error } = await supabase
        .from('paragraph_evaluations')
        .select('*')
        .eq('assignment_id', assignmentId);

      if (error) throw error;
      return data as ParagraphEvaluation[];
    },
    enabled: !!assignmentId,
  });
}

export function useParagraphEvaluationMutations(assignmentId: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const upsertMutation = useMutation({
    mutationFn: async ({ paragraphId, feedback }: { paragraphId: string; feedback: string }) => {
      const { error } = await supabase
        .from('paragraph_evaluations')
        .upsert({
          assignment_id: assignmentId,
          paragraph_id: paragraphId,
          feedback,
          evaluator_id: user?.id,
        }, {
          onConflict: 'assignment_id,paragraph_id',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paragraph-evaluations', assignmentId] });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return { upsertMutation };
}

// ============================================================================
// Scoring Hooks
// ============================================================================

export function useParagraphQuestionScores(assignmentId: string | undefined) {
  return useQuery({
    queryKey: ['paragraph-question-scores', assignmentId],
    queryFn: async () => {
      if (!assignmentId) return [];
      const { data, error } = await supabase
        .from('paragraph_question_scores')
        .select(`
          *,
          capability_domain_questions(
            id,
            question_text,
            domain_id,
            capability_domains(id, name)
          )
        `)
        .eq('assignment_id', assignmentId);

      if (error) throw error;
      return data as ParagraphQuestionScore[];
    },
    enabled: !!assignmentId,
  });
}

export function useParagraphQuestionScoreMutations(assignmentId: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const upsertMutation = useMutation({
    mutationFn: async ({ paragraphId, questionId, score }: { paragraphId: string; questionId: string; score: number }) => {
      const { error } = await supabase
        .from('paragraph_question_scores')
        .upsert({
          assignment_id: assignmentId,
          paragraph_id: paragraphId,
          question_id: questionId,
          score,
          evaluator_id: user?.id,
        }, {
          onConflict: 'assignment_id,paragraph_id,question_id',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paragraph-question-scores', assignmentId] });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return { upsertMutation };
}

// ============================================================================
// Score Calculation Hook
// ============================================================================

export function useScenarioScoreSummary(assignmentId: string | undefined, ratingScale: number = 5) {
  const { data: scores } = useParagraphQuestionScores(assignmentId);

  if (!scores || scores.length === 0) {
    return null;
  }

  // Group scores by domain
  const domainScores = new Map<string, { name: string; scores: number[]; maxScore: number }>();

  for (const score of scores) {
    const domainId = score.capability_domain_questions?.domain_id;
    const domainName = score.capability_domain_questions?.capability_domains?.name;
    
    if (!domainId || !domainName) continue;

    if (!domainScores.has(domainId)) {
      domainScores.set(domainId, { name: domainName, scores: [], maxScore: ratingScale });
    }
    domainScores.get(domainId)!.scores.push(score.score);
  }

  const domainAggregates: DomainScoreAggregate[] = [];
  let totalScore = 0;
  let totalMaxScore = 0;

  for (const [domainId, data] of domainScores) {
    const sum = data.scores.reduce((a, b) => a + b, 0);
    const max = data.scores.length * data.maxScore;
    const percentage = max > 0 ? (sum / max) * 100 : 0;

    domainAggregates.push({
      domain_id: domainId,
      domain_name: data.name,
      total_score: sum,
      max_possible_score: max,
      percentage,
      question_count: data.scores.length,
    });

    totalScore += sum;
    totalMaxScore += max;
  }

  const summary: ScenarioScoreSummary = {
    assignment_id: assignmentId!,
    overall_percentage: totalMaxScore > 0 ? (totalScore / totalMaxScore) * 100 : 0,
    domain_scores: domainAggregates.sort((a, b) => a.domain_name.localeCompare(b.domain_name)),
    total_paragraphs: 0, // Would need additional query
    paragraphs_evaluated: 0, // Would need additional query
  };

  return summary;
}
