import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { PageLoadingState } from "@/components/ui/page-loading-state";

interface Coach {
  user_id: string;
  name: string;
  email: string;
  clientCount: number;
  plan: { id: string; name: string } | null;
}

export default function CoachesList() {
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  async function fetchCoaches() {
    // Get all users with coach role
    const { data: coachRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "coach");

    if (!coachRoles || coachRoles.length === 0) {
      setCoaches([]);
      setLoading(false);
      return;
    }

    const coachUserIds = coachRoles.map((r) => r.user_id);

    // Batch-fetch all profiles with plan JOINs and client counts in parallel
    const [{ data: allProfiles }, { data: allCoachClients }, ...emailResults] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, name, plan_id, plans(id, name)")
        .in("id", coachUserIds),
      supabase
        .from("client_coaches")
        .select("coach_id")
        .in("coach_id", coachUserIds),
      // Fetch emails in parallel (edge function per user, but all run concurrently)
      ...coachUserIds.map((userId) =>
        supabase.functions
          .invoke("get-user-email", { body: { userId } })
          .catch((): { data: null } => ({ data: null })),
      ),
    ]);

    // Build lookup maps
    const profileMap = new Map<string, any>();
    allProfiles?.forEach((p) => profileMap.set(p.id, p));

    const clientCountMap = new Map<string, number>();
    allCoachClients?.forEach((cc) => {
      clientCountMap.set(cc.coach_id, (clientCountMap.get(cc.coach_id) || 0) + 1);
    });

    const enrichedCoaches = coachUserIds.map((userId, idx) => {
      const profile = profileMap.get(userId);
      const emailResult = emailResults[idx];
      return {
        user_id: userId,
        name: profile?.name || "Unknown",
        email: emailResult?.data?.email || "",
        clientCount: clientCountMap.get(userId) || 0,
        plan: profile?.plans || null,
      };
    });

    setCoaches(enrichedCoaches);
    setLoading(false);
  }

  useEffect(() => {
    fetchCoaches();
  }, []);

  if (loading) return <PageLoadingState />;

  return (
    <div>
      <Breadcrumb className="mb-4">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/admin">Dashboard</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Coaches</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Coaches</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Coaches</CardTitle>
          <CardDescription>Users with the coach role who can support clients</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Assigned Clients</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coaches.map((coach) => (
                <TableRow key={coach.user_id}>
                  <TableCell className="font-medium">{coach.name}</TableCell>
                  <TableCell>
                    {coach.email || <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    {coach.plan ? (
                      <Badge variant="outline">{coach.plan.name}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">No plan</span>
                    )}
                  </TableCell>
                  <TableCell>{coach.clientCount}</TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" onClick={() => navigate(`/admin/users`)}>
                      View in Users
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {coaches.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No coaches found. Assign the coach role to users in User Management.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
