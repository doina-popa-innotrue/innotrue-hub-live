import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Layers, Check } from "lucide-react";

interface Track {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

interface UserTrack {
  id: string;
  track_id: string;
  is_active: boolean;
}

interface AdminTrackAssignmentProps {
  userId: string;
}

export function AdminTrackAssignment({ userId }: AdminTrackAssignmentProps) {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [userTracks, setUserTracks] = useState<UserTrack[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [togglingTrackId, setTogglingTrackId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [userId]);

  async function fetchData() {
    setIsLoading(true);
    try {
      // Fetch all active tracks
      const { data: allTracks } = await supabase
        .from("tracks")
        .select("id, name, description, is_active")
        .eq("is_active", true)
        .order("name");

      // Fetch user's track assignments
      const { data: userTrackData } = await supabase
        .from("user_tracks")
        .select("id, track_id, is_active")
        .eq("user_id", userId);

      setTracks(allTracks || []);
      setUserTracks(userTrackData || []);
    } catch (error) {
      console.error("Failed to fetch tracks:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function toggleTrack(trackId: string, isActive: boolean) {
    setTogglingTrackId(trackId);
    try {
      const existingUserTrack = userTracks.find((ut) => ut.track_id === trackId);

      if (existingUserTrack) {
        // Update existing record
        const { error } = await supabase
          .from("user_tracks")
          .update({ is_active: isActive })
          .eq("id", existingUserTrack.id);

        if (error) throw error;

        setUserTracks((prev) =>
          prev.map((ut) => (ut.id === existingUserTrack.id ? { ...ut, is_active: isActive } : ut)),
        );
      } else {
        // Create new record
        const { data, error } = await supabase
          .from("user_tracks")
          .insert({
            user_id: userId,
            track_id: trackId,
            is_active: isActive,
          })
          .select()
          .single();

        if (error) throw error;

        setUserTracks((prev) => [...prev, data]);
      }

      const track = tracks.find((t) => t.id === trackId);
      toast.success(`Track "${track?.name}" ${isActive ? "enabled" : "disabled"}`);
    } catch (error) {
      console.error("Failed to toggle track:", error);
      toast.error("Failed to update track assignment");
    } finally {
      setTogglingTrackId(null);
    }
  }

  function isTrackActive(trackId: string): boolean {
    const userTrack = userTracks.find((ut) => ut.track_id === trackId);
    return userTrack?.is_active ?? false;
  }

  if (isLoading) {
    return (
      <div className="flex items-start gap-4">
        <Label className="font-semibold min-w-20">Tracks:</Label>
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-8 w-28" />
        </div>
      </div>
    );
  }

  if (tracks.length === 0) {
    return (
      <div className="flex items-center gap-4">
        <Label className="font-semibold min-w-20">Tracks:</Label>
        <span className="text-sm text-muted-foreground">No tracks configured</span>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-4">
      <Label className="font-semibold min-w-20 pt-1">
        <span className="flex items-center gap-1">
          <Layers className="h-4 w-4" />
          Tracks:
        </span>
      </Label>
      <div className="flex-1">
        <div className="flex flex-wrap gap-3">
          {tracks.map((track) => {
            const active = isTrackActive(track.id);
            const isToggling = togglingTrackId === track.id;

            return (
              <div
                key={track.id}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors ${
                  active ? "border-primary bg-primary/10" : "border-border bg-muted/30"
                }`}
              >
                <Switch
                  id={`admin-track-${track.id}`}
                  checked={active}
                  onCheckedChange={(checked) => toggleTrack(track.id, checked)}
                  disabled={isToggling}
                  className="scale-90"
                />
                <Label
                  htmlFor={`admin-track-${track.id}`}
                  className="text-sm cursor-pointer flex items-center gap-1"
                >
                  {track.name}
                  {active && <Check className="h-3 w-3 text-primary" />}
                </Label>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Enable tracks to grant the user access to track-specific features and content
        </p>
      </div>
    </div>
  );
}
