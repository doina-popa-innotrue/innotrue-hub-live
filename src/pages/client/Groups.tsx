import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Calendar, BookOpen, ArrowRight, UserPlus } from "lucide-react";
import { format } from "date-fns";
import { FeatureGate } from "@/components/FeatureGate";

interface Group {
  id: string;
  name: string;
  description: string | null;
  theme: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  join_type: string;
  program_id: string | null;
  circle_group_url: string | null;
  programs?: { name: string } | null;
  member_count?: number;
}

export default function Groups() {
  const { user } = useAuth();

  // Fetch groups user is a member of
  const { data: myGroups, isLoading: loadingMyGroups } = useQuery({
    queryKey: ["my-groups", user?.id],
    queryFn: async () => {
      const { data: memberships, error } = await supabase
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
            join_type,
            program_id,
            circle_group_url,
            programs (name)
          )
        `,
        )
        .eq("user_id", user?.id ?? "")
        .eq("status", "active");

      if (error) throw error;

      // Get member counts for each group
      const groupsWithCounts = await Promise.all(
        (memberships || []).map(async (m: any) => {
          const { count } = await supabase
            .from("group_memberships")
            .select("*", { count: "exact", head: true })
            .eq("group_id", m.group_id)
            .eq("status", "active");

          return {
            ...m.groups,
            member_count: count || 0,
            my_role: m.role,
          };
        }),
      );

      return groupsWithCounts;
    },
    enabled: !!user?.id,
  });

  // Fetch open groups user can join
  const { data: openGroups, isLoading: loadingOpenGroups } = useQuery({
    queryKey: ["open-groups", user?.id],
    queryFn: async () => {
      // Get groups user is already in
      const { data: myMemberships } = await supabase
        .from("group_memberships")
        .select("group_id")
        .eq("user_id", user?.id ?? "");

      const myGroupIds = myMemberships?.map((m) => m.group_id) || [];

      // Get open groups
      let query = supabase
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
          join_type,
          program_id,
          programs (name)
        `,
        )
        .eq("join_type", "open")
        .eq("status", "active");

      if (myGroupIds.length > 0) {
        query = query.not("id", "in", `(${myGroupIds.join(",")})`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge variant="default">Active</Badge>;
      case "completed":
        return <Badge variant="secondary">Completed</Badge>;
      case "draft":
        return <Badge variant="outline">Draft</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <FeatureGate featureKey="groups">
      <div className="container mx-auto py-6 px-4 space-y-8 max-w-full">
        <div>
          <h1 className="text-3xl font-bold">My Groups</h1>
          <p className="text-muted-foreground">
            Study groups, peer learning, and collaborative activities
          </p>
        </div>

        {/* My Groups */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Groups You're In</h2>

          {loadingMyGroups ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-48" />
              ))}
            </div>
          ) : myGroups && myGroups.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {myGroups.map((group: any) => (
                <Card key={group.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-lg">{group.name}</CardTitle>
                        {group.programs?.name && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <BookOpen className="h-3 w-3" />
                            {group.programs.name}
                          </div>
                        )}
                      </div>
                      {getStatusBadge(group.status)}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {group.description && (
                      <CardDescription className="line-clamp-2">
                        {group.description}
                      </CardDescription>
                    )}

                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        {group.member_count} members
                      </div>
                      {group.start_date && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {format(new Date(group.start_date), "MMM d, yyyy")}
                        </div>
                      )}
                    </div>

                    {group.theme && (
                      <Badge variant="outline" className="text-xs">
                        {group.theme}
                      </Badge>
                    )}

                    <Button asChild className="w-full mt-2">
                      <Link to={`/groups/${group.id}`}>
                        View Group <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center">
                <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  You're not in any groups yet. Check out open groups below to join one!
                </p>
              </CardContent>
            </Card>
          )}
        </section>

        {/* Open Groups */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Open Groups</h2>
          <p className="text-sm text-muted-foreground">Groups you can request to join</p>

          {loadingOpenGroups ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-48" />
              ))}
            </div>
          ) : openGroups && openGroups.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {openGroups.map((group: any) => (
                <Card key={group.id} className="hover:shadow-md transition-shadow border-dashed">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-lg">{group.name}</CardTitle>
                        {group.programs?.name && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <BookOpen className="h-3 w-3" />
                            {group.programs.name}
                          </div>
                        )}
                      </div>
                      <Badge variant="outline">Open</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {group.description && (
                      <CardDescription className="line-clamp-2">
                        {group.description}
                      </CardDescription>
                    )}

                    {group.start_date && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        Starts {format(new Date(group.start_date), "MMM d, yyyy")}
                      </div>
                    )}

                    {group.theme && (
                      <Badge variant="outline" className="text-xs">
                        {group.theme}
                      </Badge>
                    )}

                    <Button variant="outline" asChild className="w-full mt-2">
                      <Link to={`/groups/${group.id}`}>
                        <UserPlus className="mr-2 h-4 w-4" />
                        View & Request to Join
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">No open groups available at the moment.</p>
              </CardContent>
            </Card>
          )}
        </section>
      </div>
    </FeatureGate>
  );
}
