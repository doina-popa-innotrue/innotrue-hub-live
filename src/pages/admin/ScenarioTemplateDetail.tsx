import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowLeft,
  Plus,
  Edit,
  Trash2,
  Loader2,
  ChevronDown,
  ChevronRight,
  FileText,
  GripVertical,
  Link2,
  Unlink,
  Lock,
  AlertTriangle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AdminLoadingState } from "@/components/admin";
import { ErrorState } from "@/components/ui/error-state";
import { useAuth } from "@/contexts/AuthContext";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { RichTextDisplay } from "@/components/ui/rich-text-display";
import {
  useScenarioTemplate,
  useScenarioSections,
  useScenarioSectionMutations,
  useSectionParagraphs,
  useSectionParagraphMutations,
  useQuestionLinkMutations,
} from "@/hooks/useScenarios";
import type { ScenarioSection, SectionParagraph, ParagraphQuestionLink } from "@/types/scenarios";

export default function ScenarioTemplateDetail() {
  const { id } = useParams<{ id: string }>();
  if (!id) return null;
  const navigate = useNavigate();
  const { toast } = useToast();
  const { userRole } = useAuth();
  const isAdmin = userRole === "admin";

  const { data: template, isLoading: templateLoading } = useScenarioTemplate(id);
  const { data: sections, isLoading: sectionsLoading } = useScenarioSections(id);

  const isLocked = (template?.is_locked && !isAdmin) ?? false;

  if (templateLoading || sectionsLoading) {
    return <AdminLoadingState message="Loading scenario template..." />;
  }

  if (!template) {
    return (
      <ErrorState title="Not Found" description="The requested template could not be found." />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/scenario-templates")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{template.title}</h1>
              {template.is_locked && (
                <Badge variant="destructive">
                  <Lock className="h-3 w-3 mr-1" />
                  Locked
                </Badge>
              )}
            </div>
            {template.description && (
              <p className="text-muted-foreground">{template.description}</p>
            )}
          </div>
        </div>
        {template.capability_assessments && (
          <Badge variant="secondary" className="text-sm">
            Linked: {template.capability_assessments.name} (0-
            {template.capability_assessments.rating_scale})
          </Badge>
        )}
      </div>

      {isLocked && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="py-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <span>This template is locked. Only admins can make changes.</span>
          </CardContent>
        </Card>
      )}

      {/* Sections */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Sections</h2>
          {!isLocked && <AddSectionDialog templateId={id!} existingSections={sections || []} />}
        </div>

        {!sections || sections.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No sections yet</p>
              {!isLocked && <AddSectionDialog templateId={id!} existingSections={[]} asButton />}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {sections.map((section, index) => (
              <SectionCard
                key={section.id}
                section={section}
                sectionNumber={index + 1}
                templateId={id!}
                isLocked={isLocked}
                assessmentId={template.capability_assessment_id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Section Card Component
// ============================================================================

function SectionCard({
  section,
  sectionNumber,
  templateId,
  isLocked,
  assessmentId,
}: {
  section: ScenarioSection;
  sectionNumber: number;
  templateId: string;
  isLocked: boolean;
  assessmentId: string | null;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    title: section.title,
    instructions: section.instructions || "",
  });

  const { data: paragraphs, isLoading } = useSectionParagraphs(section.id);
  const { updateMutation, deleteMutation } = useScenarioSectionMutations(templateId);

  const handleSave = () => {
    updateMutation.mutate(
      { id: section.id, data: editData },
      {
        onSuccess: () => setIsEditing(false),
      },
    );
  };

  const handleDelete = () => {
    if (confirm("Delete this section and all its paragraphs?")) {
      deleteMutation.mutate(section.id);
    }
  };

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CollapsibleTrigger className="flex items-center gap-2 hover:text-primary">
              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <CardTitle className="text-base">
                Section {sectionNumber}: {section.title}
              </CardTitle>
            </CollapsibleTrigger>
            {!isLocked && (
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={() => setIsEditing(!isEditing)}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            )}
          </div>
          {section.instructions && !isEditing && (
            <CardDescription className="ml-6">{section.instructions}</CardDescription>
          )}
        </CardHeader>

        {isEditing && (
          <CardContent className="border-t pt-4 space-y-4">
            <div>
              <Label>Section Title</Label>
              <Input
                value={editData.title}
                onChange={(e) => setEditData({ ...editData, title: e.target.value })}
              />
            </div>
            <div>
              <Label>Instructions</Label>
              <Textarea
                value={editData.instructions}
                onChange={(e) => setEditData({ ...editData, instructions: e.target.value })}
                rows={2}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending}>
                {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save
              </Button>
            </div>
          </CardContent>
        )}

        <CollapsibleContent>
          <CardContent className="pt-0">
            {isLoading ? (
              <div className="py-4 text-center text-muted-foreground">Loading paragraphs...</div>
            ) : (
              <div className="space-y-3">
                {paragraphs?.map((paragraph, index) => (
                  <ParagraphItem
                    key={paragraph.id}
                    paragraph={paragraph}
                    paragraphNumber={index + 1}
                    sectionId={section.id}
                    isLocked={isLocked}
                    assessmentId={assessmentId}
                  />
                ))}
                {!isLocked && (
                  <AddParagraphDialog
                    sectionId={section.id}
                    existingCount={paragraphs?.length || 0}
                  />
                )}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

// ============================================================================
// Paragraph Item Component
// ============================================================================

function ParagraphItem({
  paragraph,
  paragraphNumber,
  sectionId,
  isLocked,
  assessmentId,
}: {
  paragraph: SectionParagraph & { paragraph_question_links?: ParagraphQuestionLink[] };
  paragraphNumber: number;
  sectionId: string;
  isLocked: boolean;
  assessmentId: string | null;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [showQuestionLink, setShowQuestionLink] = useState(false);
  const [editData, setEditData] = useState({
    content: paragraph.content,
    requires_response: paragraph.requires_response,
  });

  const { updateMutation, deleteMutation } = useSectionParagraphMutations(sectionId);

  const handleSave = () => {
    updateMutation.mutate(
      { id: paragraph.id, data: editData },
      {
        onSuccess: () => setIsEditing(false),
      },
    );
  };

  const handleDelete = () => {
    if (confirm("Delete this paragraph?")) {
      deleteMutation.mutate(paragraph.id);
    }
  };

  const linkedQuestions = paragraph.paragraph_question_links || [];

  return (
    <div className="border rounded-lg p-3 bg-muted/30">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1">
          <GripVertical className="h-4 w-4 text-muted-foreground mt-1 cursor-grab" />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-muted-foreground">¶{paragraphNumber}</span>
              {paragraph.requires_response && (
                <Badge variant="outline" className="text-xs">
                  Response Required
                </Badge>
              )}
              {linkedQuestions.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  <Link2 className="h-3 w-3 mr-1" />
                  {linkedQuestions.length} question{linkedQuestions.length > 1 ? "s" : ""}
                </Badge>
              )}
            </div>
            {isEditing ? (
              <div className="space-y-3">
                <RichTextEditor
                  value={editData.content}
                  onChange={(value) => setEditData({ ...editData, content: value })}
                  placeholder="Enter the scenario content for this paragraph..."
                />
                <div className="flex items-center gap-2">
                  <Switch
                    checked={editData.requires_response}
                    onCheckedChange={(checked) =>
                      setEditData({ ...editData, requires_response: checked })
                    }
                  />
                  <Label className="text-sm">Requires response</Label>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => setIsEditing(false)}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending}>
                    Save
                  </Button>
                </div>
              </div>
            ) : (
              <RichTextDisplay content={paragraph.content} className="text-sm" />
            )}

            {/* Linked Questions Display */}
            {linkedQuestions.length > 0 && !isEditing && (
              <div className="mt-2 pt-2 border-t">
                <p className="text-xs font-medium text-muted-foreground mb-1">Linked Questions:</p>
                <div className="space-y-1">
                  {linkedQuestions.map((link) => (
                    <div
                      key={link.id}
                      className="flex items-center justify-between text-xs bg-background rounded px-2 py-1"
                    >
                      <span>
                        <span className="text-muted-foreground">
                          [{link.capability_domain_questions?.capability_domains?.name}]
                        </span>{" "}
                        {link.capability_domain_questions?.question_text}
                      </span>
                      {!isLocked && (
                        <UnlinkQuestionButton
                          linkId={link.id}
                          paragraphId={paragraph.id}
                          sectionId={sectionId}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        {!isLocked && !isEditing && (
          <div className="flex items-center gap-1">
            {assessmentId && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowQuestionLink(!showQuestionLink)}
              >
                <Link2 className="h-4 w-4" />
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={() => setIsEditing(true)}>
              <Edit className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleDelete}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        )}
      </div>

      {showQuestionLink && assessmentId && (
        <div className="mt-3 pt-3 border-t">
          <LinkQuestionPanel
            paragraphId={paragraph.id}
            sectionId={sectionId}
            assessmentId={assessmentId}
            existingLinks={linkedQuestions}
            onClose={() => setShowQuestionLink(false)}
          />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Link Question Panel
// ============================================================================

function LinkQuestionPanel({
  paragraphId,
  sectionId,
  assessmentId,
  existingLinks,
  onClose,
}: {
  paragraphId: string;
  sectionId: string;
  assessmentId: string;
  existingLinks: ParagraphQuestionLink[];
  onClose: () => void;
}) {
  const { data: domains, isLoading } = useQuery({
    queryKey: ["capability-domains", assessmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("capability_domains")
        .select(
          `
          id,
          name,
          capability_domain_questions(id, question_text)
        `,
        )
        .eq("assessment_id", assessmentId)
        .order("order_index");
      if (error) throw error;
      return data;
    },
  });

  const { addLinkMutation } = useQuestionLinkMutations(paragraphId, sectionId);

  const existingQuestionIds = new Set(existingLinks.map((l) => l.question_id));

  if (isLoading) {
    return <PageLoadingState message="Loading questions..." />;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Link Questions from Assessment</p>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Done
        </Button>
      </div>
      <ScrollArea className="h-[200px]">
        <div className="space-y-3">
          {domains?.map((domain) => (
            <div key={domain.id}>
              <p className="text-xs font-medium text-muted-foreground mb-1">{domain.name}</p>
              <div className="space-y-1">
                {(domain.capability_domain_questions as any[])?.map((question: any) => (
                  <div
                    key={question.id}
                    className="flex items-center justify-between text-sm p-2 rounded hover:bg-muted"
                  >
                    <span className="flex-1 truncate">{question.question_text}</span>
                    {existingQuestionIds.has(question.id) ? (
                      <Badge variant="secondary" className="text-xs">
                        Linked
                      </Badge>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => addLinkMutation.mutate({ questionId: question.id })}
                        disabled={addLinkMutation.isPending}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Link
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

// ============================================================================
// Unlink Question Button
// ============================================================================

function UnlinkQuestionButton({
  linkId,
  paragraphId,
  sectionId,
}: {
  linkId: string;
  paragraphId: string;
  sectionId: string;
}) {
  const { removeLinkMutation } = useQuestionLinkMutations(paragraphId, sectionId);

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-5 w-5"
      onClick={() => removeLinkMutation.mutate(linkId)}
      disabled={removeLinkMutation.isPending}
    >
      <Unlink className="h-3 w-3" />
    </Button>
  );
}

// ============================================================================
// Add Section Dialog
// ============================================================================

function AddSectionDialog({
  templateId,
  existingSections,
  asButton = false,
}: {
  templateId: string;
  existingSections: ScenarioSection[];
  asButton?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({ title: "", instructions: "" });
  const { createMutation } = useScenarioSectionMutations(templateId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(
      {
        ...formData,
        order_index: existingSections.length,
      },
      {
        onSuccess: () => {
          setOpen(false);
          setFormData({ title: "", instructions: "" });
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {asButton ? (
          <Button className="mt-4">
            <Plus className="h-4 w-4 mr-2" />
            Add First Section
          </Button>
        ) : (
          <Button variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Section
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Section</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Title *</Label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
              placeholder="e.g., Background Information"
            />
          </div>
          <div>
            <Label>Instructions (optional)</Label>
            <Textarea
              value={formData.instructions}
              onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
              rows={2}
              placeholder="Instructions for this section..."
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Section
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Add Paragraph Dialog
// ============================================================================

function AddParagraphDialog({
  sectionId,
  existingCount,
}: {
  sectionId: string;
  existingCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({ content: "", requires_response: true });
  const { createMutation } = useSectionParagraphMutations(sectionId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(
      {
        ...formData,
        order_index: existingCount,
      },
      {
        onSuccess: () => {
          setOpen(false);
          setFormData({ content: "", requires_response: true });
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full">
          <Plus className="h-4 w-4 mr-2" />
          Add Paragraph
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Paragraph</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Content *</Label>
            <RichTextEditor
              value={formData.content}
              onChange={(value) => setFormData({ ...formData, content: value })}
              placeholder="Enter the scenario content for this paragraph..."
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={formData.requires_response}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, requires_response: checked })
              }
            />
            <Label>Requires response from client</Label>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Paragraph
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
