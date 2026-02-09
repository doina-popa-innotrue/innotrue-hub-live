import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, BookOpen, TrendingUp, ClipboardList, UsersRound, Award, UserX, Calendar, FileText, AlertCircle } from 'lucide-react';
import { UpcomingProgramsWidget } from '@/components/admin/UpcomingProgramsWidget';
import { format } from 'date-fns';

interface RecentRegistration {
  id: string;
  user_name: string;
  program_name: string;
  created_at: string;
  status: string;
}

interface PendingDeletionRequest {
  id: string;
  user_name: string;
  created_at: string;
  reason: string | null;
}

interface RecentEnrollment {
  id: string;
  user_name: string;
  program_name: string;
  created_at: string;
}

interface PendingBadge {
  id: string;
  user_name: string;
  badge_name: string;
  program_name: string;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalClients: 0,
    totalPrograms: 0,
    activeEnrollments: 0,
    pendingRegistrations: 0,
    activeGroups: 0,
    pendingBadges: 0,
    pendingDeletions: 0,
    totalAssessments: 0
  });
  const [recentRegistrations, setRecentRegistrations] = useState<RecentRegistration[]>([]);
  const [recentEnrollments, setRecentEnrollments] = useState<RecentEnrollment[]>([]);
  const [pendingDeletions, setPendingDeletions] = useState<PendingDeletionRequest[]>([]);
  const [pendingBadges, setPendingBadges] = useState<PendingBadge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    setLoading(true);

    // Get client user IDs first
    const { data: clientRoles } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'client');
    
    const clientUserIds = clientRoles?.map(r => r.user_id) || [];

    // Fetch all stats in parallel
    const [
      clientsRes,
      programsRes,
      enrollmentsRes,
      registrationsRes,
      groupsRes,
      badgesRes,
      deletionsRes,
      assessmentsRes
    ] = await Promise.all([
      supabase.from('user_roles').select('id', { count: 'exact', head: true }).eq('role', 'client'),
      supabase.from('programs').select('id', { count: 'exact', head: true }),
      clientUserIds.length > 0 
        ? supabase.from('client_enrollments').select('id', { count: 'exact', head: true })
            .eq('status', 'active').in('client_user_id', clientUserIds)
        : Promise.resolve({ count: 0 }),
      supabase.from('program_interest_registrations').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('groups').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('client_badges').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('account_deletion_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('psychometric_assessments').select('id', { count: 'exact', head: true }).eq('is_active', true)
    ]);

    setStats({
      totalClients: clientsRes.count || 0,
      totalPrograms: programsRes.count || 0,
      activeEnrollments: enrollmentsRes.count || 0,
      pendingRegistrations: registrationsRes.count || 0,
      activeGroups: groupsRes.count || 0,
      pendingBadges: badgesRes.count || 0,
      pendingDeletions: deletionsRes.count || 0,
      totalAssessments: assessmentsRes.count || 0
    });

    // Fetch recent registrations
    const { data: recentRegsData } = await supabase
      .from('program_interest_registrations')
      .select(`
        id,
        status,
        created_at,
        user_id,
        programs!inner (name)
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(5);

    if (recentRegsData) {
      const regsWithNames = await Promise.all(
        recentRegsData.map(async (reg: any) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('name')
            .eq('id', reg.user_id)
            .single();
          return {
            id: reg.id,
            user_name: profile?.name || 'Unknown',
            program_name: reg.programs?.name || '',
            created_at: reg.created_at,
            status: reg.status
          };
        })
      );
      setRecentRegistrations(regsWithNames);
    }

    // Fetch recent enrollments
    const { data: recentEnrollData } = await supabase
      .from('client_enrollments')
      .select(`
        id,
        created_at,
        client_user_id,
        programs!inner (name)
      `)
      .order('created_at', { ascending: false })
      .limit(5);

    if (recentEnrollData) {
      const enrollsWithNames = await Promise.all(
        recentEnrollData.map(async (enroll: any) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('name')
            .eq('id', enroll.client_user_id)
            .single();
          return {
            id: enroll.id,
            user_name: profile?.name || 'Unknown',
            program_name: enroll.programs?.name || '',
            created_at: enroll.created_at
          };
        })
      );
      setRecentEnrollments(enrollsWithNames);
    }

    // Fetch pending deletion requests
    const { data: deletionData } = await supabase
      .from('account_deletion_requests')
      .select('id, user_id, created_at, reason')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(5);

    if (deletionData) {
      const deletionsWithNames = await Promise.all(
        deletionData.map(async (del) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('name')
            .eq('id', del.user_id)
            .single();
          return {
            id: del.id,
            user_name: profile?.name || 'Unknown',
            created_at: del.created_at,
            reason: del.reason
          };
        })
      );
      setPendingDeletions(deletionsWithNames);
    }

    // Fetch pending badges
    const { data: badgeData } = await supabase
      .from('client_badges')
      .select(`
        id,
        user_id,
        program_badges!inner (
          name,
          programs!inner (name)
        )
      `)
      .eq('status', 'pending')
      .limit(5);

    if (badgeData) {
      const badgesWithNames = await Promise.all(
        badgeData.map(async (badge: any) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('name')
            .eq('id', badge.user_id)
            .single();
          return {
            id: badge.id,
            user_name: profile?.name || 'Unknown',
            badge_name: badge.program_badges?.name || '',
            program_name: badge.program_badges?.programs?.name || ''
          };
        })
      );
      setPendingBadges(badgesWithNames);
    }

    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
        <p className="text-muted-foreground">Welcome to your admin control panel</p>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card 
          className="cursor-pointer transition-colors hover:border-primary"
          onClick={() => navigate('/admin/clients')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalClients}</div>
            <p className="text-xs text-muted-foreground">Active client profiles</p>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer transition-colors hover:border-primary"
          onClick={() => navigate('/admin/programs')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Programs</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalPrograms}</div>
            <p className="text-xs text-muted-foreground">Available programs</p>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer transition-colors hover:border-primary"
          onClick={() => navigate('/admin/clients')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Enrollments</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeEnrollments}</div>
            <p className="text-xs text-muted-foreground">Clients in programs</p>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer transition-colors hover:border-primary"
          onClick={() => navigate('/admin/groups')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Groups</CardTitle>
            <UsersRound className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeGroups}</div>
            <p className="text-xs text-muted-foreground">Coaching groups</p>
          </CardContent>
        </Card>
      </div>

      {/* Action Required Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card 
          className={`cursor-pointer transition-colors hover:border-primary ${stats.pendingRegistrations > 0 ? 'border-orange-500/50' : ''}`}
          onClick={() => navigate('/admin/interest-registrations')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Registrations</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingRegistrations}</div>
            {stats.pendingRegistrations > 0 && (
              <Badge variant="secondary" className="mt-1 text-xs">Action required</Badge>
            )}
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-colors hover:border-primary ${stats.pendingBadges > 0 ? 'border-orange-500/50' : ''}`}
          onClick={() => navigate('/admin/clients')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Badges</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingBadges}</div>
            {stats.pendingBadges > 0 && (
              <Badge variant="secondary" className="mt-1 text-xs">Awaiting approval</Badge>
            )}
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-colors hover:border-primary ${stats.pendingDeletions > 0 ? 'border-destructive/50' : ''}`}
          onClick={() => navigate('/admin/deletion-requests')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Deletion Requests</CardTitle>
            <UserX className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingDeletions}</div>
            {stats.pendingDeletions > 0 && (
              <Badge variant="destructive" className="mt-1 text-xs">Requires review</Badge>
            )}
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer transition-colors hover:border-primary"
          onClick={() => navigate('/admin/assessments')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Assessments</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalAssessments}</div>
            <p className="text-xs text-muted-foreground">Active assessments</p>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Programs Widget */}
      <UpcomingProgramsWidget />

      {/* Recent Activity Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Recent Registrations */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                Recent Registrations
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate('/admin/interest-registrations')}>
                View All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {recentRegistrations.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No pending registrations</p>
            ) : (
              <div className="space-y-3">
                {recentRegistrations.map((reg) => (
                  <div
                    key={reg.id}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => navigate('/admin/interest-registrations')}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{reg.user_name}</p>
                      <p className="text-xs text-muted-foreground">{reg.program_name}</p>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {format(new Date(reg.created_at), 'MMM d')}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Enrollments */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Recent Enrollments
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate('/admin/clients')}>
                View All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {recentEnrollments.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No recent enrollments</p>
            ) : (
              <div className="space-y-3">
                {recentEnrollments.map((enroll) => (
                  <div
                    key={enroll.id}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => navigate('/admin/clients')}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{enroll.user_name}</p>
                      <p className="text-xs text-muted-foreground">{enroll.program_name}</p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {format(new Date(enroll.created_at), 'MMM d')}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Deletion Requests */}
        {pendingDeletions.length > 0 && (
          <Card className="border-destructive/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                  Pending Deletion Requests
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => navigate('/admin/deletion-requests')}>
                  Review All
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {pendingDeletions.map((del) => (
                  <div
                    key={del.id}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => navigate('/admin/deletion-requests')}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{del.user_name}</p>
                      {del.reason && (
                        <p className="text-xs text-muted-foreground line-clamp-1">{del.reason}</p>
                      )}
                    </div>
                    <Badge variant="destructive" className="text-xs">
                      {format(new Date(del.created_at), 'MMM d')}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pending Badges */}
        {pendingBadges.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Award className="h-5 w-5" />
                  Pending Badge Approvals
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => navigate('/admin/clients')}>
                  View All
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {pendingBadges.map((badge) => (
                  <div
                    key={badge.id}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => navigate('/admin/clients')}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{badge.user_name}</p>
                      <p className="text-xs text-muted-foreground">{badge.badge_name} • {badge.program_name}</p>
                    </div>
                    <Badge variant="secondary" className="text-xs">Pending</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}