import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  BookOpen,
  FileText,
  Target,
  Loader2,
  StickyNote,
  Upload,
  Library,
  Link as LinkIcon,
  X,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ResourcePickerDialog } from "@/components/modules/ResourcePickerDialog";

interface DevelopmentItemData {
  id: string;
  item_type: "reflection" | "note" | "resource" | "action_item";
  title: string | null;
  content: string | null;
  resource_url: string | null;
  due_date: string | null;
  goal_links?: Array<{ goal_id: string }>;
  milestone_links?: Array<{ milestone_id: string }>;
}

interface DevelopmentItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  snapshotId?: string;
  /** When provided (instructor flow), used to validate authorization to create items for another user */
  moduleProgressId?: string;
  questionId?: string;
  domainId?: string;
  goalId?: string;
  milestoneId?: string;
  editItem?: DevelopmentItemData | null;
  /** When set, creates the item for this user instead of the current user (for instructors) */
  forUserId?: string;
  /** Restrict to specific item types (e.g., ['resource', 'note'] for instructor mode) */
  allowedTypes?: Array<"reflection" | "note" | "resource" | "action_item">;
  /** Custom title for the dialog */
  dialogTitle?: string;
  /** Custom description for the dialog */
  dialogDescription?: string;
}

export function DevelopmentItemDialog({
  open,
  onOpenChange,
  snapshotId,
  moduleProgressId,
  questionId,
  domainId,
  goalId,
  milestoneId,
  editItem,
  forUserId,
  allowedTypes,
  dialogTitle,
  dialogDescription,
}: DevelopmentItemDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [itemType, setItemType] = useState<"reflection" | "note" | "resource" | "action_item">(
    allowedTypes?.[0] || "reflection",
  );
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [resourceUrl, setResourceUrl] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [selectedGoalId, setSelectedGoalId] = useState<string>(goalId || "");
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string>(milestoneId || "");

  // Resource type: 'url', 'file', or 'library'
  const [resourceMode, setResourceMode] = useState<"url" | "file" | "library">("url");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedLibraryResource, setSelectedLibraryResource] = useState<{
    id: string;
    title: string;
    description: string | null;
    resource_type: string;
  } | null>(null);

  const isEditing = !!editItem;

  // Populate form when editing
  useEffect(() => {
    if (editItem && open) {
      setItemType(editItem.item_type);
      setTitle(editItem.title || "");
      setContent(editItem.content || "");
      setResourceUrl(editItem.resource_url || "");
      setDueDate(editItem.due_date ? editItem.due_date.split("T")[0] : "");
      setSelectedGoalId(editItem.goal_links?.[0]?.goal_id || goalId || "");
      setSelectedMilestoneId(editItem.milestone_links?.[0]?.milestone_id || milestoneId || "");
    } else if (!open) {
      // Reset when closing
      resetForm();
    }
  }, [editItem, open, goalId, milestoneId]);

  // Fetch goals for linking
  // In instructor mode (forUserId set), only show goals the client has explicitly shared with this instructor
  // In client mode, show all their own goals
  const isInstructorMode = !!forUserId && forUserId !== user?.id;
  const { data: goals } = useQuery({
    queryKey: ["user-goals-for-linking", forUserId || user?.id, isInstructorMode ? user?.id : null],
    queryFn: async () => {
      if (!user?.id) return [];

      if (isInstructorMode) {
        // Instructor viewing client's goals - only show goals shared with this instructor
        const { data, error } = await supabase
          .from("goal_shares")
          .select(
            `
            goal_id,
            goals!inner (id, title)
          `,
          )
          .eq("shared_with_user_id", user.id)
          .eq("goals.user_id", forUserId);

        if (error) throw error;
        return data?.map((s) => s.goals).filter(Boolean) || [];
      } else {
        // Client viewing their own goals
        const { data, error } = await supabase
          .from("goals")
          .select("id, title")
          .eq("user_id", user.id)
          .order("title");
        if (error) throw error;
        return data;
      }
    },
    enabled: !!user?.id && open,
  });

  // Fetch milestones for selected goal
  const { data: milestones } = useQuery({
    queryKey: ["goal-milestones-for-linking", selectedGoalId],
    queryFn: async () => {
      if (!selectedGoalId) return [];
      const { data, error } = await supabase
        .from("goal_milestones")
        .select("id, title")
        .eq("goal_id", selectedGoalId)
        .order("title");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedGoalId && open,
  });

  const resetForm = () => {
    setItemType(allowedTypes?.[0] || "reflection");
    setTitle("");
    setContent("");
    setResourceUrl("");
    setDueDate("");
    setResourceMode("url");
    setSelectedFile(null);
    setSelectedLibraryResource(null);
    if (!goalId) setSelectedGoalId("");
    if (!milestoneId) setSelectedMilestoneId("");
  };

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];

    if (!validTypes.includes(file.type) && !file.type.startsWith("text/")) {
      toast({
        title: "Invalid file type",
        description: "Please upload an image, PDF, or document file",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload a file smaller than 10MB",
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);
    if (!title) {
      setTitle(file.name);
    }
  };

  // Upload file to storage
  const uploadFile = async (
    file: File,
    targetUserId: string,
  ): Promise<{ filePath: string; fileSize: number; mimeType: string }> => {
    const fileExt = file.name.split(".").pop();
    const fileName = `${targetUserId}/${Date.now()}.${fileExt}`;

    const { error } = await supabase.storage.from("development-item-files").upload(fileName, file);

    if (error) throw error;
    return { filePath: fileName, fileSize: file.size, mimeType: file.type };
  };

  // Handle library resource selection
  const handleLibraryResourceSelect = (resource: {
    id: string;
    title: string;
    description: string | null;
    resource_type: string;
  }) => {
    setSelectedLibraryResource(resource);
    if (!title) {
      setTitle(resource.title);
    }
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");

      // Determine target user (for instructor mode, create for client)
      const targetUserId = forUserId || user.id;

      // When creating for someone else, use backend function (bypasses RLS safely)
      if (forUserId && forUserId !== user.id) {
        if (!moduleProgressId) {
          throw new Error("Missing module context for instructor-created resource");
        }

        // For instructor mode with file upload, we upload the file first, then pass the path
        let filePath: string | null = null;
        let fileSize: number | null = null;
        let mimeType: string | null = null;

        if (itemType === "resource" && resourceMode === "file" && selectedFile) {
          const uploadResult = await uploadFile(selectedFile, forUserId);
          filePath = uploadResult.filePath;
          fileSize = uploadResult.fileSize;
          mimeType = uploadResult.mimeType;
        }

        const { data, error } = await supabase.functions.invoke("create-client-development-item", {
          body: {
            forUserId,
            moduleProgressId,
            snapshotId: snapshotId && snapshotId !== "standalone" ? snapshotId : null,
            questionId: questionId || null,
            domainId: domainId || null,
            goalId: selectedGoalId || goalId || null,
            milestoneId: selectedMilestoneId || milestoneId || null,
            itemType,
            title: title || null,
            content: content || null,
            resourceUrl: resourceMode === "url" ? resourceUrl || null : null,
            dueDate: dueDate || null,
            // New file/library fields
            filePath,
            fileSize,
            mimeType,
            libraryResourceId:
              resourceMode === "library" && selectedLibraryResource
                ? selectedLibraryResource.id
                : null,
            resourceMode,
          },
        });

        if (error) throw error;
        if ((data as any)?.error) throw new Error((data as any).error);

        return (data as any).item;
      }

      // Self-created development item (normal user flow)
      const itemData: any = {
        user_id: targetUserId,
        author_id: user.id,
        item_type: itemType,
        title: title || null,
        content: content || null,
      };

      if (itemType === "resource") {
        if (resourceMode === "file" && selectedFile) {
          // Upload file first
          const { filePath, fileSize, mimeType } = await uploadFile(selectedFile, targetUserId);
          itemData.file_path = filePath;
          itemData.file_size = fileSize;
          itemData.mime_type = mimeType;
          itemData.resource_type = mimeType.startsWith("image/") ? "image" : "file";
        } else if (resourceMode === "library" && selectedLibraryResource) {
          // Link to library resource
          itemData.library_resource_id = selectedLibraryResource.id;
          itemData.resource_type = "library";
        } else {
          // URL-based resource
          itemData.resource_url = resourceUrl || null;
          itemData.resource_type = "link";
        }
      }

      if (itemType === "action_item") {
        itemData.status = "pending";
        if (dueDate) {
          itemData.due_date = dueDate;
        }
      }

      const { data: item, error: itemError } = await supabase
        .from("development_items")
        .insert(itemData)
        .select()
        .single();

      if (itemError) throw itemError;

      // Create link to snapshot ONLY if not linking to a specific question or domain
      // (question/domain links already tie the item to the snapshot context)
      if (snapshotId && snapshotId !== "standalone" && !questionId && !domainId) {
        const { error: linkError } = await supabase.from("development_item_snapshot_links").insert({
          development_item_id: item.id,
          snapshot_id: snapshotId,
        });
        if (linkError) throw linkError;
      }

      // Create link to module progress if available
      if (moduleProgressId) {
        const { error: linkError } = await supabase.from("development_item_module_links").insert({
          development_item_id: item.id,
          module_progress_id: moduleProgressId,
        });
        if (linkError) throw linkError;
      }

      // Create link to capability question
      if (questionId && snapshotId && snapshotId !== "standalone") {
        const { error: linkError } = await supabase.from("development_item_question_links").insert({
          development_item_id: item.id,
          question_id: questionId,
          snapshot_id: snapshotId,
        });

        if (linkError) throw linkError;
      }

      // Create link to capability domain
      if (domainId && !questionId && snapshotId && snapshotId !== "standalone") {
        const { error: linkError } = await supabase.from("development_item_domain_links").insert({
          development_item_id: item.id,
          domain_id: domainId,
          snapshot_id: snapshotId,
        });

        if (linkError) throw linkError;
      }

      // Create link to goal
      const finalGoalId = selectedGoalId || goalId;
      if (finalGoalId) {
        const { error: linkError } = await supabase.from("development_item_goal_links").insert({
          development_item_id: item.id,
          goal_id: finalGoalId,
        });

        if (linkError) throw linkError;
      }

      // Create link to milestone
      const finalMilestoneId = selectedMilestoneId || milestoneId;
      if (finalMilestoneId) {
        const { error: linkError } = await supabase
          .from("development_item_milestone_links")
          .insert({
            development_item_id: item.id,
            milestone_id: finalMilestoneId,
          });

        if (linkError) throw linkError;
      }

      return item;
    },
    onSuccess: () => {
      toast({ description: "Development item added successfully" });
      queryClient.invalidateQueries({ queryKey: ["development-items"] });
      queryClient.invalidateQueries({ queryKey: ["recent-development-items"] });
      // Also invalidate instructor resources query if a snapshot was linked
      if (snapshotId && snapshotId !== "standalone") {
        queryClient.invalidateQueries({ queryKey: ["instructor-resources", snapshotId] });
        queryClient.invalidateQueries({ queryKey: ["snapshot-linked-resources", snapshotId] });
      }
      resetForm();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!user || !editItem) throw new Error("Not authenticated or no item to edit");

      // Update development item
      const itemData: any = {
        title: title || null,
        content: content || null,
        updated_at: new Date().toISOString(),
      };

      if (itemType === "resource") {
        itemData.resource_url = resourceUrl || null;
      }

      if (itemType === "action_item" && dueDate) {
        itemData.due_date = dueDate;
      } else if (itemType === "action_item") {
        itemData.due_date = null;
      }

      const { error: itemError } = await supabase
        .from("development_items")
        .update(itemData)
        .eq("id", editItem.id);

      if (itemError) throw itemError;

      // Update goal link if changed
      const finalGoalId = selectedGoalId || goalId;
      const existingGoalId = editItem.goal_links?.[0]?.goal_id;

      if (finalGoalId !== existingGoalId) {
        // Remove old link
        if (existingGoalId) {
          await supabase
            .from("development_item_goal_links")
            .delete()
            .eq("development_item_id", editItem.id)
            .eq("goal_id", existingGoalId);
        }
        // Add new link
        if (finalGoalId) {
          await supabase.from("development_item_goal_links").insert({
            development_item_id: editItem.id,
            goal_id: finalGoalId,
          });
        }
      }

      // Update milestone link if changed
      const finalMilestoneId = selectedMilestoneId || milestoneId;
      const existingMilestoneId = editItem.milestone_links?.[0]?.milestone_id;

      if (finalMilestoneId !== existingMilestoneId) {
        // Remove old link
        if (existingMilestoneId) {
          await supabase
            .from("development_item_milestone_links")
            .delete()
            .eq("development_item_id", editItem.id)
            .eq("milestone_id", existingMilestoneId);
        }
        // Add new link
        if (finalMilestoneId) {
          await supabase.from("development_item_milestone_links").insert({
            development_item_id: editItem.id,
            milestone_id: finalMilestoneId,
          });
        }
      }

      return editItem;
    },
    onSuccess: () => {
      toast({ description: "Development item updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["development-items"] });
      queryClient.invalidateQueries({ queryKey: ["recent-development-items"] });
      resetForm();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (isEditing) {
      updateMutation.mutate();
    } else {
      createMutation.mutate();
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  // Check if we're in a context that already has linking (e.g., from capability assessment)
  const hasExistingContext = questionId || domainId || goalId || milestoneId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {dialogTitle || `${isEditing ? "Edit" : "Add"} Development Item`}
          </DialogTitle>
          <DialogDescription>
            {dialogDescription ||
              (isEditing
                ? "Update your development item details"
                : "Add a reflection, resource, or action item to support your growth")}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={itemType} onValueChange={(v) => !isEditing && setItemType(v as any)}>
          <TabsList
            className={`grid w-full ${allowedTypes ? `grid-cols-${allowedTypes.length}` : "grid-cols-4"} ${isEditing ? "opacity-60 pointer-events-none" : ""}`}
          >
            {(!allowedTypes || allowedTypes.includes("reflection")) && (
              <TabsTrigger value="reflection" className="flex items-center gap-1 text-xs">
                <FileText className="h-3 w-3" />
                Reflection
              </TabsTrigger>
            )}
            {(!allowedTypes || allowedTypes.includes("note")) && (
              <TabsTrigger value="note" className="flex items-center gap-1 text-xs">
                <StickyNote className="h-3 w-3" />
                Note
              </TabsTrigger>
            )}
            {(!allowedTypes || allowedTypes.includes("resource")) && (
              <TabsTrigger value="resource" className="flex items-center gap-1 text-xs">
                <BookOpen className="h-3 w-3" />
                Resource
              </TabsTrigger>
            )}
            {(!allowedTypes || allowedTypes.includes("action_item")) && (
              <TabsTrigger value="action_item" className="flex items-center gap-1 text-xs">
                <Target className="h-3 w-3" />
                Action
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="reflection" className="space-y-4 mt-4">
            <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
              <strong className="text-foreground">What you learned or how you've grown.</strong>
              <p className="mt-1">
                Reflections capture insights, self-awareness, and transformational moments from your
                experiences.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reflection-title">Title (optional)</Label>
              <Input
                id="reflection-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Brief summary of your reflection"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reflection-content">Reflection *</Label>
              <Textarea
                id="reflection-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="What insights have you gained? What patterns do you notice? How does this change you?"
                rows={4}
              />
            </div>
          </TabsContent>

          <TabsContent value="note" className="space-y-4 mt-4">
            <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
              <strong className="text-foreground">What happened or what you observed.</strong>
              <p className="mt-1">
                Notes capture information, observations, or ideas for future reference—quick and
                factual.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="note-title">Title *</Label>
              <Input
                id="note-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Meeting notes, Key takeaways"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="note-content">Content</Label>
              <Textarea
                id="note-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="What do you want to remember?"
                rows={4}
              />
            </div>
          </TabsContent>

          <TabsContent value="resource" className="space-y-4 mt-4">
            <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
              <strong className="text-foreground">External materials that support learning.</strong>
              <p className="mt-1">Resources are links, files, or library items for reference.</p>
            </div>

            {/* Resource Mode Selector */}
            <div className="flex gap-1 p-1 bg-muted rounded-lg">
              <Button
                type="button"
                variant={resourceMode === "url" ? "default" : "ghost"}
                size="sm"
                className="flex-1"
                onClick={() => setResourceMode("url")}
              >
                <LinkIcon className="h-3 w-3 mr-1" />
                URL
              </Button>
              <Button
                type="button"
                variant={resourceMode === "file" ? "default" : "ghost"}
                size="sm"
                className="flex-1"
                onClick={() => setResourceMode("file")}
              >
                <Upload className="h-3 w-3 mr-1" />
                File
              </Button>
              <Button
                type="button"
                variant={resourceMode === "library" ? "default" : "ghost"}
                size="sm"
                className="flex-1"
                onClick={() => setResourceMode("library")}
              >
                <Library className="h-3 w-3 mr-1" />
                Library
              </Button>
            </div>

            {/* URL Mode */}
            {resourceMode === "url" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="resource-title">Resource Title *</Label>
                  <Input
                    id="resource-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Article on effective communication"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="resource-url">URL *</Label>
                  <Input
                    id="resource-url"
                    type="url"
                    value={resourceUrl}
                    onChange={(e) => setResourceUrl(e.target.value)}
                    placeholder="https://..."
                  />
                </div>
              </>
            )}

            {/* File Mode */}
            {resourceMode === "file" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="file-title">Resource Title *</Label>
                  <Input
                    id="file-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Meeting notes PDF"
                  />
                </div>
                <div className="space-y-2">
                  <Label>File</Label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleFileSelect}
                    accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt"
                  />
                  {selectedFile ? (
                    <div className="flex items-center gap-2 p-3 border rounded-lg bg-background">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="flex-1 text-sm truncate">{selectedFile.name}</span>
                      <Badge variant="secondary" className="text-xs">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </Badge>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => setSelectedFile(null)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Choose File
                    </Button>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Images, PDFs, or documents up to 10MB
                  </p>
                </div>
              </>
            )}

            {/* Library Mode */}
            {resourceMode === "library" && (
              <>
                <div className="space-y-2">
                  <Label>Select from Library</Label>
                  {selectedLibraryResource ? (
                    <div className="flex items-center gap-2 p-3 border rounded-lg bg-background">
                      <Library className="h-4 w-4 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {selectedLibraryResource.title}
                        </p>
                        {selectedLibraryResource.description && (
                          <p className="text-xs text-muted-foreground truncate">
                            {selectedLibraryResource.description}
                          </p>
                        )}
                      </div>
                      <Badge variant="secondary" className="text-xs capitalize shrink-0">
                        {selectedLibraryResource.resource_type}
                      </Badge>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        onClick={() => setSelectedLibraryResource(null)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <ResourcePickerDialog
                      excludeResourceIds={[]}
                      onSelect={handleLibraryResourceSelect}
                      trigger={
                        <Button type="button" variant="outline" className="w-full">
                          <Library className="h-4 w-4 mr-2" />
                          Browse Library
                        </Button>
                      }
                    />
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="library-title">Custom Title (optional)</Label>
                  <Input
                    id="library-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Leave empty to use library title"
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="resource-notes">Notes (optional)</Label>
              <Textarea
                id="resource-notes"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Why is this resource helpful?"
                rows={2}
              />
            </div>
          </TabsContent>

          <TabsContent value="action_item" className="space-y-4 mt-4">
            <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
              <strong className="text-foreground">A concrete next step or commitment.</strong>
              <p className="mt-1">
                Action items are specific to-dos with optional due dates that you can track to
                completion.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="action-title">Action *</Label>
              <Input
                id="action-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Practice active listening in meetings"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="action-due">Due Date (optional)</Label>
              <Input
                id="action-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="action-notes">Notes (optional)</Label>
              <Textarea
                id="action-notes"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="How will you approach this? What does success look like?"
                rows={2}
              />
            </div>
          </TabsContent>
        </Tabs>

        {/* Goal/Milestone Linking Section */}
        {(!hasExistingContext || isEditing) && (
          <div className="space-y-4 pt-4 border-t">
            <div>
              <Label className="text-sm font-medium">Link to Goal (optional)</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Select a goal to link this item. If the goal has milestones, you can also link to a
                specific milestone.
              </p>
            </div>

            <div className="space-y-2">
              <Select
                value={selectedGoalId || "__none__"}
                onValueChange={(value) => {
                  setSelectedGoalId(value === "__none__" ? "" : value);
                  setSelectedMilestoneId(""); // Reset milestone when goal changes
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a goal..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {goals?.map((goal) => (
                    <SelectItem key={goal.id} value={goal.id}>
                      {goal.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedGoalId && milestones && milestones.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="milestone-select" className="text-xs text-muted-foreground">
                  Link to Milestone (optional)
                </Label>
                <Select
                  value={selectedMilestoneId || "__none__"}
                  onValueChange={(value) =>
                    setSelectedMilestoneId(value === "__none__" ? "" : value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a milestone..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {milestones.map((milestone) => (
                      <SelectItem key={milestone.id} value={milestone.id}>
                        {milestone.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              isPending ||
              (itemType === "reflection" && !content.trim()) ||
              (itemType === "note" && !title.trim()) ||
              (itemType === "resource" &&
                ((resourceMode === "url" && (!title.trim() || !resourceUrl.trim())) ||
                  (resourceMode === "file" && (!title.trim() || !selectedFile)) ||
                  (resourceMode === "library" && !selectedLibraryResource))) ||
              (itemType === "action_item" && !title.trim())
            }
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing
              ? "Save Changes"
              : `Add ${itemType === "action_item" ? "Action" : itemType === "note" ? "Note" : itemType.charAt(0).toUpperCase() + itemType.slice(1)}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
