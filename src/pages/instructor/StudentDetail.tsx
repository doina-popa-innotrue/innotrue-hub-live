import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Loader2, ArrowLeft, Clock, CheckCircle2, Circle, PlayCircle, Calendar, TrendingUp, Mail, User, Edit2, MessageSquare, BookOpen, UserCog } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import ClientReflectionsView from '@/components/modules/ClientReflectionsView';
import ModuleFeedback from '@/components/modules/ModuleFeedback';
import { ModuleAssignmentsView } from '@/components/modules/ModuleAssignmentsView';
import { ModuleSessionManager } from '@/components/modules/ModuleSessionManager';
import { hasTierAccess } from '@/lib/tierUtils';
import ClientStaffNotes from '@/components/admin/ClientStaffNotes';
import { ManualCompletionControls } from '@/components/admin/ManualCompletionControls';

interface StudentInfo {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  enrollment_id: string;
  program_id: string;
  program_name: string;
  program_slug: string;
  program_tiers: string[];
  enrollment_status: string;
  tier: string;
  start_date: string;
  end_date: string | null;
}

interface ModuleProgress {
  id: string;
  module_id: string;
  module_title: string;
  module_description: string | null;
  module_type: string;
  estimated_minutes: number | null;
  order_index: number;
  tier_required: string;
  is_individualized: boolean;
  status: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  notes: string | null;
  time_spent_minutes: number;
  instructor_note_id?: string;
  instructor_notes?: string | null;
}

interface ActivityEvent {
  date: string;
  module_title: string;
  event_type: 'started' | 'completed' | 'updated';
  status: string;
}

export default function StudentDetail() {
  const { enrollmentId } = useParams<{ enrollmentId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [studentInfo, setStudentInfo] = useState<StudentInfo | null>(null);
  const [moduleProgress, setModuleProgress] = useState<ModuleProgress[]>([]);
  const [activityHistory, setActivityHistory] = useState<ActivityEvent[]>([]);
  const [editingNote, setEditingNote] = useState<{ moduleProgressId: string; currentNote: string; noteId?: string } | null>(null);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [viewingReflections, setViewingReflections] = useState<{ moduleProgressId: string; moduleTitle: string; moduleId: string } | null>(null);

  // Auto-open the reflections dialog if query params specify a module
  useEffect(() => {
    const moduleId = searchParams.get('moduleId');
    const moduleProgressId = searchParams.get('moduleProgressId');
    
    if (moduleId && moduleProgressId && moduleProgress.length > 0 && !loading) {
      const module = moduleProgress.find(m => m.module_id === moduleId);
      if (module) {
        setViewingReflections({
          moduleProgressId: moduleProgressId,
          moduleTitle: module.module_title,
          moduleId: moduleId
        });
        // Keep query params in URL so state persists on refresh
      }
    }
  }, [searchParams, moduleProgress, loading]);

  // Clear query params when dialog is closed manually
  const handleCloseReflectionsDialog = (open: boolean) => {
    if (!open) {
      setViewingReflections(null);
      // Clear query params when user closes the dialog
      if (searchParams.has('moduleId') || searchParams.has('moduleProgressId')) {
        setSearchParams({});
      }
    }
  };

  useEffect(() => {
    if (enrollmentId) {
      loadStudentDetail();
    }
  }, [enrollmentId]);

  const loadStudentDetail = async () => {
    try {
      setLoading(true);

      // Get enrollment details with program tiers (using staff_enrollments view to exclude financial data)
      const { data: enrollment, error: enrollmentError } = await supabase
        .from('staff_enrollments')
        .select(`
          id,
          client_user_id,
          program_id,
          status,
          tier,
          start_date,
          end_date,
          programs!inner(name, slug, tiers)
        `)
        .eq('id', enrollmentId!)
        .single();

      if (enrollmentError) throw enrollmentError;

      const programTiers = ((enrollment as any).programs.tiers as string[]) || [];

      // Get student profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('name, avatar_url, username')
        .eq('id', enrollment.client_user_id)
        .single();

      setStudentInfo({
        id: enrollment.client_user_id,
        name: profile?.name || 'Unknown',
        email: profile?.username || 'N/A',
        avatar_url: profile?.avatar_url || null,
        enrollment_id: enrollment.id,
        program_id: enrollment.program_id,
        program_name: (enrollment as any).programs.name,
        program_slug: (enrollment as any).programs.slug,
        program_tiers: programTiers,
        enrollment_status: enrollment.status,
        tier: enrollment.tier || programTiers[0] || 'essentials',
        start_date: enrollment.start_date || '',
        end_date: enrollment.end_date || null,
      });

      // Get all modules for the program
      const { data: modules, error: modulesError } = await supabase
        .from('program_modules')
        .select('*')
        .eq('program_id', enrollment.program_id)
        .eq('is_active', true)
        .order('order_index');

      if (modulesError) throw modulesError;

      // Get progress for each module
      const { data: progress, error: progressError } = await supabase
        .from('module_progress')
        .select('*')
        .eq('enrollment_id', enrollmentId!);

      if (progressError) throw progressError;

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      // Get instructor notes for this enrollment's modules
      const progressIds = progress?.map(p => p.id) || [];
      const { data: instructorNotes } = await supabase
        .from('instructor_module_notes')
        .select('*')
        .in('module_progress_id', progressIds)
        .eq('instructor_id', user?.id || '');


      // Combine module data with progress
      const moduleProgressData: ModuleProgress[] = (modules || []).map(module => {
        const moduleProgress = progress?.find(p => p.module_id === module.id);
        const instructorNote = instructorNotes?.find(n => n.module_progress_id === moduleProgress?.id);
        
        // Calculate time spent (mock data for now - could be tracked via real usage data)
        const timeSpent = moduleProgress?.status === 'completed' 
          ? module.estimated_minutes || 0
          : moduleProgress?.status === 'in_progress'
          ? Math.floor((module.estimated_minutes || 0) * 0.5)
          : 0;

        return {
          id: moduleProgress?.id || '',
          module_id: module.id,
          module_title: module.title,
          module_description: module.description,
          module_type: module.module_type,
          estimated_minutes: module.estimated_minutes,
          order_index: module.order_index,
          tier_required: module.tier_required || 'essentials',
          is_individualized: module.is_individualized || false,
          status: moduleProgress?.status || 'not_started',
          completed_at: moduleProgress?.completed_at || null,
          created_at: moduleProgress?.created_at || '',
          updated_at: moduleProgress?.updated_at || '',
          notes: moduleProgress?.notes || null,
          time_spent_minutes: timeSpent,
          instructor_note_id: instructorNote?.id,
          instructor_notes: instructorNote?.notes || null,
        };
      });

      setModuleProgress(moduleProgressData);

      // Build activity history
      const activities: ActivityEvent[] = [];
      
      progress?.forEach(p => {
        const module = modules?.find(m => m.id === p.module_id);
        if (!module) return;

        // Only show "started" if the module is actually in_progress or completed
        // (not for records with status 'not_started' which are created when viewing modules)
        if (p.created_at && (p.status === 'in_progress' || p.status === 'completed')) {
          activities.push({
            date: p.created_at,
            module_title: module.title,
            event_type: 'started',
            status: 'in_progress',
          });
        }

        // Add completed event
        if (p.status === 'completed' && p.completed_at) {
          activities.push({
            date: p.completed_at,
            module_title: module.title,
            event_type: 'completed',
            status: 'completed',
          });
        }

        // Add updated events (if updated after creation)
        if (p.updated_at && p.updated_at !== p.created_at && p.status === 'in_progress') {
          activities.push({
            date: p.updated_at,
            module_title: module.title,
            event_type: 'updated',
            status: 'in_progress',
          });
        }
      });

      // Sort by date descending
      activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setActivityHistory(activities.slice(0, 20)); // Latest 20 activities

    } catch (error: any) {
      console.error('Error loading student detail:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'in_progress':
        return <PlayCircle className="h-5 w-5 text-blue-500" />;
      default:
        return <Circle className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      completed: 'default',
      in_progress: 'secondary',
      not_started: 'outline',
    };
    return (
      <Badge variant={variants[status] || 'outline'}>
        {status === 'not_started' ? 'Not Started' : status === 'in_progress' ? 'In Progress' : 'Completed'}
      </Badge>
    );
  };

  const getModuleTypeIcon = (type: string) => {
    const icons: Record<string, string> = {
      session: '👥',
      assignment: '📝',
      reflection: '💭',
      resource: '📚',
    };
    return icons[type] || '📄';
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (minutes: number) => {
    if (minutes === 0) return '0m';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };

  const handleEditNote = (moduleProgressId: string, currentNote: string | null, noteId?: string) => {
    setEditingNote({ moduleProgressId, currentNote: currentNote || '', noteId });
    setNoteText(currentNote || '');
  };

  const handleSaveNote = async () => {
    if (!editingNote) return;

    try {
      setSavingNote(true);
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        toast({
          title: 'Error',
          description: 'You must be logged in to save notes',
          variant: 'destructive',
        });
        return;
      }

      if (editingNote.noteId) {
        // Update existing note
        const { error } = await supabase
          .from('instructor_module_notes')
          .update({ notes: noteText })
          .eq('id', editingNote.noteId);

        if (error) throw error;
      } else {
        // Create new note
        const { error } = await supabase
          .from('instructor_module_notes')
          .insert({
            module_progress_id: editingNote.moduleProgressId,
            instructor_id: user.id,
            notes: noteText,
          });

        if (error) throw error;
      }

      toast({
        title: 'Success',
        description: 'Instructor note saved successfully',
      });

      // Reload data
      await loadStudentDetail();
      setEditingNote(null);
      setNoteText('');
    } catch (error: any) {
      console.error('Error saving note:', error);
      toast({
        title: 'Error',
        description: 'Failed to save note. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSavingNote(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!studentInfo) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">Client enrollment not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Filter modules to only those accessible to the student based on their tier
  const accessibleModules = moduleProgress.filter(m => 
    hasTierAccess(
      studentInfo.program_tiers,
      studentInfo.tier,
      m.tier_required
    )
  );
  const completedModules = accessibleModules.filter(m => m.status === 'completed').length;
  const inProgressModules = accessibleModules.filter(m => m.status === 'in_progress').length;
  const notStartedModules = accessibleModules.filter(m => m.status === 'not_started').length;
  const totalModules = accessibleModules.length;
  const completionPercentage = totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0;
  const totalTimeSpent = moduleProgress.reduce((sum, m) => sum + m.time_spent_minutes, 0);
  const totalEstimatedTime = moduleProgress.reduce((sum, m) => sum + (m.estimated_minutes || 0), 0);

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => navigate('/teaching/students')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Client Progress Detail</h1>
          <p className="text-muted-foreground">{studentInfo.program_name}</p>
        </div>
      </div>

      {/* Client Info */}
      <Card>
        <CardHeader>
          <CardTitle>Client Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-6">
            <Avatar className="h-20 w-20">
              <AvatarImage src={studentInfo.avatar_url || undefined} />
              <AvatarFallback className="text-2xl">
                {studentInfo.name.split(' ').map(n => n[0]).join('').toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <User className="h-4 w-4" />
                    Client Name
                  </div>
                  <div className="font-medium">{studentInfo.name}</div>
                </div>
                <div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Mail className="h-4 w-4" />
                    Email
                  </div>
                  <div className="font-medium">{studentInfo.email}</div>
                </div>
                <div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Calendar className="h-4 w-4" />
                    Start Date
                  </div>
                  <div className="font-medium">{formatDate(studentInfo.start_date)}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Enrollment Status</div>
                  <Badge variant={studentInfo.enrollment_status === 'active' ? 'default' : 'secondary'}>
                    {studentInfo.enrollment_status}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Progress Summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall Progress</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completionPercentage}%</div>
            <Progress value={completionPercentage} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedModules}</div>
            <p className="text-xs text-muted-foreground mt-1">
              of {totalModules} modules
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <PlayCircle className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inProgressModules}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {notStartedModules} not started
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Time Spent</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatDuration(totalTimeSpent)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              of {formatDuration(totalEstimatedTime)} estimated
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Module Progress Table */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Module-by-Module Progress</CardTitle>
              <CardDescription>Detailed breakdown of all modules in the program</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
<TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Module</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Completed</TableHead>
                    <TableHead>Reflections</TableHead>
                    <TableHead>Instructor Notes</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {moduleProgress.map((module) => (
                    <TableRow 
                      key={module.module_id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/teaching/programs/${studentInfo?.program_id}/modules/${module.module_id}`, {
                        state: {
                          enrollmentId,
                          clientName: studentInfo?.name,
                        }
                      })}
                    >
                      <TableCell className="font-medium">{module.order_index + 1}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(module.status)}
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{module.module_title}</span>
                              {module.is_individualized && (
                                <Badge variant="outline" className="text-xs gap-1 bg-blue-500/10 text-blue-600 border-blue-500/20">
                                  <UserCog className="h-3 w-3" />
                                  Personalised
                                </Badge>
                              )}
                            </div>
                            {module.notes && (
                              <div className="text-xs text-muted-foreground line-clamp-1">
                                {module.notes}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{getModuleTypeIcon(module.module_type)}</span>
                      </TableCell>
                      <TableCell>{getStatusBadge(module.status)}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="font-medium">{formatDuration(module.time_spent_minutes)}</div>
                          {module.estimated_minutes && (
                            <div className="text-muted-foreground">
                              / {formatDuration(module.estimated_minutes)}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {module.completed_at ? formatDate(module.completed_at) : '-'}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewingReflections({ moduleProgressId: module.id, moduleTitle: module.module_title, moduleId: module.module_id });
                          }}
                          disabled={!module.id}
                          className="h-8"
                        >
                          <BookOpen className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      </TableCell>
<TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditNote(module.id, module.instructor_notes || null, module.instructor_note_id);
                          }}
                          disabled={!module.id}
                          className="h-8"
                        >
                          {module.instructor_notes ? (
                            <>
                              <MessageSquare className="h-4 w-4 mr-1" />
                              View/Edit
                            </>
                          ) : (
                            <>
                              <Edit2 className="h-4 w-4 mr-1" />
                              Add Note
                            </>
                          )}
                        </Button>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {enrollmentId && (
                          <ManualCompletionControls
                            moduleProgressId={module.id || undefined}
                            enrollmentId={enrollmentId}
                            moduleId={module.module_id}
                            type="module"
                            isCompleted={module.status === 'completed'}
                            onSuccess={() => {
                              // Refresh module progress
                              window.location.reload();
                            }}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Activity History */}
        <div>
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest 20 progress updates</CardDescription>
            </CardHeader>
            <CardContent>
              {activityHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No activity recorded yet
                </p>
              ) : (
                <div className="space-y-4">
                  {activityHistory.map((activity, index) => (
                    <div key={index} className="flex gap-3">
                      <div className="flex-shrink-0 mt-1">
                        {activity.event_type === 'completed' ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : activity.event_type === 'started' ? (
                          <PlayCircle className="h-5 w-5 text-blue-500" />
                        ) : (
                          <Clock className="h-5 w-5 text-yellow-500" />
                        )}
                      </div>
                      <div className="flex-1 space-y-1">
                        <p className="text-sm font-medium leading-none">
                          {activity.event_type === 'completed' && 'Completed'}
                          {activity.event_type === 'started' && 'Started'}
                          {activity.event_type === 'updated' && 'Updated'}
                        </p>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {activity.module_title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(activity.date)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Staff Notes Section */}
        {studentInfo && (
          <div className="mt-6">
            <ClientStaffNotes 
              clientUserId={studentInfo.id} 
              enrollmentId={studentInfo.enrollment_id}
              isAdmin={false} 
            />
          </div>
        )}
      </div>

      {/* Edit Note Dialog */}
      <Dialog open={!!editingNote} onOpenChange={(open) => !open && setEditingNote(null)}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Instructor Feedback & Notes</DialogTitle>
            <DialogDescription>
              Add private notes about this client's performance on this module. These notes are only visible to instructors and admins.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Performance Notes</label>
              <Textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Add your observations, feedback, or performance notes here..."
                className="min-h-[200px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingNote(null)} disabled={savingNote}>
              Cancel
            </Button>
            <Button onClick={handleSaveNote} disabled={savingNote}>
              {savingNote ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Note'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reflections & Feedback Dialog */}
      <Dialog open={!!viewingReflections} onOpenChange={handleCloseReflectionsDialog}>
        <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Reflections & Feedback</DialogTitle>
            <DialogDescription>
              {viewingReflections?.moduleTitle}
            </DialogDescription>
          </DialogHeader>
          {viewingReflections && studentInfo && (
            <div className="space-y-6 py-4">
              <ModuleSessionManager
                moduleId={viewingReflections.moduleId}
                programId={studentInfo.program_id}
                enrollmentId={studentInfo.enrollment_id}
                clientName={studentInfo.name}
              />
              <Separator />
              <ClientReflectionsView moduleProgressId={viewingReflections.moduleProgressId} />
              <Separator />
              <ModuleFeedback moduleProgressId={viewingReflections.moduleProgressId} isCoachOrInstructor />
              <Separator />
              <ModuleAssignmentsView
                moduleId={viewingReflections.moduleId}
                moduleProgressId={viewingReflections.moduleProgressId}
                isEditable={true}
                isInstructor={true}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
