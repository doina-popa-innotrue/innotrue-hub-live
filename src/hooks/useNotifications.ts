import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface Notification {
  id: string;
  user_id: string;
  notification_type_id: string | null;
  title: string;
  message: string | null;
  link: string | null;
  metadata: Record<string, unknown>;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  notification_types?: {
    key: string;
    name: string;
    icon: string;
    is_critical: boolean;
    notification_categories?: {
      key: string;
      name: string;
      icon: string;
    };
  };
}

export function useNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch notifications
  const {
    data: notifications = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from("notifications")
        .select(
          `
          *,
          notification_types (
            key,
            name,
            icon,
            is_critical,
            notification_categories (
              key,
              name,
              icon
            )
          )
        `,
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as Notification[];
    },
    enabled: !!user?.id,
  });

  // Count unread
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("id", notificationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  // Mark all as read
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) return;

      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .eq("is_read", false);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast({ title: "All notifications marked as read" });
    },
  });

  // Delete notification
  const deleteMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase.from("notifications").delete().eq("id", notificationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  // Clear all notifications
  const clearAllMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) return;

      const { error } = await supabase.from("notifications").delete().eq("user_id", user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast({ title: "All notifications cleared" });
    },
  });

  // Bulk delete notifications
  const bulkDeleteMutation = useMutation({
    mutationFn: async (notificationIds: string[]) => {
      if (!user?.id) return;

      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("user_id", user.id)
        .in("id", notificationIds);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast({ title: "Selected notifications deleted" });
    },
  });

  // Set up realtime subscription for all notification changes
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel("notifications-realtime")
      .on(
        "postgres_changes",
        {
          event: "*", // Listen to INSERT, UPDATE, DELETE
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log("[Notifications Realtime] Event received:", payload.eventType);

          // Invalidate cache to refetch notifications
          queryClient.invalidateQueries({ queryKey: ["notifications"] });

          // Show toast only for new notifications (INSERT)
          if (payload.eventType === "INSERT") {
            const newNotification = payload.new as Notification;
            toast({
              title: newNotification.title,
              description: newNotification.message || undefined,
            });
          }
        },
      )
      .subscribe((status) => {
        console.log("[Notifications Realtime] Subscription status:", status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient, toast]);

  return {
    notifications,
    unreadCount,
    isLoading,
    refetch,
    markAsRead: markAsReadMutation.mutate,
    markAllAsRead: markAllAsReadMutation.mutate,
    deleteNotification: deleteMutation.mutate,
    bulkDeleteNotifications: bulkDeleteMutation.mutate,
    clearAll: clearAllMutation.mutate,
    isMarkingRead: markAsReadMutation.isPending,
  };
}
