import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UserPlus, Loader2, Clock, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';

type RequestType = 'coach' | 'instructor' | 'both';

interface CoachInstructorRequest {
  id: string;
  request_type: RequestType;
  message: string | null;
  status: 'pending' | 'approved' | 'declined';
  admin_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
}

export function RequestCoachInstructorDialog() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [requestType, setRequestType] = useState<RequestType>('coach');
  const [message, setMessage] = useState('');

  // Fetch existing requests
  const { data: existingRequests = [], isLoading } = useQuery({
    queryKey: ['coach-instructor-requests', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('coach_instructor_requests')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as CoachInstructorRequest[];
    },
    enabled: !!user,
  });

  // Fetch current coaches and instructors from all sources
  const { data: currentAssignments } = useQuery({
    queryKey: ['client-assignments', user?.id],
    queryFn: async () => {
      if (!user) return { directCoaches: [], directInstructors: [], programTeam: [] };

      // Get direct assignments
      const [coachResult, instructorResult] = await Promise.all([
        supabase
          .from('client_coaches')
          .select('coach_id')
          .eq('client_id', user.id),
        supabase
          .from('client_instructors')
          .select('instructor_id')
          .eq('client_id', user.id),
      ]);

      // Collect all staff IDs for profile lookup
      const directCoachIds = coachResult.data?.map(c => c.coach_id) || [];
      const directInstructorIds = instructorResult.data?.map(i => i.instructor_id) || [];

      // Get enrollments to find program/module coaches and instructors
      const { data: enrollments } = await supabase
        .from('client_enrollments')
        .select('id, program_id, programs(name)')
        .eq('client_user_id', user.id)
        .in('status', ['active']);

      const programTeamData: { programName: string; coachIds: string[]; instructorIds: string[] }[] = [];
      const allStaffIds: string[] = [...directCoachIds, ...directInstructorIds];

      if (enrollments && enrollments.length > 0) {
        for (const enrollment of enrollments) {
          const programName = (enrollment.programs as any)?.name || 'Program';

          // Get program-level coaches and instructors
          const [programCoachesRes, programInstructorsRes] = await Promise.all([
            supabase
              .from('program_coaches')
              .select('coach_id')
              .eq('program_id', enrollment.program_id),
            supabase
              .from('program_instructors')
              .select('instructor_id')
              .eq('program_id', enrollment.program_id),
          ]);

          const coachIds = programCoachesRes.data?.map(c => c.coach_id) || [];
          const instructorIds = programInstructorsRes.data?.map(i => i.instructor_id) || [];

          if (coachIds.length > 0 || instructorIds.length > 0) {
            programTeamData.push({ programName, coachIds, instructorIds });
            allStaffIds.push(...coachIds, ...instructorIds);
          }
        }
      }

      // Fetch all profiles at once
      const uniqueStaffIds = [...new Set(allStaffIds)].filter(Boolean);
      let profilesMap: Record<string, string> = {};
      
      if (uniqueStaffIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', uniqueStaffIds);
        
        profilesMap = (profiles || []).reduce((acc, p) => {
          acc[p.id] = p.name || 'Unknown';
          return acc;
        }, {} as Record<string, string>);
      }

      // Map IDs to names
      const programTeam = programTeamData.map(pt => ({
        programName: pt.programName,
        coaches: pt.coachIds.map(id => profilesMap[id]).filter(Boolean),
        instructors: pt.instructorIds.map(id => profilesMap[id]).filter(Boolean),
      })).filter(pt => pt.coaches.length > 0 || pt.instructors.length > 0);

      return {
        directCoaches: directCoachIds.map(id => profilesMap[id]).filter(Boolean),
        directInstructors: directInstructorIds.map(id => profilesMap[id]).filter(Boolean),
        programTeam,
      };
    },
    enabled: !!user,
  });

  const hasAnyAssignments =
    (currentAssignments?.directCoaches?.length || 0) > 0 ||
    (currentAssignments?.directInstructors?.length || 0) > 0 ||
    (currentAssignments?.programTeam?.length || 0) > 0;

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase.from('coach_instructor_requests').insert({
        user_id: user.id,
        request_type: requestType,
        message: message || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coach-instructor-requests'] });
      toast.success('Request submitted', {
        description: 'An administrator will review your request shortly.',
      });
      setOpen(false);
      setMessage('');
      setRequestType('coach');
    },
    onError: (error) => {
      toast.error('Failed to submit request', {
        description: error.message,
      });
    },
  });

  const pendingRequest = existingRequests.find((r) => r.status === 'pending');

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-warning" />;
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-success" />;
      case 'declined':
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline">Pending</Badge>;
      case 'approved':
        return <Badge variant="default">Approved</Badge>;
      case 'declined':
        return <Badge variant="destructive">Declined</Badge>;
      default:
        return null;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          My Coaches & Instructors
        </CardTitle>
        <CardDescription>
          View your assigned coaches and instructors, or request new ones
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Assignments */}
        {hasAnyAssignments ? (
          <div className="space-y-4">
            {/* Direct Assignments - Personal Coach/Instructor */}
            {((currentAssignments?.directCoaches?.length || 0) > 0 ||
              (currentAssignments?.directInstructors?.length || 0) > 0) && (
              <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg space-y-3">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary" />
                  Personal Assignments
                </Label>
                {currentAssignments?.directCoaches && currentAssignments.directCoaches.length > 0 && (
                  <div className="space-y-1">
                    {currentAssignments.directCoaches.map((name, idx) => (
                      <p key={idx} className="text-sm">
                        <span className="font-medium">{name}</span>
                        <span className="text-muted-foreground"> is your personal coach</span>
                      </p>
                    ))}
                  </div>
                )}
                {currentAssignments?.directInstructors && currentAssignments.directInstructors.length > 0 && (
                  <div className="space-y-1">
                    {currentAssignments.directInstructors.map((name, idx) => (
                      <p key={idx} className="text-sm">
                        <span className="font-medium">{name}</span>
                        <span className="text-muted-foreground"> is your personal instructor</span>
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Program Team Assignments */}
            {currentAssignments?.programTeam && currentAssignments.programTeam.length > 0 && (
              <div className="space-y-3">
                <Label className="text-sm font-medium text-muted-foreground">
                  From Your Programs
                </Label>
                {currentAssignments.programTeam.map((program, idx) => (
                  <div key={idx} className="p-3 bg-muted/50 rounded-lg space-y-2">
                    <div className="space-y-1">
                      {program.coaches.map((name, i) => (
                        <p key={`coach-${i}`} className="text-sm">
                          <span className="font-medium">{name}</span>
                          <span className="text-muted-foreground"> is your coach on </span>
                          <span className="font-medium">{program.programName}</span>
                        </p>
                      ))}
                      {program.instructors.map((name, i) => (
                        <p key={`inst-${i}`} className="text-sm">
                          <span className="font-medium">{name}</span>
                          <span className="text-muted-foreground"> is your instructor on </span>
                          <span className="font-medium">{program.programName}</span>
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 bg-muted/50 rounded-lg text-center">
            <p className="text-sm text-muted-foreground">
              No coaches or instructors assigned yet. Submit a request below.
            </p>
          </div>
        )}

        {/* Pending Request Notice */}
        {pendingRequest && (
          <div className="p-3 bg-warning/10 border border-warning/30 rounded-lg">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-warning" />
              <span>
                You have a pending request for{' '}
                {pendingRequest.request_type === 'both'
                  ? 'coach and instructor'
                  : `a ${pendingRequest.request_type}`}
                . Submitted {format(new Date(pendingRequest.created_at), 'MMM d, yyyy')}.
              </span>
            </div>
          </div>
        )}

        {/* Request History */}
        {existingRequests.length > 0 && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Request History</Label>
            <div className="space-y-2">
              {existingRequests.slice(0, 3).map((request) => (
                <div
                  key={request.id}
                  className="flex items-center justify-between p-2 border rounded-md text-sm"
                >
                  <div className="flex items-center gap-2">
                    {getStatusIcon(request.status)}
                    <span className="capitalize">
                      {request.request_type === 'both'
                        ? 'Coach & Instructor'
                        : request.request_type}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(request.status)}
                    <span className="text-muted-foreground">
                      {format(new Date(request.created_at), 'MMM d')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Request Dialog */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="w-full" disabled={!!pendingRequest}>
              <UserPlus className="h-4 w-4 mr-2" />
              {pendingRequest ? 'Request Pending' : 'Request Coach or Instructor'}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Request Coach or Instructor</DialogTitle>
              <DialogDescription>
                Submit a request for a coach, instructor, or both. An administrator will
                review your request and assign someone to help you.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-3">
                <Label>What would you like to request?</Label>
                <RadioGroup
                  value={requestType}
                  onValueChange={(v) => setRequestType(v as RequestType)}
                  className="space-y-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="coach" id="coach" />
                    <Label htmlFor="coach" className="font-normal cursor-pointer">
                      Coach - For personal development, goal setting, and accountability
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="instructor" id="instructor" />
                    <Label htmlFor="instructor" className="font-normal cursor-pointer">
                      Instructor - For program-related guidance and learning support
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="both" id="both" />
                    <Label htmlFor="both" className="font-normal cursor-pointer">
                      Both - I need both coaching and instruction support
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Additional Information (optional)</Label>
                <Textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Tell us about your goals or any specific needs..."
                  rows={4}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => submitMutation.mutate()}
                disabled={submitMutation.isPending}
              >
                {submitMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Submit Request'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
