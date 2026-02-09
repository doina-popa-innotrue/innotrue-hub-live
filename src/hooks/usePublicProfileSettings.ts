import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface PublicProfileSettings {
  id: string;
  user_id: string;
  is_public: boolean;
  custom_slug: string | null;
  show_name: boolean;
  show_avatar: boolean;
  show_bio: boolean;
  show_target_role: boolean;
  show_social_links: boolean;
  show_education: boolean;
  show_certifications: boolean;
  show_job_title: boolean;
  show_organisation: boolean;
  show_tagline: boolean;
  published_at: string | null;
  snapshot_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface PublicProfileInterest {
  id: string;
  user_id: string;
  interest_type: "interest" | "value" | "drive";
  item_value: string;
  created_at: string;
}

export function usePublicProfileSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ["public-profile-settings"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("public_profile_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      return data as PublicProfileSettings | null;
    },
  });

  const { data: publicInterests, isLoading: interestsLoading } = useQuery({
    queryKey: ["public-profile-interests"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("public_profile_interests")
        .select("*")
        .eq("user_id", user.id);

      if (error) throw error;
      return data as PublicProfileInterest[];
    },
  });

  const upsertSettings = useMutation({
    mutationFn: async (updates: Partial<PublicProfileSettings>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("public_profile_settings")
        .upsert({
          user_id: user.id,
          ...updates,
        }, { onConflict: "user_id" });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["public-profile-settings"] });
      toast({ description: "Public profile settings updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const togglePublicInterest = useMutation({
    mutationFn: async ({ type, value, isPublic }: { type: string; value: string; isPublic: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (isPublic) {
        const { error } = await supabase
          .from("public_profile_interests")
          .insert({
            user_id: user.id,
            interest_type: type,
            item_value: value,
          });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("public_profile_interests")
          .delete()
          .eq("user_id", user.id)
          .eq("interest_type", type)
          .eq("item_value", value);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["public-profile-interests"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const checkSlugAvailability = async (slug: string): Promise<boolean> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data, error } = await supabase
      .from("public_profile_settings")
      .select("id")
      .eq("custom_slug", slug)
      .neq("user_id", user.id)
      .maybeSingle();

    if (error) return false;
    return !data;
  };

  const publishProfile = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("generate-public-profile", {
        body: {},
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["public-profile-settings"] });
      toast({ description: `Profile published at ${data.slug}` });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const unpublishProfile = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("generate-public-profile", {
        body: { action: "unpublish" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["public-profile-settings"] });
      toast({ description: "Profile unpublished" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return {
    settings,
    publicInterests: publicInterests || [],
    isLoading: settingsLoading || interestsLoading,
    upsertSettings,
    togglePublicInterest,
    checkSlugAvailability,
    publishProfile,
    unpublishProfile,
  };
}
