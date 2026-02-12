import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2, FileText, Shield, Award, Search, GripVertical } from "lucide-react";
import {
  useModuleScenarios,
  useModuleScenarioMutations,
  useScenarioTemplates,
} from "@/hooks/useScenarios";
import type { ModuleScenario } from "@/types/scenarios";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface ModuleScenariosEditorProps {
  moduleId: string;
}

export function ModuleScenariosEditor({ moduleId }: ModuleScenariosEditorProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: linkedScenarios, isLoading } = useModuleScenarios(moduleId);
  const { data: allTemplates } = useScenarioTemplates();
  const { addMutation, removeMutation, updateMutation, reorderMutation } =
    useModuleScenarioMutations();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Filter out already-linked scenarios
  const linkedTemplateIds = new Set(linkedScenarios?.map((s) => s.template_id) || []);
  const availableTemplates =
    allTemplates?.filter(
      (t) =>
        t.is_active &&
        !linkedTemplateIds.has(t.id) &&
        (searchQuery === "" || t.title.toLowerCase().includes(searchQuery.toLowerCase())),
    ) || [];

  const handleAdd = (templateId: string) => {
    addMutation.mutate(
      { module_id: moduleId, template_id: templateId },
      { onSuccess: () => setIsAddDialogOpen(false) },
    );
  };

  const handleRemove = (id: string) => {
    removeMutation.mutate({ id, moduleId });
  };

  const handleToggleCertification = (scenario: ModuleScenario) => {
    updateMutation.mutate({
      id: scenario.id,
      moduleId,
      is_required_for_certification: !scenario.is_required_for_certification,
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id && linkedScenarios) {
      const oldIndex = linkedScenarios.findIndex((s) => s.id === active.id);
      const newIndex = linkedScenarios.findIndex((s) => s.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(linkedScenarios, oldIndex, newIndex);
        reorderMutation.mutate({
          moduleId,
          orderedIds: newOrder.map((s) => s.id),
        });
      }
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Link scenario-based assessments to this module. Scenarios marked "required for
          certification" must be completed and evaluated before the client can receive their program
          badge.
        </p>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Add Scenario
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Link Scenario to Module</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search scenarios..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <ScrollArea className="h-[300px]">
                {availableTemplates.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    {allTemplates?.length === linkedTemplateIds.size
                      ? "All scenarios are already linked to this module"
                      : "No scenarios match your search"}
                  </p>
                ) : (
                  <div className="space-y-2 pr-4">
                    {availableTemplates.map((template) => (
                      <Card
                        key={template.id}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => handleAdd(template.id)}
                      >
                        <CardContent className="py-3 px-4">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-primary shrink-0" />
                                <span className="font-medium truncate">{template.title}</span>
                              </div>
                              {template.description && (
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                  {template.description}
                                </p>
                              )}
                              <div className="flex items-center gap-2 mt-2">
                                {template.is_protected && (
                                  <Badge variant="secondary" className="text-xs gap-1">
                                    <Shield className="h-3 w-3" />
                                    Protected
                                  </Badge>
                                )}
                                {template.capability_assessments && (
                                  <Badge variant="outline" className="text-xs">
                                    {template.capability_assessments.name}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAdd(template.id);
                              }}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {linkedScenarios?.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No scenarios linked to this module yet.</p>
          </CardContent>
        </Card>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={linkedScenarios?.map((s) => s.id) || []}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {linkedScenarios?.map((scenario) => (
                <SortableScenarioCard
                  key={scenario.id}
                  scenario={scenario}
                  onToggleCertification={handleToggleCertification}
                  onRemove={handleRemove}
                  isUpdating={updateMutation.isPending}
                  isRemoving={removeMutation.isPending}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

// Sortable scenario card component
interface SortableScenarioCardProps {
  scenario: ModuleScenario;
  onToggleCertification: (scenario: ModuleScenario) => void;
  onRemove: (id: string) => void;
  isUpdating: boolean;
  isRemoving: boolean;
}

function SortableScenarioCard({
  scenario,
  onToggleCertification,
  onRemove,
  isUpdating,
  isRemoving,
}: SortableScenarioCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: scenario.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card ref={setNodeRef} style={style}>
      <CardContent className="py-3 px-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="cursor-grab active:cursor-grabbing touch-none"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary shrink-0" />
                <span className="font-medium truncate">
                  {scenario.scenario_templates?.title || "Untitled Scenario"}
                </span>
                {scenario.scenario_templates?.is_protected && (
                  <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </div>
              {scenario.scenario_templates?.description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-1 ml-6">
                  {scenario.scenario_templates.description}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <div className="flex items-center gap-2">
              <Switch
                id={`cert-${scenario.id}`}
                checked={scenario.is_required_for_certification}
                onCheckedChange={() => onToggleCertification(scenario)}
                disabled={isUpdating}
              />
              <Label
                htmlFor={`cert-${scenario.id}`}
                className="text-xs text-muted-foreground cursor-pointer flex items-center gap-1"
              >
                <Award className="h-3 w-3" />
                Required for cert
              </Label>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => onRemove(scenario.id)}
              disabled={isRemoving}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
