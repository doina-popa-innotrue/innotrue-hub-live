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
  StickyNote,
  ChevronDown,
  ChevronUp,
  Paperclip,
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";

interface TaskNote {
  id: string;
  title: string;
  content: string | null;
  created_at: string;
  updated_at: string;
  resources?: TaskNoteResource[];
}

interface TaskNoteResource {
  id: string;
  title: string;
  resource_type: string;
  url: string | null;
  file_path: string | null;
  description: string | null;
  created_at: string;
}

interface TaskNotesProps {
  taskId: string;
}

const RESOURCE_ICONS = {
  image: FileImage,
  pdf: FileText,
  link: Link2,
  other: FileText,
};

export default function TaskNotes({ taskId }: TaskNotesProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [notes, setNotes] = useState<TaskNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNoteDialog, setShowNoteDialog] = useState(false);
  const [showResourceDialog, setShowResourceDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteNoteId, setDeleteNoteId] = useState<string | null>(null);
  const [deleteResourceId, setDeleteResourceId] = useState<string | null>(null);
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const [editingNote, setEditingNote] = useState<TaskNote | null>(null);
  const [currentNoteId, setCurrentNoteId] = useState<string | null>(null);
  const [uploadMode, setUploadMode] = useState<"url" | "file">("url");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [noteFormData, setNoteFormData] = useState({
    title: "",
    content: "",
  });

  const [resourceFormData, setResourceFormData] = useState({
    title: "",
    resource_type: "link",
    url: "",
    description: "",
  });

  useEffect(() => {
    fetchNotes();
  }, [taskId]);

  const fetchNotes = async () => {
    try {
      const { data: notesData, error: notesError } = await supabase
        .from("task_notes")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false });

      if (notesError) throw notesError;

      // Fetch resources for each note
      const notesWithResources = await Promise.all(
        (notesData || []).map(async (note) => {
          const { data: resources } = await supabase
            .from("task_note_resources")
            .select("*")
            .eq("note_id", note.id)
            .order("created_at", { ascending: false });
          return { ...note, resources: resources || [] };
        }),
      );

      setNotes(notesWithResources);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load notes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleNoteExpanded = (noteId: string) => {
    setExpandedNotes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(noteId)) {
        newSet.delete(noteId);
      } else {
        newSet.add(noteId);
      }
      return newSet;
    });
  };

  const handleSaveNote = async () => {
    if (!noteFormData.title.trim()) {
      toast({
        title: "Validation Error",
        description: "Title is required",
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

      if (editingNote) {
        const { error } = await supabase
          .from("task_notes")
          .update({
            title: noteFormData.title,
            content: noteFormData.content || null,
          })
          .eq("id", editingNote.id);

        if (error) throw error;
        toast({ title: "Success", description: "Note updated successfully" });
      } else {
        const { error } = await supabase.from("task_notes").insert([
          {
            task_id: taskId,
            user_id: user.id,
            title: noteFormData.title,
            content: noteFormData.content || null,
          },
        ]);

        if (error) throw error;
        toast({ title: "Success", description: "Note added successfully" });
      }

      setNoteFormData({ title: "", content: "" });
      setEditingNote(null);
      setShowNoteDialog(false);
      fetchNotes();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to save note",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteNote = async () => {
    if (!deleteNoteId) return;

    try {
      // Resources will be cascade deleted
      const { error } = await supabase.from("task_notes").delete().eq("id", deleteNoteId);

      if (error) throw error;
      toast({ title: "Success", description: "Note deleted successfully" });
      fetchNotes();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to delete note",
        variant: "destructive",
      });
    } finally {
      setDeleteNoteId(null);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateFile(file, "task-note-resources");
    if (!validation.valid) {
      sonnerToast.error(validation.error);
      return;
    }

    setSelectedFile(file);

    if (!resourceFormData.title) {
      setResourceFormData({ ...resourceFormData, title: file.name });
    }

    if (file.type.startsWith("image/")) {
      setResourceFormData({
        ...resourceFormData,
        resource_type: "image",
        title: resourceFormData.title || file.name,
      });
    } else if (file.type === "application/pdf") {
      setResourceFormData({
        ...resourceFormData,
        resource_type: "pdf",
        title: resourceFormData.title || file.name,
      });
    }
  };

  const uploadFile = async (file: File, userId: string, noteId: string) => {
    const fileExt = file.name.split(".").pop();
    const fileName = `${userId}/${taskId}/${noteId}/${Date.now()}.${fileExt}`;

    const { data, error } = await supabase.storage
      .from("task-note-resources")
      .upload(fileName, file);

    if (error) throw error;
    return fileName;
  };

  const handleSaveResource = async () => {
    if (!currentNoteId) return;

    if (!resourceFormData.title.trim()) {
      toast({
        title: "Validation Error",
        description: "Title is required",
        variant: "destructive",
      });
      return;
    }

    if (uploadMode === "url" && !resourceFormData.url.trim()) {
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
        filePath = await uploadFile(selectedFile, user.id, currentNoteId);
        // Note: url is left null for file uploads - we use signed download URLs
      } else {
        url = resourceFormData.url;
      }

      const { error } = await supabase.from("task_note_resources").insert([
        {
          note_id: currentNoteId,
          user_id: user.id,
          title: resourceFormData.title,
          resource_type: resourceFormData.resource_type,
          url: url,
          file_path: filePath,
          description: resourceFormData.description || null,
        },
      ]);

      if (error) throw error;

      toast({ title: "Success", description: "Resource added successfully" });
      setResourceFormData({ title: "", resource_type: "link", url: "", description: "" });
      setSelectedFile(null);
      setShowResourceDialog(false);
      setCurrentNoteId(null);
      fetchNotes();
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

  const handleDeleteResource = async () => {
    if (!deleteResourceId) return;

    try {
      const note = notes.find((n) => n.resources?.some((r) => r.id === deleteResourceId));
      const resource = note?.resources?.find((r) => r.id === deleteResourceId);

      if (resource?.file_path) {
        await supabase.storage.from("task-note-resources").remove([resource.file_path]);
      }

      const { error } = await supabase
        .from("task_note_resources")
        .delete()
        .eq("id", deleteResourceId);

      if (error) throw error;
      toast({ title: "Success", description: "Resource deleted successfully" });
      fetchNotes();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to delete resource",
        variant: "destructive",
      });
    } finally {
      setDeleteResourceId(null);
    }
  };

  const handleDownload = async (resource: TaskNoteResource) => {
    if (!resource.file_path) {
      window.open(resource.url || "#", "_blank");
      return;
    }

    try {
      const { data, error } = await supabase.storage
        .from("task-note-resources")
        .download(resource.file_path);

      if (error) throw error;

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

  const openEditNote = (note: TaskNote) => {
    setEditingNote(note);
    setNoteFormData({ title: note.title, content: note.content || "" });
    setShowNoteDialog(true);
  };

  const openAddResource = (noteId: string) => {
    setCurrentNoteId(noteId);
    setResourceFormData({ title: "", resource_type: "link", url: "", description: "" });
    setSelectedFile(null);
    setUploadMode("url");
    setShowResourceDialog(true);
  };

  if (loading) {
    return <div className="text-muted-foreground">Loading notes...</div>;
  }

  return (
    <>
      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <StickyNote className="h-5 w-5" />
              <CardTitle>Notes</CardTitle>
            </div>
            <Button
              onClick={() => {
                setEditingNote(null);
                setNoteFormData({ title: "", content: "" });
                setShowNoteDialog(true);
              }}
              size="sm"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Note
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {notes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <StickyNote className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No notes yet. Add notes to track your progress and thoughts on this task.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notes.map((note) => (
                <Collapsible
                  key={note.id}
                  open={expandedNotes.has(note.id)}
                  onOpenChange={() => toggleNoteExpanded(note.id)}
                >
                  <div className="border rounded-lg bg-card">
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3 flex-1">
                          <StickyNote className="h-4 w-4 text-muted-foreground" />
                          <div className="flex-1">
                            <h4 className="font-medium">{note.title}</h4>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(note.created_at), "MMM d, yyyy h:mm a")}
                              </span>
                              {note.resources && note.resources.length > 0 && (
                                <Badge variant="secondary" className="text-xs">
                                  <Paperclip className="h-3 w-3 mr-1" />
                                  {note.resources.length}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {expandedNotes.has(note.id) ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="px-4 pb-4 border-t">
                        {note.content && (
                          <div className="mt-3 text-sm text-muted-foreground whitespace-pre-wrap">
                            {note.content}
                          </div>
                        )}

                        {/* Resources */}
                        {note.resources && note.resources.length > 0 && (
                          <div className="mt-4">
                            <h5 className="text-sm font-medium mb-2">Attachments</h5>
                            <div className="grid gap-2">
                              {note.resources.map((resource) => {
                                const Icon =
                                  RESOURCE_ICONS[
                                    resource.resource_type as keyof typeof RESOURCE_ICONS
                                  ] || FileText;
                                return (
                                  <div
                                    key={resource.id}
                                    className="flex items-center justify-between p-2 rounded border bg-muted/30"
                                  >
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                                      <span className="text-sm truncate">{resource.title}</span>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      {resource.file_path ? (
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8"
                                          onClick={() => handleDownload(resource)}
                                        >
                                          <Download className="h-4 w-4" />
                                        </Button>
                                      ) : (
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8"
                                          onClick={() => window.open(resource.url || "#", "_blank")}
                                        >
                                          <ExternalLink className="h-4 w-4" />
                                        </Button>
                                      )}
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => setDeleteResourceId(resource.id)}
                                      >
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                      </Button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Action buttons */}
                        <div className="flex items-center gap-2 mt-4 pt-3 border-t">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openAddResource(note.id)}
                          >
                            <Paperclip className="h-4 w-4 mr-1" />
                            Add Attachment
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => openEditNote(note)}>
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteNoteId(note.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Note Dialog */}
      <Dialog open={showNoteDialog} onOpenChange={setShowNoteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingNote ? "Edit Note" : "Add Note"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="note-title">Title *</Label>
              <Input
                id="note-title"
                value={noteFormData.title}
                onChange={(e) => setNoteFormData({ ...noteFormData, title: e.target.value })}
                placeholder="Note title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="note-content">Content</Label>
              <Textarea
                id="note-content"
                value={noteFormData.content}
                onChange={(e) => setNoteFormData({ ...noteFormData, content: e.target.value })}
                placeholder="Write your note here..."
                rows={5}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowNoteDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveNote} disabled={saving}>
                {saving ? "Saving..." : editingNote ? "Update" : "Add Note"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Resource Dialog */}
      <Dialog open={showResourceDialog} onOpenChange={setShowResourceDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Attachment</DialogTitle>
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
                <Label htmlFor="resource-title">Title *</Label>
                <Input
                  id="resource-title"
                  value={resourceFormData.title}
                  onChange={(e) =>
                    setResourceFormData({ ...resourceFormData, title: e.target.value })
                  }
                  placeholder="e.g., Helpful article, Reference PDF"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="resource-type">Type *</Label>
                <Select
                  value={resourceFormData.resource_type}
                  onValueChange={(value) =>
                    setResourceFormData({ ...resourceFormData, resource_type: value })
                  }
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
                <Label htmlFor="resource-url">URL *</Label>
                <Input
                  id="resource-url"
                  type="url"
                  value={resourceFormData.url}
                  onChange={(e) =>
                    setResourceFormData({ ...resourceFormData, url: e.target.value })
                  }
                  placeholder="https://example.com/resource"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="resource-description">Description</Label>
                <Textarea
                  id="resource-description"
                  value={resourceFormData.description}
                  onChange={(e) =>
                    setResourceFormData({ ...resourceFormData, description: e.target.value })
                  }
                  placeholder="Brief description..."
                  rows={2}
                />
              </div>
            </TabsContent>

            <TabsContent value="file" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="file-title">Title *</Label>
                <Input
                  id="file-title"
                  value={resourceFormData.title}
                  onChange={(e) =>
                    setResourceFormData({ ...resourceFormData, title: e.target.value })
                  }
                  placeholder="Resource title (auto-filled from filename)"
                />
              </div>

              <div className="space-y-2">
                <Label>File Upload *</Label>
                <div className="flex items-center gap-2">
                  <Input
                    ref={fileInputRef}
                    type="file"
                    accept={acceptStringForBucket("task-note-resources")}
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
                <Label htmlFor="file-description">Description</Label>
                <Textarea
                  id="file-description"
                  value={resourceFormData.description}
                  onChange={(e) =>
                    setResourceFormData({ ...resourceFormData, description: e.target.value })
                  }
                  placeholder="Brief description..."
                  rows={2}
                />
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowResourceDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveResource} disabled={saving}>
              {saving ? "Adding..." : "Add Attachment"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Note Confirmation */}
      <AlertDialog open={!!deleteNoteId} onOpenChange={() => setDeleteNoteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Note</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this note? This will also delete all attachments. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteNote}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Resource Confirmation */}
      <AlertDialog open={!!deleteResourceId} onOpenChange={() => setDeleteResourceId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Attachment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this attachment? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteResource}
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
