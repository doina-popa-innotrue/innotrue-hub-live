import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type OrderDirection = 'asc' | 'desc';

interface UseAdminCRUDOptions<T> {
  /** The Supabase table name */
  tableName: string;
  /** Query key for React Query caching */
  queryKey: string;
  /** Column to order by (default: 'name') */
  orderBy?: keyof T | string;
  /** Order direction (default: 'asc') */
  orderDirection?: OrderDirection;
  /** Select statement (default: '*') */
  select?: string;
  /** Entity name for toast messages (default: 'Item') */
  entityName?: string;
  /** Additional filters to apply */
  filters?: Array<{ column: string; operator: string; value: any }>;
  /** Transform data after fetch */
  transform?: (data: any[]) => T[];
}

interface UseAdminCRUDResult<T, TFormData> {
  // Data
  data: T[] | undefined;
  isLoading: boolean;
  error: Error | null;
  
  // Dialog state
  isDialogOpen: boolean;
  setIsDialogOpen: (open: boolean) => void;
  editingItem: T | null;
  
  // Form state
  formData: TFormData;
  setFormData: React.Dispatch<React.SetStateAction<TFormData>>;
  resetForm: () => void;
  
  // Convenience methods
  openCreate: () => void;
  openEdit: (item: T) => void;
  
  // Actions
  handleEdit: (item: T) => void;
  /** Submit handler - can pass event or form data directly */
  handleSubmit: (eventOrData: React.FormEvent | TFormData) => void;
  handleDelete: (id: string, confirmMessage?: string) => void;
  
  // Mutation states
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
  isMutating: boolean;
  /** Alias for isMutating */
  isSubmitting: boolean;
  
  // Utilities
  refetch: () => void;
}

/**
 * Generic hook for Admin CRUD operations.
 * Provides standardized data fetching, mutations, dialog state, and form handling.
 * 
 * @example
 * ```tsx
 * const {
 *   data: families,
 *   isLoading,
 *   isDialogOpen,
 *   setIsDialogOpen,
 *   formData,
 *   setFormData,
 *   handleEdit,
 *   handleSubmit,
 *   handleDelete,
 *   isMutating,
 * } = useAdminCRUD<AssessmentFamily, FormData>({
 *   tableName: 'assessment_families',
 *   queryKey: 'admin-assessment-families',
 *   entityName: 'Assessment family',
 *   initialFormData: { name: '', slug: '', is_active: true },
 *   mapItemToForm: (item) => ({ name: item.name, slug: item.slug, is_active: item.is_active }),
 * });
 * ```
 */
export function useAdminCRUD<T extends { id: string }, TFormData extends Record<string, any>>(
  options: UseAdminCRUDOptions<T> & {
    /** Initial form data for create mode */
    initialFormData: TFormData;
    /** Map an item to form data for edit mode */
    mapItemToForm: (item: T) => TFormData;
  }
): UseAdminCRUDResult<T, TFormData> {
  const {
    tableName,
    queryKey,
    orderBy = 'name',
    orderDirection = 'asc',
    select = '*',
    entityName = 'Item',
    filters = [],
    transform,
    initialFormData,
    mapItemToForm,
  } = options;

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<T | null>(null);
  
  // Form state
  const [formData, setFormData] = useState<TFormData>(initialFormData);

  // Query
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [queryKey],
    queryFn: async () => {
      let query = supabase
        .from(tableName as any)
        .select(select)
        .order(orderBy as string, { ascending: orderDirection === 'asc' });

      // Apply filters
      for (const filter of filters) {
        query = query.filter(filter.column, filter.operator, filter.value);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      return transform ? transform(data as any[]) : (data as unknown as T[]);
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: TFormData) => {
      const { error } = await supabase
        .from(tableName as any)
        .insert([data as any]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      toast({ description: `${entityName} created successfully` });
      handleCloseDialog();
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: TFormData }) => {
      const { error } = await supabase
        .from(tableName as any)
        .update(data as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      toast({ description: `${entityName} updated successfully` });
      handleCloseDialog();
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from(tableName as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      toast({ description: `${entityName} deleted successfully` });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Handlers
  const resetForm = useCallback(() => {
    setFormData(initialFormData);
    setEditingItem(null);
  }, [initialFormData]);

  const handleCloseDialog = useCallback(() => {
    setIsDialogOpen(false);
    resetForm();
  }, [resetForm]);

  const handleEdit = useCallback((item: T) => {
    setEditingItem(item);
    setFormData(mapItemToForm(item));
    setIsDialogOpen(true);
  }, [mapItemToForm]);

  const openCreate = useCallback(() => {
    resetForm();
    setIsDialogOpen(true);
  }, [resetForm]);

  const openEdit = useCallback((item: T) => {
    handleEdit(item);
  }, [handleEdit]);

  const handleSubmit = useCallback((eventOrData: React.FormEvent | TFormData) => {
    // If it's a form event, prevent default
    if (eventOrData && typeof eventOrData === 'object' && 'preventDefault' in eventOrData) {
      eventOrData.preventDefault();
      if (editingItem) {
        updateMutation.mutate({ id: editingItem.id, data: formData });
      } else {
        createMutation.mutate(formData);
      }
    } else {
      // Direct form data passed
      if (editingItem) {
        updateMutation.mutate({ id: editingItem.id, data: eventOrData as TFormData });
      } else {
        createMutation.mutate(eventOrData as TFormData);
      }
    }
  }, [editingItem, formData, createMutation, updateMutation]);

  const handleDelete = useCallback((id: string, confirmMessage?: string) => {
    const message = confirmMessage || `Delete this ${entityName.toLowerCase()}?`;
    if (confirm(message)) {
      deleteMutation.mutate(id);
    }
  }, [entityName, deleteMutation]);

  // Custom setIsDialogOpen that resets form appropriately
  const setDialogOpen = useCallback((open: boolean) => {
    if (open && !editingItem) {
      // Opening for create mode - reset form
      resetForm();
    } else if (!open) {
      // Closing - reset form
      resetForm();
    }
    setIsDialogOpen(open);
  }, [resetForm, editingItem]);

  const isMutating = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  return {
    data,
    isLoading,
    error: error as Error | null,
    
    isDialogOpen,
    setIsDialogOpen: setDialogOpen,
    editingItem,
    
    formData,
    setFormData,
    resetForm,
    
    openCreate,
    openEdit,
    handleEdit,
    handleSubmit,
    handleDelete,
    
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isMutating,
    isSubmitting: isMutating,
    
    refetch,
  };
}

/**
 * Hook for additional count queries (e.g., count of related items)
 */
export function useAdminCount(
  tableName: string,
  queryKey: string,
  groupByColumn: string,
  filterColumn?: string,
  filterValue?: any
) {
  return useQuery({
    queryKey: [queryKey],
    queryFn: async () => {
      let query = supabase
        .from(tableName as any)
        .select(groupByColumn);

      if (filterColumn && filterValue !== undefined) {
        query = query.not(filterColumn, 'is', null);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Count manually
      const counts: Record<string, number> = {};
      ((data as any[]) || []).forEach((item: any) => {
        const key = item[groupByColumn];
        if (key) {
          counts[key] = (counts[key] || 0) + 1;
        }
      });

      return counts;
    },
  });
}

/**
 * Hook for toggle mutations (e.g., toggle active status)
 */
export function useAdminToggle(
  tableName: string,
  queryKey: string,
  entityName = 'Item'
) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, column, value }: { id: string; column: string; value: boolean }) => {
      const { error } = await supabase
        .from(tableName as any)
        .update({ [column]: value } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      toast({ description: `${entityName} ${variables.value ? 'activated' : 'deactivated'}` });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });
}
