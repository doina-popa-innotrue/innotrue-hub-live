import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';

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
      .from('user_roles')
      .select('user_id')
      .eq('role', 'coach');

    if (!coachRoles || coachRoles.length === 0) {
      setCoaches([]);
      setLoading(false);
      return;
    }

    const enrichedCoaches = await Promise.all(
      coachRoles.map(async (roleEntry) => {
        const { data: profile } = await supabase
          .from('profiles')
          .select('name, id, plan_id')
          .eq('id', roleEntry.user_id)
          .single();

        let plan: { id: string; name: string } | null = null;
        if (profile?.plan_id) {
          const { data: planData } = await supabase
            .from('plans')
            .select('id, name')
            .eq('id', profile.plan_id)
            .single();
          plan = planData;
        }

        // Get email via edge function
        let email = '';
        try {
          const { data: emailData } = await supabase.functions.invoke('get-user-email', {
            body: { userId: roleEntry.user_id }
          });
          email = emailData?.email || '';
        } catch {
          // Ignore email fetch errors
        }

        // Count assigned clients
        let clientCountVal = 0;
        try {
          const result = await (supabase
            .from('client_coaches') as any)
            .select('id')
            .eq('coach_id', roleEntry.user_id);
          clientCountVal = result.data?.length || 0;
        } catch {
          // Ignore count errors
        }

        return {
          user_id: roleEntry.user_id,
          name: profile?.name || 'Unknown',
          email,
          clientCount: clientCountVal,
          plan,
        };
      })
    );

    setCoaches(enrichedCoaches);
    setLoading(false);
  }

  useEffect(() => {
    fetchCoaches();
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
                  <TableCell>{coach.email || <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>
                    {coach.plan ? (
                      <Badge variant="outline">{coach.plan.name}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">No plan</span>
                    )}
                  </TableCell>
                  <TableCell>{coach.clientCount}</TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/admin/users`)}
                    >
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
