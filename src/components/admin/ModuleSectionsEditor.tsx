import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, GripVertical, Trash2, Minus } from "lucide-react";
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

interface ModuleSection {
  id: string;
  module_id: string;
  order_index: number;
  section_type: "content" | "separator";
  title: string | null;
  content: string | null;
  created_at?: string;
  updated_at?: string;
}

type SectionType = "content" | "separator";

interface SortableSectionItemProps {
  section: ModuleSection;
  onUpdate: (id: string, field: keyof ModuleSection, value: string | null) => void;
  onDelete: (id: string) => void;
}

function SortableSectionItem({ section, onUpdate, onDelete }: SortableSectionItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  if (section.section_type === "separator") {
    return (
      <div ref={setNodeRef} style={style} className="flex items-center gap-2 py-3">
        <button {...attributes} {...listeners} className="cursor-grab p-1 hover:bg-muted rounded">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
        <div className="flex-1 flex items-center gap-4">
          <Minus className="h-4 w-4 text-muted-foreground" />
          <div className="flex-1 border-t border-border" />
          <span className="text-xs text-muted-foreground">Separator</span>
          <div className="flex-1 border-t border-border" />
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDelete(section.id)}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <Card ref={setNodeRef} style={style} className="relative">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <button {...attributes} {...listeners} className="cursor-grab p-1 hover:bg-muted rounded">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </button>
          <div className="flex-1">
            <Input
              value={section.title || ""}
              onChange={(e) => onUpdate(section.id, "title", e.target.value || null)}
              placeholder="Section title (optional)"
              className="font-medium"
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(section.id)}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <RichTextEditor
          value={section.content || ""}
          onChange={(value) => onUpdate(section.id, "content", value)}
          placeholder="Section content..."
        />
      </CardContent>
    </Card>
  );
}

interface ModuleSectionsEditorProps {
  moduleId: string;
}

export function ModuleSectionsEditor({ moduleId }: ModuleSectionsEditorProps) {
  const [sections, setSections] = useState<ModuleSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  useEffect(() => {
    fetchSections();
  }, [moduleId]);

  async function fetchSections() {
    const { data, error } = await supabase
      .from("module_sections")
      .select("*")
      .eq("module_id", moduleId)
      .order("order_index");

    if (error) {
      toast.error("Failed to load sections");
      console.error(error);
    } else {
      setSections(
        (data || []).map((s) => ({
          ...s,
          section_type: s.section_type as SectionType,
        })),
      );
    }
    setLoading(false);
  }

  async function addSection(type: SectionType) {
    setSaving(true);
    const newOrderIndex = sections.length;

    const { data, error } = await supabase
      .from("module_sections")
      .insert({
        module_id: moduleId,
        order_index: newOrderIndex,
        section_type: type,
        title: null,
        content: type === "content" ? "" : null,
      })
      .select()
      .single();

    if (error) {
      toast.error("Failed to add section");
      console.error(error);
    } else if (data) {
      const newSection: ModuleSection = {
        ...data,
        section_type: data.section_type as SectionType,
      };
      setSections([...sections, newSection]);
      toast.success(`${type === "separator" ? "Separator" : "Section"} added`);
    }
    setSaving(false);
  }

  async function updateSection(id: string, field: keyof ModuleSection, value: string | null) {
    // Update local state immediately for responsiveness
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)));

    // Debounce the database update
    const { error } = await supabase
      .from("module_sections")
      .update({ [field]: value, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      toast.error("Failed to update section");
      console.error(error);
    }
  }

  async function deleteSection(id: string) {
    setSaving(true);
    const { error } = await supabase.from("module_sections").delete().eq("id", id);

    if (error) {
      toast.error("Failed to delete section");
      console.error(error);
    } else {
      setSections((prev) => prev.filter((s) => s.id !== id));
      // Re-order remaining sections
      const remaining = sections.filter((s) => s.id !== id);
      await updateOrder(remaining);
      toast.success("Section deleted");
    }
    setSaving(false);
  }

  async function updateOrder(newSections: ModuleSection[]) {
    const updates = newSections.map((section, index) => ({
      id: section.id,
      order_index: index,
    }));

    for (const update of updates) {
      await supabase
        .from("module_sections")
        .update({ order_index: update.order_index })
        .eq("id", update.id);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setSections((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        const newItems = arrayMove(items, oldIndex, newIndex);

        // Update order in database
        updateOrder(newItems);

        return newItems;
      });
    }
  }

  if (loading) {
    return <div className="p-4 text-muted-foreground">Loading sections...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold">Content Sections</Label>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => addSection("separator")}
            disabled={saving}
          >
            <Minus className="mr-2 h-4 w-4" />
            Add Separator
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => addSection("content")}
            disabled={saving}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Section
          </Button>
        </div>
      </div>

      {sections.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-muted-foreground">
            <p>No content sections yet.</p>
            <p className="text-sm">Click "Add Section" to start building your module content.</p>
          </CardContent>
        </Card>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {sections.map((section) => (
                <SortableSectionItem
                  key={section.id}
                  section={section}
                  onUpdate={updateSection}
                  onDelete={deleteSection}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
