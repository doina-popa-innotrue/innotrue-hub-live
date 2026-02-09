import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface OrganizationSharingConsent {
  id: string;
  user_id: string;
  organization_id: string;
  share_goals: boolean;
  share_decisions: boolean;
  share_tasks: boolean;
  share_progress: boolean;
  share_assessments: boolean;
  share_development_items: boolean;
  share_assignments: boolean;
  consent_given_at: string | null;
  consent_updated_at: string;
  created_at: string;
}

type ConsentField = 'share_goals' | 'share_decisions' | 'share_tasks' | 
  'share_progress' | 'share_assessments' | 'share_development_items' | 'share_assignments';

export function useOrganizationSharingConsent(organizationId?: string) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: consent, isLoading } = useQuery({
    queryKey: ["org-sharing-consent", user?.id, organizationId],
    queryFn: async () => {
      if (!user || !organizationId) return null;

      const { data, error } = await supabase
        .from("organization_sharing_consent" as any)
        .select("*")
        .eq("user_id", user.id)
        .eq("organization_id", organizationId)
        .maybeSingle();

      if (error) throw error;
      return data as unknown as OrganizationSharingConsent | null;
    },
    enabled: !!user && !!organizationId,
  });

  const updateConsent = useMutation({
    mutationFn: async (updates: Partial<Omit<OrganizationSharingConsent, 'id' | 'user_id' | 'organization_id' | 'created_at'>>) => {
      if (!user || !organizationId) throw new Error("Not authenticated or no organization");

      const now = new Date().toISOString();
      const dataToUpsert = {
        user_id: user.id,
        organization_id: organizationId,
        ...updates,
        consent_updated_at: now,
        consent_given_at: updates.consent_given_at ?? now,
      };

      const { error } = await supabase
        .from("organization_sharing_consent" as any)
        .upsert(dataToUpsert, { onConflict: "user_id,organization_id" });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-sharing-consent"] });
      toast({ description: "Organization sharing preferences updated" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });

  const toggleConsent = async (field: ConsentField) => {
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
      share_assignments: true,
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
      share_assignments: false,
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
