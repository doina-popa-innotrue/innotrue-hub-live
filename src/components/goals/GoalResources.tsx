import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";
import { validateFile, acceptStringForBucket } from "@/lib/fileValidation";
import {
  Plus,
  Trash2,
  Link2,
  FileImage,
  FileText,
  ExternalLink,
  Upload,
  Download,
} from "lucide-react";
import { format } from "date-fns";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Resource {
  id: string;
  title: string;
  resource_type: string;
  url: string | null;
  file_path: string | null;
  description: string | null;
  created_at: string;
}

interface GoalResourcesProps {
  goalId: string;
}

const RESOURCE_ICONS = {
  image: FileImage,
  pdf: FileText,
  link: Link2,
  other: FileText,
};

export default function GoalResources({ goalId }: GoalResourcesProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [uploadMode, setUploadMode] = useState<"url" | "file">("url");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [formData, setFormData] = useState({
    title: "",
    resource_type: "link",
    url: "",
    description: "",
  });

  useEffect(() => {
    fetchResources();
  }, [goalId]);

  const fetchResources = async () => {
    try {
      const { data, error } = await supabase
        .from("goal_resources")
        .select("*")
        .eq("goal_id", goalId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setResources(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load resources",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateFile(file, "goal-resources");
    if (!validation.valid) {
      sonnerToast.error(validation.error);
      return;
    }

    setSelectedFile(file);

    // Auto-set title if empty
    if (!formData.title) {
      setFormData({ ...formData, title: file.name });
    }

    // Auto-detect resource type
    if (file.type.startsWith("image/")) {
      setFormData({ ...formData, resource_type: "image", title: formData.title || file.name });
    } else if (file.type === "application/pdf") {
      setFormData({ ...formData, resource_type: "pdf", title: formData.title || file.name });
    }
  };

  const uploadFile = async (file: File, userId: string) => {
    const fileExt = file.name.split(".").pop();
    const fileName = `${userId}/${goalId}/${Date.now()}.${fileExt}`;

    const { data, error } = await supabase.storage.from("goal-resources").upload(fileName, file);

    if (error) throw error;
    return fileName;
  };

  const getPublicUrl = (filePath: string) => {
    const { data } = supabase.storage.from("goal-resources").getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleSave = async () => {
    if (!formData.title.trim()) {
      toast({
        title: "Validation Error",
        description: "Title is required",
        variant: "destructive",
      });
      return;
    }

    if (uploadMode === "url" && !formData.url.trim()) {
      toast({
        title: "Validation Error",
        description: "URL is required",
        variant: "destructive",
      });
      return;
    }

    if (uploadMode === "file" && !selectedFile) {
      toast({
        title: "Validation Error",
        description: "Please select a file to upload",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let filePath: string | null = null;
      let url: string | null = null;

      if (uploadMode === "file" && selectedFile) {
        filePath = await uploadFile(selectedFile, user.id);
        url = getPublicUrl(filePath);
      } else {
        url = formData.url;
      }

      const { error } = await supabase.from("goal_resources").insert([
        {
          goal_id: goalId,
          user_id: user.id,
          title: formData.title,
          resource_type: formData.resource_type,
          url: url,
          file_path: filePath,
          description: formData.description || null,
        },
      ]);

      if (error) throw error;

      toast({ title: "Success", description: "Resource added successfully" });
      setFormData({ title: "", resource_type: "link", url: "", description: "" });
      setSelectedFile(null);
      setShowDialog(false);
      fetchResources();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to add resource",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      // Get the resource to check if it has a file_path
      const resource = resources.find((r) => r.id === deleteId);

      // Delete from storage if it has a file_path
      if (resource?.file_path) {
        const { error: storageError } = await supabase.storage
          .from("goal-resources")
          .remove([resource.file_path]);

        if (storageError) {
          console.error("Storage deletion error:", storageError);
          // Continue with database deletion even if storage fails
        }
      }

      // Delete from database
      const { error } = await supabase.from("goal_resources").delete().eq("id", deleteId);

      if (error) throw error;
      toast({ title: "Success", description: "Resource deleted successfully" });
      fetchResources();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to delete resource",
        variant: "destructive",
      });
    } finally {
      setDeleteId(null);
    }
  };

  const handleDownload = async (resource: Resource) => {
    if (!resource.file_path) {
      // If no file_path, just open the URL
      window.open(resource.url || "#", "_blank");
      return;
    }

    try {
      const { data, error } = await supabase.storage
        .from("goal-resources")
        .download(resource.file_path);

      if (error) throw error;

      // Create download link
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = resource.title;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to download file",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <div className="text-muted-foreground">Loading resources...</div>;
  }

  return (
    <>
      <Card className="mt-6">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
            <div className="flex items-center gap-2">
              <Link2 className="h-5 w-5 shrink-0" />
              <CardTitle>Resources</CardTitle>
            </div>
            <Button onClick={() => setShowDialog(true)} size="sm" className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              Add Resource
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {resources.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Link2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No resources yet. Add helpful links, PDFs, or images to support your goal.</p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {resources.map((resource) => {
                const Icon =
                  RESOURCE_ICONS[resource.resource_type as keyof typeof RESOURCE_ICONS] || FileText;
                return (
                  <div
                    key={resource.id}
                    className="p-4 border rounded-lg bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-start gap-3 flex-1">
                        <Icon className="h-5 w-5 mt-0.5 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium truncate">{resource.title}</h4>
                          {resource.description && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                              {resource.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            {resource.file_path ? (
                              <Button
                                variant="link"
                                size="sm"
                                className="h-auto p-0 text-xs"
                                onClick={() => handleDownload(resource)}
                              >
                                <Download className="h-3 w-3 mr-1" />
                                Download
                              </Button>
                            ) : (
                              <a
                                href={resource.url || "#"}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-primary hover:underline flex items-center gap-1"
                              >
                                Open <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(resource.created_at), "MMM d, yyyy")}
                            </span>
                          </div>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteId(resource.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Resource</DialogTitle>
          </DialogHeader>

          <Tabs value={uploadMode} onValueChange={(v) => setUploadMode(v as "url" | "file")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="url">
                <Link2 className="h-4 w-4 mr-2" />
                Add Link
              </TabsTrigger>
              <TabsTrigger value="file">
                <Upload className="h-4 w-4 mr-2" />
                Upload File
              </TabsTrigger>
            </TabsList>

            <TabsContent value="url" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Helpful article, Reference PDF"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Type *</Label>
                <Select
                  value={formData.resource_type}
                  onValueChange={(value) => setFormData({ ...formData, resource_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="link">Link</SelectItem>
                    <SelectItem value="pdf">PDF</SelectItem>
                    <SelectItem value="image">Image</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="url">URL *</Label>
                <Input
                  id="url"
                  type="url"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  placeholder="https://example.com/resource"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of this resource..."
                  rows={3}
                />
              </div>
            </TabsContent>

            <TabsContent value="file" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title-file">Title *</Label>
                <Input
                  id="title-file"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Resource title (auto-filled from filename)"
                />
              </div>

              <div className="space-y-2">
                <Label>File Upload *</Label>
                <div className="flex items-center gap-2">
                  <Input
                    ref={fileInputRef}
                    type="file"
                    accept={acceptStringForBucket("goal-resources")}
                    onChange={handleFileSelect}
                    className="cursor-pointer"
                  />
                  {selectedFile && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedFile(null);
                        if (fileInputRef.current) {
                          fileInputRef.current.value = "";
                        }
                      }}
                    >
                      Clear
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Supported: Images (JPG, PNG, GIF, WEBP) and PDF files. Max size: 10MB
                </p>
                {selectedFile && (
                  <div className="text-sm text-muted-foreground">
                    Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)}{" "}
                    MB)
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description-file">Description</Label>
                <Textarea
                  id="description-file"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of this resource..."
                  rows={3}
                />
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowDialog(false);
                setSelectedFile(null);
                setFormData({ title: "", resource_type: "link", url: "", description: "" });
              }}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Adding..." : "Add Resource"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Resource</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this resource? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
