import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2,
  Plus,
  Trash2,
  FileText,
  GripVertical,
  Download,
  ExternalLink,
  ChevronUp,
  ChevronDown,
  Lock,
  Layers,
  FolderOpen,
} from "lucide-react";
import { toast } from "sonner";
import { ResourcePickerDialog } from "@/components/modules/ResourcePickerDialog";

interface Resource {
  id: string;
  canonical_id: string;
  title: string;
  description: string | null;
  resource_type: string;
  url: string | null;
  file_path: string | null;
  file_name: string | null;
  file_size: number | null;
  downloadable: boolean;
}

interface ResourceAssignment {
  id: string;
  module_id: string;
  resource_id: string;
  order_index: number;
  is_required: boolean;
  notes: string | null;
  assigned_by: string;
  created_at: string;
  resource: Resource;
}

interface ResourceCollection {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

interface CollectionLink {
  id: string;
  module_id: string;
  collection_id: string;
  order_index: number;
  resource_collections: ResourceCollection;
}

interface ModuleResourceAssignmentProps {
  moduleId: string;
}

export function ModuleResourceAssignment({ moduleId }: ModuleResourceAssignmentProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<string>("resources");
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [collectionDialogOpen, setCollectionDialogOpen] = useState(false);
  const [selectedResourceId, setSelectedResourceId] = useState<string>("");
  const [selectedResourceTitle, setSelectedResourceTitle] = useState<string>("");
  const [selectedResourceType, setSelectedResourceType] = useState<string>("");
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [isRequired, setIsRequired] = useState(false);

  // Fetch assigned resources for this module
  const { data: assignments, isLoading: loadingAssignments } = useQuery({
    queryKey: ["module-resource-assignments", moduleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("module_resource_assignments")
        .select(
          `
          *,
          resource:resource_id(
            id,
            canonical_id,
            title,
            description,
            resource_type,
            url,
            file_path,
            file_name,
            file_size,
            downloadable
          )
        `,
        )
        .eq("module_id", moduleId)
        .order("order_index", { ascending: true });

      if (error) throw error;
      return data as ResourceAssignment[];
    },
  });

  // Fetch linked collections for this module
  const { data: collectionLinks, isLoading: loadingCollections } = useQuery({
    queryKey: ["module-collection-links", moduleId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("module_collection_links")
        .select(
          `
          *,
          resource_collections(id, name, description, is_active)
        `,
        )
        .eq("module_id", moduleId)
        .order("order_index", { ascending: true });

      if (error) throw error;
      return data as CollectionLink[];
    },
  });

  // Fetch available collections
  const { data: availableCollections, isLoading: loadingAvailableCollections } = useQuery({
    queryKey: ["available-collections"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("resource_collections")
        .select("id, name, description, is_active")
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (error) throw error;
      return data as ResourceCollection[];
    },
  });

  // Filter out already linked collections
  const unlinkedCollections =
    availableCollections?.filter(
      (c) => !collectionLinks?.some((cl) => cl.collection_id === c.id),
    ) || [];

  // IDs of already-assigned resources (used by ResourcePickerDialog to exclude them)
  const assignedResourceIds = assignments?.map((a) => a.resource_id) || [];

  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!user || !selectedResourceId) throw new Error("Invalid data");

      const nextOrderIndex = (assignments?.length || 0) + 1;

      const { error } = await supabase.from("module_resource_assignments").insert({
        module_id: moduleId,
        resource_id: selectedResourceId,
        order_index: nextOrderIndex,
        is_required: isRequired,
        notes: notes || null,
        assigned_by: user.id,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["module-resource-assignments", moduleId] });
      // Also invalidate the picker's cache so excluded list stays in sync
      queryClient.invalidateQueries({ queryKey: ["available-resources-for-picker"] });
      setDetailsDialogOpen(false);
      setSelectedResourceId("");
      setSelectedResourceTitle("");
      setSelectedResourceType("");
      setNotes("");
      setIsRequired(false);
      toast.success("Resource assigned to module");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to assign resource");
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      const { error } = await supabase
        .from("module_resource_assignments")
        .delete()
        .eq("id", assignmentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["module-resource-assignments", moduleId] });
      toast.success("Resource removed from module");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to remove resource");
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async ({
      assignmentId,
      direction,
    }: {
      assignmentId: string;
      direction: "up" | "down";
    }) => {
      if (!assignments) return;

      const currentIndex = assignments.findIndex((a) => a.id === assignmentId);
      if (currentIndex === -1) return;

      const newIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
      if (newIndex < 0 || newIndex >= assignments.length) return;

      const current = assignments[currentIndex];
      const target = assignments[newIndex];

      // Swap order indices
      await supabase
        .from("module_resource_assignments")
        .update({ order_index: target.order_index })
        .eq("id", current.id);

      await supabase
        .from("module_resource_assignments")
        .update({ order_index: current.order_index })
        .eq("id", target.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["module-resource-assignments", moduleId] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to reorder");
    },
  });

  const toggleRequiredMutation = useMutation({
    mutationFn: async ({
      assignmentId,
      isRequired,
    }: {
      assignmentId: string;
      isRequired: boolean;
    }) => {
      const { error } = await supabase
        .from("module_resource_assignments")
        .update({ is_required: isRequired })
        .eq("id", assignmentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["module-resource-assignments", moduleId] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update");
    },
  });

  // Collection mutations
  const linkCollectionMutation = useMutation({
    mutationFn: async () => {
      if (!user || !selectedCollectionId) throw new Error("Invalid data");

      const nextOrderIndex = (collectionLinks?.length || 0) + 1;

      const { error } = await (supabase as any).from("module_collection_links").insert({
        module_id: moduleId,
        collection_id: selectedCollectionId,
        order_index: nextOrderIndex,
        created_by: user.id,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["module-collection-links", moduleId] });
      setCollectionDialogOpen(false);
      setSelectedCollectionId("");
      toast.success("Collection linked to module");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to link collection");
    },
  });

  const unlinkCollectionMutation = useMutation({
    mutationFn: async (linkId: string) => {
      const { error } = await (supabase as any)
        .from("module_collection_links")
        .delete()
        .eq("id", linkId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["module-collection-links", moduleId] });
      toast.success("Collection unlinked from module");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to unlink collection");
    },
  });

  const handleDownload = async (assignment: ResourceAssignment) => {
    if (!assignment.resource?.file_path) return;

    const { data, error } = await supabase.storage
      .from("resource-library")
      .download(assignment.resource.file_path);

    if (error) {
      toast.error("Failed to download file");
      return;
    }

    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = assignment.resource?.file_name || "download";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loadingAssignments) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div>
          <CardTitle className="text-lg">Module Resources</CardTitle>
          <CardDescription>Assign resources and collections to this module</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex items-center justify-between mb-4">
            <TabsList>
              <TabsTrigger value="resources" className="gap-2">
                <FileText className="h-4 w-4" />
                Resources
                {assignments && assignments.length > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {assignments.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="collections" className="gap-2">
                <Layers className="h-4 w-4" />
                Collections
                {collectionLinks && collectionLinks.length > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {collectionLinks.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {activeTab === "resources" && (
              <>
                <ResourcePickerDialog
                  excludeResourceIds={assignedResourceIds}
                  onSelect={(resource) => {
                    setSelectedResourceId(resource.id);
                    setSelectedResourceTitle(resource.title);
                    setSelectedResourceType(resource.resource_type);
                    setNotes("");
                    setIsRequired(false);
                    setDetailsDialogOpen(true);
                  }}
                  trigger={
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Assign Resource
                    </Button>
                  }
                />

                {/* Assignment details dialog (shown after picking a resource) */}
                <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Assign Resource</DialogTitle>
                      <DialogDescription>
                        Configure how this resource is assigned to the module
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border">
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="font-medium truncate">{selectedResourceTitle}</span>
                        <Badge variant="outline" className="capitalize text-xs shrink-0">
                          {selectedResourceType}
                        </Badge>
                      </div>

                      <div className="space-y-2">
                        <Label>Notes (optional)</Label>
                        <Textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Add any notes about this resource for clients..."
                          rows={3}
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <Switch
                          checked={isRequired}
                          onCheckedChange={setIsRequired}
                          id="is-required"
                        />
                        <Label htmlFor="is-required">Mark as required</Label>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setDetailsDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button
                        onClick={() => assignMutation.mutate()}
                        disabled={!selectedResourceId || assignMutation.isPending}
                      >
                        {assignMutation.isPending && (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        )}
                        Assign
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </>
            )}

            {activeTab === "collections" && (
              <Dialog open={collectionDialogOpen} onOpenChange={setCollectionDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" disabled={unlinkedCollections.length === 0}>
                    <Plus className="h-4 w-4 mr-2" />
                    Link Collection
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Link Collection</DialogTitle>
                    <DialogDescription>
                      Link a resource collection to include all its resources in this module
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Collection *</Label>
                      <Select value={selectedCollectionId} onValueChange={setSelectedCollectionId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a collection" />
                        </SelectTrigger>
                        <SelectContent>
                          {unlinkedCollections.map((collection) => (
                            <SelectItem key={collection.id} value={collection.id}>
                              <div className="flex items-center gap-2">
                                <FolderOpen className="h-4 w-4" />
                                <span>{collection.name}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {loadingAvailableCollections && (
                        <p className="text-xs text-muted-foreground">Loading collections...</p>
                      )}
                      {unlinkedCollections.length === 0 && !loadingAvailableCollections && (
                        <p className="text-xs text-muted-foreground">
                          No more collections available. Create collections in Resource Collections.
                        </p>
                      )}
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setCollectionDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      onClick={() => linkCollectionMutation.mutate()}
                      disabled={!selectedCollectionId || linkCollectionMutation.isPending}
                    >
                      {linkCollectionMutation.isPending && (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      )}
                      Link
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>

          <TabsContent value="resources" className="mt-0">
            {assignments?.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <FileText className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No resources assigned yet.</p>
                <p className="text-xs">
                  Assign resources from the library to make them available to clients.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {assignments?.filter((a) => a.resource).map((assignment, index) => (
                  <div
                    key={assignment.id}
                    className="flex items-start gap-3 p-3 rounded-lg border bg-card"
                  >
                    <div className="flex flex-col items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        disabled={index === 0}
                        onClick={() =>
                          reorderMutation.mutate({ assignmentId: assignment.id, direction: "up" })
                        }
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        disabled={index === (assignments?.length || 0) - 1}
                        onClick={() =>
                          reorderMutation.mutate({ assignmentId: assignment.id, direction: "down" })
                        }
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{assignment.resource.title}</span>
                        <Badge variant="outline" className="capitalize text-xs">
                          {assignment.resource.resource_type}
                        </Badge>
                        {assignment.is_required && (
                          <Badge variant="default" className="text-xs">
                            Required
                          </Badge>
                        )}
                      </div>
                      {assignment.resource.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {assignment.resource.description}
                        </p>
                      )}
                      {assignment.notes && (
                        <p className="text-sm text-muted-foreground mt-1 italic">
                          Note: {assignment.notes}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-2">
                        {assignment.resource.file_path && assignment.resource.downloadable && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownload(assignment)}
                          >
                            <Download className="h-3 w-3 mr-1" />
                            Download
                            {assignment.resource.file_size && (
                              <span className="ml-1 text-muted-foreground">
                                ({formatFileSize(assignment.resource.file_size)})
                              </span>
                            )}
                          </Button>
                        )}
                        {assignment.resource.file_path && !assignment.resource.downloadable && (
                          <Badge variant="secondary" className="gap-1">
                            <Lock className="h-3 w-3" />
                            View Only
                          </Badge>
                        )}
                        {assignment.resource.url && (
                          <Button variant="outline" size="sm" asChild>
                            <a
                              href={assignment.resource.url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="h-3 w-3 mr-1" />
                              Open Link
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <Switch
                          checked={assignment.is_required}
                          onCheckedChange={(checked) =>
                            toggleRequiredMutation.mutate({
                              assignmentId: assignment.id,
                              isRequired: checked,
                            })
                          }
                          id={`required-${assignment.id}`}
                        />
                        <Label htmlFor={`required-${assignment.id}`} className="text-xs">
                          Required
                        </Label>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm("Remove this resource from the module?")) {
                            removeMutation.mutate(assignment.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="collections" className="mt-0">
            {loadingCollections ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : collectionLinks?.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Layers className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No collections linked yet.</p>
                <p className="text-xs">
                  Link collections to dynamically include all their resources.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {collectionLinks?.map((link) => (
                  <div
                    key={link.id}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                  >
                    <div className="p-2 rounded-md bg-muted">
                      <FolderOpen className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium">{link.resource_collections.name}</span>
                      {link.resource_collections.description && (
                        <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">
                          {link.resource_collections.description}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm("Unlink this collection from the module?")) {
                          unlinkCollectionMutation.mutate(link.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
