import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  FileText,
  Upload,
  Link,
  X,
  Paperclip,
  Download,
  ExternalLink,
  Save,
  Trash2,
  Library,
  Video,
  Image as ImageIcon,
  ClipboardList,
} from "lucide-react";
import { ResourcePickerDialog } from "./ResourcePickerDialog";
import { ScenarioPickerDialog } from "./ScenarioPickerDialog";

interface Attachment {
  id?: string;
  title: string;
  attachment_type: "file" | "link" | "image";
  file_path?: string;
  url?: string;
  description?: string;
  file?: File;
  file_size?: number;
}

interface AssignedResource {
  id: string;
  resource_id: string;
  notes: string | null;
  resource: {
    id: string;
    canonical_id: string;
    title: string;
    description: string | null;
    resource_type: string;
    url: string | null;
    file_path: string | null;
  };
}

interface PendingResource {
  id: string;
  canonical_id: string;
  title: string;
  description: string | null;
  resource_type: string;
}

interface AssignedScenario {
  id: string;
  scenario_template_id: string;
  notes: string | null;
  scenario_template: {
    id: string;
    title: string;
    description: string | null;
    is_protected: boolean;
    capability_assessments?: {
      id: string;
      name: string;
    } | null;
  };
}

interface PendingScenario {
  id: string;
  title: string;
  description: string | null;
  is_protected: boolean;
  capability_assessments?: {
    id: string;
    name: string;
    slug: string;
  } | null;
}

interface ClientContent {
  id: string;
  content: string;
  assigned_at: string;
  attachments: Attachment[];
}

interface InlineClientContentEditorProps {
  moduleId: string;
  clientUserId: string;
  clientName: string;
}

export function InlineClientContentEditor({
  moduleId,
  clientUserId,
  clientName,
}: InlineClientContentEditorProps) {
  const [content, setContent] = useState("");
  const [existingContent, setExistingContent] = useState<ClientContent | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [newAttachments, setNewAttachments] = useState<Attachment[]>([]);
  const [assignedResources, setAssignedResources] = useState<AssignedResource[]>([]);
  const [pendingResources, setPendingResources] = useState<PendingResource[]>([]);
  const [assignedScenarios, setAssignedScenarios] = useState<AssignedScenario[]>([]);
  const [pendingScenarios, setPendingScenarios] = useState<PendingScenario[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchContent();
  }, [moduleId, clientUserId]);

  async function fetchContent() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("module_client_content")
        .select("*, module_client_content_attachments(*)")
        .eq("module_id", moduleId)
        .eq("user_id", clientUserId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setExistingContent({
          id: data.id,
          content: data.content,
          assigned_at: data.assigned_at,
          attachments: (data as any).module_client_content_attachments || [],
        });
        setContent(data.content);
        setAttachments((data as any).module_client_content_attachments || []);

        // Fetch assigned resources
        const { data: resourcesData } = await supabase
          .from("module_client_content_resources")
          .select(
            `
            id,
            resource_id,
            notes,
            resource:resource_id(id, canonical_id, title, description, resource_type, url, file_path)
          `,
          )
          .eq("module_client_content_id", data.id);

        if (resourcesData) {
          setAssignedResources(resourcesData as unknown as AssignedResource[]);
        }

        // Fetch assigned scenarios
        const { data: scenariosData } = await supabase
          .from("module_client_content_scenarios")
          .select(
            `
            id,
            scenario_template_id,
            notes,
            scenario_template:scenario_template_id(
              id, 
              title, 
              description, 
              is_protected,
              capability_assessments(id, name)
            )
          `,
          )
          .eq("module_client_content_id", data.id);

        if (scenariosData) {
          setAssignedScenarios(scenariosData as unknown as AssignedScenario[]);
        }
      } else {
        setExistingContent(null);
        setContent("");
        setAttachments([]);
        setAssignedResources([]);
        setAssignedScenarios([]);
      }
      setPendingResources([]);
      setPendingScenarios([]);
    } catch (error) {
      console.error("Error fetching content:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!content.trim()) {
      toast.error("Please enter content");
      return;
    }

    setSaving(true);
    try {
      const currentUser = (await supabase.auth.getUser()).data.user;

      const { data: savedContent, error } = await supabase
        .from("module_client_content")
        .upsert(
          {
            id: existingContent?.id,
            module_id: moduleId,
            user_id: clientUserId,
            content: content.trim(),
            assigned_by: currentUser?.id || "",
          },
          { onConflict: "module_id,user_id" },
        )
        .select()
        .single();

      if (error) throw error;

      // Upload new file attachments
      for (const attachment of newAttachments) {
        if (attachment.file) {
          const filePath = `${clientUserId}/${moduleId}/${Date.now()}_${attachment.file.name}`;
          const { error: uploadError } = await supabase.storage
            .from("module-client-content")
            .upload(filePath, attachment.file);

          if (uploadError) {
            console.error("Upload error:", uploadError);
            continue;
          }

          await supabase.from("module_client_content_attachments").insert({
            module_client_content_id: savedContent.id,
            title: attachment.title,
            attachment_type: attachment.attachment_type,
            file_path: filePath,
            mime_type: attachment.file.type,
            file_size: attachment.file.size,
            description: attachment.description,
          });
        } else if (attachment.url) {
          await supabase.from("module_client_content_attachments").insert({
            module_client_content_id: savedContent.id,
            title: attachment.title,
            attachment_type: attachment.attachment_type,
            url: attachment.url,
            description: attachment.description,
          });
        }
      }

      // Save pending resources
      for (const resource of pendingResources) {
        await supabase.from("module_client_content_resources").insert({
          module_client_content_id: savedContent.id,
          resource_id: resource.id,
          assigned_by: currentUser?.id,
        });
      }

      // Save pending scenarios
      for (const scenario of pendingScenarios) {
        await supabase.from("module_client_content_scenarios").insert({
          module_client_content_id: savedContent.id,
          scenario_template_id: scenario.id,
          assigned_by: currentUser?.id,
        });
      }

      toast.success("Content saved for " + clientName);
      setNewAttachments([]);
      setPendingResources([]);
      setPendingScenarios([]);
      fetchContent();
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Failed to save content");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAttachment(attachment: Attachment) {
    if (!attachment.id) return;

    try {
      if (attachment.file_path) {
        await supabase.storage.from("module-client-content").remove([attachment.file_path]);
      }
      await supabase.from("module_client_content_attachments").delete().eq("id", attachment.id);
      toast.success("Attachment deleted");
      fetchContent();
    } catch (error) {
      toast.error("Failed to delete attachment");
    }
  }

  async function handleDownload(attachment: Attachment) {
    if (!attachment.file_path) return;

    const { data, error } = await supabase.storage
      .from("module-client-content")
      .download(attachment.file_path);

    if (error || !data) {
      toast.error("Failed to download file");
      return;
    }

    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = attachment.title;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;

    const fileAttachments: Attachment[] = Array.from(files).map((file) => ({
      title: file.name,
      attachment_type: file.type.startsWith("image/") ? "image" : "file",
      file,
      file_size: file.size,
    }));

    setNewAttachments([...newAttachments, ...fileAttachments]);
    e.target.value = "";
  }

  function addLinkAttachment() {
    setNewAttachments([...newAttachments, { title: "", attachment_type: "link", url: "" }]);
  }

  function updateNewAttachment(index: number, field: keyof Attachment, value: string) {
    const updated = [...newAttachments];
    updated[index] = { ...updated[index], [field]: value };
    setNewAttachments(updated);
  }

  function removeNewAttachment(index: number) {
    setNewAttachments(newAttachments.filter((_, i) => i !== index));
  }

  function handleAddResource(resource: PendingResource) {
    setPendingResources([...pendingResources, resource]);
  }

  function removePendingResource(index: number) {
    setPendingResources(pendingResources.filter((_, i) => i !== index));
  }

  async function handleDeleteResource(resourceId: string) {
    try {
      await supabase.from("module_client_content_resources").delete().eq("id", resourceId);
      toast.success("Resource removed");
      fetchContent();
    } catch (error) {
      toast.error("Failed to remove resource");
    }
  }

  function handleAddScenario(scenario: PendingScenario) {
    setPendingScenarios([...pendingScenarios, scenario]);
  }

  function removePendingScenario(index: number) {
    setPendingScenarios(pendingScenarios.filter((_, i) => i !== index));
  }

  async function handleDeleteScenario(scenarioLinkId: string) {
    try {
      await supabase.from("module_client_content_scenarios").delete().eq("id", scenarioLinkId);
      toast.success("Scenario removed");
      fetchContent();
    } catch (error) {
      toast.error("Failed to remove scenario");
    }
  }

  function getResourceIcon(type: string) {
    switch (type) {
      case "video":
        return <Video className="h-4 w-4 text-muted-foreground" />;
      case "image":
        return <ImageIcon className="h-4 w-4 text-muted-foreground" />;
      default:
        return <Library className="h-4 w-4 text-muted-foreground" />;
    }
  }

  function formatFileSize(bytes?: number) {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  // Combine already assigned and pending resource IDs for the picker's exclusion list
  const excludeResourceIds = [
    ...assignedResources.map((r) => r.resource_id),
    ...pendingResources.map((r) => r.id),
  ];

  // Combine already assigned and pending scenario IDs for the picker's exclusion list
  const excludeScenarioIds = [
    ...assignedScenarios.map((s) => s.scenario_template_id),
    ...pendingScenarios.map((s) => s.id),
  ];

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading client content...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Personalised Content for {clientName}
        </CardTitle>
        <CardDescription>
          Add unique scenarios, files, or instructions for this client's assignment.
          {existingContent && (
            <span className="block mt-1 text-xs">
              Last updated: {new Date(existingContent.assigned_at).toLocaleString()}
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Content / Scenario</Label>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Enter the specific scenario, instructions, or context for this client..."
            rows={5}
          />
        </div>

        {/* Existing attachments */}
        {attachments.length > 0 && (
          <div className="space-y-2">
            <Label>Current Attachments</Label>
            <div className="space-y-2">
              {attachments.map((att) => (
                <div
                  key={att.id}
                  className="flex items-center justify-between p-3 border rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-2">
                    <Paperclip className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{att.title}</span>
                    {att.file_size && (
                      <span className="text-xs text-muted-foreground">
                        ({formatFileSize(att.file_size)})
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {att.url ? (
                      <Button variant="ghost" size="sm" asChild>
                        <a href={att.url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    ) : att.file_path ? (
                      <Button variant="ghost" size="sm" onClick={() => handleDownload(att)}>
                        <Download className="h-4 w-4" />
                      </Button>
                    ) : null}
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteAttachment(att)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Assigned resources from library */}
        {assignedResources.length > 0 && (
          <div className="space-y-2">
            <Label>Assigned Resources</Label>
            <div className="space-y-2">
              {assignedResources.map((res) => (
                <div
                  key={res.id}
                  className="flex items-center justify-between p-3 border rounded-lg bg-primary/5"
                >
                  <div className="flex items-center gap-2">
                    {getResourceIcon(res.resource.resource_type)}
                    <span className="text-sm font-medium">{res.resource.title}</span>
                    <Badge variant="secondary" className="text-xs capitalize">
                      {res.resource.resource_type}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    {res.resource.url && (
                      <Button variant="ghost" size="sm" asChild>
                        <a href={res.resource.url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteResource(res.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Assigned scenarios from system */}
        {assignedScenarios.length > 0 && (
          <div className="space-y-2">
            <Label>Assigned Scenarios</Label>
            <div className="space-y-2">
              {assignedScenarios.map((scen) => (
                <div
                  key={scen.id}
                  className="flex items-center justify-between p-3 border rounded-lg bg-accent/30 border-accent"
                >
                  <div className="flex items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-accent-foreground" />
                    <span className="text-sm font-medium">{scen.scenario_template.title}</span>
                    {scen.scenario_template.capability_assessments && (
                      <Badge variant="secondary" className="text-xs">
                        {scen.scenario_template.capability_assessments.name}
                      </Badge>
                    )}
                    {scen.scenario_template.is_protected && (
                      <Badge variant="outline" className="text-xs">
                        Protected
                      </Badge>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleDeleteScenario(scen.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add new attachments, resources, and scenarios */}
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <Label>Add Content</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-1" /> Upload File
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={addLinkAttachment}>
                <Link className="h-4 w-4 mr-1" /> Add Link
              </Button>
              <ResourcePickerDialog
                excludeResourceIds={excludeResourceIds}
                onSelect={handleAddResource}
              />
              <ScenarioPickerDialog
                excludeScenarioIds={excludeScenarioIds}
                onSelect={handleAddScenario}
              />
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>

          {newAttachments.map((att, index) => (
            <div key={index} className="flex items-start gap-2 p-3 border rounded-lg">
              {att.attachment_type === "link" ? (
                <div className="flex-1 space-y-2">
                  <Input
                    placeholder="Link title"
                    value={att.title}
                    onChange={(e) => updateNewAttachment(index, "title", e.target.value)}
                  />
                  <Input
                    type="url"
                    placeholder="https://..."
                    value={att.url || ""}
                    onChange={(e) => updateNewAttachment(index, "url", e.target.value)}
                  />
                </div>
              ) : (
                <div className="flex-1 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{att.title}</span>
                  {att.file_size && (
                    <span className="text-xs text-muted-foreground">
                      ({formatFileSize(att.file_size)})
                    </span>
                  )}
                </div>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeNewAttachment(index)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}

          {/* Pending resources (to be saved) */}
          {pendingResources.map((res, index) => (
            <div
              key={res.id}
              className="flex items-center gap-2 p-3 border rounded-lg border-primary/30 bg-primary/5"
            >
              {getResourceIcon(res.resource_type)}
              <span className="text-sm font-medium flex-1">{res.title}</span>
              <Badge variant="secondary" className="text-xs capitalize">
                {res.resource_type}
              </Badge>
              <Badge variant="outline" className="text-xs">
                New
              </Badge>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removePendingResource(index)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}

          {/* Pending scenarios (to be saved) */}
          {pendingScenarios.map((scen, index) => (
            <div
              key={scen.id}
              className="flex items-center gap-2 p-3 border rounded-lg border-accent bg-accent/20"
            >
              <ClipboardList className="h-4 w-4 text-accent-foreground" />
              <span className="text-sm font-medium flex-1">{scen.title}</span>
              {scen.capability_assessments && (
                <Badge variant="secondary" className="text-xs">
                  {scen.capability_assessments.name}
                </Badge>
              )}
              <Badge variant="outline" className="text-xs">
                New
              </Badge>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removePendingScenario(index)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        <div className="pt-2">
          <Button onClick={handleSave} disabled={saving || !content.trim()}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : existingContent ? "Update Content" : "Save Content"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
