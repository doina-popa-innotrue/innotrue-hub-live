import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  ExternalLink,
  Copy,
  GripVertical,
  Undo,
  Redo,
  Trash2,
  Check,
  Settings,
  X,
  ArrowRightLeft,
  CopyPlus,
  Users,
  Upload,
  ImageIcon,
  UserCog,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import ModuleForm from "@/components/admin/ModuleForm";
import { ModulePrerequisites } from "@/components/admin/ModulePrerequisites";
import { ModuleSectionsEditor } from "@/components/admin/ModuleSectionsEditor";
import { InstructorCoachAssignment } from "@/components/admin/InstructorCoachAssignment";
import { ModuleAssignmentConfig } from "@/components/admin/ModuleAssignmentConfig";
import { ModuleSkillsEditor } from "@/components/admin/ModuleSkillsEditor";
import { ModuleScenariosEditor } from "@/components/admin/ModuleScenariosEditor";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { RichTextDisplay } from "@/components/ui/rich-text-display";
import { ProgramVersionHistory } from "@/components/admin/ProgramVersionHistory";
import { ProgramTermsManager } from "@/components/admin/ProgramTermsManager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ModuleProgramTransferDialog } from "@/components/admin/ModuleProgramTransferDialog";
import ModuleClientContentManager from "@/components/admin/ModuleClientContentManager";
import ProgramBadgeManager from "@/components/admin/ProgramBadgeManager";
import { ProgramCohortsManager } from "@/components/admin/ProgramCohortsManager";
import { ProgramPlanConfig } from "@/components/admin/ProgramPlanConfig";
import { ModuleDomainMapper } from "@/components/admin/ModuleDomainMapper";
import { validateFile, acceptStringForBucket } from "@/lib/fileValidation";
import { PageLoadingState } from "@/components/ui/page-loading-state";

interface SortableModuleProps {
  module: any;
  index: number;
  onEdit: (module: any) => void;
  onClone: (module: any) => void;
  onCopyToProgram: (module: any) => void;
  onMoveToProgram: (module: any) => void;
  onToggleActive: (moduleId: string, currentState: boolean) => void;
  onDelete: (module: any) => void;
  isSelected: boolean;
  onSelect: (moduleId: string, checked: boolean) => void;
  selectionMode: boolean;
}

function SortableModule({
  module,
  index,
  onEdit,
  onClone,
  onCopyToProgram,
  onMoveToProgram,
  onToggleActive,
  onDelete,
  isSelected,
  onSelect,
  selectionMode,
}: SortableModuleProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: module.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <Card
        className={`${isDragging ? "shadow-lg" : ""} ${isSelected ? "ring-2 ring-primary" : ""} ${!module.is_active ? "opacity-60" : ""}`}
      >
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-2 sm:gap-3 flex-1 min-w-0">
            {selectionMode && (
              <Checkbox
                checked={isSelected}
                onCheckedChange={(checked) => onSelect(module.id, checked as boolean)}
                className="mt-1 shrink-0"
              />
            )}
            <button
              className="mt-1 cursor-grab active:cursor-grabbing touch-none shrink-0"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="h-5 w-5 text-muted-foreground" />
            </button>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base sm:text-lg leading-tight">
                Module {index + 1}: {module.title}
              </CardTitle>
              <div className="flex items-center gap-1 sm:gap-2 flex-wrap mt-2">
                {module.code && (
                  <Badge variant="outline" className="text-xs font-mono">
                    {module.code}
                  </Badge>
                )}
                <Badge variant="outline" className="text-xs">
                  {module.module_type}
                </Badge>
                {module.tier_required && (
                  <Badge variant="secondary" className="text-xs">
                    {module.tier_required}
                  </Badge>
                )}
                {module.is_individualized && (
                  <Badge
                    variant="outline"
                    className="bg-blue-500/10 text-blue-600 border-blue-500/20 text-xs"
                  >
                    <UserCog className="h-3 w-3 mr-1" />
                    Personalised
                  </Badge>
                )}
                {!module.is_active && (
                  <Badge variant="destructive" className="text-xs">
                    Inactive
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground whitespace-nowrap">Active</span>
              <Switch
                checked={module.is_active}
                onCheckedChange={() => onToggleActive(module.id, module.is_active)}
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost" title="Copy options">
                  <Copy className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onClone(module)}>
                  <Copy className="mr-2 h-4 w-4" />
                  Clone in this program
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onCopyToProgram(module)}>
                  <CopyPlus className="mr-2 h-4 w-4" />
                  Copy to another program
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onMoveToProgram(module)}>
                  <ArrowRightLeft className="mr-2 h-4 w-4" />
                  Move to another program
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button size="sm" variant="ghost" onClick={() => onEdit(module)} title="Edit module">
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onDelete(module)}
              title="Delete module"
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <RichTextDisplay
            content={module.description ?? ""}
            className="text-sm text-muted-foreground"
          />
          {module.links && module.links.length > 0 && (
            <div className="space-y-2 overflow-hidden">
              <p className="text-sm font-medium">Resource Links:</p>
              <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2">
                {module.links.map((link: any, linkIndex: number) => (
                  <Button
                    key={linkIndex}
                    variant="outline"
                    size="sm"
                    asChild
                    className="w-full sm:w-auto justify-start"
                  >
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate"
                    >
                      <span className="truncate">{link.name}</span>
                      <ExternalLink className="ml-2 h-3 w-3 shrink-0" />
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
            />
          </div>

          <div className="border-t pt-4">
            <ModuleAssignmentConfig moduleId={module.id} />
          </div>
          {module.is_individualized && (
            <div className="border-t pt-4">
              <ModuleClientContentManager
                moduleId={module.id}
                moduleName={module.title}
                programId={module.program_id}
              />
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Estimated time: {module.estimated_minutes} minutes
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

interface SortableTierItemProps {
  id: string;
  tier: string;
  index: number;
  onUpdateName: (newName: string) => void;
  onRemove: () => void;
  canRemove: boolean;
}

function SortableTierItem({
  id,
  tier,
  index,
  onUpdateName,
  onRemove,
  canRemove,
}: SortableTierItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2">
      <button
        className="cursor-grab active:cursor-grabbing touch-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>
      <span className="w-6 text-center font-medium text-muted-foreground">{index + 1}.</span>
      <Input value={tier} onChange={(e) => onUpdateName(e.target.value)} className="flex-1" />
      <Button
        variant="ghost"
        size="icon"
        onClick={onRemove}
        disabled={!canRemove}
        title="Remove tier"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default function ProgramDetail() {
  const { id } = useParams() as { id: string };
  const [program, setProgram] = useState<any>(null);
  const [modules, setModules] = useState<any[]>([]);
  const [openAdd, setOpenAdd] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [editingModule, setEditingModule] = useState<any>(null);
  const [history, setHistory] = useState<any[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [selectedModules, setSelectedModules] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [moduleToDelete, setModuleToDelete] = useState<any>(null);
  const [showSingleDeleteDialog, setShowSingleDeleteDialog] = useState(false);
  const [openTierManager, setOpenTierManager] = useState(false);
  const [editingTiers, setEditingTiers] = useState<string[]>([]);
  const [newTierName, setNewTierName] = useState("");
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [transferMode, setTransferMode] = useState<"copy" | "move">("copy");
  const [transferModule, setTransferModule] = useState<any>(null);
  const [openEditProgram, setOpenEditProgram] = useState(false);
  const [editingProgramName, setEditingProgramName] = useState("");
  const [editingDescription, setEditingDescription] = useState("");
  const [editingProgramCode, setEditingProgramCode] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;
  const hasSelection = selectedModules.size > 0;
  const allSelected = modules.length > 0 && selectedModules.size === modules.length;

  useEffect(() => {
    async function fetchData() {
      try {
        const { data: programData, error: programError } = await supabase
          .from("programs")
          .select("*")
          .eq("id", id)
          .single();
        const { data: modulesData, error: modulesError } = await supabase
          .from("program_modules")
          .select("*")
          .eq("program_id", id)
          .order("order_index");

        if (programError) console.error("Error fetching program:", programError);
        if (modulesError) console.error("Error fetching modules:", modulesError);

        setProgram(programData);
        if (modulesData) {
          setModules(modulesData);
          // Initialize history with the first state
          setHistory([modulesData]);
          setHistoryIndex(0);
        }
      } catch (error) {
        console.error("Error in fetchData:", error);
      }
    }
    fetchData();
  }, [id]);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        if (canUndo) undo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        if (canRedo) redo();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canUndo, canRedo, historyIndex, history]);

  async function addModule(data: any) {
    const { error } = await supabase.from("program_modules").insert({
      program_id: id,
      title: data.title,
      description: data.description,
      content: data.content || null,
      module_type: data.moduleType as "session" | "assignment" | "reflection" | "resource",
      order_index: modules.length + 1,
      estimated_minutes: parseInt(data.estimatedMinutes),
      links: data.links,
      tier_required: data.tierRequired,
      is_individualized: data.isIndividualized || false,
      code: data.code || null,
      feature_key: data.featureKey || null,
      capability_assessment_id: data.capabilityAssessmentId || null,
      content_package_id: data.contentPackageId || null,
    });

    if (error) {
      toast.error("Failed to add module");
    } else {
      toast.success("Module added!");
      setOpenAdd(false);
      // Refresh modules
      const { data: modulesData } = await supabase
        .from("program_modules")
        .select("*")
        .eq("program_id", id)
        .order("order_index");
      setModules(modulesData || []);
    }
  }

  async function updateModule(data: any) {
    const { error } = await supabase
      .from("program_modules")
      .update({
        title: data.title,
        description: data.description,
        content: data.content || null,
        module_type: data.moduleType as "session" | "assignment" | "reflection" | "resource",
        estimated_minutes: parseInt(data.estimatedMinutes),
        links: data.links,
        tier_required: data.tierRequired,
        is_individualized: data.isIndividualized || false,
        code: data.code || null,
        feature_key: data.featureKey || null,
        capability_assessment_id: data.capabilityAssessmentId || null,
        content_package_id: data.contentPackageId || null,
      })
      .eq("id", editingModule.id);

    if (error) {
      toast.error("Failed to update module");
    } else {
      toast.success("Module updated!");
      setOpenEdit(false);
      setEditingModule(null);
      // Refresh modules
      const { data: modulesData } = await supabase
        .from("program_modules")
        .select("*")
        .eq("program_id", id)
        .order("order_index");
      setModules(modulesData || []);
    }
  }

  function handleEditModule(module: any) {
    setEditingModule(module);
    // Small delay to ensure any dropdown portals are cleaned up before dialog opens
    requestAnimationFrame(() => {
      setOpenEdit(true);
    });
  }

  async function cloneModule(module: any) {
    // Robust clone that avoids UNIQUE(program_id, order_index) collisions by:
    // 1) inserting the clone at a guaranteed-non-colliding temp order_index
    // 2) rebuilding the desired list order locally
    // 3) using the existing 2-phase updateModuleOrder() to reindex everything safely
    try {
      const tempBase = 100000;

      // Always use fresh data to avoid cloning based on stale local state
      const { data: latestModules, error: latestError } = await supabase
        .from("program_modules")
        .select("*")
        .eq("program_id", id)
        .order("order_index");

      if (latestError) throw latestError;

      const list = latestModules || [];
      const sourceIndex = list.findIndex((m) => m.id === module.id);
      if (sourceIndex === -1) throw new Error("Module not found in program");

      const { data: insertedRows, error: insertError } = await supabase
        .from("program_modules")
        .insert({
          program_id: module.program_id,
          title: `Copy of ${module.title}`,
          description: module.description,
          content: module.content || null,
          module_type: module.module_type,
          // temp order_index so it never collides; we will reindex immediately after
          order_index: tempBase - 1,
          estimated_minutes: module.estimated_minutes,
          links: module.links,
          tier_required: module.tier_required,
          is_active: module.is_active,
          is_individualized: module.is_individualized || false,
          code: module.code || null,
          feature_key: module.feature_key || null,
          capability_assessment_id: module.capability_assessment_id || null,
        })
        .select("*");

      if (insertError) throw insertError;
      const cloned = insertedRows?.[0];
      if (!cloned?.id) throw new Error("Failed to create clone");

      const desired = [...list.slice(0, sourceIndex + 1), cloned, ...list.slice(sourceIndex + 1)];

      await updateModuleOrder(desired);

      toast.success("Module cloned successfully!");
      const { data: modulesData } = await supabase
        .from("program_modules")
        .select("*")
        .eq("program_id", id)
        .order("order_index");
      setModules(modulesData || []);
    } catch (error: any) {
      console.error("Clone error:", error);
      toast.error(`Failed to clone module: ${error?.message || "Unknown error"}`);
      const { data: modulesData } = await supabase
        .from("program_modules")
        .select("*")
        .eq("program_id", id)
        .order("order_index");
      setModules(modulesData || []);
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = modules.findIndex((m) => m.id === active.id);
    const newIndex = modules.findIndex((m) => m.id === over.id);

    const newModules = arrayMove(modules, oldIndex, newIndex);

    // Save to history before updating
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newModules);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);

    // Optimistically update UI
    setModules(newModules);

    // Update order_index in database for all affected modules
    await updateModuleOrder(newModules);
  }

  async function updateModuleOrder(moduleList: any[]) {
    // NOTE: program_modules has a UNIQUE(program_id, order_index) constraint.
    // Updating rows one-by-one can intermittently fail due to transient collisions.
    // We avoid this by doing a 2-phase update:
    //  1) move all affected modules to a temporary non-colliding range
    //  2) set the final 1..N order_index values
    try {
      const tempBase = 100000; // far above any realistic module count

      const tempResults = await Promise.all(
        moduleList.map((module, index) =>
          supabase
            .from("program_modules")
            .update({ order_index: tempBase + index + 1 })
            .eq("id", module.id)
            .select("id"),
        ),
      );

      const tempErrors = tempResults.filter((r) => r.error);
      if (tempErrors.length > 0) {
        console.error("Temp module order update errors:", tempErrors);
        throw new Error("Failed to update module order (temp phase)");
      }

      const finalResults = await Promise.all(
        moduleList.map((module, index) =>
          supabase
            .from("program_modules")
            .update({ order_index: index + 1 })
            .eq("id", module.id)
            .select("id"),
        ),
      );

      const finalErrors = finalResults.filter((r) => r.error);
      if (finalErrors.length > 0) {
        console.error("Final module order update errors:", finalErrors);
        throw new Error("Failed to update module order (final phase)");
      }

      toast.success("Module order updated!");
    } catch (error) {
      console.error("Failed to update module order:", error);
      toast.error("Failed to update module order");
      const { data: modulesData } = await supabase
        .from("program_modules")
        .select("*")
        .eq("program_id", id)
        .order("order_index");
      if (modulesData) {
        setModules(modulesData);
        setHistory([modulesData]);
        setHistoryIndex(0);
      }
    }
  }

  async function undo() {
    if (!canUndo) return;

    const newIndex = historyIndex - 1;
    const previousState = history[newIndex];

    setHistoryIndex(newIndex);
    setModules(previousState);

    await updateModuleOrder(previousState);
    toast.success("Undone!");
  }

  async function redo() {
    if (!canRedo) return;

    const newIndex = historyIndex + 1;
    const nextState = history[newIndex];

    setHistoryIndex(newIndex);
    setModules(nextState);

    await updateModuleOrder(nextState);
    toast.success("Redone!");
  }

  function handleModuleSelect(moduleId: string, checked: boolean) {
    const newSelection = new Set(selectedModules);
    if (checked) {
      newSelection.add(moduleId);
    } else {
      newSelection.delete(moduleId);
    }
    setSelectedModules(newSelection);
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedModules(new Set());
    } else {
      setSelectedModules(new Set(modules.map((m) => m.id)));
    }
  }

  async function bulkDelete() {
    try {
      const modulesToDelete = Array.from(selectedModules);

      const { error } = await supabase.from("program_modules").delete().in("id", modulesToDelete);

      if (error) throw error;

      toast.success(`Deleted ${modulesToDelete.length} module(s)`);
      setSelectedModules(new Set());
      setSelectionMode(false);
      setShowDeleteDialog(false);

      // Refresh modules
      const { data: modulesData } = await supabase
        .from("program_modules")
        .select("*")
        .eq("program_id", id)
        .order("order_index");

      if (modulesData) {
        setModules(modulesData);
        // Update history
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(modulesData);
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
      }
    } catch (error: any) {
      toast.error(`Failed to delete modules: ${error.message}`);
    }
  }

  function handleDeleteModule(module: any) {
    setModuleToDelete(module);
    setShowSingleDeleteDialog(true);
  }

  async function confirmDeleteModule() {
    if (!moduleToDelete) return;

    try {
      const { error } = await supabase.from("program_modules").delete().eq("id", moduleToDelete.id);

      if (error) throw error;

      toast.success(`Module "${moduleToDelete.title}" deleted`);
      setModuleToDelete(null);
      setShowSingleDeleteDialog(false);

      // Refresh modules
      const { data: modulesData } = await supabase
        .from("program_modules")
        .select("*")
        .eq("program_id", id)
        .order("order_index");

      if (modulesData) {
        setModules(modulesData);
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(modulesData);
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
      }
    } catch (error: any) {
      toast.error(`Failed to delete module: ${error.message}`);
    }
  }

  async function bulkDuplicate() {
    try {
      const modulesToDuplicate = modules.filter((m) => selectedModules.has(m.id));

      // Sort by order_index to maintain order
      modulesToDuplicate.sort((a, b) => a.order_index - b.order_index);

      // Get the highest order_index
      const maxOrderIndex = Math.max(...modules.map((m) => m.order_index));

      // Prepare new modules with incremented order_index
      const newModules = modulesToDuplicate.map((module, idx) => ({
        program_id: module.program_id,
        title: `Copy of ${module.title}`,
        description: module.description,
        content: module.content || null,
        module_type: module.module_type,
        order_index: maxOrderIndex + idx + 1,
        estimated_minutes: module.estimated_minutes,
        links: module.links,
        tier_required: module.tier_required,
        is_active: module.is_active,
      }));

      const { error } = await supabase.from("program_modules").insert(newModules);

      if (error) throw error;

      toast.success(`Duplicated ${modulesToDuplicate.length} module(s)`);
      setSelectedModules(new Set());
      setSelectionMode(false);

      // Refresh modules
      const { data: modulesData } = await supabase
        .from("program_modules")
        .select("*")
        .eq("program_id", id)
        .order("order_index");

      if (modulesData) {
        setModules(modulesData);
        // Update history
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(modulesData);
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
      }
    } catch (error: any) {
      toast.error(`Failed to duplicate modules: ${error.message}`);
    }
  }

  async function toggleModuleActive(moduleId: string, currentState: boolean) {
    try {
      const { error } = await supabase
        .from("program_modules")
        .update({ is_active: !currentState })
        .eq("id", moduleId);

      if (error) throw error;

      toast.success(`Module ${!currentState ? "activated" : "deactivated"}`);

      // Refresh modules
      const { data: modulesData } = await supabase
        .from("program_modules")
        .select("*")
        .eq("program_id", id)
        .order("order_index");

      if (modulesData) {
        setModules(modulesData);
      }
    } catch (error: any) {
      toast.error(`Failed to update module: ${error.message}`);
    }
  }

  function openTierManagerDialog() {
    setEditingTiers((program?.tiers as string[]) || ["Essentials", "Premium"]);
    setNewTierName("");
    setOpenTierManager(true);
  }

  function handleTierDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = parseInt(String(active.id).replace("tier-", ""));
    const newIndex = parseInt(String(over.id).replace("tier-", ""));

    const newTiers = arrayMove(editingTiers, oldIndex, newIndex);
    setEditingTiers(newTiers);
  }

  function addTier() {
    if (!newTierName.trim()) {
      toast.error("Please enter a tier name");
      return;
    }

    const tierExists = editingTiers.some(
      (t) => t.toLowerCase() === newTierName.trim().toLowerCase(),
    );
    if (tierExists) {
      toast.error("A tier with this name already exists");
      return;
    }

    setEditingTiers([...editingTiers, newTierName.trim()]);
    setNewTierName("");
  }

  function removeTier(index: number) {
    const tierToRemove = editingTiers[index];

    // Check if any modules use this tier
    const modulesUsingTier = modules.filter(
      (m) => m.tier_required?.toLowerCase() === tierToRemove.toLowerCase(),
    );

    if (modulesUsingTier.length > 0) {
      toast.error(
        `Cannot remove tier "${tierToRemove}": ${modulesUsingTier.length} module(s) are using it`,
      );
      return;
    }

    setEditingTiers(editingTiers.filter((_, i) => i !== index));
  }

  function updateTierName(index: number, newName: string) {
    const updated = [...editingTiers];
    updated[index] = newName;
    setEditingTiers(updated);
  }

  async function saveTiers() {
    if (editingTiers.length === 0) {
      toast.error("Program must have at least one tier");
      return;
    }

    // Check for duplicate names
    const lowerCaseTiers = editingTiers.map((t) => t.toLowerCase());
    const hasDuplicates = lowerCaseTiers.some(
      (tier, index) => lowerCaseTiers.indexOf(tier) !== index,
    );

    if (hasDuplicates) {
      toast.error("Tier names must be unique");
      return;
    }

    const { error } = await supabase.from("programs").update({ tiers: editingTiers }).eq("id", id);

    if (error) {
      toast.error("Failed to update tiers");
      return;
    }

    toast.success("Tiers updated successfully");
    setOpenTierManager(false);

    // Refresh program data
    const { data: programData } = await supabase.from("programs").select("*").eq("id", id).single();
    setProgram(programData);
  }

  function openEditProgramDialog() {
    setEditingProgramName(program?.name || "");
    setEditingDescription(program?.description || "");
    setEditingProgramCode(program?.code || "");
    setOpenEditProgram(true);
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateFile(file, "program-logos");
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    setUploadingLogo(true);

    try {
      // Delete old logo if exists
      if (program?.logo_url) {
        const oldPath = program.logo_url.split("/").pop();
        if (oldPath) {
          await supabase.storage.from("program-logos").remove([`${id}/${oldPath}`]);
        }
      }

      // Upload new logo
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("program-logos")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("program-logos").getPublicUrl(filePath);

      // Update program with logo URL
      const { error: updateError } = await supabase
        .from("programs")
        .update({ logo_url: publicUrl })
        .eq("id", id);

      if (updateError) throw updateError;

      toast.success("Logo uploaded successfully");

      // Refresh program data
      const { data: programData } = await supabase
        .from("programs")
        .select("*")
        .eq("id", id)
        .single();
      setProgram(programData);
    } catch (error: any) {
      toast.error(`Failed to upload logo: ${error.message}`);
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) {
        logoInputRef.current.value = "";
      }
    }
  }

  async function removeLogo() {
    if (!program?.logo_url) return;

    try {
      const path = program.logo_url.split("program-logos/")[1];
      if (path) {
        await supabase.storage.from("program-logos").remove([path]);
      }

      const { error } = await supabase.from("programs").update({ logo_url: null }).eq("id", id);

      if (error) throw error;

      toast.success("Logo removed");

      // Refresh program data
      const { data: programData } = await supabase
        .from("programs")
        .select("*")
        .eq("id", id)
        .single();
      setProgram(programData);
    } catch (error: any) {
      toast.error(`Failed to remove logo: ${error.message}`);
    }
  }

  async function saveProgram() {
    if (!editingProgramName.trim()) {
      toast.error("Program name is required");
      return;
    }

    try {
      const { error } = await supabase
        .from("programs")
        .update({
          name: editingProgramName.trim(),
          description: editingDescription,
          code: editingProgramCode.trim() || null,
        })
        .eq("id", id);

      if (error) throw error;

      toast.success("Program updated");
      setOpenEditProgram(false);

      // Refresh program data
      const { data: programData } = await supabase
        .from("programs")
        .select("*")
        .eq("id", id)
        .single();
      setProgram(programData);
    } catch (error: any) {
      toast.error(`Failed to update program: ${error.message}`);
    }
  }

  if (!program) return <PageLoadingState />;

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6">
        {/* Header row: Logo + Name + Manage Tiers button */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
          {/* Logo section */}
          <div className="shrink-0">
            {program.logo_url ? (
              <div className="relative group">
                <img
                  src={program.logo_url}
                  alt={`${program.name} logo`}
                  className="h-16 w-16 sm:h-20 sm:w-20 object-contain rounded-lg border bg-muted"
                />
                <div className="absolute inset-0 bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 rounded-lg">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => logoInputRef.current?.click()}
                    disabled={uploadingLogo}
                  >
                    <Upload className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={removeLogo}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => logoInputRef.current?.click()}
                disabled={uploadingLogo}
                className="h-16 w-16 sm:h-20 sm:w-20 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
              >
                {uploadingLogo ? (
                  <span className="text-xs">Uploading...</span>
                ) : (
                  <>
                    <ImageIcon className="h-6 w-6" />
                    <span className="text-xs">Add Logo</span>
                  </>
                )}
              </button>
            )}
            <input
              ref={logoInputRef}
              type="file"
              accept={acceptStringForBucket("program-logos")}
              className="hidden"
              onChange={handleLogoUpload}
            />
          </div>

          {/* Name and code */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold truncate">{program.name}</h1>
            {program.code && (
              <Badge variant="secondary" className="text-xs shrink-0">
                {program.code}
              </Badge>
            )}
          </div>

          {/* Manage Tiers button */}
          <Button
            variant="outline"
            size="sm"
            onClick={openTierManagerDialog}
            className="shrink-0 self-start sm:self-center"
          >
            <Settings className="mr-2 h-4 w-4" />
            <span className="hidden xs:inline">Manage Tiers</span>
            <span className="xs:hidden">Tiers</span>
          </Button>
        </div>

        {/* Description - full width below header */}
        <div className="mt-4">
          <div className="flex items-start gap-2">
            <div className="text-muted-foreground flex-1">
              {program.description ? (
                <RichTextDisplay content={program.description} />
              ) : (
                <p>No description</p>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={openEditProgramDialog} className="shrink-0">
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 mt-3 items-center">
            <span className="text-sm text-muted-foreground">Tier Hierarchy:</span>
            {((program?.tiers as string[]) || ["Essentials", "Premium"]).map((tier, index) => (
              <Badge key={tier} variant="outline">
                {index + 1}. {tier}
              </Badge>
            ))}
            <span className="text-xs text-muted-foreground ml-2">
              (higher numbers include access to lower tiers)
            </span>
          </div>
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Program Team</CardTitle>
          </CardHeader>
          <CardContent>
            <InstructorCoachAssignment entityType="program" entityId={id} />
          </CardContent>
        </Card>
      </div>

      {/* Edit Program Dialog */}
      <Dialog open={openEditProgram} onOpenChange={setOpenEditProgram}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Program</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="program-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="program-name"
                value={editingProgramName}
                onChange={(e) => setEditingProgramName(e.target.value)}
                placeholder="Enter program name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="program-code">Code (External ID)</Label>
              <Input
                id="program-code"
                value={editingProgramCode}
                onChange={(e) => setEditingProgramCode(e.target.value)}
                placeholder="e.g., PROG-001 or cta-immersion"
              />
              <p className="text-xs text-muted-foreground">
                Optional. Use to link with external systems like InnoTrue Academy.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <RichTextEditor
                value={editingDescription}
                onChange={setEditingDescription}
                placeholder="Enter program description..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpenEditProgram(false)}>
                Cancel
              </Button>
              <Button onClick={saveProgram}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="modules" className="w-full">
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <TabsList className="inline-flex w-max sm:w-auto">
            <TabsTrigger value="modules">Modules</TabsTrigger>
            <TabsTrigger value="access">Plan Access</TabsTrigger>
            <TabsTrigger value="cohorts">Cohorts</TabsTrigger>
            <TabsTrigger value="terms" className="whitespace-nowrap">
              Terms & Conditions
            </TabsTrigger>
            <TabsTrigger value="badge">Badge</TabsTrigger>
            <TabsTrigger value="versions" className="whitespace-nowrap">
              Version History
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="access" className="mt-6">
          <ProgramPlanConfig
            programId={id}
            programTiers={program?.tiers || []}
            currentPlanId={program?.plan_id || null}
            currentMinTier={program?.min_plan_tier || 0}
            currentRequiresSeparatePurchase={program?.requires_separate_purchase || false}
            currentAllowRepeatEnrollment={(program as any)?.allow_repeat_enrollment || false}
            onUpdate={async () => {
              const { data: programData } = await supabase
                .from("programs")
                .select("*")
                .eq("id", id)
                .single();
              setProgram(programData);
            }}
          />
        </TabsContent>

        <TabsContent value="modules" className="mt-6">
          <div className="flex flex-wrap gap-2 mb-6">
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={undo}
                disabled={!canUndo}
                title="Undo (Ctrl+Z)"
              >
                <Undo className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={redo}
                disabled={!canRedo}
                title="Redo (Ctrl+Y)"
              >
                <Redo className="h-4 w-4" />
              </Button>
            </div>
            <Button
              variant={selectionMode ? "secondary" : "outline"}
              size="sm"
              onClick={() => {
                setSelectionMode(!selectionMode);
                if (selectionMode) {
                  setSelectedModules(new Set());
                }
              }}
            >
              <Check className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">
                {selectionMode ? "Cancel Selection" : "Select Modules"}
              </span>
              <span className="sm:hidden">{selectionMode ? "Cancel" : "Select"}</span>
            </Button>
            <Dialog open={openAdd} onOpenChange={setOpenAdd}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Add Module</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add Module</DialogTitle>
                </DialogHeader>
                <ModuleForm
                  onSubmit={addModule}
                  onCancel={() => setOpenAdd(false)}
                  submitLabel="Add Module"
                  availableTiers={(program?.tiers as string[]) || ["Essentials", "Premium"]}
                />
              </DialogContent>
            </Dialog>
          </div>

          {selectionMode && hasSelection && (
            <Card className="mb-4 bg-primary/5">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Checkbox checked={allSelected} onCheckedChange={toggleSelectAll} />
                    <span className="text-sm font-medium">
                      {selectedModules.size} module(s) selected
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={bulkDuplicate}>
                      <Copy className="mr-2 h-4 w-4" />
                      Duplicate Selected
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setShowDeleteDialog(true)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Selected
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={modules.map((m) => m.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-4">
                {modules.map((module, index) => (
                  <SortableModule
                    key={module.id}
                    module={module}
                    index={index}
                    onEdit={handleEditModule}
                    onClone={cloneModule}
                    onCopyToProgram={(mod) => {
                      setTransferModule(mod);
                      setTransferMode("copy");
                      setTransferDialogOpen(true);
                    }}
                    onMoveToProgram={(mod) => {
                      setTransferModule(mod);
                      setTransferMode("move");
                      setTransferDialogOpen(true);
                    }}
                    onToggleActive={toggleModuleActive}
                    onDelete={handleDeleteModule}
                    isSelected={selectedModules.has(module.id)}
                    onSelect={handleModuleSelect}
                    selectionMode={selectionMode}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          <Dialog
            open={openEdit}
            onOpenChange={(open) => {
              setOpenEdit(open);
              if (!open) {
                // Delay clearing editingModule to allow dialog to close gracefully
                setTimeout(() => setEditingModule(null), 150);
              }
            }}
          >
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Module</DialogTitle>
              </DialogHeader>
              {editingModule && (
                <Tabs defaultValue="details" className="w-full">
                  <TabsList className="grid w-full grid-cols-6">
                    <TabsTrigger value="details">Details</TabsTrigger>
                    <TabsTrigger value="sections">Sections</TabsTrigger>
                    <TabsTrigger value="skills">Skills</TabsTrigger>
                    <TabsTrigger value="scenarios">Scenarios</TabsTrigger>
                    <TabsTrigger value="prerequisites">Access</TabsTrigger>
                    <TabsTrigger value="domains">Domains</TabsTrigger>
                  </TabsList>
                  <TabsContent value="details" className="mt-4">
                    <ModuleForm
                      initialData={{
                        id: editingModule.id,
                        title: editingModule.title,
                        description: editingModule.description,
                        content: editingModule.content || "",
                        moduleType: editingModule.module_type,
                        estimatedMinutes: String(editingModule.estimated_minutes),
                        links: editingModule.links || [],
                        tierRequired: editingModule.tier_required || "essentials",
                        isIndividualized: editingModule.is_individualized || false,
                        code: editingModule.code || "",
                        featureKey: editingModule.feature_key || null,
                        capabilityAssessmentId: editingModule.capability_assessment_id || null,
                        contentPackagePath: editingModule.content_package_path || null,
                        contentPackageId: editingModule.content_package_id || null,
                      }}
                      onSubmit={updateModule}
                      onCancel={() => {
                        setOpenEdit(false);
                        setEditingModule(null);
                      }}
                      submitLabel="Update Module"
                      availableTiers={(program?.tiers as string[]) || ["Essentials", "Premium"]}
                    />
                  </TabsContent>
                  <TabsContent value="sections" className="mt-4 space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Changes save automatically as you edit.
                    </p>
                    <ModuleSectionsEditor moduleId={editingModule.id} />
                  </TabsContent>
                  <TabsContent value="skills" className="mt-4">
                    <ModuleSkillsEditor moduleId={editingModule.id} />
                  </TabsContent>
                  <TabsContent value="scenarios" className="mt-4">
                    <ModuleScenariosEditor moduleId={editingModule.id} />
                  </TabsContent>
                  <TabsContent value="prerequisites" className="mt-4 space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Manage prerequisites and time-gating for this module.
                    </p>
                    <ModulePrerequisites
                      moduleId={editingModule.id}
                      programId={editingModule.program_id}
                      currentModuleOrderIndex={editingModule.order_index}
                    />
                  </TabsContent>
                  <TabsContent value="domains" className="mt-4">
                    <ModuleDomainMapper
                      moduleId={editingModule.id}
                      moduleName={editingModule.title}
                    />
                  </TabsContent>
                </Tabs>
              )}
            </DialogContent>
          </Dialog>

          <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {selectedModules.size} module(s)?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete the selected modules
                  from this program.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={bulkDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog open={showSingleDeleteDialog} onOpenChange={setShowSingleDeleteDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete module?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete the module "
                  {moduleToDelete?.title}" from this program.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={confirmDeleteModule}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Dialog open={openTierManager} onOpenChange={setOpenTierManager}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Manage Subscription Tiers</DialogTitle>
              </DialogHeader>
              <div className="space-y-6">
                <div className="space-y-4">
                  <Label>Tier Hierarchy (drag to reorder or edit names)</Label>
                  <p className="text-xs text-muted-foreground">
                    Tiers are ordered from lowest (1) to highest. Higher tiers include access to all
                    lower tier content.
                  </p>
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleTierDragEnd}
                  >
                    <SortableContext
                      items={editingTiers.map((_, i) => `tier-${i}`)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2">
                        {editingTiers.map((tier, index) => (
                          <SortableTierItem
                            key={`tier-${index}`}
                            id={`tier-${index}`}
                            tier={tier}
                            index={index}
                            onUpdateName={(newName) => updateTierName(index, newName)}
                            onRemove={() => removeTier(index)}
                            canRemove={editingTiers.length > 1}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                </div>

                <div className="space-y-4">
                  <Label>Add New Tier</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="e.g., Gold, Platinum, Enterprise"
                      value={newTierName}
                      onChange={(e) => setNewTierName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addTier();
                        }
                      }}
                    />
                    <Button onClick={addTier} variant="outline">
                      <Plus className="mr-2 h-4 w-4" />
                      Add
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    New tiers are added at the highest level. Drag to reorder if needed.
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button onClick={saveTiers} className="flex-1">
                    Save Changes
                  </Button>
                  <Button variant="outline" onClick={() => setOpenTierManager(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="cohorts" className="mt-6">
          {program && <ProgramCohortsManager programId={id} />}
        </TabsContent>

        <TabsContent value="terms" className="mt-6">
          {program && <ProgramTermsManager programId={id} />}
        </TabsContent>

        <TabsContent value="badge" className="mt-6">
          {program && <ProgramBadgeManager programId={id} programName={program.name} />}
        </TabsContent>

        <TabsContent value="versions" className="mt-6">
          {program && <ProgramVersionHistory programId={id} programName={program.name} />}
        </TabsContent>
      </Tabs>

      <ModuleProgramTransferDialog
        open={transferDialogOpen}
        onOpenChange={setTransferDialogOpen}
        module={transferModule}
        mode={transferMode}
        currentProgramId={id}
        onComplete={async () => {
          const { data: modulesData } = await supabase
            .from("program_modules")
            .select("*")
            .eq("program_id", id)
            .order("order_index");
          if (modulesData) {
            setModules(modulesData);
          }
        }}
      />
    </div>
  );
}
