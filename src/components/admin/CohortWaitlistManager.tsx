import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UserPlus, Trash2, Clock, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface CohortWaitlistManagerProps {
  cohortId: string;
  cohortName: string;
  programId: string;
}

interface WaitlistEntry {
  id: string;
  user_id: string;
  position: number;
  notified: boolean;
  created_at: string;
  profile_name: string | null;
  profile_email: string | null;
}

export function CohortWaitlistManager({
  cohortId,
  cohortName,
  programId,
}: CohortWaitlistManagerProps) {
  const { user: adminUser } = useAuth();
  const queryClient = useQueryClient();

  // Fetch capacity info
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
    staleTime: 10000,
  });

  // Fetch waitlist entries with profile data
  const { data: entries, isLoading } = useQuery({
    queryKey: ["cohort-waitlist", cohortId],
    queryFn: async () => {
      // Fetch waitlist entries
      const { data: waitlist, error } = await supabase
        .from("cohort_waitlist")
        .select("id, user_id, position, notified, created_at")
        .eq("cohort_id", cohortId)
        .order("position");

      if (error) throw error;
      if (!waitlist || waitlist.length === 0) return [];

      // Fetch profile names for all users
      const userIds = waitlist.map((w) => w.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name, username")
        .in("id", userIds);

      const profileMap = new Map<string, { name: string | null; email: string | null }>();
      profiles?.forEach((p) => {
        profileMap.set(p.id, { name: p.name, email: p.username });
      });

      return waitlist.map((w) => ({
        ...w,
        profile_name: profileMap.get(w.user_id)?.name || null,
        profile_email: profileMap.get(w.user_id)?.email || null,
      })) as WaitlistEntry[];
    },
    staleTime: 10000,
  });

  // Promote mutation: enroll user from waitlist
  const promoteMutation = useMutation({
    mutationFn: async (entry: WaitlistEntry) => {
      // Call enroll_with_credits with force=true (admin override)
      const { data: enrollResult, error: enrollError } = await supabase.rpc(
        "enroll_with_credits",
        {
          p_client_user_id: entry.user_id,
          p_program_id: programId,
          p_cohort_id: cohortId,
          p_final_credit_cost: 0,
          p_original_credit_cost: 0,
          p_discount_percent: 100,
          p_description: `Promoted from cohort waitlist for ${cohortName}`,
          p_force: true,
          p_enrollment_source: "waitlist_promotion",
          p_referred_by: adminUser?.id || null,
          p_referral_note: `Promoted from cohort waitlist: ${cohortName}`,
        },
      );

      if (enrollError) throw enrollError;
      if (!enrollResult?.success) throw new Error(enrollResult?.error || "Enrollment failed");

      // Remove from waitlist
      const { error: deleteError } = await supabase
        .from("cohort_waitlist")
        .delete()
        .eq("id", entry.id);

      if (deleteError) {
        console.error("Failed to remove from waitlist after promotion:", deleteError);
      }

      return { enrollmentId: enrollResult.enrollment_id, userName: entry.profile_name };
    },
    onSuccess: (result) => {
      toast.success(`${result.userName || "User"} has been enrolled from the waitlist`);
      queryClient.invalidateQueries({ queryKey: ["cohort-waitlist", cohortId] });
      queryClient.invalidateQueries({ queryKey: ["cohort-capacity", cohortId] });
      queryClient.invalidateQueries({ queryKey: ["cohort-enrollment-counts"] });
      queryClient.invalidateQueries({ queryKey: ["cohort-waitlist-counts"] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to promote: ${error.message}`);
    },
  });

  // Remove mutation
  const removeMutation = useMutation({
    mutationFn: async (entryId: string) => {
      const { error } = await supabase.from("cohort_waitlist").delete().eq("id", entryId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removed from waitlist");
      queryClient.invalidateQueries({ queryKey: ["cohort-waitlist", cohortId] });
      queryClient.invalidateQueries({ queryKey: ["cohort-capacity", cohortId] });
      queryClient.invalidateQueries({ queryKey: ["cohort-waitlist-counts"] });
    },
    onError: () => {
      toast.error("Failed to remove from waitlist");
    },
  });

  if (isLoading) {
    return <div className="text-sm text-muted-foreground py-2">Loading waitlist...</div>;
  }

  if (!entries || entries.length === 0) {
    return null;
  }

  const availableSpots = capacityInfo?.available_spots ?? 0;

  return (
    <div className="space-y-3 border-t pt-4 mt-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-amber-600" />
          <span className="text-sm font-medium">Waitlist ({entries.length})</span>
        </div>
        {capacityInfo && (
          <Badge variant={availableSpots > 0 ? "default" : "secondary"} className="text-xs">
            {availableSpots > 0
              ? `${availableSpots} spot${availableSpots !== 1 ? "s" : ""} available`
              : "At capacity"}
          </Badge>
        )}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">#</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Joined</TableHead>
            <TableHead className="w-20">Status</TableHead>
            <TableHead className="w-24 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => (
            <TableRow key={entry.id}>
              <TableCell className="font-mono text-muted-foreground">{entry.position}</TableCell>
              <TableCell className="font-medium">{entry.profile_name || "—"}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {entry.profile_email || "—"}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {format(new Date(entry.created_at), "MMM d, yyyy")}
              </TableCell>
              <TableCell>
                {entry.notified ? (
                  <Badge variant="outline" className="text-xs text-amber-600">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Notified
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">Waiting</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50"
                    onClick={() => promoteMutation.mutate(entry)}
                    disabled={promoteMutation.isPending}
                    title="Promote to enrolled"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => {
                      if (confirm(`Remove ${entry.profile_name || "this user"} from the waitlist?`)) {
                        removeMutation.mutate(entry.id);
                      }
                    }}
                    disabled={removeMutation.isPending}
                    title="Remove from waitlist"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
