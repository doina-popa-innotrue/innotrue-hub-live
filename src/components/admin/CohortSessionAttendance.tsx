import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CheckCircle2, XCircle, MinusCircle, Users, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface CohortSessionAttendanceProps {
  sessionId: string;
  cohortId: string;
  onStatsChange?: () => void;
}

type AttendanceStatus = "present" | "absent" | "excused";

interface EnrolledUser {
  enrollment_id: string;
  user_id: string;
  name: string;
  email: string;
}

interface AttendanceRecord {
  id: string;
  enrollment_id: string;
  status: AttendanceStatus;
}

export function CohortSessionAttendance({
  sessionId,
  cohortId,
  onStatsChange,
}: CohortSessionAttendanceProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Fetch enrolled users for this cohort
  const { data: enrolledUsers, isLoading: loadingUsers } = useQuery({
    queryKey: ["cohort-enrolled-users", cohortId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_enrollments")
        .select("id, client_user_id, profiles:client_user_id(name, email)")
        .eq("cohort_id" as string, cohortId)
        .eq("status", "active");

      if (error) throw error;
      return (
        (data as unknown as {
          id: string;
          client_user_id: string;
          profiles: { name: string; email: string } | null;
        }[])?.map((d) => ({
          enrollment_id: d.id,
          user_id: d.client_user_id,
          name: d.profiles?.name || "Unknown",
          email: d.profiles?.email || "",
        })) || []
      ) as EnrolledUser[];
    },
  });

  // Fetch existing attendance records for this session
  const { data: attendance, isLoading: loadingAttendance } = useQuery({
    queryKey: ["session-attendance", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cohort_session_attendance" as string)
        .select("id, enrollment_id, status")
        .eq("session_id", sessionId);

      if (error) throw error;
      return (data as AttendanceRecord[]) || [];
    },
  });

  const upsertMutation = useMutation({
    mutationFn: async ({
      enrollmentId,
      status,
    }: {
      enrollmentId: string;
      status: AttendanceStatus;
    }) => {
      const { error } = await supabase.from("cohort_session_attendance" as string).upsert(
        {
          session_id: sessionId,
          enrollment_id: enrollmentId,
          status,
          marked_by: user?.id,
          marked_at: new Date().toISOString(),
        },
        { onConflict: "session_id,enrollment_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session-attendance", sessionId] });
      onStatsChange?.();
    },
    onError: () => {
      toast.error("Failed to update attendance");
    },
  });

  const markAllMutation = useMutation({
    mutationFn: async (status: AttendanceStatus) => {
      if (!enrolledUsers) return;
      const records = enrolledUsers.map((u) => ({
        session_id: sessionId,
        enrollment_id: u.enrollment_id,
        status,
        marked_by: user?.id,
        marked_at: new Date().toISOString(),
      }));
      const { error } = await supabase
        .from("cohort_session_attendance" as string)
        .upsert(records, { onConflict: "session_id,enrollment_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session-attendance", sessionId] });
      onStatsChange?.();
      toast.success("Attendance updated");
    },
    onError: () => {
      toast.error("Failed to update attendance");
    },
  });

  if (loadingUsers || loadingAttendance) {
    return (
      <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        Loading attendance...
      </div>
    );
  }

  if (!enrolledUsers || enrolledUsers.length === 0) {
    return (
      <div className="py-4 text-center text-sm text-muted-foreground border rounded-lg mt-2 bg-muted/30">
        No enrolled users in this cohort
      </div>
    );
  }

  const attendanceMap = new Map<string, AttendanceRecord>();
  attendance?.forEach((a) => attendanceMap.set(a.enrollment_id, a));

  const presentCount = attendance?.filter((a) => a.status === "present").length || 0;
  const absentCount = attendance?.filter((a) => a.status === "absent").length || 0;
  const excusedCount = attendance?.filter((a) => a.status === "excused").length || 0;

  const getStatusButton = (
    enrollmentId: string,
    targetStatus: AttendanceStatus,
    current: AttendanceStatus | undefined,
  ) => {
    const isActive = current === targetStatus;
    const icons = {
      present: <CheckCircle2 className="h-3.5 w-3.5" />,
      absent: <XCircle className="h-3.5 w-3.5" />,
      excused: <MinusCircle className="h-3.5 w-3.5" />,
    };
    const variants = {
      present: isActive
        ? "bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400"
        : "",
      absent: isActive
        ? "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400"
        : "",
      excused: isActive
        ? "bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400"
        : "",
    };

    return (
      <Button
        variant="outline"
        size="sm"
        className={`text-xs h-7 px-2 ${variants[targetStatus]}`}
        onClick={() => upsertMutation.mutate({ enrollmentId, status: targetStatus })}
        disabled={upsertMutation.isPending}
      >
        {icons[targetStatus]}
        <span className="ml-1 capitalize hidden sm:inline">{targetStatus}</span>
      </Button>
    );
  };

  return (
    <div className="mt-2 border rounded-lg p-3 bg-muted/20 space-y-3">
      {/* Stats bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 text-sm">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span>
            <span className="font-medium">{presentCount}</span>/{enrolledUsers.length} present
          </span>
          {absentCount > 0 && (
            <Badge variant="destructive" className="text-xs">
              {absentCount} absent
            </Badge>
          )}
          {excusedCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              {excusedCount} excused
            </Badge>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={() => markAllMutation.mutate("present")}
          disabled={markAllMutation.isPending}
        >
          {markAllMutation.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin mr-1" />
          ) : (
            <CheckCircle2 className="h-3 w-3 mr-1" />
          )}
          Mark All Present
        </Button>
      </div>

      {/* User list */}
      <div className="space-y-1.5">
        {enrolledUsers.map((eu) => {
          const record = attendanceMap.get(eu.enrollment_id);
          const initials = eu.name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);

          return (
            <div
              key={eu.enrollment_id}
              className="flex items-center justify-between gap-2 py-1.5 px-2 rounded hover:bg-muted/50"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Avatar className="h-6 w-6 text-[10px]">
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <span className="text-sm truncate">{eu.name}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {getStatusButton(eu.enrollment_id, "present", record?.status)}
                {getStatusButton(eu.enrollment_id, "absent", record?.status)}
                {getStatusButton(eu.enrollment_id, "excused", record?.status)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
