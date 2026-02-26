import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export interface ActionItem {
  id: string;
  title: string | null;
  content: string | null;
  status: string | null;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  task_links: Array<{ task_id: string; task: { id: string; title: string } }>;
}

export function useActionItems(options?: { status?: "pending" | "completed" | "all" }) {
  const { user } = useAuth();
  const statusFilter = options?.status ?? "all";

  return useQuery({
    queryKey: ["action-items", user?.id, statusFilter],
    queryFn: async () => {
      if (!user) return [];

      let query = supabase
        .from("development_items")
        .select(
          `
          id, title, content, status, due_date, completed_at, created_at, updated_at,
          task_links:development_item_task_links(
            task_id,
            task:tasks(id, title)
          )
        `,
        )
        .eq("user_id", user.id)
        .eq("item_type", "action_item")
        .order("created_at", { ascending: false });

      if (statusFilter === "pending") {
        query = query.or("status.eq.pending,status.is.null");
      } else if (statusFilter === "completed") {
        query = query.eq("status", "completed");
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as ActionItem[];
    },
    enabled: !!user,
  });
}

export function useToggleActionItemStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ itemId, newStatus }: { itemId: string; newStatus: string }) => {
      const updates: Record<string, unknown> = { status: newStatus };
      if (newStatus === "completed") {
        updates.completed_at = new Date().toISOString();
      } else {
        updates.completed_at = null;
      }

      const { error } = await supabase.from("development_items").update(updates).eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["action-items"] });
      queryClient.invalidateQueries({ queryKey: ["development-items"] });
      queryClient.invalidateQueries({ queryKey: ["recent-development-items"] });
    },
  });
}
