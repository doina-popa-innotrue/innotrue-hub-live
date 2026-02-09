import { useAuth } from '@/contexts/AuthContext';
import { useScenarioAssignments, useScenarioProgress } from '@/hooks/useScenarios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { FileText, Clock, CheckCircle2, Send, Eye, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import type { ScenarioAssignment, ScenarioAssignmentStatus } from '@/types/scenarios';
import { ScenarioErrorBoundary } from '@/components/scenarios/ScenarioErrorBoundary';

const statusConfig: Record<ScenarioAssignmentStatus, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; icon: React.ReactNode }> = {
  draft: { label: 'In Progress', variant: 'secondary', icon: <Clock className="h-3 w-3" /> },
  submitted: { label: 'Submitted', variant: 'default', icon: <Send className="h-3 w-3" /> },
  in_review: { label: 'Under Review', variant: 'outline', icon: <Eye className="h-3 w-3" /> },
  evaluated: { label: 'Evaluated', variant: 'default', icon: <CheckCircle2 className="h-3 w-3" /> },
};

function ScenariosContent() {
  const { user } = useAuth();
  const { data: assignments, isLoading } = useScenarioAssignments({ userId: user?.id });

  if (isLoading) {
    return (
      <div className="container py-6 space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  const activeAssignments = assignments?.filter(a => a.status !== 'evaluated') || [];
  const completedAssignments = assignments?.filter(a => a.status === 'evaluated') || [];

  return (
    <div className="container py-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Scenario Assessments</h1>
        <p className="text-muted-foreground mt-1">
          Complete scenario-based assessments to demonstrate your capabilities
        </p>
      </div>

      {assignments?.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No Scenario Assignments</h3>
            <p className="text-muted-foreground text-center max-w-md mt-1">
              You don't have any scenario assessments assigned yet. Check back later or contact your instructor.
            </p>
          </CardContent>
        </Card>
      )}

      {activeAssignments.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-primary" />
            Active Assignments
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {activeAssignments.map(assignment => (
              <ScenarioCard key={assignment.id} assignment={assignment} />
            ))}
          </div>
        </section>
      )}

      {completedAssignments.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            Completed
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {completedAssignments.map(assignment => (
              <ScenarioCard key={assignment.id} assignment={assignment} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// Default export with error boundary
export default function Scenarios() {
  return (
    <ScenarioErrorBoundary fallbackPath="/" fallbackLabel="Back to Dashboard">
      <ScenariosContent />
    </ScenarioErrorBoundary>
  );
}

// Scenario Card Component with Progress
function ScenarioCard({ assignment }: { assignment: ScenarioAssignment }) {
  const template = assignment.scenario_templates;
  const config = statusConfig[assignment.status];
  const isDraft = assignment.status === 'draft';
  const isCompleted = assignment.status === 'evaluated';

  const { data: progress } = useScenarioProgress(
    assignment.template_id,
    assignment.id
  );

  return (
    <Card className={isCompleted ? "opacity-80 hover:opacity-100 transition-opacity" : "hover:shadow-md transition-shadow"}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg line-clamp-2">
            {template?.title || 'Untitled Scenario'}
          </CardTitle>
          <Badge variant={config.variant} className="flex items-center gap-1 shrink-0">
            {config.icon}
            {config.label}
          </Badge>
        </div>
        {template?.description && !isCompleted && (
          <CardDescription className="line-clamp-2 mt-1">
            {template.description}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress bar for draft assignments */}
        {isDraft && progress && progress.total > 0 && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Progress</span>
              <span>{progress.answered}/{progress.total}</span>
            </div>
            <Progress value={progress.percentage} className="h-2" />
          </div>
        )}

        <div className="text-sm text-muted-foreground space-y-1">
          {!isCompleted && (
            <p>Assigned: {format(new Date(assignment.assigned_at), 'MMM d, yyyy')}</p>
          )}
          {assignment.submitted_at && !isCompleted && (
            <p>Submitted: {format(new Date(assignment.submitted_at), 'MMM d, yyyy')}</p>
          )}
          {assignment.evaluated_at && (
            <p>Evaluated: {format(new Date(assignment.evaluated_at), 'MMM d, yyyy')}</p>
          )}
        </div>

        <Button asChild variant={isCompleted ? "outline" : "default"} className="w-full">
          <Link to={`/scenarios/${assignment.id}`}>
            {isDraft ? 'Continue' : isCompleted ? 'View Results' : 'View'}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
