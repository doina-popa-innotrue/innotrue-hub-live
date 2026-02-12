import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TalentLmsProgress {
  talentlms_course_id: string;
  course_name: string;
  completion_status: string;
  progress_percentage: number;
  time_spent_minutes: number;
  test_score: number | null;
  completed_at: string | null;
  last_synced_at: string;
}

export function useTalentLmsProgress(userId?: string) {
  const [progress, setProgress] = useState<TalentLmsProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const fetchProgress = async (targetUserId?: string) => {
    try {
      setLoading(true);
      const userIdToFetch = targetUserId || userId;

      if (!userIdToFetch) return;

      const { data, error } = await supabase
        .from("talentlms_progress")
        .select("*")
        .eq("user_id", userIdToFetch)
        .order("last_synced_at", { ascending: false });

      if (error) throw error;

      setProgress(data as TalentLmsProgress[]);
    } catch (error: any) {
      console.error("Error fetching TalentLMS progress:", error);
    } finally {
      setLoading(false);
    }
  };

  const syncProgress = async () => {
    try {
      setSyncing(true);

      const response = await supabase.functions.invoke("sync-talentlms-progress", {
        body: {},
      });

      if (response.error) {
        throw response.error;
      }

      if (response.data?.error) {
        toast.error(response.data.message || response.data.error);
        return;
      }

      toast.success("Academy progress synced successfully");

      // Refresh progress data
      await fetchProgress();
    } catch (error: any) {
      console.error("Error syncing Academy progress:", error);
      toast.error("Failed to sync Academy progress");
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchProgress(userId);
    }
  }, [userId]);

  return {
    progress,
    loading,
    syncing,
    syncProgress,
    refetch: fetchProgress,
  };
}
