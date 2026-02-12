import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface CoachingConsentPreferences {
  id: string;
  user_id: string;
  share_goals: boolean;
  share_decisions: boolean;
  share_tasks: boolean;
  share_progress: boolean;
  share_assessments: boolean;
  share_development_items: boolean;
  consent_given_at: string | null;
  consent_updated_at: string;
  created_at: string;
}

export function useCoachingConsent() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: consent, isLoading } = useQuery({
    queryKey: ["coaching-consent", user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .from("coaching_consent_preferences" as any)
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      return data as unknown as CoachingConsentPreferences | null;
    },
    enabled: !!user,
  });

  const updateConsent = useMutation({
    mutationFn: async (
      updates: Partial<Omit<CoachingConsentPreferences, "id" | "user_id" | "created_at">>,
    ) => {
      if (!user) throw new Error("Not authenticated");

      const now = new Date().toISOString();
      const dataToUpsert = {
        user_id: user.id,
        ...updates,
        consent_updated_at: now,
        consent_given_at: updates.consent_given_at ?? now,
      };

      const { error } = await supabase
        .from("coaching_consent_preferences" as any)
        .upsert(dataToUpsert, { onConflict: "user_id" });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coaching-consent"] });
      toast({ description: "Coach sharing preferences updated" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleConsent = async (
    field: keyof Pick<
      CoachingConsentPreferences,
      | "share_goals"
      | "share_decisions"
      | "share_tasks"
      | "share_progress"
      | "share_assessments"
      | "share_development_items"
    >,
  ) => {
    const currentValue = consent?.[field] ?? false;
    await updateConsent.mutateAsync({ [field]: !currentValue });
  };

  const giveFullConsent = async () => {
    await updateConsent.mutateAsync({
      share_goals: true,
      share_decisions: true,
      share_tasks: true,
      share_progress: true,
      share_assessments: true,
      share_development_items: true,
    });
  };

  const revokeAllConsent = async () => {
    await updateConsent.mutateAsync({
      share_goals: false,
      share_decisions: false,
      share_tasks: false,
      share_progress: false,
      share_assessments: false,
      share_development_items: false,
    });
  };

  return {
    consent,
    isLoading,
    updateConsent,
    toggleConsent,
    giveFullConsent,
    revokeAllConsent,
  };
}
