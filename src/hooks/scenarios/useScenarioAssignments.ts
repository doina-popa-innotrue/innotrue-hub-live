import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import type { ScenarioAssignment } from '@/types/scenarios';

// ============================================================================
// Assignment Hooks
// ============================================================================

export function useScenarioAssignments(filters?: { userId?: string; templateId?: string; status?: string }) {
  return useQuery({
    queryKey: ['scenario-assignments', filters],
    queryFn: async () => {
      let query = supabase
        .from('scenario_assignments')
        .select(`
          *,
          scenario_templates(*),
          program_modules(id, title),
          client_enrollments(
            id,
            program_id,
            programs(id, name)
          )
        `)
        .order('created_at', { ascending: false });

      if (filters?.userId) {
        query = query.eq('user_id', filters.userId);
      }
      if (filters?.templateId) {
        query = query.eq('template_id', filters.templateId);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch profiles separately to avoid complex join issues
      const userIds = [...new Set(data?.map(a => a.user_id) || [])];
      const assignedByIds = [...new Set(data?.filter(a => a.assigned_by).map(a => a.assigned_by!) || [])];
      const evaluatedByIds = [...new Set(data?.filter(a => a.evaluated_by).map(a => a.evaluated_by!) || [])];
      
      const allProfileIds = [...new Set([...userIds, ...assignedByIds, ...evaluatedByIds])];
      
      let profileMap = new Map<string, { id: string; name: string }>();
      if (allProfileIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', allProfileIds);

        profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      }

      return (data || []).map(assignment => ({
        ...assignment,
        profiles: profileMap.get(assignment.user_id) || null,
        assigned_by_profile: assignment.assigned_by ? profileMap.get(assignment.assigned_by) || null : null,
        evaluated_by_profile: assignment.evaluated_by ? profileMap.get(assignment.evaluated_by) || null : null,
      })) as unknown as ScenarioAssignment[];
    },
  });
}

export function useScenarioAssignment(id: string | undefined) {
  return useQuery({
    queryKey: ['scenario-assignment', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('scenario_assignments')
        .select(`
          *,
          scenario_templates(
            *,
            capability_assessments(id, name, slug, rating_scale)
          ),
          program_modules(id, title),
          client_enrollments(
            id,
            program_id,
            programs(id, name)
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as ScenarioAssignment;
    },
    enabled: !!id,
  });
}

export interface CreateAssignmentData {
  template_id: string;
  user_id: string;
  enrollment_id?: string;
  module_id?: string;
}

export interface BulkAssignmentData {
  template_id: string;
  user_ids: string[];
  enrollment_ids?: string[];
  module_id?: string;
}

export function useScenarioAssignmentMutations() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const createMutation = useMutation({
    mutationFn: async (data: CreateAssignmentData) => {
      const { data: result, error } = await supabase
        .from('scenario_assignments')
        .insert({
          template_id: data.template_id,
          user_id: data.user_id,
          assigned_by: user?.id,
          enrollment_id: data.enrollment_id || null,
          module_id: data.module_id || null,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scenario-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['module-scenarios'] });
      toast({ description: 'Scenario assigned' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const bulkCreateMutation = useMutation({
    mutationFn: async (data: BulkAssignmentData) => {
      const assignments = data.user_ids.map((userId, index) => ({
        template_id: data.template_id,
        user_id: userId,
        assigned_by: user?.id,
        enrollment_id: data.enrollment_ids?.[index] || null,
        module_id: data.module_id || null,
      }));

      const { data: result, error } = await supabase
        .from('scenario_assignments')
        .insert(assignments)
        .select();

      if (error) throw error;
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['scenario-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['module-scenarios'] });
      toast({ description: `Scenario assigned to ${data.length} clients` });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes?: string }) => {
      const updateData: Record<string, unknown> = { status };
      
      if (status === 'submitted') {
        updateData.submitted_at = new Date().toISOString();
      } else if (status === 'evaluated') {
        updateData.evaluated_at = new Date().toISOString();
        updateData.evaluated_by = user?.id;
      }
      
      if (notes !== undefined) {
        updateData.overall_notes = notes;
      }

      const { error } = await supabase
        .from('scenario_assignments')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scenario-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['scenario-assignment'] });
      toast({ description: 'Assignment updated' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('scenario_assignments')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scenario-assignments'] });
      toast({ description: 'Assignment deleted' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return { createMutation, bulkCreateMutation, updateStatusMutation, deleteMutation };
}
