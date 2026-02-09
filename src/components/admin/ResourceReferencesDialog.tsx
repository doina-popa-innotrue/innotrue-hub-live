import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { BookOpen, Users, Target, FileText } from 'lucide-react';

interface ResourceReferencesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resourceId: string;
  resourceTitle: string;
}

interface ModuleAssignment {
  id: string;
  moduleName: string;
  programName: string | null;
}

interface ReflectionAssignment {
  id: string;
  moduleName: string | null;
  programName: string | null;
}

interface GoalResource {
  id: string;
  goalTitle: string;
  userName: string | null;
}

interface ProgramLink {
  id: string;
  programName: string;
}

export function ResourceReferencesDialog({
  open,
  onOpenChange,
  resourceId,
  resourceTitle,
}: ResourceReferencesDialogProps) {
  // Fetch all references
  const { data, isLoading } = useQuery({
    queryKey: ['resource-references', resourceId],
    queryFn: async () => {
      const moduleAssignments: ModuleAssignment[] = [];
      const reflectionAssignments: ReflectionAssignment[] = [];
      const goalResources: GoalResource[] = [];
      const programLinks: ProgramLink[] = [];

      // 1. Fetch module assignments
      const { data: moduleAssignData } = await supabase
        .from('module_resource_assignments')
        .select('id, module_id')
        .eq('resource_id', resourceId) as { data: any[] | null };

      if (moduleAssignData && moduleAssignData.length > 0) {
        const moduleIds = moduleAssignData.map((m: any) => m.module_id);
        const { data: modulesData } = await supabase
          .from('modules' as any)
          .select('id, title, program_id')
          .in('id', moduleIds) as { data: any[] | null };

        if (modulesData) {
          const programIds = [...new Set(modulesData.map((m: any) => m.program_id).filter(Boolean))];
          const { data: programsData } = programIds.length > 0 
            ? await supabase.from('programs').select('id, name').in('id', programIds as string[]) as { data: any[] | null }
            : { data: null };

          moduleAssignData.forEach((assignment: any) => {
            const module = modulesData.find((m: any) => m.id === assignment.module_id);
            const program = programsData?.find((p: any) => p.id === module?.program_id);
            moduleAssignments.push({
              id: assignment.id,
              moduleName: module?.title || 'Unknown module',
              programName: program?.name || null,
            });
          });
        }
      }

      // 2. Fetch reflection resources
      const reflectionResult = await supabase
        .from('module_reflection_resources' as any)
        .select('id, module_reflection_id')
        .eq('resource_id', resourceId);
      const reflectionData = reflectionResult.data as any[] | null;

      if (reflectionData && reflectionData.length > 0) {
        const reflectionIds = reflectionData.map((r: any) => r.module_reflection_id);
        const { data: reflectionsData } = await supabase
          .from('module_reflections' as any)
          .select('id, module_id')
          .in('id', reflectionIds) as { data: any[] | null };

        if (reflectionsData) {
          const moduleIds = [...new Set(reflectionsData.map((r: any) => r.module_id).filter(Boolean))];
          const { data: modulesData } = moduleIds.length > 0
            ? await supabase.from('modules' as any).select('id, title, program_id').in('id', moduleIds as string[]) as { data: any[] | null }
            : { data: null };

          const programIds = [...new Set(modulesData?.map((m: any) => m.program_id).filter(Boolean) || [])];
          const { data: programsData } = programIds.length > 0 
            ? await supabase.from('programs').select('id, name').in('id', programIds as string[]) as { data: any[] | null }
            : { data: null };

          reflectionData.forEach((assignment: any) => {
            const reflection = reflectionsData.find((r: any) => r.id === assignment.module_reflection_id);
            const module = modulesData?.find((m: any) => m.id === reflection?.module_id);
            const program = programsData?.find((p: any) => p.id === module?.program_id);
            reflectionAssignments.push({
              id: assignment.id,
              moduleName: module?.title || null,
              programName: program?.name || null,
            });
          });
        }
      }

      // 3. Fetch goal resources
      const goalResult = await supabase
        .from('goal_resources' as any)
        .select('id, goal_id')
        .eq('resource_id', resourceId);
      const goalData = goalResult.data as any[] | null;

      if (goalData && goalData.length > 0) {
        const goalIds = goalData.map((g: any) => g.goal_id);
        const { data: goalsData } = await supabase
          .from('goals')
          .select('id, title, user_id')
          .in('id', goalIds) as { data: any[] | null };

        if (goalsData) {
          const userIds = [...new Set(goalsData.map((g: any) => g.user_id).filter(Boolean))];
          const { data: profilesData } = userIds.length > 0
            ? await supabase.from('profiles').select('id, name').in('id', userIds as string[]) as { data: any[] | null }
            : { data: null };

          goalData.forEach((gr: any) => {
            const goal = goalsData.find((g: any) => g.id === gr.goal_id);
            const profile = profilesData?.find((p: any) => p.id === goal?.user_id);
            goalResources.push({
              id: gr.id,
              goalTitle: goal?.title || 'Unknown goal',
              userName: profile?.name || null,
            });
          });
        }
      }

      // 4. Fetch program links
      const { data: programData } = await supabase
        .from('resource_library_programs')
        .select('id, program_id')
        .eq('resource_id', resourceId) as { data: any[] | null };

      if (programData && programData.length > 0) {
        const programIds = programData.map((p: any) => p.program_id);
        const { data: programsData } = await supabase
          .from('programs')
          .select('id, name')
          .in('id', programIds) as { data: any[] | null };

        programData.forEach((link: any) => {
          const program = programsData?.find((p: any) => p.id === link.program_id);
          if (program) {
            programLinks.push({
              id: link.id,
              programName: program.name,
            });
          }
        });
      }

      return { moduleAssignments, reflectionAssignments, goalResources, programLinks };
    },
    enabled: open,
  });

  const totalReferences = 
    (data?.moduleAssignments.length || 0) + 
    (data?.reflectionAssignments.length || 0) + 
    (data?.goalResources.length || 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Resource References</DialogTitle>
          <DialogDescription>
            Where "{resourceTitle}" is being used
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : (
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-6">
              {/* Program gating */}
              {data?.programLinks && data.programLinks.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Users className="h-4 w-4" />
                    Gated to Programs ({data.programLinks.length})
                  </div>
                  <div className="pl-6 space-y-1">
                    {data.programLinks.map((link) => (
                      <div key={link.id} className="text-sm text-muted-foreground">
                        {link.programName}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Module assignments */}
              {data?.moduleAssignments && data.moduleAssignments.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <BookOpen className="h-4 w-4" />
                    Module Assignments ({data.moduleAssignments.length})
                  </div>
                  <div className="pl-6 space-y-2">
                    {data.moduleAssignments.map((assignment) => (
                      <div key={assignment.id} className="text-sm">
                        <div className="font-medium">{assignment.moduleName}</div>
                        {assignment.programName && (
                          <div className="text-xs text-muted-foreground">
                            in {assignment.programName}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Reflection assignments */}
              {data?.reflectionAssignments && data.reflectionAssignments.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <FileText className="h-4 w-4" />
                    Reflection Resources ({data.reflectionAssignments.length})
                  </div>
                  <div className="pl-6 space-y-2">
                    {data.reflectionAssignments.map((assignment) => (
                      <div key={assignment.id} className="text-sm">
                        <div className="font-medium">{assignment.moduleName || 'Unknown module'}</div>
                        {assignment.programName && (
                          <div className="text-xs text-muted-foreground">
                            in {assignment.programName}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Goal resources */}
              {data?.goalResources && data.goalResources.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Target className="h-4 w-4" />
                    Goal Resources ({data.goalResources.length})
                  </div>
                  <div className="pl-6 space-y-2">
                    {data.goalResources.map((gr) => (
                      <div key={gr.id} className="text-sm">
                        <div className="font-medium">{gr.goalTitle}</div>
                        {gr.userName && (
                          <div className="text-xs text-muted-foreground">
                            by {gr.userName}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {totalReferences === 0 && (data?.programLinks?.length || 0) === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>This resource is not referenced anywhere yet.</p>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
