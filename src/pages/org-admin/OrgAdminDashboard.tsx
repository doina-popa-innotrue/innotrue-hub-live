import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, BookOpen, GraduationCap, TrendingUp, Plus, Building2, Coins } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useOrgCreditBatches } from '@/hooks/useCreditBatches';
import { subDays } from 'date-fns';

export default function OrgAdminDashboard() {
  const { organizationMembership, user } = useAuth();

  // Org credit batches for balance widget
  const { totalAvailable, isLoading: creditsLoading } = useOrgCreditBatches(
    organizationMembership?.organization_id
  );

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['org-stats', organizationMembership?.organization_id],
    queryFn: async () => {
      if (!organizationMembership?.organization_id) return null;

      // Get member count
      const { count: memberCount } = await supabase
        .from('organization_members')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationMembership.organization_id)
        .eq('is_active', true);

      // Get members who joined in the last 30 days for growth calculation
      const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
      const { count: newMembersCount } = await supabase
        .from('organization_members')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationMembership.organization_id)
        .eq('is_active', true)
        .gte('joined_at', thirtyDaysAgo);

      // Get all member user IDs first
      const { data: members } = await supabase
        .from('organization_members')
        .select('user_id')
        .eq('organization_id', organizationMembership.organization_id)
        .eq('is_active', true);

      const memberUserIds = members?.map(m => m.user_id) || [];

      // Get enrollment counts for org members
      let programCount = 0;
      let enrollmentCount = 0;
      let activeEnrollmentCount = 0;

      if (memberUserIds.length > 0) {
        // Get enrollments for these users (using staff_enrollments view to exclude financial data)
        const { data: enrollments } = await supabase
          .from('staff_enrollments')
          .select('id, program_id, status')
          .in('client_user_id', memberUserIds);

        if (enrollments) {
          enrollmentCount = enrollments.length;
          activeEnrollmentCount = enrollments.filter(e => e.status === 'active').length;
          
          // Count unique programs
          const uniquePrograms = new Set(enrollments.map(e => e.program_id));
          programCount = uniquePrograms.size;
        }
      }

      // Calculate growth percentage
      const previousTotal = (memberCount || 0) - (newMembersCount || 0);
      const growthPercent = previousTotal > 0
        ? Math.round(((newMembersCount || 0) / previousTotal) * 100)
        : (newMembersCount || 0) > 0 ? 100 : 0;

      return {
        memberCount: memberCount || 0,
        programCount,
        enrollmentCount,
        activeEnrollmentCount,
        newMembersCount: newMembersCount || 0,
        growthPercent,
      };
    },
    enabled: !!organizationMembership?.organization_id,
  });

  const { data: recentMembers, isLoading: membersLoading } = useQuery({
    queryKey: ['org-recent-members', organizationMembership?.organization_id],
    queryFn: async () => {
      if (!organizationMembership?.organization_id) return [];

      const { data } = await supabase
        .from('organization_members')
        .select(`
          id,
          role,
          joined_at,
          user_id
        `)
        .eq('organization_id', organizationMembership.organization_id)
        .eq('is_active', true)
        .order('joined_at', { ascending: false })
        .limit(5);

      if (!data || data.length === 0) return [];

      // Fetch profile info for these members
      const userIds = data.map(m => m.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      return data.map(member => ({
        ...member,
        profile: profileMap.get(member.user_id) as { id: string; name: string | null } | undefined,
      }));
    },
    enabled: !!organizationMembership?.organization_id,
  });

  if (!organizationMembership) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <Building2 className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">No Organization Found</h2>
        <p className="text-muted-foreground">
          You are not currently associated with any organization.
        </p>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Members',
      value: stats?.memberCount || 0,
      icon: Users,
      description: 'Active organization members',
      color: 'text-primary',
    },
    {
      title: 'Programs',
      value: stats?.programCount || 0,
      icon: BookOpen,
      description: 'Programs with enrollments',
      color: 'text-chart-2',
    },
    {
      title: 'Enrollments',
      value: stats?.activeEnrollmentCount || 0,
      icon: GraduationCap,
      description: `${stats?.enrollmentCount || 0} total enrollments`,
      color: 'text-chart-3',
    },
    {
      title: 'Growth',
      value: `+${stats?.growthPercent || 0}%`,
      icon: TrendingUp,
      description: `${stats?.newMembersCount || 0} new this month`,
      color: 'text-chart-4',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Welcome to {organizationMembership.organization_name}
          </h1>
          <p className="text-muted-foreground">
            Manage your organization's members, programs, and settings
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link to="/org-admin/members">
              <Plus className="h-4 w-4 mr-2" />
              Invite Member
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold">{stat.value}</div>
              )}
              <p className="text-xs text-muted-foreground">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Credit Balance Widget */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" />
            Organization Credits
          </CardTitle>
          <Button variant="outline" size="sm" asChild>
            <Link to="/org-admin/programs">Use Credits</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {creditsLoading ? (
            <Skeleton className="h-10 w-32" />
          ) : (
            <div className="text-3xl font-bold text-primary">
              {totalAvailable.toLocaleString()}
            </div>
          )}
          <p className="text-sm text-muted-foreground mt-1">
            Available for program enrollments
          </p>
        </CardContent>
      </Card>

      {/* Recent Members */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Recent Members</CardTitle>
            <CardDescription>Latest additions to your organization</CardDescription>
          </div>
          <Button variant="outline" asChild>
            <Link to="/org-admin/members">View All</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {membersLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                </div>
              ))}
            </div>
          ) : recentMembers && recentMembers.length > 0 ? (
            <div className="space-y-4">
              {recentMembers.map((member) => (
                <div key={member.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{member.profile?.name || 'Unknown'}</p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="capitalize">
                    {member.role.replace('org_', '')}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No members yet</p>
              <Button variant="link" asChild className="mt-2">
                <Link to="/org-admin/members">Invite your first member</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
          <Link to="/org-admin/members">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                Manage Members
              </CardTitle>
              <CardDescription>
                Invite, remove, or update member roles
              </CardDescription>
            </CardHeader>
          </Link>
        </Card>

        <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
          <Link to="/org-admin/programs">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Organization Programs
              </CardTitle>
              <CardDescription>
                View and manage your organization's programs
              </CardDescription>
            </CardHeader>
          </Link>
        </Card>

        <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
          <Link to="/org-admin/settings">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Organization Settings
              </CardTitle>
              <CardDescription>
                Configure your organization profile
              </CardDescription>
            </CardHeader>
          </Link>
        </Card>
      </div>
    </div>
  );
}
