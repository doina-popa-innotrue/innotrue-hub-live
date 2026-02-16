import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Users,
  FileText,
  Trash2,
  Edit,
  Upload,
  Link,
  X,
  Paperclip,
  ClipboardList,
  Library,
} from "lucide-react";
import { ResourcePickerDialog } from "@/components/modules/ResourcePickerDialog";
import { ScenarioPickerDialog } from "@/components/modules/ScenarioPickerDialog";
import { validateFile, acceptStringForBucket } from "@/lib/fileValidation";

interface Attachment {
  id?: string;
  title: string;
  attachment_type: "file" | "link" | "image";
  file_path?: string;
  url?: string;
  description?: string;
  file?: File;
}

interface ClientContent {
  id: string;
  user_id: string;
  content: string;
  assigned_by: string;
  assigned_at: string;
  user_name?: string;
  attachments?: Attachment[];
  scenarios?: LinkedScenario[];
  resources?: LinkedResource[];
}

interface LinkedScenario {
  id: string;
  scenario_template_id: string;
  scenario_template: {
    id: string;
    title: string;
    description: string | null;
    is_protected: boolean;
    capability_assessments?: { id: string; name: string } | null;
  };
}

interface LinkedResource {
  id: string;
  resource_id: string;
  resource: {
    id: string;
    title: string;
    resource_type: string;
  };
}

interface PendingScenario {
  id: string;
  title: string;
  description: string | null;
  is_protected: boolean;
  capability_assessments?: { id: string; name: string; slug: string } | null;
}

interface PendingResource {
  id: string;
  canonical_id: string;
  title: string;
  description: string | null;
  resource_type: string;
}

interface ModuleClientContentManagerProps {
  moduleId: string;
  moduleName: string;
  programId: string;
}

export default function ModuleClientContentManager({
  moduleId,
  moduleName,
  programId,
}: ModuleClientContentManagerProps) {
  const [open, setOpen] = useState(false);
  const [clientContents, setClientContents] = useState<ClientContent[]>([]);
  const [enrolledClients, setEnrolledClients] = useState<{ id: string; name: string }[]>([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [content, setContent] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [pendingScenarios, setPendingScenarios] = useState<PendingScenario[]>([]);
  const [pendingResources, setPendingResources] = useState<PendingResource[]>([]);
  const [editingContent, setEditingContent] = useState<ClientContent | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open, moduleId]);

  async function fetchData() {
    const { data: contents } = await supabase
      .from("module_client_content")
      .select("*, module_client_content_attachments(*)")
      .eq("module_id", moduleId);

    const { data: enrollments } = await supabase
      .from("client_enrollments")
      .select("client_user_id")
      .eq("program_id", programId)
      .eq("status", "active");

    if (enrollments && enrollments.length > 0) {
      const clientIds = enrollments
        .map((e) => e.client_user_id)
        .filter((id): id is string => id != null);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name")
        .in("id", clientIds);
      setEnrolledClients(profiles || []);
    }

    if (contents) {
      const userIds = contents.map((c) => c.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name")
        .in("id", userIds);

      const contentsWithNames = contents.map((c) => ({
        ...c,
        user_name: profiles?.find((p) => p.id === c.user_id)?.name || "Unknown",
        attachments: (c as any).module_client_content_attachments || [],
      }));
      setClientContents(contentsWithNames);
    }
  }

  async function handleSave() {
    if (!selectedClient || !content.trim()) {
      toast.error("Please select a client and enter content");
      return;
    }

    setSaving(true);
    try {
      const { data: savedContent, error } = await supabase
        .from("module_client_content")
        .upsert(
          {
            id: editingContent?.id,
            module_id: moduleId,
            user_id: selectedClient,
            content: content.trim(),
            assigned_by: (await supabase.auth.getUser()).data.user?.id || "",
          },
          { onConflict: "module_id,user_id" },
        )
        .select()
        .single();

      if (error) throw error;

      for (const attachment of attachments) {
        if (attachment.file) {
          const filePath = `${selectedClient}/${moduleId}/${Date.now()}_${attachment.file.name}`;
          const { error: uploadError } = await supabase.storage
            .from("module-client-content")
            .upload(filePath, attachment.file);

          if (uploadError) continue;

          await supabase.from("module_client_content_attachments").insert({
            module_client_content_id: savedContent.id,
            title: attachment.title,
            attachment_type: attachment.attachment_type,
            file_path: filePath,
            mime_type: attachment.file.type,
            file_size: attachment.file.size,
            description: attachment.description,
          });
        } else if (attachment.url && !attachment.id) {
          await supabase.from("module_client_content_attachments").insert({
            module_client_content_id: savedContent.id,
            title: attachment.title,
            attachment_type: attachment.attachment_type,
            url: attachment.url,
            description: attachment.description,
          });
        }
      }

      // Save pending scenarios
      const currentUser = (await supabase.auth.getUser()).data.user;
      for (const scenario of pendingScenarios) {
        await supabase.from("module_client_content_scenarios").insert({
          module_client_content_id: savedContent.id,
          scenario_template_id: scenario.id,
          assigned_by: currentUser?.id,
        });
      }

      // Save pending resources
      for (const resource of pendingResources) {
        await supabase.from("module_client_content_resources").insert({
          module_client_content_id: savedContent.id,
          resource_id: resource.id,
          assigned_by: currentUser?.id,
        });
      }

      toast.success("Client content saved!");
      resetForm();
      fetchData();
    } catch (error) {
      toast.error("Failed to save content");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(contentId: string) {
    if (!confirm("Delete this client's content?")) return;
    const { error } = await supabase.from("module_client_content").delete().eq("id", contentId);
    if (error) toast.error("Failed to delete");
    else {
      toast.success("Deleted");
      fetchData();
    }
  }

  async function deleteAttachment(attachmentId: string, filePath?: string) {
    if (filePath) await supabase.storage.from("module-client-content").remove([filePath]);
    await supabase.from("module_client_content_attachments").delete().eq("id", attachmentId);
    fetchData();
  }

  function startEdit(clientContent: ClientContent) {
    setEditingContent(clientContent);
    setSelectedClient(clientContent.user_id);
    setContent(clientContent.content);
    setAttachments(clientContent.attachments || []);
  }

  function resetForm() {
    setEditingContent(null);
    setSelectedClient("");
    setContent("");
    setAttachments([]);
    setPendingScenarios([]);
    setPendingResources([]);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    const validFiles: File[] = [];
    for (const file of Array.from(files)) {
      const validation = validateFile(file, "module-client-content");
      if (!validation.valid) {
        toast.error(validation.error);
        continue;
      }
      validFiles.push(file);
    }
    const newAttachments: Attachment[] = validFiles.map((file) => ({
      title: file.name,
      attachment_type: file.type.startsWith("image/") ? "image" : "file",
      file,
    }));
    setAttachments([...attachments, ...newAttachments]);
    e.target.value = "";
  }

  function addLinkAttachment() {
    setAttachments([...attachments, { title: "", attachment_type: "link", url: "" }]);
  }

  function updateAttachment(index: number, field: keyof Attachment, value: string) {
    const updated = [...attachments];
    updated[index] = { ...updated[index], [field]: value };
    setAttachments(updated);
  }

  function removeNewAttachment(index: number) {
    setAttachments(attachments.filter((_, i) => i !== index));
  }

  function handleAddScenario(scenario: PendingScenario) {
    setPendingScenarios([...pendingScenarios, scenario]);
  }

  function removePendingScenario(index: number) {
    setPendingScenarios(pendingScenarios.filter((_, i) => i !== index));
  }

  function handleAddResource(resource: PendingResource) {
    setPendingResources([...pendingResources, resource]);
  }

  function removePendingResource(index: number) {
    setPendingResources(pendingResources.filter((_, i) => i !== index));
  }

  const excludeScenarioIds = pendingScenarios.map((s) => s.id);
  const excludeResourceIds = pendingResources.map((r) => r.id);

  const clientsWithContent = clientContents.map((c) => c.user_id);
  const clientsWithoutContent = enrolledClients.filter((c) => !clientsWithContent.includes(c.id));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Users className="h-4 w-4 mr-2" />
          Client Content
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Client Content - {moduleName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {clientContents.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Assigned Content</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {clientContents.map((cc) => (
                  <div key={cc.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{cc.user_name}</Badge>
                        <span className="text-xs text-muted-foreground">
                          Assigned {new Date(cc.assigned_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={() => startEdit(cc)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(cc.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{cc.content}</p>
                    {cc.attachments && cc.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-2 border-t">
                        {cc.attachments.map((att: any) => (
                          <div
                            key={att.id}
                            className="flex items-center gap-1 bg-muted px-2 py-1 rounded text-xs"
                          >
                            <Paperclip className="h-3 w-3" />
                            {att.title}
                            <button
                              onClick={() => deleteAttachment(att.id, att.file_path)}
                              className="ml-1 hover:text-destructive"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {editingContent ? "Edit Content" : "Assign New Content"}
              </CardTitle>
              <CardDescription>
                Assign unique scenarios or materials to individual clients
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Client</Label>
                <Select
                  value={selectedClient}
                  onValueChange={setSelectedClient}
                  disabled={!!editingContent}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a client" />
                  </SelectTrigger>
                  <SelectContent>
                    {(editingContent ? enrolledClients : clientsWithoutContent).map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Content / Scenario</Label>
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Enter the specific scenario or instructions..."
                  rows={6}
                />
              </div>

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
                      <Upload className="h-4 w-4 mr-1" />
                      Upload
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={addLinkAttachment}>
                      <Link className="h-4 w-4 mr-1" />
                      Add Link
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
                    accept={acceptStringForBucket("module-client-content")}
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                </div>

                {attachments
                  .filter((a) => !a.id)
                  .map((att, index) => (
                    <div key={index} className="flex items-start gap-2 p-3 border rounded-lg">
                      {att.attachment_type === "link" ? (
                        <div className="flex-1 space-y-2">
                          <Input
                            placeholder="Link title"
                            value={att.title}
                            onChange={(e) => updateAttachment(index, "title", e.target.value)}
                          />
                          <Input
                            type="url"
                            placeholder="https://..."
                            value={att.url || ""}
                            onChange={(e) => updateAttachment(index, "url", e.target.value)}
                          />
                        </div>
                      ) : (
                        <div className="flex-1 flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{att.title}</span>
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

                {/* Pending resources */}
                {pendingResources.map((res, index) => (
                  <div
                    key={res.id}
                    className="flex items-center gap-2 p-3 border rounded-lg border-primary/30 bg-primary/5"
                  >
                    <Library className="h-4 w-4 text-muted-foreground" />
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

                {/* Pending scenarios */}
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

              <div className="flex gap-2">
                <Button
                  onClick={handleSave}
                  disabled={saving || !selectedClient || !content.trim()}
                >
                  {saving ? "Saving..." : editingContent ? "Update" : "Assign Content"}
                </Button>
                {editingContent && (
                  <Button variant="outline" onClick={resetForm}>
                    Cancel
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
