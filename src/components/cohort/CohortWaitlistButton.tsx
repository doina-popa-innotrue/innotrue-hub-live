import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, X } from "lucide-react";
import { toast } from "sonner";

interface CohortWaitlistButtonProps {
  cohortId: string;
  cohortName: string;
}

export function CohortWaitlistButton({ cohortId, cohortName }: CohortWaitlistButtonProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Check cohort capacity
  const { data: capacityInfo } = useQuery({
    queryKey: ["cohort-capacity", cohortId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("check_cohort_capacity", {
        p_cohort_id: cohortId,
      });
      if (error) throw error;
      return data as {
        has_capacity: boolean;
        capacity: number | null;
        enrolled_count: number;
        waitlist_count: number;
        available_spots: number | null;
      };
    },
    staleTime: 15000,
  });

  // Check if user is on waitlist
  const { data: waitlistEntry } = useQuery({
    queryKey: ["cohort-waitlist-entry", cohortId, user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("cohort_waitlist")
        .select("id, position")
        .eq("cohort_id", cohortId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
    staleTime: 15000,
  });

  // Join waitlist mutation
  const joinMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("join_cohort_waitlist", {
        p_cohort_id: cohortId,
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast.success(`You're #${data.position} on the waitlist for ${cohortName}`);
      queryClient.invalidateQueries({ queryKey: ["cohort-capacity", cohortId] });
      queryClient.invalidateQueries({ queryKey: ["cohort-waitlist-entry", cohortId] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to join waitlist");
    },
  });

  // Leave waitlist mutation
  const leaveMutation = useMutation({
    mutationFn: async () => {
      if (!waitlistEntry) return;
      const { error } = await supabase
        .from("cohort_waitlist")
        .delete()
        .eq("id", waitlistEntry.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removed from waitlist");
      queryClient.invalidateQueries({ queryKey: ["cohort-capacity", cohortId] });
      queryClient.invalidateQueries({ queryKey: ["cohort-waitlist-entry", cohortId] });
    },
    onError: () => {
      toast.error("Failed to leave waitlist");
    },
  });

  // Don't show anything if cohort has capacity (enroll button shown elsewhere)
  if (!capacityInfo || capacityInfo.has_capacity) return null;

  // User is already on the waitlist
  if (waitlistEntry) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="gap-1">
          <Clock className="h-3 w-3" />
          On Waitlist #{waitlistEntry.position}
        </Badge>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-destructive"
          onClick={() => leaveMutation.mutate()}
          disabled={leaveMutation.isPending}
          title="Leave waitlist"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  // Cohort is full, show join waitlist button
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => joinMutation.mutate()}
      disabled={joinMutation.isPending || !user}
    >
      <Clock className="h-4 w-4 mr-1" />
      {joinMutation.isPending ? "Joining..." : "Join Waitlist"}
      {capacityInfo.waitlist_count > 0 && (
        <span className="ml-1 text-muted-foreground">({capacityInfo.waitlist_count} waiting)</span>
      )}
    </Button>
  );
}
