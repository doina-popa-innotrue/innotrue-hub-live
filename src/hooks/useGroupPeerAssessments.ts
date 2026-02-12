import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface GroupPeerAssessmentConfig {
  id: string;
  group_id: string;
  assessment_id: string;
  is_active: boolean;
  created_at: string;
  assessment?: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    rating_scale: number;
  };
}

export interface PeerAssessmentSnapshot {
  id: string;
  assessment_id: string;
  user_id: string;
  evaluator_id: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  evaluation_relationship: string;
  assessment?: {
    id: string;
    name: string;
    slug: string;
  };
  user?: {
    id: string;
    name: string;
    avatar_url: string | null;
  };
  evaluator?: {
    id: string;
    name: string;
    avatar_url: string | null;
  };
}

// Hook for admins to manage peer assessment configs
export function useAdminGroupPeerAssessments(groupId: string | undefined) {
  const queryClient = useQueryClient();

  // Fetch current peer assessment configs for this group
  const { data: configs, isLoading } = useQuery({
    queryKey: ["group-peer-assessments", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_peer_assessments")
        .select(
          `
          *,
          assessment:capability_assessments (
            id, name, slug, description, rating_scale
          )
        `,
        )
        .eq("group_id", groupId!)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as GroupPeerAssessmentConfig[];
    },
    enabled: !!groupId,
  });

  // Fetch all available capability assessments that support evaluator mode
  const { data: availableAssessments } = useQuery({
    queryKey: ["capability-assessments-for-peer"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("capability_assessments")
        .select("id, name, slug, description, rating_scale, assessment_mode")
        .eq("is_active", true)
        .eq("is_retired", false)
        .in("assessment_mode", ["evaluator", "both"])
        .order("name");

      if (error) throw error;
      return data;
    },
    enabled: !!groupId,
  });

  // Add a peer assessment config
  const addConfig = useMutation({
    mutationFn: async (assessmentId: string) => {
      const { error } = await supabase
        .from("group_peer_assessments")
        .insert({ group_id: groupId!, assessment_id: assessmentId });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-peer-assessments", groupId] });
    },
  });

  // Remove a peer assessment config
  const removeConfig = useMutation({
    mutationFn: async (configId: string) => {
      const { error } = await supabase.from("group_peer_assessments").delete().eq("id", configId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-peer-assessments", groupId] });
    },
  });

  // Toggle active status
  const toggleActive = useMutation({
    mutationFn: async ({ configId, isActive }: { configId: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("group_peer_assessments")
        .update({ is_active: isActive })
        .eq("id", configId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-peer-assessments", groupId] });
    },
  });

  // Filter out already configured assessments
  const unconfiguredAssessments = availableAssessments?.filter(
    (a) => !configs?.some((c) => c.assessment_id === a.id),
  );

  return {
    configs,
    isLoading,
    availableAssessments: unconfiguredAssessments,
    addConfig,
    removeConfig,
    toggleActive,
  };
}

// Hook for clients to access peer assessments in their groups
export function useClientGroupPeerAssessments(groupId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch available peer assessments for this group
  const { data: availableAssessments, isLoading: loadingAssessments } = useQuery({
    queryKey: ["client-group-peer-assessments", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_peer_assessments")
        .select(
          `
          *,
          assessment:capability_assessments (
            id, name, slug, description, rating_scale
          )
        `,
        )
        .eq("group_id", groupId!)
        .eq("is_active", true);

      if (error) throw error;
      return data as GroupPeerAssessmentConfig[];
    },
    enabled: !!groupId,
  });

  // Fetch peer assessments given by current user in this group
  const { data: givenAssessments, isLoading: loadingGiven } = useQuery({
    queryKey: ["peer-assessments-given", groupId, user?.id],
    queryFn: async () => {
      if (!user) return [];

      // Get group members first
      const { data: members } = await supabase
        .from("group_memberships")
        .select("user_id")
        .eq("group_id", groupId!)
        .eq("status", "active");

      if (!members?.length) return [];

      const memberIds = members.map((m) => m.user_id);

      const { data, error } = await supabase
        .from("capability_snapshots")
        .select(
          `
          *,
          assessment:capability_assessments (id, name, slug),
          user:profiles!capability_snapshots_user_id_fkey (id, name, avatar_url)
        `,
        )
        .eq("evaluator_id", user.id)
        .eq("evaluation_relationship", "peer")
        .eq("is_self_assessment", false)
        .in("user_id", memberIds)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as PeerAssessmentSnapshot[];
    },
    enabled: !!groupId && !!user,
  });

  // Fetch peer assessments received by current user
  const { data: receivedAssessments, isLoading: loadingReceived } = useQuery({
    queryKey: ["peer-assessments-received", groupId, user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("capability_snapshots")
        .select(
          `
          *,
          assessment:capability_assessments (id, name, slug),
          evaluator:profiles!capability_snapshots_evaluator_id_fkey (id, name, avatar_url)
        `,
        )
        .eq("user_id", user.id)
        .eq("evaluation_relationship", "peer")
        .eq("is_self_assessment", false)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as PeerAssessmentSnapshot[];
    },
    enabled: !!groupId && !!user,
  });

  // Create a new peer assessment
  const createPeerAssessment = useMutation({
    mutationFn: async ({
      assessmentId,
      subjectUserId,
    }: {
      assessmentId: string;
      subjectUserId: string;
    }) => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("capability_snapshots")
        .insert({
          assessment_id: assessmentId,
          user_id: subjectUserId,
          evaluator_id: user.id,
          is_self_assessment: false,
          evaluation_relationship: "peer",
          status: "draft",
        })
        .select("id")
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["peer-assessments-given", groupId] });
    },
  });

  return {
    availableAssessments,
    givenAssessments,
    receivedAssessments,
    isLoading: loadingAssessments || loadingGiven || loadingReceived,
    createPeerAssessment,
  };
}
