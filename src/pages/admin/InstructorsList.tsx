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

interface Instructor {
  user_id: string;
  name: string;
  email: string;
  programCount: number;
  plan: { id: string; name: string } | null;
}

export default function InstructorsList() {
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  async function fetchInstructors() {
    // Get all users with instructor role
    const { data: instructorRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "instructor");

    if (!instructorRoles || instructorRoles.length === 0) {
      setInstructors([]);
      setLoading(false);
      return;
    }

    const instructorUserIds = instructorRoles.map((r) => r.user_id);

    // Batch-fetch all profiles with plan JOINs and program counts in parallel
    const [{ data: allProfiles }, { data: allProgramInstructors }, ...emailResults] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("id, name, plan_id, plans(id, name)")
          .in("id", instructorUserIds),
        supabase
          .from("program_instructors")
          .select("instructor_id")
          .in("instructor_id", instructorUserIds),
        // Fetch emails in parallel (edge function per user, but all run concurrently)
        ...instructorUserIds.map((userId) =>
          supabase.functions
            .invoke("get-user-email", { body: { userId } })
            .catch((): { data: null } => ({ data: null })),
        ),
      ]);

    // Build lookup maps
    const profileMap = new Map<string, any>();
    allProfiles?.forEach((p) => profileMap.set(p.id, p));

    const programCountMap = new Map<string, number>();
    allProgramInstructors?.forEach((pi) => {
      programCountMap.set(pi.instructor_id, (programCountMap.get(pi.instructor_id) || 0) + 1);
    });

    const enrichedInstructors = instructorUserIds.map((userId, idx) => {
      const profile = profileMap.get(userId);
      const emailResult = emailResults[idx];
      return {
        user_id: userId,
        name: profile?.name || "Unknown",
        email: emailResult?.data?.email || "",
        programCount: programCountMap.get(userId) || 0,
        plan: profile?.plans || null,
      };
    });

    setInstructors(enrichedInstructors);
    setLoading(false);
  }

  useEffect(() => {
    fetchInstructors();
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
            <BreadcrumbPage>Instructors</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Instructors</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Instructors</CardTitle>
          <CardDescription>Users with the instructor role who can teach programs</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Assigned Programs</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {instructors.map((instructor) => (
                <TableRow key={instructor.user_id}>
                  <TableCell className="font-medium">{instructor.name}</TableCell>
                  <TableCell>
                    {instructor.email || <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    {instructor.plan ? (
                      <Badge variant="outline">{instructor.plan.name}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">No plan</span>
                    )}
                  </TableCell>
                  <TableCell>{instructor.programCount}</TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" onClick={() => navigate(`/admin/users`)}>
                      View in Users
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {instructors.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No instructors found. Assign the instructor role to users in User Management.
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
