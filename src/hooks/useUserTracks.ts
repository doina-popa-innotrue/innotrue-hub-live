import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Track {
  id: string;
  name: string;
  key: string;
  description: string | null;
  icon: string | null;
  is_active: boolean;
  display_order: number;
}

interface UserTrack {
  id: string;
  user_id: string;
  track_id: string;
  is_active: boolean;
  created_at: string;
  track?: Track;
}

interface EffectiveFeature {
  feature_id: string;
  feature_key: string;
  feature_name: string;
  is_enabled: boolean;
  limit_value: number | null;
  source_track_id: string;
  source_track_name: string;
}

export function useUserTracks() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch all available tracks
  const { data: allTracks, isLoading: tracksLoading } = useQuery({
    queryKey: ["all-tracks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tracks")
        .select("*")
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return data as Track[];
    },
  });

  // Fetch user's selected tracks
  const { data: userTracks, isLoading: userTracksLoading } = useQuery({
    queryKey: ["user-tracks", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("user_tracks")
        .select(
          `
          *,
          track:tracks(*)
        `,
        )
        .eq("user_id", user.id);
      if (error) throw error;
      return data as (UserTrack & { track: Track })[];
    },
    enabled: !!user?.id,
  });

  // Fetch effective features from active tracks (using the DB function)
  const { data: effectiveFeatures, isLoading: featuresLoading } = useQuery({
    queryKey: ["effective-track-features", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase.rpc("get_effective_track_features", {
        p_user_id: user.id,
      });
      if (error) throw error;
      return data as EffectiveFeature[];
    },
    enabled: !!user?.id,
  });

  // Toggle a track on/off for the user
  const toggleTrackMutation = useMutation({
    mutationFn: async ({ trackId, isActive }: { trackId: string; isActive: boolean }) => {
      if (!user?.id) throw new Error("Not authenticated");

      const { data: existing } = await supabase
        .from("user_tracks")
        .select("id")
        .eq("user_id", user.id)
        .eq("track_id", trackId)
        .single();

      if (existing) {
        const { error } = await supabase
          .from("user_tracks")
          .update({ is_active: isActive })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("user_tracks").insert({
          user_id: user.id,
          track_id: trackId,
          is_active: isActive,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-tracks"] });
      queryClient.invalidateQueries({ queryKey: ["effective-track-features"] });
      toast.success("Track preference updated");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update track");
    },
  });

  // Get the active tracks for the user
  const activeTracks =
    (userTracks
      ?.filter((ut) => ut.is_active)
      .map((ut) => ut.track)
      .filter(Boolean) as Track[]) || [];

  // Get the effective limit for a feature (highest limit from any active track)
  const getFeatureLimit = (featureKey: string): number | null => {
    const feature = effectiveFeatures?.find((f) => f.feature_key === featureKey);
    return feature?.limit_value ?? null;
  };

  // Check if a feature is enabled by any active track
  const hasTrackFeature = (featureKey: string): boolean => {
    const feature = effectiveFeatures?.find((f) => f.feature_key === featureKey);
    return feature?.is_enabled ?? false;
  };

  return {
    allTracks,
    userTracks,
    activeTracks,
    effectiveFeatures,
    isLoading: tracksLoading || userTracksLoading || featuresLoading,
    toggleTrack: toggleTrackMutation.mutate,
    isToggling: toggleTrackMutation.isPending,
    getFeatureLimit,
    hasTrackFeature,
  };
}
