import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, Users, BookOpen, GraduationCap, Clock, ExternalLink, UserCog } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { RichTextDisplay } from '@/components/ui/rich-text-display';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { InstructorCoachAssignment } from '@/components/admin/InstructorCoachAssignment';

interface Module {
  id: string;
  title: string;
  description: string | null;
  module_type: string;
  estimated_minutes: number | null;
  order_index: number;
  is_active: boolean;
  tier_required: string | null;
  links: unknown;
  code: string | null;
  is_individualized?: boolean;
}

interface Program {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  category: string;
  is_active: boolean;
  tiers: unknown;
  logo_url: string | null;
}

interface EnrolledStudent {
  id: string;
  client_user_id: string;
  status: string;
  tier: string | null;
  start_date: string | null;
  profile: {
    name: string | null;
  } | null;
}

export default function InstructorProgramDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user, userRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [program, setProgram] = useState<Program | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [enrolledStudents, setEnrolledStudents] = useState<EnrolledStudent[]>([]);
  const [assignmentRole, setAssignmentRole] = useState<'instructor' | 'coach' | null>(null);

  useEffect(() => {
    if (user && slug) {
      loadProgramData();
    }
  }, [user, slug]);

  const loadProgramData = async () => {
    try {
      setLoading(true);

      // First get the program by slug
      const { data: programData, error: programError } = await supabase
        .from('programs')
        .select('*')
        .eq('slug', slug ?? '')
        .single();

      if (programError || !programData) {
        console.error('Error loading program:', programError);
        setLoading(false);
        return;
      }

      setProgram(programData as Program);

      // Check if user is assigned as instructor or coach to this program
      const userId: string = user?.id ?? '';
      const [instructorCheck, coachCheck] = await Promise.all([
        supabase
          .from('program_instructors')
          .select('id')
          .eq('program_id', programData.id)
          .eq('instructor_id', userId)
          .maybeSingle(),
        supabase
          .from('program_coaches')
          .select('id')
          .eq('program_id', programData.id)
          .eq('coach_id', userId)
          .maybeSingle(),
      ]);

      if (instructorCheck.data) {
        setAssignmentRole('instructor');
      } else if (coachCheck.data) {
        setAssignmentRole('coach');
      }

      // Load modules
      const { data: modulesData } = await supabase
        .from('program_modules')
        .select('*')
        .eq('program_id', programData.id)
        .eq('is_active', true)
        .order('order_index');

      setModules((modulesData || []) as Module[]);

      // Load enrolled students (using staff_enrollments view to exclude financial data)
      const { data: enrollmentsData } = await supabase
        .from('staff_enrollments')
        .select(`
          id,
          client_user_id,
          status,
          tier,
          start_date
        `)
        .eq('program_id', programData.id)
        .eq('status', 'active');

      if (enrollmentsData && enrollmentsData.length > 0) {
        // Get profiles for enrolled users
        const userIds = enrollmentsData.map(e => e.client_user_id).filter((id): id is string => id != null);
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', userIds);

        const studentsWithProfiles = enrollmentsData.map(enrollment => ({
          ...enrollment,
          client_user_id: enrollment.client_user_id ?? '',
          id: enrollment.id ?? '',
          status: enrollment.status ?? 'active',
          profile: profilesData?.find(p => p.id === enrollment.client_user_id) || null,
        })) as EnrolledStudent[];

        setEnrolledStudents(studentsWithProfiles);
      }
    } catch (error) {
      console.error('Error loading program data:', error);
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

  if (!program) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">Program not found or you don't have access.</p>
            <Button onClick={() => navigate('/teaching')} className="mt-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Button variant="ghost" onClick={() => navigate('/teaching')} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
          <div className="flex items-center gap-3 mb-2">
            {program.logo_url && (
              <img
                src={program.logo_url}
                alt={program.name}
                className="h-12 w-12 object-contain"
              />
            )}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className={`h-3 w-3 rounded-full ${getCategoryColor(program.category)}`} />
                <span className="text-sm text-muted-foreground capitalize">{program.category}</span>
                {assignmentRole && (
                  <Badge variant={assignmentRole === 'instructor' ? 'default' : 'secondary'}>
                    {assignmentRole === 'instructor' ? '👨‍🏫 Instructor' : '🎯 Coach'}
                  </Badge>
                )}
              </div>
              <h1 className="text-3xl font-bold">{program.name}</h1>
            </div>
          </div>
          {program.description && (
            <RichTextDisplay content={program.description} className="text-muted-foreground mt-2 max-w-3xl" />
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Modules</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{modules.length}</div>
            <p className="text-xs text-muted-foreground">Active modules in program</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Enrolled Clients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{enrolledStudents.length}</div>
            <p className="text-xs text-muted-foreground">Currently active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Duration</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(modules.reduce((sum, m) => sum + (m.estimated_minutes || 0), 0) / 60)}h
            </div>
            <p className="text-xs text-muted-foreground">Estimated total time</p>
          </CardContent>
        </Card>
      </div>

      {/* Content Tabs */}
      <Tabs defaultValue="modules" className="space-y-4">
        <TabsList>
          <TabsTrigger value="modules">
            <BookOpen className="h-4 w-4 mr-2" />
            Modules ({modules.length})
          </TabsTrigger>
          <TabsTrigger value="students">
            <Users className="h-4 w-4 mr-2" />
            Clients ({enrolledStudents.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="modules" className="space-y-4">
          {modules.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No modules in this program yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {modules.map((module, index) => (
                <Card 
                  key={module.id} 
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => navigate(`/teaching/programs/${program.id}/modules/${module.id}`)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        {getModuleTypeIcon(module.module_type)}
                        <div>
                          <CardTitle className="flex items-center gap-2 flex-wrap">
                            Module {index + 1}: {module.title}
                            {module.code && (
                              <Badge variant="outline" className="text-xs font-mono">{module.code}</Badge>
                            )}
                            {module.is_individualized && (
                              <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20">
                                <UserCog className="h-3 w-3 mr-1" />
                                Personalised
                              </Badge>
                            )}
                            <Badge variant="outline">{module.module_type}</Badge>
                            {module.tier_required && (
                              <Badge variant="secondary">{module.tier_required}</Badge>
                            )}
                          </CardTitle>
                          {module.estimated_minutes && (
                            <p className="text-sm text-muted-foreground mt-1">
                              <Clock className="inline h-3 w-3 mr-1" />
                              {module.estimated_minutes} minutes
                            </p>
                          )}
                        </div>
                      </div>
                      <Button variant="ghost" size="sm">
                        View Details →
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4" onClick={(e) => e.stopPropagation()}>
                    {module.description && (
                      <RichTextDisplay content={module.description} className="text-sm text-muted-foreground" />
                    )}
                    {!!module.links && Array.isArray(module.links) && (module.links as { name: string; url: string }[]).length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Resource Links:</p>
                        <div className="flex flex-wrap gap-2">
                          {(module.links as { name: string; url: string }[]).map((link, linkIndex) => (
                            <Button
                              key={linkIndex}
                              variant="outline"
                              size="sm"
                              asChild
                            >
                              <a href={link.url} target="_blank" rel="noopener noreferrer">
                                {link.name}
                                <ExternalLink className="ml-2 h-3 w-3" />
                              </a>
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="border-t pt-4">
                      <InstructorCoachAssignment
                        entityType="module"
                        entityId={module.id}
                        moduleTypeName={module.module_type}
                        readOnly={true}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="students" className="space-y-4">
          {enrolledStudents.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No clients enrolled yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {enrolledStudents.map((student) => (
                <Card key={student.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <GraduationCap className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h4 className="font-medium">
                            {student.profile?.name || 'Unknown Student'}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            {student.tier && <span>Tier: {student.tier}</span>}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/teaching/students/${student.id}`)}
                      >
                        View Progress
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
