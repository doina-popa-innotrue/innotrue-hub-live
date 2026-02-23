import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { Loader2, UserCheck } from "lucide-react";

interface CompletedUser {
  user_id: string;
  user_name: string;
  completed_programs: {
    program_name: string;
    completed_at: string;
  }[];
  last_completion_date: string;
}

export default function ProgramCompletions() {
  // Fetch users on Programs plan who have completed all their enrollments
  const { data: completedUsers, isLoading } = useQuery({
    queryKey: ["program-completions"],
    queryFn: async () => {
      // Get the Programs plan ID
      const { data: programsPlan } = await supabase
        .from("plans")
        .select("id")
        .eq("key", "programs")
        .single();

      if (!programsPlan) return [];

      // Get users on Programs plan
      const { data: usersOnProgramsPlan } = await supabase
        .from("profiles")
        .select("id, name")
        .eq("plan_id", programsPlan.id);

      if (!usersOnProgramsPlan || usersOnProgramsPlan.length === 0) return [];

      // For each user, check their enrollments
      const completedUsers: CompletedUser[] = [];

      for (const profile of usersOnProgramsPlan) {
        // Get all enrollments for this user
        const { data: enrollments } = await supabase
          .from("client_enrollments")
          .select(
            `
            id,
            status,
            updated_at,
            programs!inner (
              name
            )
          `,
          )
          .eq("client_user_id", profile.id);

        if (!enrollments || enrollments.length === 0) continue;

        // Check if all enrollments are completed
        const allCompleted = enrollments.every((e) => e.status === "completed");

        if (allCompleted) {
          const completedPrograms = enrollments.map((e) => ({
            program_name: ((e.programs as any)?.name as string) ?? "",
            completed_at: (e.updated_at as string) ?? "",
          }));

          // Find the most recent completion date
          const lastCompletionDate = completedPrograms.reduce(
            (latest: string, p) =>
              new Date(p.completed_at) > new Date(latest) ? p.completed_at : latest,
            completedPrograms[0].completed_at,
          );

          completedUsers.push({
            user_id: profile.id,
            user_name: profile.name || "Unknown",
            completed_programs: completedPrograms,
            last_completion_date: lastCompletionDate,
          });
        }
      }

      // Sort by most recent completion first
      return completedUsers.sort(
        (a, b) =>
          new Date(b.last_completion_date).getTime() - new Date(a.last_completion_date).getTime(),
      );
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Program Completions</h1>
        <p className="text-muted-foreground">
          Users who have completed all their enrolled programs
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            Completed Programs
          </CardTitle>
          <CardDescription>
            Users on the Programs plan who have completed all their enrollments
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !completedUsers || completedUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <UserCheck className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No users have completed all their programs yet</p>
              <p className="text-sm mt-1">
                Users on the Programs plan will appear here once they complete all their enrollments
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Completed Programs</TableHead>
                  <TableHead>Last Completion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {completedUsers.map((user) => (
                  <TableRow key={user.user_id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{user.user_name}</p>
                        <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                          {user.user_id}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.completed_programs.map((p, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {p.program_name}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {format(new Date(user.last_completion_date), "MMM d, yyyy")}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
