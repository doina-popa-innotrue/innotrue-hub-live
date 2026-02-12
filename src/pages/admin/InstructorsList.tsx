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

    const enrichedInstructors = await Promise.all(
      instructorRoles.map(async (roleEntry) => {
        const { data: profile } = await supabase
          .from("profiles")
          .select("name, id, plan_id")
          .eq("id", roleEntry.user_id)
          .single();

        let plan: { id: string; name: string } | null = null;
        if (profile?.plan_id) {
          const { data: planData } = await supabase
            .from("plans")
            .select("id, name")
            .eq("id", profile.plan_id)
            .single();
          plan = planData;
        }

        // Get email via edge function
        let email = "";
        try {
          const { data: emailData } = await supabase.functions.invoke("get-user-email", {
            body: { userId: roleEntry.user_id },
          });
          email = emailData?.email || "";
        } catch {
          // Ignore email fetch errors
        }

        // Count programs where user is instructor
        let programCount = 0;
        try {
          const result = await (supabase.from("program_instructors") as any)
            .select("id")
            .eq("user_id", roleEntry.user_id);
          programCount = result.data?.length || 0;
        } catch {
          // Ignore count errors
        }

        return {
          user_id: roleEntry.user_id,
          name: profile?.name || "Unknown",
          email,
          programCount,
          plan,
        };
      }),
    );

    setInstructors(enrichedInstructors);
    setLoading(false);
  }

  useEffect(() => {
    fetchInstructors();
  }, []);

  if (loading) return <div>Loading...</div>;

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
