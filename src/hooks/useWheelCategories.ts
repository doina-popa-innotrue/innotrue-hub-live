import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface WheelCategory {
  id: string;
  key: string;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  order_index: number;
  is_active: boolean;
  is_legacy: boolean;
}

export function useWheelCategories(options?: { includeLegacy?: boolean; activeOnly?: boolean }) {
  const { includeLegacy = true, activeOnly = true } = options || {};

  return useQuery({
    queryKey: ["wheel-categories", { includeLegacy, activeOnly }],
    queryFn: async () => {
      let query = supabase
        .from("wheel_categories")
        .select("*")
        .order("order_index", { ascending: true });

      if (activeOnly) {
        query = query.eq("is_active", true);
      }

      if (!includeLegacy) {
        query = query.eq("is_legacy", false);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as WheelCategory[];
    },
    staleTime: 1000 * 60 * 10, // Cache for 10 minutes - categories rarely change
  });
}

// Helper to get category by key
export function useCategoryByKey(key: string | null | undefined) {
  const { data: categories } = useWheelCategories();

  if (!key || !categories) return null;
  return categories.find((c) => c.key === key) || null;
}

// Helper to build a lookup map
export function useCategoryLookup() {
  const { data: categories, isLoading, error } = useWheelCategories();

  const lookup: Record<string, WheelCategory> = {};
  const labels: Record<string, string> = {};
  const colors: Record<string, string> = {};

  if (categories) {
    categories.forEach((cat) => {
      lookup[cat.key] = cat;
      labels[cat.key] = cat.name;
      colors[cat.key] = cat.color || "#6B7280";
    });
  }

  return { lookup, labels, colors, categories, isLoading, error };
}
