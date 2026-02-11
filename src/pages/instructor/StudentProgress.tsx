import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Loader2, Users, TrendingUp, TrendingDown, Search, Filter, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { hasTierAccess } from '@/lib/tierUtils';

interface StudentProgress {
  enrollment_id: string;
  client_user_id: string;
  client_name: string;
  client_email: string;
  program_id: string;
  program_name: string;
  program_slug: string;
  enrollment_status: string;
  tier: string;
  start_date: string;
  total_modules: number;
  completed_modules: number;
  in_progress_modules: number;
  completion_percentage: number;
  last_activity: string | null;
}

export default function StudentProgress() {
  const { user, userRole, userRoles } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<StudentProgress[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<StudentProgress[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [programFilter, setProgramFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'progress' | 'activity' | 'program' | 'status'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    if (user) {
      loadStudentProgress();
    }
  }, [user, userRole]);

  useEffect(() => {
    filterAndSortStudents();
  }, [students, searchQuery, statusFilter, programFilter, sortBy, sortDirection]);

  const loadStudentProgress = async () => {
    try {
      setLoading(true);

      // Filter based on the currently selected role view
      const showInstructor = userRole === 'instructor';
      const showCoach = userRole === 'coach';

      // Get all programs the instructor/coach is assigned to based on selected role
      const programInstructorPromise = showInstructor && userRoles.includes('instructor') && user
        ? supabase
            .from('program_instructors')
            .select('program_id')
            .eq('instructor_id', user.id ?? '')
        : Promise.resolve({ data: [], error: null });

      const programCoachPromise = showCoach && userRoles.includes('coach') && user
        ? supabase
            .from('program_coaches')
            .select('program_id')
            .eq('coach_id', user.id ?? '')
        : Promise.resolve({ data: [], error: null });

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

      if (allProgramIds.size === 0) {
        setStudents([]);
        setLoading(false);
        return;
      }

      // Get all enrollments for these programs with program tiers (using staff_enrollments view to exclude financial data)
      const { data: enrollments, error: enrollmentsError } = await supabase
        .from('staff_enrollments')
        .select(`
          id,
          client_user_id,
          program_id,
          status,
          tier,
          start_date,
          programs!inner(name, slug, tiers)
        `)
        .in('program_id', Array.from(allProgramIds));

      if (enrollmentsError) throw enrollmentsError;

      // Get student details and progress for each enrollment
      const studentProgressData = await Promise.all(
        (enrollments || []).map(async (enrollment) => {
          const programTiers = ((enrollment as any).programs.tiers as string[]) || [];
          const userTier = enrollment.tier || programTiers[0] || 'essentials';

          // Get student profile
          const { data: profile } = await supabase
            .from('profiles')
            .select('name, username')
            .eq('id', enrollment.client_user_id ?? '')
            .single();

          // Get all modules in program with tier info
          const { data: allModules } = await supabase
            .from('program_modules')
            .select('id, tier_required')
            .eq('program_id', enrollment.program_id ?? '')
            .eq('is_active', true);

          // Filter to accessible modules based on user's tier
          const accessibleModules = (allModules || []).filter(m =>
            hasTierAccess(programTiers, userTier, m.tier_required)
          );
          const accessibleModuleIds = new Set(accessibleModules.map(m => m.id));

          // Get module progress
          const { data: moduleProgress } = await supabase
            .from('module_progress')
            .select('status, updated_at, module_id')
            .eq('enrollment_id', enrollment.id ?? '');

          // Filter progress to accessible modules only
          const accessibleProgress = (moduleProgress || []).filter(m => 
            accessibleModuleIds.has(m.module_id)
          );

          const totalModules = accessibleModules.length;
          const completedModules = accessibleProgress.filter(m => m.status === 'completed').length;
          const inProgressModules = accessibleProgress.filter(m => m.status === 'in_progress').length;
          const completionPercentage = totalModules > 0 ? (completedModules / totalModules) * 100 : 0;

          // Get last activity
          const lastActivity = accessibleProgress.length > 0
            ? accessibleProgress.sort((a, b) =>
                new Date(b.updated_at ?? '').getTime() - new Date(a.updated_at ?? '').getTime()
              )[0].updated_at
            : null;

          return {
            enrollment_id: enrollment.id,
            client_user_id: enrollment.client_user_id ?? '',
            client_name: profile?.name || 'Unknown',
            client_email: profile?.username || 'N/A',
            program_id: enrollment.program_id ?? '',
            program_name: (enrollment as any).programs.name,
            program_slug: (enrollment as any).programs.slug,
            enrollment_status: enrollment.status,
            tier: enrollment.tier || 'essentials',
            start_date: enrollment.start_date || '',
            total_modules: totalModules,
            completed_modules: completedModules,
            in_progress_modules: inProgressModules,
            completion_percentage: Math.round(completionPercentage),
            last_activity: lastActivity,
          };
        })
      );

      setStudents(studentProgressData as StudentProgress[]);
    } catch (error: any) {
      console.error('Error loading student progress:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortStudents = () => {
    let filtered = [...students];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        s => s.client_name.toLowerCase().includes(query) ||
             s.client_email.toLowerCase().includes(query) ||
             s.program_name.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(s => s.enrollment_status === statusFilter);
    }

    // Program filter
    if (programFilter !== 'all') {
      filtered = filtered.filter(s => s.program_id === programFilter);
    }

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = a.client_name.localeCompare(b.client_name);
          break;
        case 'program':
          comparison = a.program_name.localeCompare(b.program_name);
          break;
        case 'status':
          comparison = a.enrollment_status.localeCompare(b.enrollment_status);
          break;
        case 'progress':
          comparison = a.completion_percentage - b.completion_percentage;
          break;
        case 'activity':
          if (!a.last_activity && !b.last_activity) comparison = 0;
          else if (!a.last_activity) comparison = 1;
          else if (!b.last_activity) comparison = -1;
          else comparison = new Date(a.last_activity).getTime() - new Date(b.last_activity).getTime();
          break;
        default:
          comparison = 0;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    setFilteredStudents(filtered);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      active: 'default',
      completed: 'secondary',
      paused: 'outline',
    };
    return <Badge variant={variants[status] || 'default'}>{status}</Badge>;
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 80) return 'bg-success';
    if (percentage >= 50) return 'bg-primary';
    if (percentage >= 20) return 'bg-warning';
    return 'bg-destructive';
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const uniquePrograms = Array.from(new Set(students.map(s => ({ id: s.program_id, name: s.program_name }))));
  const totalStudents = students.length;
  const avgCompletion = students.length > 0
    ? Math.round(students.reduce((sum, s) => sum + s.completion_percentage, 0) / students.length)
    : 0;
  const activeStudents = students.filter(s => s.enrollment_status === 'active').length;
  const completedStudents = students.filter(s => s.enrollment_status === 'completed').length;

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Client Progress Overview</h1>
        <p className="text-muted-foreground">
          Monitor completion rates and performance across all your assigned programs
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStudents}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Across {uniquePrograms.length} programs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Completion</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgCompletion}%</div>
            <Progress value={avgCompletion} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Enrollments</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeStudents}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Currently learning
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <TrendingDown className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedStudents}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Finished programs
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search clients or programs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
              </SelectContent>
            </Select>

            <Select value={programFilter} onValueChange={setProgramFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Programs" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Programs</SelectItem>
                {uniquePrograms.map(program => (
                  <SelectItem key={program.id} value={program.id}>
                    {program.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Sort By" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="program">Programme</SelectItem>
                <SelectItem value="status">Status</SelectItem>
                <SelectItem value="progress">Progress</SelectItem>
                <SelectItem value="activity">Last Activity</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="icon"
              onClick={() => setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')}
              title={sortDirection === 'asc' ? 'Ascending' : 'Descending'}
            >
              {sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Clients Table */}
      <Card>
        <CardHeader>
          <CardTitle>Clients ({filteredStudents.length})</CardTitle>
          <CardDescription>
            Detailed progress information for each client enrollment
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredStudents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No clients found matching your filters
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-ml-3 h-8 data-[state=active]:bg-accent"
                      onClick={() => {
                        if (sortBy === 'name') {
                          setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortBy('name');
                          setSortDirection('asc');
                        }
                      }}
                    >
                      Client
                      {sortBy === 'name' ? (
                        sortDirection === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />
                      ) : (
                        <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />
                      )}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-ml-3 h-8 data-[state=active]:bg-accent"
                      onClick={() => {
                        if (sortBy === 'program') {
                          setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortBy('program');
                          setSortDirection('asc');
                        }
                      }}
                    >
                      Programme
                      {sortBy === 'program' ? (
                        sortDirection === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />
                      ) : (
                        <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />
                      )}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-ml-3 h-8 data-[state=active]:bg-accent"
                      onClick={() => {
                        if (sortBy === 'status') {
                          setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortBy('status');
                          setSortDirection('asc');
                        }
                      }}
                    >
                      Status
                      {sortBy === 'status' ? (
                        sortDirection === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />
                      ) : (
                        <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />
                      )}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-ml-3 h-8 data-[state=active]:bg-accent"
                      onClick={() => {
                        if (sortBy === 'progress') {
                          setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortBy('progress');
                          setSortDirection('desc');
                        }
                      }}
                    >
                      Progress
                      {sortBy === 'progress' ? (
                        sortDirection === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />
                      ) : (
                        <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />
                      )}
                    </Button>
                  </TableHead>
                  <TableHead>Modules</TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-ml-3 h-8 data-[state=active]:bg-accent"
                      onClick={() => {
                        if (sortBy === 'activity') {
                          setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortBy('activity');
                          setSortDirection('desc');
                        }
                      }}
                    >
                      Last Activity
                      {sortBy === 'activity' ? (
                        sortDirection === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />
                      ) : (
                        <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />
                      )}
                    </Button>
                  </TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.map((student) => (
                  <TableRow key={student.enrollment_id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{student.client_name}</div>
                        <div className="text-sm text-muted-foreground">{student.client_email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{student.program_name}</div>
                        <div className="text-sm text-muted-foreground capitalize">{student.tier}</div>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(student.enrollment_status)}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{student.completion_percentage}%</span>
                        </div>
                        <Progress 
                          value={student.completion_percentage} 
                          className="h-2"
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div className="font-medium text-success">
                          {student.completed_modules} completed
                        </div>
                        <div className="text-muted-foreground">
                          {student.in_progress_modules} in progress
                        </div>
                        <div className="text-muted-foreground">
                          {student.total_modules - student.completed_modules - student.in_progress_modules} not started
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDate(student.last_activity)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/teaching/students/${student.enrollment_id}`)}
                      >
                        View Details
                      </Button>
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
