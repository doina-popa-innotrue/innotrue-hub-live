import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ClipboardList, ChevronRight, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface AssignedScenarioItemProps {
  scenarioTemplateId: string;
  title: string;
  assessmentName?: string | null;
  moduleId: string;
  enrollmentId?: string;
}

export function AssignedScenarioItem({
  scenarioTemplateId,
  title,
  assessmentName,
  moduleId,
  enrollmentId,
}: AssignedScenarioItemProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      // First, check if an assignment already exists for this user and template
      const { data: existingAssignment, error: fetchError } = await supabase
        .from('scenario_assignments')
        .select('id')
        .eq('template_id', scenarioTemplateId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (existingAssignment) {
        // Navigate to existing assignment
        navigate(`/scenarios/${existingAssignment.id}`);
        return;
      }

      // Create a new assignment
      const { data: newAssignment, error: createError } = await supabase
        .from('scenario_assignments')
        .insert({
          template_id: scenarioTemplateId,
          user_id: user.id,
          module_id: moduleId,
          enrollment_id: enrollmentId || null,
          status: 'draft',
        })
        .select('id')
        .single();

      if (createError) throw createError;

      toast.success('Scenario started!');
      navigate(`/scenarios/${newAssignment.id}`);
    } catch (error: any) {
      console.error('Error accessing scenario:', error);
      toast.error('Failed to access scenario');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      className="w-full justify-start border-accent bg-accent/10 hover:bg-accent/20"
      onClick={handleClick}
      disabled={isLoading}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <ClipboardList className="h-4 w-4 mr-2" />
      )}
      <span className="flex-1 text-left">{title}</span>
      {assessmentName && (
        <Badge variant="secondary" className="text-xs ml-2">
          {assessmentName}
        </Badge>
      )}
      <ChevronRight className="ml-2 h-4 w-4" />
    </Button>
  );
}
