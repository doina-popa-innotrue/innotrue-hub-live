import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, FolderOpen, FileText, Loader2, X, GripVertical } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Collection {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  resourceCount?: number;
}

interface CollectionItem {
  id: string;
  collection_id: string;
  resource_id: string;
  order_index: number;
  resource_library: {
    id: string;
    title: string;
    resource_type: string;
  };
}

export default function ResourceCollectionsManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
  const [managingCollection, setManagingCollection] = useState<Collection | null>(null);
  const [selectedResourceId, setSelectedResourceId] = useState<string>("");

  // Form state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);

  // Fetch collections with resource count
  const { data: collections, isLoading } = useQuery({
    queryKey: ["resource-collections"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("resource_collections")
        .select("*, resource_collection_items(count)")
        .order("name");

      if (error) throw error;

      return (data || []).map((c: any) => ({
        ...c,
        resourceCount: c.resource_collection_items?.[0]?.count || 0,
      })) as Collection[];
    },
  });

  // Fetch collection items when managing
  const { data: collectionItems, isLoading: itemsLoading } = useQuery({
    queryKey: ["collection-items", managingCollection?.id],
    queryFn: async () => {
      if (!managingCollection) return [];

      const { data, error } = await (supabase as any)
        .from("resource_collection_items")
        .select("*, resource_library(id, title, resource_type)")
        .eq("collection_id", managingCollection.id)
        .order("order_index");

      if (error) throw error;
      return data as CollectionItem[];
    },
    enabled: !!managingCollection,
  });

  // Fetch all available resources
  const { data: allResources } = useQuery({
    queryKey: ["all-resources-for-collections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resource_library")
        .select("id, title, resource_type")
        .eq("is_active", true)
        .order("title");

      if (error) throw error;
      return data;
    },
  });

  // Create collection
  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("resource_collections").insert({
        name: formName,
        description: formDescription || null,
        is_active: formIsActive,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resource-collections"] });
      toast({ description: "Collection created successfully" });
      resetForm();
      setIsCreateOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Update collection
  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingCollection) return;

      const { error } = await (supabase as any)
        .from("resource_collections")
        .update({
          name: formName,
          description: formDescription || null,
          is_active: formIsActive,
        })
        .eq("id", editingCollection.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resource-collections"] });
      toast({ description: "Collection updated successfully" });
      resetForm();
      setEditingCollection(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Delete collection
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("resource_collections").delete().eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resource-collections"] });
      toast({ description: "Collection deleted successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Add resource to collection
  const addResourceMutation = useMutation({
    mutationFn: async (resourceId: string) => {
      if (!managingCollection) return;

      const maxOrder = collectionItems?.length
        ? Math.max(...collectionItems.map((i) => i.order_index)) + 1
        : 0;

      const { error } = await (supabase as any).from("resource_collection_items").insert({
        collection_id: managingCollection.id,
        resource_id: resourceId,
        order_index: maxOrder,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collection-items", managingCollection?.id] });
      queryClient.invalidateQueries({ queryKey: ["resource-collections"] });
      toast({ description: "Resource added to collection" });
      setSelectedResourceId("");
    },
    onError: (error: any) => {
      if (error.message?.includes("duplicate")) {
        toast({
          title: "Already in collection",
          description: "This resource is already in this collection",
          variant: "destructive",
        });
      } else {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      }
    },
  });

  // Remove resource from collection
  const removeResourceMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await (supabase as any)
        .from("resource_collection_items")
        .delete()
        .eq("id", itemId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collection-items", managingCollection?.id] });
      queryClient.invalidateQueries({ queryKey: ["resource-collections"] });
      toast({ description: "Resource removed from collection" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormName("");
    setFormDescription("");
    setFormIsActive(true);
  };

  const openEditDialog = (collection: Collection) => {
    setFormName(collection.name);
    setFormDescription(collection.description || "");
    setFormIsActive(collection.is_active);
    setEditingCollection(collection);
  };

  const availableResources =
    allResources?.filter((r) => !collectionItems?.some((i) => i.resource_id === r.id)) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Resource Collections</h1>
          <p className="text-muted-foreground">
            Group resources into collections for bulk linking to assessment domains and questions
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Create Collection
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Collection</DialogTitle>
              <DialogDescription>
                Create a new resource collection that can be linked to assessment topics.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g., Event-Driven Integration Resources"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Optional description..."
                  rows={3}
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch id="is_active" checked={formIsActive} onCheckedChange={setFormIsActive} />
                <Label htmlFor="is_active">Active</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => createMutation.mutate()}
                disabled={!formName || createMutation.isPending}
              >
                {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : collections?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Collections Yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first collection to start grouping resources.
            </p>
            <Button
              onClick={() => {
                resetForm();
                setIsCreateOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Collection
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {collections?.map((collection) => (
            <Card key={collection.id} className={!collection.is_active ? "opacity-60" : ""}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FolderOpen className="h-4 w-4" />
                      {collection.name}
                    </CardTitle>
                    {collection.description && (
                      <CardDescription className="text-xs line-clamp-2">
                        {collection.description}
                      </CardDescription>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEditDialog(collection)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Collection?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will delete the collection and all its resource associations. Any
                            assessment links to this collection will also be removed.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteMutation.mutate(collection.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      <FileText className="h-3 w-3 mr-1" />
                      {collection.resourceCount} resources
                    </Badge>
                    {!collection.is_active && <Badge variant="outline">Inactive</Badge>}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setManagingCollection(collection)}
                  >
                    Manage
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog
        open={!!editingCollection}
        onOpenChange={(open) => !open && setEditingCollection(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Collection</DialogTitle>
            <DialogDescription>Update the collection details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="edit-is_active"
                checked={formIsActive}
                onCheckedChange={setFormIsActive}
              />
              <Label htmlFor="edit-is_active">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCollection(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => updateMutation.mutate()}
              disabled={!formName || updateMutation.isPending}
            >
              {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Collection Dialog */}
      <Dialog
        open={!!managingCollection}
        onOpenChange={(open) => !open && setManagingCollection(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5" />
              {managingCollection?.name}
            </DialogTitle>
            <DialogDescription>
              Add or remove resources from this collection. Changes take effect immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Add resource */}
            <div className="flex gap-2">
              <Select value={selectedResourceId} onValueChange={setSelectedResourceId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select a resource to add..." />
                </SelectTrigger>
                <SelectContent>
                  {availableResources.length === 0 ? (
                    <SelectItem value="none" disabled>
                      No more resources available
                    </SelectItem>
                  ) : (
                    availableResources.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.title}
                        <span className="text-muted-foreground ml-2">({r.resource_type})</span>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <Button
                onClick={() => addResourceMutation.mutate(selectedResourceId)}
                disabled={!selectedResourceId || addResourceMutation.isPending}
              >
                {addResourceMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/* Current resources */}
            {itemsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : collectionItems?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No resources in this collection yet.</p>
                <p className="text-sm">Add resources using the dropdown above.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Resource</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {collectionItems?.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                      </TableCell>
                      <TableCell className="font-medium">{item.resource_library?.title}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {item.resource_library?.resource_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => removeResourceMutation.mutate(item.id)}
                          disabled={removeResourceMutation.isPending}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setManagingCollection(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
