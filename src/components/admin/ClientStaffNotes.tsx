import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Plus,
  Edit2,
  Trash2,
  Flag,
  FlagOff,
  ChevronDown,
  ChevronRight,
  Link2,
  FileText,
  ExternalLink,
  Loader2,
  User,
  Calendar,
  Tag,
  AlertCircle,
  ThumbsUp,
  ThumbsDown,
  Minus,
  Lock,
  Unlock,
} from "lucide-react";

interface ClientStaffNotesProps {
  clientUserId: string;
  enrollmentId?: string;
  isAdmin?: boolean;
}

interface StaffNote {
  id: string;
  client_user_id: string;
  author_id: string;
  enrollment_id: string | null;
  title: string;
  content: string | null;
  note_type: string;
  sentiment: string | null;
  tags: string[] | null;
  is_flagged: boolean;
  is_private: boolean;
  created_at: string;
  updated_at: string;
  author?: { id: string; name: string | null; avatar_url: string | null };
  attachments?: NoteAttachment[];
}

interface NoteAttachment {
  id: string;
  note_id: string;
  attachment_type: string;
  title: string;
  url: string | null;
  file_path: string | null;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  description: string | null;
  created_at: string;
}

const NOTE_TYPES = [
  { value: "general", label: "General Note" },
  { value: "session_note", label: "Session Note" },
  { value: "observation", label: "Observation" },
  { value: "progress", label: "Progress Update" },
  { value: "concern", label: "Concern" },
  { value: "action_item", label: "Action Item" },
  { value: "milestone", label: "Milestone" },
];

const SENTIMENTS = [
  { value: "positive", label: "Positive", icon: ThumbsUp, color: "text-success" },
  { value: "neutral", label: "Neutral", icon: Minus, color: "text-muted-foreground" },
  { value: "negative", label: "Negative", icon: ThumbsDown, color: "text-destructive" },
  { value: "concern", label: "Concern", icon: AlertCircle, color: "text-warning" },
];

export default function ClientStaffNotes({
  clientUserId,
  enrollmentId,
  isAdmin = false,
}: ClientStaffNotesProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<StaffNote | null>(null);
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState<string>("all");
  const [showFlaggedOnly, setShowFlaggedOnly] = useState(false);

  const [form, setForm] = useState({
    title: "",
    content: "",
    note_type: "general",
    sentiment: "",
    tags: "",
    is_flagged: false,
    is_private: false,
  });

  const [attachments, setAttachments] = useState<
    { type: "link"; title: string; url: string; description: string }[]
  >([]);

  // Fetch notes
  const { data: notes, isLoading } = useQuery({
    queryKey: ["client-staff-notes", clientUserId, enrollmentId],
    queryFn: async () => {
      let query = supabase
        .from("client_staff_notes")
        .select("*")
        .eq("client_user_id", clientUserId)
        .order("created_at", { ascending: false });

      if (enrollmentId) {
        query = query.or(`enrollment_id.eq.${enrollmentId},enrollment_id.is.null`);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch author profiles and attachments
      const notesWithDetails = await Promise.all(
        (data || []).map(async (note) => {
          const { data: author } = await supabase
            .from("profiles")
            .select("id, name, avatar_url")
            .eq("id", note.author_id)
            .single();

          const { data: attachmentsData } = await supabase
            .from("client_staff_note_attachments")
            .select("*")
            .eq("note_id", note.id);

          return { ...note, author, attachments: attachmentsData || [] };
        }),
      );

      return notesWithDetails as StaffNote[];
    },
  });

  // Create note mutation
  const createNote = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      if (!form.title.trim()) throw new Error("Title is required");

      const { data: noteData, error: noteError } = await supabase
        .from("client_staff_notes")
        .insert({
          client_user_id: clientUserId,
          author_id: user.id,
          enrollment_id: enrollmentId || null,
          title: form.title.trim(),
          content: form.content.trim() || null,
          note_type: form.note_type,
          sentiment: form.sentiment || null,
          tags: form.tags
            ? form.tags
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean)
            : null,
          is_flagged: form.is_flagged,
          is_private: form.is_private,
        })
        .select()
        .single();

      if (noteError) throw noteError;

      // Add attachments
      if (attachments.length > 0 && noteData) {
        const attachmentInserts = attachments.map((att) => ({
          note_id: noteData.id,
          attachment_type: att.type,
          title: att.title,
          url: att.url,
          description: att.description || null,
        }));

        const { error: attError } = await supabase
          .from("client_staff_note_attachments")
          .insert(attachmentInserts);

        if (attError) throw attError;
      }

      return noteData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-staff-notes", clientUserId] });
      toast.success("Note added");
      resetForm();
      setDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to add note");
    },
  });

  // Update note mutation
  const updateNote = useMutation({
    mutationFn: async () => {
      if (!editingNote) throw new Error("No note to update");
      if (!form.title.trim()) throw new Error("Title is required");

      const { error } = await supabase
        .from("client_staff_notes")
        .update({
          title: form.title.trim(),
          content: form.content.trim() || null,
          note_type: form.note_type,
          sentiment: form.sentiment || null,
          tags: form.tags
            ? form.tags
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean)
            : null,
          is_flagged: form.is_flagged,
          is_private: form.is_private,
        })
        .eq("id", editingNote.id);

      if (error) throw error;

      // Handle attachments - for simplicity, delete old and add new
      await supabase.from("client_staff_note_attachments").delete().eq("note_id", editingNote.id);

      if (attachments.length > 0) {
        const attachmentInserts = attachments.map((att) => ({
          note_id: editingNote.id,
          attachment_type: att.type,
          title: att.title,
          url: att.url,
          description: att.description || null,
        }));

        await supabase.from("client_staff_note_attachments").insert(attachmentInserts);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-staff-notes", clientUserId] });
      toast.success("Note updated");
      resetForm();
      setDialogOpen(false);
      setEditingNote(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update note");
    },
  });

  // Delete note mutation
  const deleteNote = useMutation({
    mutationFn: async (noteId: string) => {
      const { error } = await supabase.from("client_staff_notes").delete().eq("id", noteId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-staff-notes", clientUserId] });
      toast.success("Note deleted");
    },
    onError: () => {
      toast.error("Failed to delete note");
    },
  });

  // Toggle flag mutation
  const toggleFlag = useMutation({
    mutationFn: async ({ noteId, isFlagged }: { noteId: string; isFlagged: boolean }) => {
      const { error } = await supabase
        .from("client_staff_notes")
        .update({ is_flagged: isFlagged })
        .eq("id", noteId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-staff-notes", clientUserId] });
    },
  });

  const resetForm = () => {
    setForm({
      title: "",
      content: "",
      note_type: "general",
      sentiment: "",
      tags: "",
      is_flagged: false,
      is_private: false,
    });
    setAttachments([]);
  };

  const handleEdit = (note: StaffNote) => {
    setEditingNote(note);
    setForm({
      title: note.title,
      content: note.content || "",
      note_type: note.note_type,
      sentiment: note.sentiment || "",
      tags: note.tags?.join(", ") || "",
      is_flagged: note.is_flagged,
      is_private: note.is_private,
    });
    setAttachments(
      (note.attachments || []).map((att) => ({
        type: "link" as const,
        title: att.title,
        url: att.url || "",
        description: att.description || "",
      })),
    );
    setDialogOpen(true);
  };

  const handleAddAttachment = () => {
    setAttachments([...attachments, { type: "link", title: "", url: "", description: "" }]);
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const handleAttachmentChange = (index: number, field: string, value: string) => {
    const updated = [...attachments];
    updated[index] = { ...updated[index], [field]: value };
    setAttachments(updated);
  };

  const toggleExpanded = (noteId: string) => {
    const newExpanded = new Set(expandedNotes);
    if (newExpanded.has(noteId)) {
      newExpanded.delete(noteId);
    } else {
      newExpanded.add(noteId);
    }
    setExpandedNotes(newExpanded);
  };

  const filteredNotes = notes?.filter((note) => {
    if (showFlaggedOnly && !note.is_flagged) return false;
    if (filterType !== "all" && note.note_type !== filterType) return false;
    return true;
  });

  const getSentimentIcon = (sentiment: string | null) => {
    const s = SENTIMENTS.find((s) => s.value === sentiment);
    if (!s) return null;
    const Icon = s.icon;
    return <Icon className={`h-4 w-4 ${s.color}`} />;
  };

  const canEditNote = (note: StaffNote) => {
    return isAdmin || note.author_id === user?.id;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Staff Notes
            </CardTitle>
            <CardDescription>
              Private notes about this client (not visible to the client)
            </CardDescription>
          </div>
          <Button
            size="sm"
            onClick={() => {
              resetForm();
              setEditingNote(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Note
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[150px] h-8 text-xs">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {NOTE_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant={showFlaggedOnly ? "default" : "outline"}
            size="sm"
            className="h-8 text-xs"
            onClick={() => setShowFlaggedOnly(!showFlaggedOnly)}
          >
            <Flag className="h-3 w-3 mr-1" />
            Flagged
          </Button>
          <span className="text-xs text-muted-foreground ml-auto">
            {filteredNotes?.length || 0} note{(filteredNotes?.length || 0) !== 1 ? "s" : ""}
          </span>
        </div>
      </CardHeader>

      <CardContent>
        {filteredNotes && filteredNotes.length > 0 ? (
          <ScrollArea className="max-h-[500px]">
            <div className="space-y-3">
              {filteredNotes.map((note) => (
                <Collapsible
                  key={note.id}
                  open={expandedNotes.has(note.id)}
                  onOpenChange={() => toggleExpanded(note.id)}
                >
                  <div className="border rounded-lg">
                    <CollapsibleTrigger asChild>
                      <div className="flex items-start gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors">
                        {expandedNotes.has(note.id) ? (
                          <ChevronDown className="h-4 w-4 mt-1 text-muted-foreground shrink-0" />
                        ) : (
                          <ChevronRight className="h-4 w-4 mt-1 text-muted-foreground shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium truncate">{note.title}</span>
                            {note.is_private && (
                              <Lock className="h-3 w-3 text-muted-foreground shrink-0" />
                            )}
                            {note.is_flagged && (
                              <Flag className="h-3 w-3 text-destructive shrink-0" />
                            )}
                            {getSentimentIcon(note.sentiment)}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 flex-wrap">
                            <Badge variant="outline" className="text-xs">
                              {NOTE_TYPES.find((t) => t.value === note.note_type)?.label ||
                                note.note_type}
                            </Badge>
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {note.author?.name || "Unknown"}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(note.created_at), "MMM d, yyyy h:mm a")}
                            </span>
                          </div>
                        </div>
                        {canEditNote(note) && (
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFlag.mutate({ noteId: note.id, isFlagged: !note.is_flagged });
                              }}
                            >
                              {note.is_flagged ? (
                                <FlagOff className="h-3 w-3" />
                              ) : (
                                <Flag className="h-3 w-3" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEdit(note);
                              }}
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm("Delete this note?")) deleteNote.mutate(note.id);
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="px-3 pb-3 pt-0 ml-7 border-t">
                        {note.content && (
                          <p className="text-sm whitespace-pre-wrap mt-3">{note.content}</p>
                        )}
                        {note.tags && note.tags.length > 0 && (
                          <div className="flex items-center gap-1 mt-3 flex-wrap">
                            <Tag className="h-3 w-3 text-muted-foreground" />
                            {note.tags.map((tag, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {note.attachments && note.attachments.length > 0 && (
                          <div className="mt-3 space-y-2">
                            <span className="text-xs font-medium text-muted-foreground">
                              Attachments
                            </span>
                            {note.attachments.map((att) => (
                              <a
                                key={att.id}
                                href={att.url || "#"}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-sm text-primary hover:underline"
                              >
                                <Link2 className="h-3 w-3" />
                                {att.title}
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            ))}
                          </div>
                        )}
                        {note.updated_at !== note.created_at && (
                          <p className="text-xs text-muted-foreground mt-3 pt-2 border-t">
                            Updated: {format(new Date(note.updated_at), "MMM d, yyyy h:mm a")}
                          </p>
                        )}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p>No notes yet</p>
            <p className="text-sm">Add private notes to track this client's progress</p>
          </div>
        )}
      </CardContent>

      {/* Add/Edit Note Dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditingNote(null);
            resetForm();
          }
        }}
      >
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingNote ? "Edit Note" : "Add Staff Note"}</DialogTitle>
            <DialogDescription>
              Private note about this client (not shared with the client)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="note-title">Title *</Label>
              <Input
                id="note-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Brief title for this note"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Note Type</Label>
                <Select
                  value={form.note_type}
                  onValueChange={(v) => setForm({ ...form, note_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {NOTE_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Sentiment</Label>
                <Select
                  value={form.sentiment}
                  onValueChange={(v) => setForm({ ...form, sentiment: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {SENTIMENTS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        <div className="flex items-center gap-2">
                          <s.icon className={`h-4 w-4 ${s.color}`} />
                          {s.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="note-content">Content</Label>
              <Textarea
                id="note-content"
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                placeholder="Detailed notes, observations, or feedback..."
                className="min-h-[120px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="note-tags">Tags (comma-separated)</Label>
              <Input
                id="note-tags"
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                placeholder="e.g., follow-up, coaching, performance"
              />
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is-private"
                  checked={form.is_private}
                  onChange={(e) => setForm({ ...form, is_private: e.target.checked })}
                  className="h-4 w-4 rounded border-input"
                />
                <Label htmlFor="is-private" className="flex items-center gap-1 cursor-pointer">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                  Private note (only visible to you and admins)
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is-flagged"
                  checked={form.is_flagged}
                  onChange={(e) => setForm({ ...form, is_flagged: e.target.checked })}
                  className="h-4 w-4 rounded border-input"
                />
                <Label htmlFor="is-flagged" className="flex items-center gap-1 cursor-pointer">
                  <Flag className="h-4 w-4 text-destructive" />
                  Flag as important
                </Label>
              </div>
            </div>

            {/* Attachments */}
            <div className="space-y-3 pt-3 border-t">
              <div className="flex items-center justify-between">
                <Label>Links & Attachments</Label>
                <Button type="button" variant="outline" size="sm" onClick={handleAddAttachment}>
                  <Link2 className="h-3 w-3 mr-1" />
                  Add Link
                </Button>
              </div>
              {attachments.map((att, index) => (
                <div key={index} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Link {index + 1}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-destructive"
                      onClick={() => handleRemoveAttachment(index)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  <Input
                    placeholder="Title"
                    value={att.title}
                    onChange={(e) => handleAttachmentChange(index, "title", e.target.value)}
                  />
                  <Input
                    placeholder="URL"
                    value={att.url}
                    onChange={(e) => handleAttachmentChange(index, "url", e.target.value)}
                  />
                  <Input
                    placeholder="Description (optional)"
                    value={att.description}
                    onChange={(e) => handleAttachmentChange(index, "description", e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                setEditingNote(null);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => (editingNote ? updateNote.mutate() : createNote.mutate())}
              disabled={!form.title.trim() || createNote.isPending || updateNote.isPending}
            >
              {(createNote.isPending || updateNote.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingNote ? "Save Changes" : "Add Note"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
