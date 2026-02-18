import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { X, Plus, Package, Trash2, Upload, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface ModuleType {
  id: string;
  name: string;
  description: string | null;
}

interface Feature {
  key: string;
  name: string;
}

interface CapabilityAssessment {
  id: string;
  name: string;
}
interface ModuleLink {
  name: string;
  url: string;
  type: "zoom" | "calendly" | "talentlms" | "circle" | "lucidchart" | "miro" | "gdrive" | "other";
}

interface ModuleFormProps {
  initialData?: {
    id?: string; // Module ID — needed for content package upload
    title: string;
    description: string;
    content?: string;
    moduleType: string;
    estimatedMinutes: string;
    links?: ModuleLink[];
    tierRequired?: string;
    isIndividualized?: boolean;
    code?: string;
    featureKey?: string | null;
    capabilityAssessmentId?: string | null;
    contentPackagePath?: string | null;
  };
  onSubmit: (data: {
    title: string;
    description: string;
    content: string;
    moduleType: string;
    estimatedMinutes: string;
    links: ModuleLink[];
    tierRequired: string;
    isIndividualized: boolean;
    code: string;
    featureKey: string | null;
    capabilityAssessmentId: string | null;
  }) => Promise<void>;
  onCancel: () => void;
  submitLabel: string;
  availableTiers?: string[];
}

export default function ModuleForm({
  initialData,
  onSubmit,
  onCancel,
  submitLabel,
  availableTiers = ["Essentials", "Premium"],
}: ModuleFormProps) {
  const [title, setTitle] = useState(initialData?.title || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [content, setContent] = useState(initialData?.content || "");
  const [moduleType, setModuleType] = useState(initialData?.moduleType || "session");
  const [estimatedMinutes, setEstimatedMinutes] = useState(initialData?.estimatedMinutes || "60");
  const [links, setLinks] = useState<ModuleLink[]>(initialData?.links || []);
  const [tierRequired, setTierRequired] = useState(
    initialData?.tierRequired || availableTiers[0]?.toLowerCase() || "essentials",
  );
  const [isIndividualized, setIsIndividualized] = useState(initialData?.isIndividualized || false);
  const [code, setCode] = useState(initialData?.code || "");
  const [featureKey, setFeatureKey] = useState<string | null>(initialData?.featureKey || null);
  const [capabilityAssessmentId, setCapabilityAssessmentId] = useState<string | null>(
    initialData?.capabilityAssessmentId || null,
  );
  const [moduleTypes, setModuleTypes] = useState<ModuleType[]>([]);
  const [consumableFeatures, setConsumableFeatures] = useState<Feature[]>([]);
  const [capabilityAssessments, setCapabilityAssessments] = useState<CapabilityAssessment[]>([]);
  const [contentPackagePath, setContentPackagePath] = useState<string | null>(
    initialData?.contentPackagePath || null,
  );
  const [uploadingPackage, setUploadingPackage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [typesRes, featuresRes, assessmentsRes] = await Promise.all([
          supabase.from("module_types").select("id, name, description").order("name"),
          supabase.from("features").select("key, name").eq("is_consumable", true).order("name"),
          supabase
            .from("capability_assessments")
            .select("id, name")
            .eq("is_active", true)
            .order("name"),
        ]);
        if (typesRes.error) console.error("Error fetching module types:", typesRes.error);
        if (featuresRes.error) console.error("Error fetching features:", featuresRes.error);
        if (assessmentsRes.error)
          console.error("Error fetching assessments:", assessmentsRes.error);

        if (typesRes.data) setModuleTypes(typesRes.data);
        if (featuresRes.data) setConsumableFeatures(featuresRes.data);
        if (assessmentsRes.data) setCapabilityAssessments(assessmentsRes.data);
      } catch (error) {
        console.error("Error fetching form data:", error);
      }
    };
    fetchData();
  }, []);

  const addLink = () => {
    setLinks([...links, { name: "", url: "", type: "other" }]);
  };

  const updateLink = (index: number, field: keyof ModuleLink, value: string) => {
    const newLinks = [...links];
    newLinks[index] = { ...newLinks[index], [field]: value };
    setLinks(newLinks);
  };

  const removeLink = (index: number) => {
    setLinks(links.filter((_, i) => i !== index));
  };

  const handlePackageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !initialData?.id) return;

    if (!file.name.endsWith(".zip")) {
      toast.error("Please upload a ZIP file");
      return;
    }

    if (file.size > 500 * 1024 * 1024) {
      toast.error("File size exceeds 500 MB limit");
      return;
    }

    setUploadingPackage(true);
    setUploadProgress(10);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error("Authentication required");
        return;
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("moduleId", initialData.id);

      setUploadProgress(30);

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
      const response = await fetch(
        `${supabaseUrl}/functions/v1/upload-content-package`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          body: formData,
        },
      );

      setUploadProgress(80);

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || "Upload failed");
        return;
      }

      setContentPackagePath(result.content_package_path);
      setUploadProgress(100);
      toast.success(`Content package uploaded (${result.files_uploaded} files)`);
    } catch (err) {
      toast.error("Upload failed — check your connection");
      console.error("Content package upload error:", err);
    } finally {
      setUploadingPackage(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemovePackage = async () => {
    if (!initialData?.id) return;

    const { error } = await supabase
      .from("program_modules")
      .update({ content_package_path: null })
      .eq("id", initialData.id);

    if (error) {
      toast.error("Failed to remove content package");
    } else {
      setContentPackagePath(null);
      toast.success("Content package removed");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({
      title,
      description,
      content,
      moduleType,
      estimatedMinutes,
      links: links.filter((link) => link.name && link.url), // Only include complete links
      tierRequired,
      isIndividualized,
      code: code.trim(),
      featureKey,
      capabilityAssessmentId,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label>Code (External ID)</Label>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g., TLMS-101 or articulate-intro"
          />
          <p className="text-xs text-muted-foreground">
            Optional. Use to link with TalentLMS/Articulate Rise courses.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Description</Label>
        <RichTextEditor
          value={description}
          onChange={setDescription}
          placeholder="Brief module description..."
        />
      </div>

      <div className="space-y-2">
        <Label>Content</Label>
        <RichTextEditor
          value={content}
          onChange={setContent}
          placeholder="Full module content, instructions, or materials..."
        />
      </div>

      <div className="space-y-2">
        <Label>Type</Label>
        <Select value={moduleType} onValueChange={setModuleType}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {moduleTypes.length > 0
              ? moduleTypes.map((type) => (
                  <SelectItem key={type.id} value={type.name}>
                    {type.name.charAt(0).toUpperCase() + type.name.slice(1)}
                  </SelectItem>
                ))
              : ["session", "assignment", "reflection", "resource"].map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Estimated Minutes</Label>
        <Input
          type="number"
          value={estimatedMinutes}
          onChange={(e) => setEstimatedMinutes(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label>Access Tier Required</Label>
        <p className="text-xs text-muted-foreground">
          Higher tiers include access to all lower tier content.
        </p>
        <Select value={tierRequired} onValueChange={setTierRequired}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {availableTiers.map((tier, index) => (
              <SelectItem key={tier} value={tier.toLowerCase()}>
                {index + 1}. {tier}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between p-4 border rounded-lg">
        <div className="space-y-0.5">
          <Label htmlFor="individualized">Individualized Content</Label>
          <p className="text-xs text-muted-foreground">
            Enable per-client content. When enabled, admins/coaches can assign unique scenarios or
            materials to each participant.
          </p>
        </div>
        <Switch
          id="individualized"
          checked={isIndividualized}
          onCheckedChange={setIsIndividualized}
        />
      </div>

      <div className="space-y-2">
        <Label>Consumable Feature</Label>
        <Select
          value={featureKey || "none"}
          onValueChange={(v) => setFeatureKey(v === "none" ? null : v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="None" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {consumableFeatures.map((feature) => (
              <SelectItem key={feature.key} value={feature.key}>
                {feature.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Optional. When this module is completed, the selected feature's usage count will be
          incremented.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Self-Assessment (Capability Assessment)</Label>
        <Select
          value={capabilityAssessmentId || "none"}
          onValueChange={(v) => setCapabilityAssessmentId(v === "none" ? null : v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="None" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {capabilityAssessments.map((assessment) => (
              <SelectItem key={assessment.id} value={assessment.id}>
                {assessment.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Optional. Link a capability assessment for clients to complete as part of this module.
        </p>
      </div>

      {/* Content Package — only available in edit mode (needs module ID) */}
      {initialData?.id && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Package className="h-5 w-5" />
              Content Package
            </CardTitle>
            <CardDescription>
              Upload a Rise/web export ZIP to embed interactive learning content directly in the module.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {contentPackagePath ? (
              <div className="flex items-center justify-between p-3 border rounded-lg bg-green-50 dark:bg-green-950/20">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="text-sm font-medium">Content package uploaded</p>
                    <p className="text-xs text-muted-foreground">{contentPackagePath}</p>
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleRemovePackage}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Remove
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingPackage}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {uploadingPackage ? "Uploading..." : "Upload ZIP"}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    ZIP archive up to 500 MB. Must contain an index.html file.
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".zip"
                  className="hidden"
                  onChange={handlePackageUpload}
                />
                {uploadingPackage && (
                  <div className="space-y-1">
                    <Progress value={uploadProgress} />
                    <p className="text-xs text-muted-foreground text-center">
                      {uploadProgress < 30
                        ? "Preparing upload..."
                        : uploadProgress < 80
                          ? "Uploading and extracting..."
                          : "Finalizing..."}
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Resource Links</CardTitle>
          <Button type="button" size="sm" onClick={addLink} variant="outline">
            <Plus className="mr-2 h-4 w-4" />
            Add Link
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {links.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No links added yet. Click "Add Link" to add resource links.
            </p>
          ) : (
            links.map((link, index) => (
              <Card key={index}>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className="flex-1 space-y-4">
                      <div className="space-y-2">
                        <Label>Link Name</Label>
                        <Input
                          placeholder="e.g., Book Your Session"
                          value={link.name}
                          onChange={(e) => updateLink(index, "name", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>URL</Label>
                        <Input
                          type="url"
                          placeholder="https://..."
                          value={link.url}
                          onChange={(e) => updateLink(index, "url", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Link Type</Label>
                        <Select
                          value={link.type}
                          onValueChange={(value) =>
                            updateLink(index, "type", value as ModuleLink["type"])
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="calendly">Scheduling Tool</SelectItem>
                            <SelectItem value="zoom">Zoom</SelectItem>
                            <SelectItem value="talentlms">InnoTrue Academy</SelectItem>
                            <SelectItem value="circle">InnoTrue Community</SelectItem>
                            <SelectItem value="lucidchart">LucidChart</SelectItem>
                            <SelectItem value="miro">Miro</SelectItem>
                            <SelectItem value="gdrive">Google Drive</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => removeLink(index)}
                      className="mt-8"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button type="submit" className="flex-1">
          {submitLabel}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
