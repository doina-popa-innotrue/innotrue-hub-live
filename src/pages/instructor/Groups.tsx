import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Calendar, ArrowRight, BookOpen, Loader2 } from "lucide-react";
import { format } from "date-fns";

interface Group {
  id: string;
  name: string;
  description: string | null;
  theme: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  program_id: string | null;
  programs?: { name: string } | null;
  member_count?: number;
}

export default function InstructorGroups() {
  const { user, userRole, userRoles } = useAuth();
  const navigate = useNavigate();

  const { data: groups, isLoading } = useQuery({
    queryKey: ["instructor-groups", user?.id, userRole],
    queryFn: async () => {
      // Get groups where user is a leader (typically instructors/coaches)
      const { data: leaderGroups, error: leaderError } = await supabase
        .from("group_memberships")
        .select(
          `
          group_id,
          role,
          groups (
            id,
            name,
            description,
            theme,
            start_date,
            end_date,
            status,
            program_id,
            programs (name)
          )
        `,
        )
        .eq("user_id", user?.id ?? "")
        .eq("role", "leader")
        .eq("status", "active");

      if (leaderError) throw leaderError;

      // Also get groups for programs where user is instructor/coach
      const showInstructor = userRole === "instructor";
      const showCoach = userRole === "coach";

      const programInstructorPromise =
        showInstructor && userRoles.includes("instructor") && user
          ? supabase.from("program_instructors").select("program_id").eq("instructor_id", user.id)
          : Promise.resolve({ data: [], error: null });

      const programCoachPromise =
        showCoach && userRoles.includes("coach") && user
          ? supabase.from("program_coaches").select("program_id").eq("coach_id", user.id)
          : Promise.resolve({ data: [], error: null });

      const [instructorPrograms, coachPrograms] = await Promise.all([
        programInstructorPromise,
        programCoachPromise,
      ]);

      const programIds = new Set([
        ...(instructorPrograms.data || []).map((p) => p.program_id),
        ...(coachPrograms.data || []).map((p) => p.program_id),
      ]);

      let programGroups: any[] = [];
      if (programIds.size > 0) {
        const { data, error } = await supabase
          .from("groups")
          .select(
            `
            id,
            name,
            description,
            theme,
            start_date,
            end_date,
            status,
            program_id,
            programs (name)
          `,
          )
          .in("program_id", Array.from(programIds))
          .eq("status", "active");

        if (!error && data) {
          programGroups = data;
        }
      }

      // Combine and deduplicate groups
      const allGroupsMap = new Map<string, Group>();

      (leaderGroups || []).forEach((m: any) => {
        if (m.groups) {
          allGroupsMap.set(m.groups.id, {
            ...m.groups,
            programs: m.groups.programs,
          });
        }
      });

      programGroups.forEach((g: any) => {
        if (!allGroupsMap.has(g.id)) {
          allGroupsMap.set(g.id, {
            ...g,
            programs: g.programs,
          });
        }
      });

      // Get member counts for all groups
      const groupIds = Array.from(allGroupsMap.keys());
      if (groupIds.length > 0) {
        const { data: memberCounts } = await supabase
          .from("group_memberships")
          .select("group_id")
          .in("group_id", groupIds)
          .eq("status", "active");

        const counts = (memberCounts || []).reduce(
          (acc, m) => {
            acc[m.group_id] = (acc[m.group_id] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>,
        );

        allGroupsMap.forEach((group, id) => {
          group.member_count = counts[id] || 0;
        });
      }

      return Array.from(allGroupsMap.values());
    },
    enabled: !!user?.id,
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
      active: "default",
      draft: "outline",
      completed: "secondary",
      archived: "destructive",
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  if (isLoading) {
    return <PageLoadingState />;
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Groups</h1>
        <p className="text-muted-foreground">Manage and view groups from your assigned programs</p>
      </div>

      {!groups || groups.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Groups Found</h3>
            <p className="text-muted-foreground">
              You don't have any groups associated with your assigned programs yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <Card key={group.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1">
                    {getStatusBadge(group.status)}
                    <CardTitle className="text-lg mt-2">{group.name}</CardTitle>
                    {group.description && (
                      <CardDescription className="line-clamp-2">
                        {group.description}
                      </CardDescription>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                  {group.programs && (
                    <div className="flex items-center gap-1">
                      <BookOpen className="h-4 w-4" />
                      <span>{group.programs.name}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    <span>{group.member_count || 0} members</span>
                  </div>
                </div>

                {(group.start_date || group.end_date) && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {group.start_date && format(new Date(group.start_date), "MMM d, yyyy")}
                      {group.start_date && group.end_date && " - "}
                      {group.end_date && format(new Date(group.end_date), "MMM d, yyyy")}
                    </span>
                  </div>
                )}

                {group.theme && (
                  <Badge variant="outline" className="text-xs">
                    {group.theme}
                  </Badge>
                )}

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate(`/groups/${group.id}`)}
                >
                  View Group
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
