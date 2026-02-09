import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useClientGroupPeerAssessments, PeerAssessmentSnapshot } from '@/hooks/useGroupPeerAssessments';
import { 
  ClipboardCheck, Loader2, ArrowRight, Clock, CheckCircle, 
  Send, Inbox, ExternalLink 
} from 'lucide-react';
import { format } from 'date-fns';

interface GroupPeerAssessmentsPanelProps {
  groupId: string;
  members: Array<{
    user_id: string;
    name: string;
    avatar_url?: string | null;
  }>;
  currentUserId: string;
}

export function GroupPeerAssessmentsPanel({ 
  groupId, 
  members, 
  currentUserId 
}: GroupPeerAssessmentsPanelProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('given');
  const [isAssessDialogOpen, setIsAssessDialogOpen] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [selectedAssessmentId, setSelectedAssessmentId] = useState('');

  const {
    availableAssessments,
    givenAssessments,
    receivedAssessments,
    isLoading,
    createPeerAssessment,
  } = useClientGroupPeerAssessments(groupId);

  // Filter out current user from members list
  const otherMembers = members.filter((m) => m.user_id !== currentUserId);

  const handleStartAssessment = async () => {
    if (!selectedMemberId || !selectedAssessmentId) return;

    try {
      const result = await createPeerAssessment.mutateAsync({
        assessmentId: selectedAssessmentId,
        subjectUserId: selectedMemberId,
      });

      toast({ title: 'Assessment started' });
      setIsAssessDialogOpen(false);
      setSelectedMemberId('');
      setSelectedAssessmentId('');

      // Navigate to the assessment form - use correct route path
      window.location.href = `/capabilities/${selectedAssessmentId}?snapshotId=${result.id}`;
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>;
      case 'draft':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />In Progress</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const hasAssessments = availableAssessments && availableAssessments.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5" />
          <h3 className="text-lg font-semibold">Peer Assessments</h3>
        </div>
        {hasAssessments && otherMembers.length > 0 && (
          <Button size="sm" onClick={() => setIsAssessDialogOpen(true)}>
            <ClipboardCheck className="mr-2 h-4 w-4" />
            Assess a Peer
          </Button>
        )}
      </div>

      {!hasAssessments ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <ClipboardCheck className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No peer assessments available for this group</p>
          </CardContent>
        </Card>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="given" className="flex items-center gap-1">
              <Send className="h-3 w-3" />
              Given ({givenAssessments?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="received" className="flex items-center gap-1">
              <Inbox className="h-3 w-3" />
              Received ({receivedAssessments?.length || 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="given" className="mt-4">
            <AssessmentList 
              assessments={givenAssessments || []} 
              type="given" 
              getStatusBadge={getStatusBadge}
            />
          </TabsContent>

          <TabsContent value="received" className="mt-4">
            <AssessmentList 
              assessments={receivedAssessments || []} 
              type="received" 
              getStatusBadge={getStatusBadge}
            />
          </TabsContent>
        </Tabs>
      )}

      {/* Start Assessment Dialog */}
      <Dialog open={isAssessDialogOpen} onOpenChange={setIsAssessDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assess a Peer</DialogTitle>
            <DialogDescription>
              Select a group member and assessment to provide feedback on their capabilities
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select Peer</Label>
              <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a group member" />
                </SelectTrigger>
                <SelectContent>
                  {otherMembers.map((member) => (
                    <SelectItem key={member.user_id} value={member.user_id}>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={member.avatar_url || undefined} />
                          <AvatarFallback className="text-xs">{member.name?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        {member.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Select Assessment</Label>
              <Select value={selectedAssessmentId} onValueChange={setSelectedAssessmentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an assessment" />
                </SelectTrigger>
                <SelectContent>
                  {availableAssessments?.map((config) => (
                    <SelectItem key={config.assessment_id} value={config.assessment_id}>
                      {config.assessment?.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssessDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleStartAssessment} 
              disabled={!selectedMemberId || !selectedAssessmentId || createPeerAssessment.isPending}
            >
              {createPeerAssessment.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Start Assessment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface AssessmentListProps {
  assessments: PeerAssessmentSnapshot[];
  type: 'given' | 'received';
  getStatusBadge: (status: string) => JSX.Element;
}

function AssessmentList({ assessments, type, getStatusBadge }: AssessmentListProps) {
  if (assessments.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <p className="text-sm">
            {type === 'given' 
              ? "You haven't given any peer assessments yet"
              : "You haven't received any peer assessments yet"}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {assessments.map((assessment) => {
        const person = type === 'given' ? assessment.user : assessment.evaluator;
        const assessmentId = assessment.assessment_id;

        return (
          <Card key={assessment.id}>
            <CardContent className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar className="shrink-0">
                  <AvatarImage src={person?.avatar_url || undefined} />
                  <AvatarFallback>{person?.name?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">
                    {type === 'given' ? `Assessment of ${person?.name}` : `From ${person?.name}`}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {assessment.assessment?.name} • {format(new Date(assessment.created_at), 'MMM d, yyyy')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                {getStatusBadge(assessment.status)}
                {assessment.status === 'draft' && type === 'given' && assessmentId && (
                  <Link to={`/capabilities/${assessmentId}?snapshotId=${assessment.id}`}>
                    <Button variant="outline" size="sm">
                      Continue
                      <ArrowRight className="ml-1 h-3 w-3" />
                    </Button>
                  </Link>
                )}
                {assessment.status === 'completed' && assessmentId && (
                  <Link to={`/capabilities/${assessmentId}?snapshotId=${assessment.id}`}>
                    <Button variant="ghost" size="sm">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
