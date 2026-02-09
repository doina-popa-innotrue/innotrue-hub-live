import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import type { ModuleScenario } from '@/types/scenarios';

// ============================================================================
// Module-Scenario Linking Hooks
// ============================================================================

export function useModuleScenarios(moduleId: string | undefined) {
  return useQuery({
    queryKey: ['module-scenarios', moduleId],
    queryFn: async () => {
      if (!moduleId) return [];
      const { data, error } = await supabase
        .from('module_scenarios')
        .select(`
          *,
          scenario_templates(
            id, title, description, is_active, is_protected,
            capability_assessments(id, name, slug)
          )
        `)
        .eq('module_id', moduleId)
        .order('order_index');

      if (error) throw error;
      return data as ModuleScenario[];
    },
    enabled: !!moduleId,
  });
}

export function useScenariosForModule(moduleId: string | undefined) {
  // Get scenarios linked to a module (for client view)
  return useModuleScenarios(moduleId);
}

export interface ModuleScenarioMutationData {
  module_id: string;
  template_id: string;
  is_required_for_certification?: boolean;
  notes?: string;
}

export function useModuleScenarioMutations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const addMutation = useMutation({
    mutationFn: async (data: ModuleScenarioMutationData) => {
      const { data: result, error } = await supabase
        .from('module_scenarios')
        .insert({
          module_id: data.module_id,
          template_id: data.template_id,
          is_required_for_certification: data.is_required_for_certification ?? false,
          notes: data.notes,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['module-scenarios', variables.module_id] });
      toast({ description: 'Scenario linked to module' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to link scenario',
        variant: 'destructive',
      });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async ({ id, moduleId }: { id: string; moduleId: string }) => {
      const { error } = await supabase
        .from('module_scenarios')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { moduleId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['module-scenarios', result.moduleId] });
      toast({ description: 'Scenario unlinked from module' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to unlink scenario',
        variant: 'destructive',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, moduleId, ...updates }: { id: string; moduleId: string; is_required_for_certification?: boolean; notes?: string; order_index?: number }) => {
      const { error } = await supabase
        .from('module_scenarios')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      return { moduleId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['module-scenarios', result.moduleId] });
      toast({ description: 'Scenario settings updated' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update scenario',
        variant: 'destructive',
      });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async ({ moduleId, orderedIds }: { moduleId: string; orderedIds: string[] }) => {
      // Update order_index for each scenario
      const updates = orderedIds.map((id, index) => 
        supabase
          .from('module_scenarios')
          .update({ order_index: index })
          .eq('id', id)
      );

      const results = await Promise.all(updates);
      const errors = results.filter(r => r.error);
      if (errors.length > 0) {
        throw new Error(errors[0].error?.message || 'Failed to reorder scenarios');
      }

      return { moduleId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['module-scenarios', result.moduleId] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to reorder scenarios',
        variant: 'destructive',
      });
    },
  });

  return {
    addMutation,
    removeMutation,
    updateMutation,
    reorderMutation,
  };
}
