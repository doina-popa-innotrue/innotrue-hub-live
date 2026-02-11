import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, GraduationCap, Users, BookOpen, Calendar, Target, Brain, CheckSquare, Award, UsersRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RichTextDisplay } from '@/components/ui/rich-text-display';
import { PendingAssignmentsWidget } from '@/components/instructor/PendingAssignmentsWidget';
import { format } from 'date-fns';

interface ProgramAssignment {
  id: string;
  program_id: string;
  role: 'instructor' | 'coach';
  program: {
    id: string;
    name: string;
    description: string | null;
    slug: string;
    category: string;
    is_active: boolean;
  };
  module_count: number;
  enrolled_clients_count: number;
}

interface ModuleAssignment {
  id: string;
  module_id: string;
  role: 'instructor' | 'coach';
  module: {
    id: string;
    title: string;
    description: string | null;
    module_type: string;
    estimated_minutes: number | null;
    program: {
      name: string;
      slug: string;
    };
  };
}

interface SharedGoal {
  id: string;
  title: string;
  category: string;
  progress_percentage: number;
  client_name: string;
  client_id: string;
}

interface SharedDecision {
  id: string;
  title: string;
  status: string;
  importance: string;
  client_name: string;
  client_id: string;
}

interface SharedTask {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  client_name: string;
  client_id: string;
}

interface UpcomingSession {
  id: string;
  title: string;
  session_date: string;
  group_id: string;
  group_name: string;
}

interface PendingBadge {
  id: string;
  client_name: string;
  badge_name: string;
  program_name: string;
}

export default function InstructorCoachDashboard() {
  const { user, userRole, userRoles } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;
  const [loading, setLoading] = useState(true);
  const [programAssignments, setProgramAssignments] = useState<ProgramAssignment[]>([]);
  const [moduleAssignments, setModuleAssignments] = useState<ModuleAssignment[]>([]);
  const [sharedGoals, setSharedGoals] = useState<SharedGoal[]>([]);
  const [sharedDecisions, setSharedDecisions] = useState<SharedDecision[]>([]);
  const [sharedTasks, setSharedTasks] = useState<SharedTask[]>([]);
  const [upcomingSessions, setUpcomingSessions] = useState<UpcomingSession[]>([]);
  const [pendingBadges, setPendingBadges] = useState<PendingBadge[]>([]);
  const [groupCount, setGroupCount] = useState(0);

  useEffect(() => {
    if (user) {
      loadAssignments();
      loadAdditionalData();
    }
  }, [user, userRole]);

  const loadAdditionalData = async () => {
    if (!user) return;

    // Load shared goals from clients
    const { data: clientCoaches } = await supabase
      .from('client_coaches')
      .select('client_id')
      .eq('coach_id', user.id);

    const clientIds = clientCoaches?.map(c => c.client_id) || [];

    if (clientIds.length > 0) {
      // Shared goals
      const { data: goalsData } = await supabase
        .from('goal_shares')
        .select(`
          goals!inner (
            id,
            title,
            category,
            progress_percentage,
            user_id
          )
        `)
        .eq('shared_with_user_id', user.id)
        .limit(5);

      if (goalsData) {
        const goalsWithClients = await Promise.all(
          goalsData.map(async (g: any) => {
            const { data: profile } = await supabase
              .from('profiles')
              .select('name')
              .eq('id', g.goals.user_id)
              .single();
            return {
              id: g.goals.id,
              title: g.goals.title,
              category: g.goals.category,
              progress_percentage: g.goals.progress_percentage,
              client_name: profile?.name || 'Unknown',
              client_id: g.goals.user_id
            };
          })
        );
        setSharedGoals(goalsWithClients);
      }

      // Shared decisions
      const { data: decisionsData } = await supabase
        .from('decisions')
        .select('id, title, status, importance, user_id')
        .eq('shared_with_coach', true)
        .in('user_id', clientIds)
        .in('status', ['upcoming', 'in_progress'])
        .limit(5);

      if (decisionsData) {
        const decisionsWithClients = await Promise.all(
          decisionsData.map(async (d) => {
            const { data: profile } = await supabase
              .from('profiles')
              .select('name')
              .eq('id', d.user_id)
              .single();
            return {
              id: d.id,
              title: d.title,
              status: d.status,
              importance: d.importance || 'medium',
              client_name: profile?.name || 'Unknown',
              client_id: d.user_id
            };
          })
        );
        setSharedDecisions(decisionsWithClients);
      }

      // Shared tasks
      const { data: tasksData } = await supabase
        .from('tasks')
        .select('id, title, status, due_date, user_id')
        .eq('shared_with_coach', true)
        .in('user_id', clientIds)
        .neq('status', 'done')
        .order('due_date', { ascending: true, nullsFirst: false })
        .limit(5);

      if (tasksData) {
        const tasksWithClients = await Promise.all(
          tasksData.map(async (t) => {
            const { data: profile } = await supabase
              .from('profiles')
              .select('name')
              .eq('id', t.user_id)
              .single();
            return {
              id: t.id,
              title: t.title,
              status: t.status,
              due_date: t.due_date,
              client_name: profile?.name || 'Unknown',
              client_id: t.user_id
            };
          })
        );
        setSharedTasks(tasksWithClients);
      }
    }

    // Load upcoming group sessions
    const { data: memberships } = await supabase
      .from('group_memberships')
      .select('group_id')
      .eq('user_id', user.id)
      .eq('status', 'active');

    const groupIds = memberships?.map(m => m.group_id) || [];
    setGroupCount(groupIds.length);

    if (groupIds.length > 0) {
      const { data: sessionsData } = await supabase
        .from('group_sessions')
        .select(`
          id,
          title,
          session_date,
          group_id,
          groups!inner (name)
        `)
        .in('group_id', groupIds)
        .gte('session_date', new Date().toISOString())
        .eq('status', 'scheduled')
        .order('session_date', { ascending: true })
        .limit(5);

      if (sessionsData) {
        setUpcomingSessions(sessionsData.map((s: any) => ({
          id: s.id,
          title: s.title,
          session_date: s.session_date,
          group_id: s.group_id,
          group_name: s.groups?.name || ''
        })));
      }
    }

    // Load pending badge approvals
    const { data: badgesData } = await supabase
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

    if (badgesData) {
      const badgesWithClients = await Promise.all(
        badgesData.map(async (b: any) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('name')
            .eq('id', b.user_id)
            .single();
          return {
            id: b.id,
            client_name: profile?.name || 'Unknown',
            badge_name: b.program_badges?.name || '',
            program_name: b.program_badges?.programs?.name || ''
          };
        })
      );
      setPendingBadges(badgesWithClients);
    }
  };

  const loadAssignments = async () => {
    try {
      setLoading(true);

      const showInstructor = userRole === 'instructor';
      const showCoach = userRole === 'coach';

      const programInstructorPromise = showInstructor && userRoles.includes('instructor') && user
        ? supabase
            .from('program_instructors')
            .select(`
              id,
              program_id,
              programs!inner(id, name, description, slug, category, is_active)
            `)
            .eq('instructor_id', user.id)
        : Promise.resolve({ data: [] as { id: string; program_id: string; programs: any }[], error: null });

      const programCoachPromise = showCoach && userRoles.includes('coach') && user
        ? supabase
            .from('program_coaches')
            .select(`
              id,
              program_id,
              programs!inner(id, name, description, slug, category, is_active)
            `)
            .eq('coach_id', user.id)
        : Promise.resolve({ data: [] as { id: string; program_id: string; programs: any }[], error: null });

      const [instructorPrograms, coachPrograms] = await Promise.all([
        programInstructorPromise,
        programCoachPromise,
      ]);

      if (instructorPrograms.error) throw instructorPrograms.error;
      if (coachPrograms.error) throw coachPrograms.error;

      const allProgramIds = new Set([
        ...(instructorPrograms.data || []).map(p => p.program_id),
        ...(coachPrograms.data || []).map(p => p.program_id),
      ]);

      const programsWithStats = await Promise.all(
        Array.from(allProgramIds).map(async (programId) => {
          const instructorAssignment = (instructorPrograms.data || []).find(p => p.program_id === programId);
          const coachAssignment = (coachPrograms.data || []).find(p => p.program_id === programId);
          
          const assignment = instructorAssignment || coachAssignment;
          const role = instructorAssignment ? 'instructor' as const : 'coach' as const;

          const { count: moduleCount } = await supabase
            .from('program_modules')
            .select('*', { count: 'exact', head: true })
            .eq('program_id', programId)
            .eq('is_active', true);

          // Use staff_enrollments view to exclude financial data from staff access
          const { count: clientCount } = await supabase
            .from('staff_enrollments')
            .select('*', { count: 'exact', head: true })
            .eq('program_id', programId)
            .eq('status', 'active');

          return {
            id: assignment!.id,
            program_id: programId,
            role,
            program: (assignment as any).programs,
            module_count: moduleCount || 0,
            enrolled_clients_count: clientCount || 0,
          };
        })
      );

      setProgramAssignments(programsWithStats);

      const moduleInstructorPromise = showInstructor && userRoles.includes('instructor') && user
        ? supabase
            .from('module_instructors')
            .select(`
              id,
              module_id,
              program_modules!inner(
                id,
                title,
                description,
                module_type,
                estimated_minutes,
                programs!inner(name, slug)
              )
            `)
            .eq('instructor_id', user.id)
        : Promise.resolve({ data: [], error: null });

      const moduleCoachPromise = showCoach && userRoles.includes('coach') && user
        ? supabase
            .from('module_coaches')
            .select(`
              id,
              module_id,
              program_modules!inner(
                id,
                title,
                description,
                module_type,
                estimated_minutes,
                programs!inner(name, slug)
              )
            `)
            .eq('coach_id', user.id)
        : Promise.resolve({ data: [], error: null });

      const [instructorModules, coachModules] = await Promise.all([
        moduleInstructorPromise,
        moduleCoachPromise,
      ]);

      if (instructorModules.error) throw instructorModules.error;
      if (coachModules.error) throw coachModules.error;

      const allModules = [
        ...(instructorModules.data || []).map(m => ({
          id: m.id,
          module_id: m.module_id,
          role: 'instructor' as const,
          module: {
            ...(m as any).program_modules,
            program: (m as any).program_modules.programs,
          },
        })),
        ...(coachModules.data || []).map(m => ({
          id: m.id,
          module_id: m.module_id,
          role: 'coach' as const,
          module: {
            ...(m as any).program_modules,
            program: (m as any).program_modules.programs,
          },
        })),
      ];

      setModuleAssignments(allModules);
    } catch (error: any) {
      console.error('Error loading assignments:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      cta: 'bg-blue-500',
      leadership: 'bg-purple-500',
      executive: 'bg-amber-500',
      ai: 'bg-green-500',
      'deep-dive': 'bg-red-500',
    };
    return colors[category] || 'bg-gray-500';
  };

  const getModuleTypeIcon = (type: string) => {
    switch (type) {
      case 'session':
        return <Users className="h-4 w-4" />;
      case 'assignment':
        return <BookOpen className="h-4 w-4" />;
      case 'reflection':
        return <Calendar className="h-4 w-4" />;
      case 'resource':
        return <GraduationCap className="h-4 w-4" />;
      default:
        return <BookOpen className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const totalPrograms = programAssignments.length;
  const totalModules = moduleAssignments.length;
  const totalClients = programAssignments.reduce((sum, p) => sum + p.enrolled_clients_count, 0);
  const instructorProgramCount = programAssignments.filter(p => p.role === 'instructor').length;
  const coachProgramCount = programAssignments.filter(p => p.role === 'coach').length;

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Assigned Programs</h1>
        <p className="text-muted-foreground">
          Overview of your instructor and coaching assignments
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => navigate('/teaching')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Programs</CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPrograms}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {instructorProgramCount} instructor, {coachProgramCount} coach
            </p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => navigate('/teaching/students')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Clients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalClients}</div>
            <p className="text-xs text-muted-foreground mt-1">Across all programs</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => navigate('/teaching/groups')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Groups</CardTitle>
            <UsersRound className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{groupCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Active memberships</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => navigate('/teaching/badges')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Badges</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingBadges.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Awaiting approval</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Your Roles</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 flex-wrap">
              {userRoles.includes('instructor') && (
                <Badge variant="default">Instructor</Badge>
              )}
              {userRoles.includes('coach') && (
                <Badge variant="secondary">Coach</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Assessments & Upcoming Sessions */}
      <div className="grid gap-4 md:grid-cols-2">
        <PendingAssignmentsWidget />
        
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Upcoming Sessions
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate('/teaching/groups')}>
                View All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {upcomingSessions.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No upcoming sessions</p>
            ) : (
              <div className="space-y-3">
                {upcomingSessions.slice(0, 3).map((session) => (
                  <div
                    key={session.id}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/groups/${session.group_id}`)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{session.title}</p>
                      <p className="text-xs text-muted-foreground">{session.group_name}</p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {format(new Date(session.session_date), 'MMM d, h:mm a')}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Shared Items from Clients */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Shared Goals */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Target className="h-5 w-5" />
                Shared Goals
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate('/teaching/shared-goals')}>
                View All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {sharedGoals.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No shared goals</p>
            ) : (
              <div className="space-y-3">
                {sharedGoals.slice(0, 3).map((goal) => (
                  <div
                    key={goal.id}
                    className="p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/teaching/students/${goal.client_id}`)}
                  >
                    <p className="font-medium truncate">{goal.title}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-muted-foreground">{goal.client_name}</span>
                      <Badge variant="outline" className="text-xs">{goal.progress_percentage}%</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Shared Decisions */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Brain className="h-5 w-5" />
                Shared Decisions
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate('/coaching/decisions')}>
                View All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {sharedDecisions.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No shared decisions</p>
            ) : (
              <div className="space-y-3">
                {sharedDecisions.slice(0, 3).map((decision) => (
                  <div
                    key={decision.id}
                    className="p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/coaching/decisions/${decision.id}`)}
                  >
                    <p className="font-medium truncate">{decision.title}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-muted-foreground">{decision.client_name}</span>
                      <Badge variant={decision.importance === 'high' || decision.importance === 'critical' ? 'destructive' : 'outline'} className="text-xs">
                        {decision.importance}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Shared Tasks */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckSquare className="h-5 w-5" />
                Shared Tasks
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate('/coaching/tasks')}>
                View All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {sharedTasks.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No shared tasks</p>
            ) : (
              <div className="space-y-3">
                {sharedTasks.slice(0, 3).map((task) => (
                  <div
                    key={task.id}
                    className="p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/teaching/students/${task.client_id}`)}
                  >
                    <p className="font-medium truncate">{task.title}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-muted-foreground">{task.client_name}</span>
                      {task.due_date && (
                        <Badge variant="outline" className="text-xs">
                          {format(new Date(task.due_date), 'MMM d')}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="programs" className="space-y-4">
        <TabsList>
          <TabsTrigger value="programs">
            <GraduationCap className="h-4 w-4 mr-2" />
            Programs ({programAssignments.length})
          </TabsTrigger>
          <TabsTrigger value="modules">
            <BookOpen className="h-4 w-4 mr-2" />
            Individual Modules ({moduleAssignments.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="programs" className="space-y-4">
          {programAssignments.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No program assignments yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {programAssignments.map((assignment) => (
                <Card key={assignment.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge
                            variant={assignment.role === 'instructor' ? 'default' : 'secondary'}
                          >
                            {assignment.role === 'instructor' ? '👨‍🏫 Instructor' : '🎯 Coach'}
                          </Badge>
                          <div className={`h-2 w-2 rounded-full ${getCategoryColor(assignment.program.category)}`} />
                          <span className="text-xs text-muted-foreground capitalize">
                            {assignment.program.category}
                          </span>
                        </div>
                        <CardTitle className="text-xl">{assignment.program.name}</CardTitle>
                        {assignment.program.description && (
                          <RichTextDisplay 
                            content={assignment.program.description} 
                            className="text-sm text-muted-foreground line-clamp-2" 
                          />
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1">
                          <BookOpen className="h-4 w-4" />
                          {assignment.module_count} modules
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          {assignment.enrolled_clients_count} clients
                        </span>
                      </div>
                    </div>
                    <Button
                      onClick={() => navigate(`/teaching/programs/${assignment.program.slug}`)}
                      className="w-full"
                    >
                      View Program Details
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="modules" className="space-y-4">
          {moduleAssignments.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No individual module assignments yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {moduleAssignments.map((assignment) => (
                <Card key={assignment.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="flex items-center gap-2">
                          {getModuleTypeIcon(assignment.module.module_type)}
                          <Badge
                            variant={assignment.role === 'instructor' ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {assignment.role === 'instructor' ? 'Instructor' : 'Coach'}
                          </Badge>
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium">{assignment.module.title}</h4>
                          <p className="text-sm text-muted-foreground">
                            Program: {assignment.module.program.name}
                            {assignment.module.estimated_minutes && (
                              <span className="ml-2">• {assignment.module.estimated_minutes} min</span>
                            )}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/teaching/programs/${assignment.module.program.slug}`)}
                      >
                        View
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}