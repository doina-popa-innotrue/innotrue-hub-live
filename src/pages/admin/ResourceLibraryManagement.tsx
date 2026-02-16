import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Loader2,
  Plus,
  Edit2,
  Trash2,
  FileText,
  Link as LinkIcon,
  Image,
  Video,
  Download,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  ChevronDown,
  Globe,
  Shield,
  Settings,
  Sparkles,
  ExternalLink,
  Tag,
} from "lucide-react";
import { ResourceCreditConfig } from "@/components/admin/ResourceCreditConfig";
import { ResourceSkillsManager } from "@/components/admin/ResourceSkillsManager";
import { ResourceReferencesDialog } from "@/components/admin/ResourceReferencesDialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { validateFile, acceptStringForBucket, sanitizeFilename } from "@/lib/fileValidation";

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
  mime_type: string | null;
  metadata: Record<string, any> | null;
  is_active: boolean;
  visibility: string | null;
  downloadable: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  program_ids?: string[];
  skill_ids?: string[];
  plan_id: string | null;
  min_plan_tier: number;
  is_consumable: boolean;
  category_id: string | null;
}

interface Category {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  is_active: boolean;
}

interface Program {
  id: string;
  name: string;
  slug: string;
}

const resourceTypes = [
  { value: "document", label: "Document", icon: FileText },
  { value: "link", label: "Link", icon: LinkIcon },
  { value: "image", label: "Image", icon: Image },
  { value: "video", label: "Video", icon: Video },
  { value: "template", label: "Template", icon: FileText },
  { value: "cheatsheet", label: "Cheatsheet", icon: FileText },
  { value: "report", label: "Report", icon: FileText },
];

export default function ResourceLibraryManagement() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);
  const [planConfigResource, setPlanConfigResource] = useState<Resource | null>(null);
  const [uploading, setUploading] = useState(false);
  const [programsOpen, setProgramsOpen] = useState(false);
  const [filterProgram, setFilterProgram] = useState<string>("all");
  const [filterSkill, setFilterSkill] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [referencesResource, setReferencesResource] = useState<Resource | null>(null);

  const [formData, setFormData] = useState({
    canonical_id: "",
    title: "",
    description: "",
    resource_type: "document",
    url: "",
    file: null as File | null,
    downloadable: true,
    program_ids: [] as string[],
    skill_ids: [] as string[],
    category_id: "" as string,
  });

  const { data: programs } = useQuery({
    queryKey: ["programs-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("programs")
        .select("id, name, slug")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data as Program[];
    },
  });

  const { data: skills } = useQuery({
    queryKey: ["skills-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("skills")
        .select("id, name, category")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: categories } = useQuery({
    queryKey: ["resource-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resource_categories")
        .select("*")
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return data as Category[];
    },
  });

  const { data: resources, isLoading } = useQuery({
    queryKey: ["resource-library"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resource_library")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch program assignments for all resources
      const resourceIds = data.map((r) => r.id);
      const { data: programLinks } = await supabase
        .from("resource_library_programs")
        .select("resource_id, program_id")
        .in("resource_id", resourceIds);

      // Fetch skill assignments
      const { data: skillLinks } = await supabase
        .from("resource_library_skills")
        .select("resource_id, skill_id")
        .in("resource_id", resourceIds);

      // Map program and skill IDs to resources
      const resourcesWithLinks = data.map((resource) => ({
        ...resource,
        program_ids:
          programLinks?.filter((pl) => pl.resource_id === resource.id).map((pl) => pl.program_id) ||
          [],
        skill_ids:
          skillLinks?.filter((sl) => sl.resource_id === resource.id).map((sl) => sl.skill_id) || [],
      }));

      return resourcesWithLinks as Resource[];
    },
  });

  // Filter resources based on selected filters
  const filteredResources = resources?.filter((resource) => {
    // Program filter
    if (filterProgram !== "all") {
      if (filterProgram === "public" && (resource.program_ids?.length || 0) > 0) return false;
      if (filterProgram === "gated" && (resource.program_ids?.length || 0) === 0) return false;
      if (
        filterProgram !== "public" &&
        filterProgram !== "gated" &&
        !resource.program_ids?.includes(filterProgram)
      )
        return false;
    }
    // Skill filter
    if (filterSkill !== "all" && !resource.skill_ids?.includes(filterSkill)) return false;
    // Category filter
    if (filterCategory !== "all") {
      if (filterCategory === "uncategorized" && resource.category_id) return false;
      if (filterCategory !== "uncategorized" && resource.category_id !== filterCategory)
        return false;
    }
    return true;
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!user) throw new Error("Not authenticated");

      let file_path: string | null = null;
      let file_name: string | null = null;
      let file_size: number | null = null;
      let mime_type: string | null = null;

      if (data.file) {
        const validation = validateFile(data.file, "resource-library");
        if (!validation.valid) {
          toast.error(validation.error);
          return;
        }
        setUploading(true);
        const fileExt = data.file.name.split(".").pop();
        const fileName = `${data.canonical_id}-${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("resource-library")
          .upload(fileName, data.file);

        if (uploadError) throw uploadError;

        file_path = fileName;
        file_name = sanitizeFilename(data.file.name);
        file_size = data.file.size;
        mime_type = data.file.type;
        setUploading(false);
      }

      const { data: newResource, error } = await supabase
        .from("resource_library")
        .insert({
          canonical_id: data.canonical_id,
          title: data.title,
          description: data.description || null,
          resource_type: data.resource_type,
          url: data.url || null,
          category_id: data.category_id || null,
          file_path,
          file_name,
          file_size,
          mime_type,
          created_by: user.id,
          is_active: true,
          visibility: "private",
          downloadable: data.downloadable,
        })
        .select("id")
        .single();

      if (error) throw error;

      // Add program assignments if any
      if (data.program_ids.length > 0 && newResource) {
        const programLinks = data.program_ids.map((pid) => ({
          resource_id: newResource.id,
          program_id: pid,
        }));
        const { error: linkError } = await supabase
          .from("resource_library_programs")
          .insert(programLinks);

        if (linkError) throw linkError;
      }

      // Add skill assignments if any
      if (data.skill_ids.length > 0 && newResource) {
        const skillLinks = data.skill_ids.map((sid) => ({
          resource_id: newResource.id,
          skill_id: sid,
        }));
        const { error: skillError } = await supabase
          .from("resource_library_skills")
          .insert(skillLinks);

        if (skillError) throw skillError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resource-library"] });
      setDialogOpen(false);
      resetForm();
      toast.success("Resource created successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create resource");
      setUploading(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<typeof formData> & { file?: File | null };
    }) => {
      let updateData: Record<string, any> = {
        canonical_id: data.canonical_id,
        title: data.title,
        description: data.description || null,
        resource_type: data.resource_type,
        url: data.url || null,
        category_id: data.category_id || null,
      };

      if (data.file) {
        const validation = validateFile(data.file, "resource-library");
        if (!validation.valid) {
          toast.error(validation.error);
          return;
        }
        setUploading(true);
        const fileExt = data.file.name.split(".").pop();
        const fileName = `${data.canonical_id}-${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("resource-library")
          .upload(fileName, data.file);

        if (uploadError) throw uploadError;

        updateData.file_path = fileName;
        updateData.file_name = sanitizeFilename(data.file.name);
        updateData.file_size = data.file.size;
        updateData.mime_type = data.file.type;
        setUploading(false);
      }

      const { error } = await supabase.from("resource_library").update(updateData).eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resource-library"] });
      setDialogOpen(false);
      setEditingResource(null);
      resetForm();
      toast.success("Resource updated successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update resource");
      setUploading(false);
    },
  });

  const togglePublishMutation = useMutation({
    mutationFn: async ({ id, visibility }: { id: string; visibility: string }) => {
      const { error } = await supabase
        .from("resource_library")
        .update({ visibility })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resource-library"] });
      toast.success("Resource visibility updated");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update resource");
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("resource_library").update({ is_active }).eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resource-library"] });
      toast.success("Resource status updated");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update resource");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (resource: Resource) => {
      // Delete file from storage if exists
      if (resource.file_path) {
        await supabase.storage.from("resource-library").remove([resource.file_path]);
      }

      const { error } = await supabase.from("resource_library").delete().eq("id", resource.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resource-library"] });
      toast.success("Resource deleted successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to delete resource");
    },
  });

  const updateProgramsMutation = useMutation({
    mutationFn: async ({
      resourceId,
      programIds,
    }: {
      resourceId: string;
      programIds: string[];
    }) => {
      // Delete existing links
      await supabase.from("resource_library_programs").delete().eq("resource_id", resourceId);

      // Insert new links
      if (programIds.length > 0) {
        const links = programIds.map((pid) => ({ resource_id: resourceId, program_id: pid }));
        const { error } = await supabase.from("resource_library_programs").insert(links);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resource-library"] });
    },
  });

  const resetForm = () => {
    setFormData({
      canonical_id: "",
      title: "",
      description: "",
      resource_type: "document",
      url: "",
      file: null,
      downloadable: true,
      program_ids: [],
      skill_ids: [],
      category_id: "",
    });
    setProgramsOpen(false);
  };

  const handleEdit = (resource: Resource) => {
    setEditingResource(resource);
    setFormData({
      canonical_id: resource.canonical_id,
      title: resource.title,
      description: resource.description || "",
      resource_type: resource.resource_type,
      url: resource.url || "",
      file: null,
      downloadable: resource.downloadable,
      program_ids: resource.program_ids || [],
      skill_ids: resource.skill_ids || [],
      category_id: resource.category_id || "",
    });
    setProgramsOpen((resource.program_ids?.length || 0) > 0);
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.canonical_id.trim() || !formData.title.trim()) {
      toast.error("Please fill in required fields");
      return;
    }

    if (editingResource) {
      updateMutation.mutate(
        { id: editingResource.id, data: formData },
        {
          onSuccess: async () => {
            // Update program assignments
            updateProgramsMutation.mutate({
              resourceId: editingResource.id,
              programIds: formData.program_ids,
            });

            // Update skill assignments
            await supabase
              .from("resource_library_skills")
              .delete()
              .eq("resource_id", editingResource.id);

            if (formData.skill_ids.length > 0) {
              const skillLinks = formData.skill_ids.map((sid) => ({
                resource_id: editingResource.id,
                skill_id: sid,
              }));
              await supabase.from("resource_library_skills").insert(skillLinks);
            }

            queryClient.invalidateQueries({ queryKey: ["resource-library"] });
          },
        },
      );
    } else {
      createMutation.mutate(formData);
    }
  };

  const toggleProgramSelection = (programId: string) => {
    setFormData((prev) => ({
      ...prev,
      program_ids: prev.program_ids.includes(programId)
        ? prev.program_ids.filter((id) => id !== programId)
        : [...prev.program_ids, programId],
    }));
  };

  const handleDownload = async (resource: Resource) => {
    if (!resource.file_path) return;

    const { data, error } = await supabase.storage
      .from("resource-library")
      .download(resource.file_path);

    if (error) {
      toast.error("Failed to download file");
      return;
    }

    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = resource.file_name || "download";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getTypeIcon = (type: string) => {
    const typeConfig = resourceTypes.find((t) => t.value === type);
    const Icon = typeConfig?.icon || FileText;
    return <Icon className="h-4 w-4" />;
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Resource Library</h1>
          <p className="text-muted-foreground">
            Manage reusable resources that can be assigned to modules
          </p>
        </div>
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setEditingResource(null);
              resetForm();
            }
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Resource
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingResource ? "Edit Resource" : "Add New Resource"}</DialogTitle>
              <DialogDescription>
                {editingResource ? "Update resource details" : "Create a new reusable resource"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="canonical_id">Canonical ID *</Label>
                <Input
                  id="canonical_id"
                  value={formData.canonical_id}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      canonical_id: e.target.value.toLowerCase().replace(/\s+/g, "-"),
                    })
                  }
                  placeholder="e.g., getting-started-guide"
                />
                <p className="text-xs text-muted-foreground">Unique identifier for this resource</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Resource title"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of this resource"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="resource_type">Type</Label>
                  <Select
                    value={formData.resource_type}
                    onValueChange={(value) => setFormData({ ...formData, resource_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {resourceTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          <div className="flex items-center gap-2">
                            <type.icon className="h-4 w-4" />
                            {type.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={formData.category_id || "none"}
                    onValueChange={(value) =>
                      setFormData({ ...formData, category_id: value === "none" ? "" : value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No category</SelectItem>
                      {categories?.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          <div className="flex items-center gap-2">
                            <Tag className="h-4 w-4" />
                            {cat.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="url">URL (optional)</Label>
                <Input
                  id="url"
                  type="url"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  placeholder="https://..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="file">Upload File</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="file"
                    type="file"
                    accept={acceptStringForBucket("resource-library")}
                    onChange={(e) =>
                      setFormData({ ...formData, file: e.target.files?.[0] || null })
                    }
                    className="flex-1"
                  />
                </div>
                {formData.file && (
                  <p className="text-xs text-muted-foreground">
                    Selected: {formData.file.name} ({formatFileSize(formData.file.size)})
                  </p>
                )}
                {editingResource?.file_name && !formData.file && (
                  <p className="text-xs text-muted-foreground">
                    Current file: {editingResource.file_name}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 pt-2">
                <Switch
                  checked={formData.downloadable}
                  onCheckedChange={(checked) => setFormData({ ...formData, downloadable: checked })}
                  id="downloadable"
                />
                <Label htmlFor="downloadable" className="flex items-center gap-2">
                  {formData.downloadable ? (
                    <>
                      <Unlock className="h-4 w-4" />
                      Downloadable
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4" />
                      View Only (Protected IP)
                    </>
                  )}
                </Label>
              </div>

              <Collapsible open={programsOpen} onOpenChange={setProgramsOpen} className="space-y-2">
                <CollapsibleTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    <span className="flex items-center gap-2">
                      {formData.program_ids.length === 0 ? (
                        <>
                          <Globe className="h-4 w-4" />
                          Public (all users)
                        </>
                      ) : (
                        <>
                          <Lock className="h-4 w-4" />
                          Gated to {formData.program_ids.length} program(s)
                        </>
                      )}
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${programsOpen ? "rotate-180" : ""}`}
                    />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 pt-2">
                  <p className="text-xs text-muted-foreground">
                    Leave empty for public access, or select programs to restrict access.
                  </p>
                  <div className="border rounded-md p-3 max-h-40 overflow-y-auto space-y-2">
                    {programs?.map((program) => (
                      <div key={program.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`program-${program.id}`}
                          checked={formData.program_ids.includes(program.id)}
                          onCheckedChange={() => toggleProgramSelection(program.id)}
                        />
                        <label htmlFor={`program-${program.id}`} className="text-sm cursor-pointer">
                          {program.name}
                        </label>
                      </div>
                    ))}
                    {!programs?.length && (
                      <p className="text-sm text-muted-foreground">No programs available</p>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <ResourceSkillsManager
                inline
                resourceId=""
                selectedSkillIds={formData.skill_ids}
                onSkillsChange={(ids) => setFormData((prev) => ({ ...prev, skill_ids: ids }))}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending || uploading}
              >
                {(createMutation.isPending || updateMutation.isPending || uploading) && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                {uploading ? "Uploading..." : editingResource ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Resources</CardTitle>
              <CardDescription>
                {filteredResources?.length || 0} resources
                {(filterProgram !== "all" || filterSkill !== "all" || filterCategory !== "all") &&
                  ` (filtered)`}
              </CardDescription>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="uncategorized">Uncategorized</SelectItem>
                  {categories?.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterSkill} onValueChange={setFilterSkill}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by skill" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Skills</SelectItem>
                  {skills?.map((skill) => (
                    <SelectItem key={skill.id} value={skill.id}>
                      {skill.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterProgram} onValueChange={setFilterProgram}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by program" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Resources</SelectItem>
                  <SelectItem value="public">Public Only</SelectItem>
                  <SelectItem value="gated">Gated Only</SelectItem>
                  {programs?.map((program) => (
                    <SelectItem key={program.id} value={program.id}>
                      {program.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredResources?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No resources match the current filter.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Resource</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Programs</TableHead>
                  <TableHead>Plan Access</TableHead>
                  <TableHead>File</TableHead>
                  <TableHead>Download</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Visibility</TableHead>
                  <TableHead className="text-right sticky right-0 bg-background">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredResources?.map((resource) => (
                  <TableRow key={resource.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{resource.title}</div>
                        <div className="text-xs text-muted-foreground">{resource.canonical_id}</div>
                        {resource.description && (
                          <div className="text-sm text-muted-foreground line-clamp-1 mt-1">
                            {resource.description}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {resource.category_id ? (
                        <Badge variant="outline" className="gap-1">
                          <Tag className="h-3 w-3" />
                          {categories?.find((c) => c.id === resource.category_id)?.name ||
                            "Unknown"}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getTypeIcon(resource.resource_type)}
                        <span className="capitalize">{resource.resource_type}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {(resource.program_ids?.length || 0) === 0 ? (
                        <Badge variant="outline" className="gap-1">
                          <Globe className="h-3 w-3" />
                          Public
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1">
                          <Lock className="h-3 w-3" />
                          {resource.program_ids?.length} program(s)
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {resource.min_plan_tier === 0 && !resource.is_consumable ? (
                        <span className="text-muted-foreground text-sm">All plans</span>
                      ) : (
                        <div className="flex flex-col gap-1">
                          {resource.min_plan_tier > 0 && (
                            <Badge variant="outline" className="gap-1">
                              <Shield className="h-3 w-3" />
                              Tier {resource.min_plan_tier}+
                            </Badge>
                          )}
                          {resource.is_consumable && (
                            <Badge variant="secondary" className="gap-1 text-xs">
                              Usage limits
                            </Badge>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {resource.file_name ? (
                        <div className="text-sm">
                          <div className="truncate max-w-[150px]">{resource.file_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatFileSize(resource.file_size)}
                          </div>
                        </div>
                      ) : resource.url ? (
                        <a
                          href={resource.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline flex items-center gap-1"
                        >
                          <LinkIcon className="h-3 w-3" />
                          Link
                        </a>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={resource.downloadable ? "outline" : "secondary"}
                        className="gap-1"
                      >
                        {resource.downloadable ? (
                          <>
                            <Unlock className="h-3 w-3" />
                            Yes
                          </>
                        ) : (
                          <>
                            <Lock className="h-3 w-3" />
                            Protected
                          </>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={resource.is_active}
                          onCheckedChange={(checked) =>
                            toggleActiveMutation.mutate({ id: resource.id, is_active: checked })
                          }
                        />
                        <Badge variant={resource.is_active ? "default" : "secondary"}>
                          {resource.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={resource.visibility || "private"}
                        onValueChange={(value) =>
                          togglePublishMutation.mutate({
                            id: resource.id,
                            visibility: value,
                          })
                        }
                      >
                        <SelectTrigger className="w-[130px] h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="private">
                            <span className="flex items-center gap-1">
                              <EyeOff className="h-3 w-3" />
                              Private
                            </span>
                          </SelectItem>
                          <SelectItem value="enrolled">
                            <span className="flex items-center gap-1">
                              <Lock className="h-3 w-3" />
                              Enrolled
                            </span>
                          </SelectItem>
                          <SelectItem value="public">
                            <span className="flex items-center gap-1">
                              <Eye className="h-3 w-3" />
                              Public
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(resource.created_at), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-right sticky right-0 bg-background">
                      <div className="flex items-center justify-end gap-1 pl-2 border-l">
                        {resource.file_path && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDownload(resource)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setPlanConfigResource(resource)}
                          title="Plan settings"
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(resource)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm("Are you sure you want to delete this resource?")) {
                              deleteMutation.mutate(resource);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Plan Config Dialog */}
      <Dialog
        open={!!planConfigResource}
        onOpenChange={(open) => !open && setPlanConfigResource(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Plan Access Settings</DialogTitle>
            <DialogDescription>
              Configure which plans can access "{planConfigResource?.title}"
            </DialogDescription>
          </DialogHeader>
          {planConfigResource && (
            <ResourceCreditConfig
              resourceId={planConfigResource.id}
              currentPlanId={planConfigResource.plan_id}
              currentMinTier={planConfigResource.min_plan_tier}
              isConsumable={planConfigResource.is_consumable}
              creditCost={(planConfigResource as any).credit_cost ?? 1}
              onUpdate={() => {
                queryClient.invalidateQueries({ queryKey: ["resource-library"] });
                setPlanConfigResource(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
