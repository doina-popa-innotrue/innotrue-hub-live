import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface SkillCategory {
  id: string;
  key: string;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  order_index: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useSkillCategories(options?: { activeOnly?: boolean }) {
  const { activeOnly = true } = options || {};

  return useQuery({
    queryKey: ["skill-categories", { activeOnly }],
    queryFn: async () => {
      let query = supabase
        .from("skill_categories")
        .select("*")
        .order("order_index", { ascending: true });

      if (activeOnly) {
        query = query.eq("is_active", true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as SkillCategory[];
    },
    staleTime: 1000 * 60 * 10, // Cache for 10 minutes
  });
}

// Helper to get category by id
export function useCategoryById(id: string | null | undefined) {
  const { data: categories } = useSkillCategories({ activeOnly: false });

  if (!id || !categories) return null;
  return categories.find((c) => c.id === id) || null;
}

// Helper to build a lookup map
export function useSkillCategoryLookup() {
  const { data: categories, isLoading, error } = useSkillCategories({ activeOnly: false });

  const lookup: Record<string, SkillCategory> = {};
  const labels: Record<string, string> = {};

  if (categories) {
    categories.forEach((cat) => {
      lookup[cat.id] = cat;
      labels[cat.id] = cat.name;
    });
  }

  return { lookup, labels, categories, isLoading, error };
}

// CRUD mutations for admin
export function useSkillCategoryMutations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createMutation = useMutation({
    mutationFn: async (data: Omit<SkillCategory, "id" | "created_at" | "updated_at">) => {
      const { data: result, error } = await supabase
        .from("skill_categories")
        .insert(data)
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["skill-categories"] });
      toast({ title: "Category created successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create category",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: Partial<SkillCategory> & { id: string }) => {
      const { error } = await supabase.from("skill_categories").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["skill-categories"] });
      toast({ title: "Category updated successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update category",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("skill_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["skill-categories"] });
      toast({ title: "Category deleted successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete category",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return { createMutation, updateMutation, deleteMutation };
}
