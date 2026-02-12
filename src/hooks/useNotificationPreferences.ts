import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface NotificationCategory {
  id: string;
  key: string;
  name: string;
  description: string | null;
  icon: string;
  order_index: number;
}

export interface NotificationType {
  id: string;
  key: string;
  category_id: string | null;
  name: string;
  description: string | null;
  icon: string;
  is_critical: boolean;
  default_email_enabled: boolean;
  default_in_app_enabled: boolean;
  order_index: number;
}

export interface UserPreference {
  id: string;
  user_id: string;
  notification_type_id: string;
  email_enabled: boolean;
  in_app_enabled: boolean;
}

export interface NotificationTypeWithPreference extends NotificationType {
  email_enabled: boolean;
  in_app_enabled: boolean;
  has_custom_preference: boolean;
}

export function useNotificationPreferences() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ["notification-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notification_categories")
        .select("*")
        .eq("is_active", true)
        .order("order_index");

      if (error) throw error;
      return data as NotificationCategory[];
    },
  });

  // Fetch notification types
  const { data: types = [] } = useQuery({
    queryKey: ["notification-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notification_types")
        .select("*")
        .eq("is_active", true)
        .order("order_index");

      if (error) throw error;
      return data as NotificationType[];
    },
  });

  // Fetch user preferences
  const { data: userPreferences = [], isLoading } = useQuery({
    queryKey: ["user-notification-preferences", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from("user_notification_preferences")
        .select("*")
        .eq("user_id", user.id);

      if (error) throw error;
      return data as UserPreference[];
    },
    enabled: !!user?.id,
  });

  // Merge types with user preferences
  const typesWithPreferences: NotificationTypeWithPreference[] = types.map((type) => {
    const userPref = userPreferences.find((p) => p.notification_type_id === type.id);
    return {
      ...type,
      email_enabled: userPref ? userPref.email_enabled : type.default_email_enabled,
      in_app_enabled: userPref ? userPref.in_app_enabled : type.default_in_app_enabled,
      has_custom_preference: !!userPref,
    };
  });

  // Group by category
  const typesByCategory = categories.map((category) => ({
    ...category,
    types: typesWithPreferences.filter((t) => t.category_id === category.id),
  }));

  // Update preference mutation
  const updatePreferenceMutation = useMutation({
    mutationFn: async ({
      typeId,
      emailEnabled,
      inAppEnabled,
    }: {
      typeId: string;
      emailEnabled: boolean;
      inAppEnabled: boolean;
    }) => {
      if (!user?.id) throw new Error("Not authenticated");

      const { error } = await supabase.from("user_notification_preferences").upsert(
        {
          user_id: user.id,
          notification_type_id: typeId,
          email_enabled: emailEnabled,
          in_app_enabled: inAppEnabled,
        },
        {
          onConflict: "user_id,notification_type_id",
        },
      );

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-notification-preferences"] });
    },
    onError: (error) => {
      toast({
        title: "Error updating preference",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Bulk update - enable/disable all for a category
  const bulkUpdateCategoryMutation = useMutation({
    mutationFn: async ({
      categoryId,
      emailEnabled,
      inAppEnabled,
    }: {
      categoryId: string;
      emailEnabled?: boolean;
      inAppEnabled?: boolean;
    }) => {
      if (!user?.id) throw new Error("Not authenticated");

      const categoryTypes = types.filter((t) => t.category_id === categoryId && !t.is_critical);

      for (const type of categoryTypes) {
        const currentPref = userPreferences.find((p) => p.notification_type_id === type.id);

        await supabase.from("user_notification_preferences").upsert(
          {
            user_id: user.id,
            notification_type_id: type.id,
            email_enabled: emailEnabled ?? currentPref?.email_enabled ?? type.default_email_enabled,
            in_app_enabled:
              inAppEnabled ?? currentPref?.in_app_enabled ?? type.default_in_app_enabled,
          },
          {
            onConflict: "user_id,notification_type_id",
          },
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-notification-preferences"] });
      toast({ title: "Preferences updated" });
    },
  });

  // Reset to defaults
  const resetToDefaultsMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("user_notification_preferences")
        .delete()
        .eq("user_id", user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-notification-preferences"] });
      toast({ title: "Preferences reset to defaults" });
    },
  });

  return {
    categories,
    types,
    typesWithPreferences,
    typesByCategory,
    isLoading,
    updatePreference: updatePreferenceMutation.mutate,
    bulkUpdateCategory: bulkUpdateCategoryMutation.mutate,
    resetToDefaults: resetToDefaultsMutation.mutate,
    isUpdating: updatePreferenceMutation.isPending || bulkUpdateCategoryMutation.isPending,
  };
}
