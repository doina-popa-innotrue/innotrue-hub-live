import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Pencil, Eye, Trash2, Check, Shield, History } from "lucide-react";
import DOMPurify from "dompurify";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ProgramTerms {
  id: string;
  program_id: string;
  version: number;
  title: string;
  content_html: string;
  is_current: boolean;
  is_blocking_on_first_access: boolean;
  is_blocking_on_update: boolean;
  effective_from: string;
  created_at: string;
  updated_at: string;
}

interface ProgramTermsManagerProps {
  programId: string;
}

export function ProgramTermsManager({ programId }: ProgramTermsManagerProps) {
  const [terms, setTerms] = useState<ProgramTerms[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingTerm, setEditingTerm] = useState<ProgramTerms | null>(null);
  const [previewTerm, setPreviewTerm] = useState<ProgramTerms | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [acceptanceStats, setAcceptanceStats] = useState<Record<string, number>>({});

  // Form state
  const [title, setTitle] = useState("");
  const [contentHtml, setContentHtml] = useState("");
  const [isBlockingOnFirstAccess, setIsBlockingOnFirstAccess] = useState(true);
  const [isBlockingOnUpdate, setIsBlockingOnUpdate] = useState(false);
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [isCurrent, setIsCurrent] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchTerms();
  }, [programId]);

  async function fetchTerms() {
    try {
      const { data, error } = await supabase
        .from("program_terms")
        .select("*")
        .eq("program_id", programId)
        .order("version", { ascending: false });

      if (error) throw error;
      setTerms(data || []);

      // Fetch acceptance stats for each term
      if (data && data.length > 0) {
        const stats: Record<string, number> = {};
        for (const term of data) {
          const { count } = await supabase
            .from("user_program_terms_acceptance")
            .select("*", { count: "exact", head: true })
            .eq("program_terms_id", term.id);
          stats[term.id] = count || 0;
        }
        setAcceptanceStats(stats);
      }
    } catch (error: any) {
      console.error("Error fetching terms:", error);
      toast.error("Failed to load terms");
    } finally {
      setLoading(false);
    }
  }

  function openCreateDialog() {
    setEditingTerm(null);
    setTitle("");
    setContentHtml("");
    setIsBlockingOnFirstAccess(true);
    setIsBlockingOnUpdate(false);
    setEffectiveFrom(new Date().toISOString().split("T")[0]);
    setIsCurrent(terms.length === 0);
    setOpenDialog(true);
  }

  function openEditDialog(term: ProgramTerms) {
    setEditingTerm(term);
    setTitle(term.title);
    setContentHtml(term.content_html);
    setIsBlockingOnFirstAccess(term.is_blocking_on_first_access);
    setIsBlockingOnUpdate(term.is_blocking_on_update);
    setEffectiveFrom(term.effective_from.split("T")[0]);
    setIsCurrent(term.is_current);
    setOpenDialog(true);
  }

  async function handleSave() {
    if (!title.trim() || !contentHtml.trim()) {
      toast.error("Please fill in title and content");
      return;
    }

    setSaving(true);
    try {
      if (editingTerm) {
        // Update existing term
        const { error } = await supabase
          .from("program_terms")
          .update({
            title,
            content_html: contentHtml,
            is_blocking_on_first_access: isBlockingOnFirstAccess,
            is_blocking_on_update: isBlockingOnUpdate,
            effective_from: effectiveFrom,
            is_current: isCurrent,
          })
          .eq("id", editingTerm.id);

        if (error) throw error;
        toast.success("Terms updated successfully");
      } else {
        // Create new term - calculate next version
        const maxVersion = terms.length > 0 ? Math.max(...terms.map((t) => t.version)) : 0;

        const { error } = await supabase.from("program_terms").insert({
          program_id: programId,
          version: maxVersion + 1,
          title,
          content_html: contentHtml,
          is_blocking_on_first_access: isBlockingOnFirstAccess,
          is_blocking_on_update: isBlockingOnUpdate,
          effective_from: effectiveFrom,
          is_current: isCurrent,
        });

        if (error) throw error;
        toast.success("Terms created successfully");
      }

      setOpenDialog(false);
      fetchTerms();
    } catch (error: any) {
      console.error("Error saving terms:", error);
      toast.error("Failed to save terms");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(termId: string) {
    try {
      const { error } = await supabase.from("program_terms").delete().eq("id", termId);

      if (error) throw error;
      toast.success("Terms deleted successfully");
      setDeleteConfirm(null);
      fetchTerms();
    } catch (error: any) {
      console.error("Error deleting terms:", error);
      toast.error("Failed to delete terms");
    }
  }

  async function setAsCurrent(termId: string) {
    try {
      const { error } = await supabase
        .from("program_terms")
        .update({ is_current: true })
        .eq("id", termId);

      if (error) throw error;
      toast.success("Terms set as current");
      fetchTerms();
    } catch (error: any) {
      console.error("Error setting current terms:", error);
      toast.error("Failed to update terms");
    }
  }

  if (loading) {
    return <div className="text-center py-4">Loading terms...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Terms & Conditions</CardTitle>
              <CardDescription>Manage T&Cs that clients must accept</CardDescription>
            </div>
          </div>
          <Button onClick={openCreateDialog} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Version
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {terms.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No terms and conditions defined</p>
            <p className="text-sm mt-1">Create your first version to require client acceptance</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Version</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Blocking</TableHead>
                <TableHead>Acceptances</TableHead>
                <TableHead>Effective From</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {terms.map((term) => (
                <TableRow key={term.id}>
                  <TableCell>
                    <Badge variant="outline">v{term.version}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">{term.title}</TableCell>
                  <TableCell>
                    {term.is_current ? (
                      <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                        <Check className="h-3 w-3 mr-1" />
                        Current
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Archived</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1 text-xs">
                      {term.is_blocking_on_first_access && (
                        <span className="text-primary">First access</span>
                      )}
                      {term.is_blocking_on_update && (
                        <span className="text-orange-500">On update</span>
                      )}
                      {!term.is_blocking_on_first_access && !term.is_blocking_on_update && (
                        <span className="text-muted-foreground">Non-blocking</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{acceptanceStats[term.id] || 0}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(term.effective_from).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setPreviewTerm(term)}
                        title="Preview"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => openEditDialog(term)}
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {!term.is_current && (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setAsCurrent(term.id)}
                            title="Set as current"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setDeleteConfirm(term.id)}
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Create/Edit Dialog */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="max-w-2xl h-[90vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle>
              {editingTerm
                ? `Edit Terms (Version ${editingTerm.version})`
                : "Create New Terms Version"}
            </DialogTitle>
            <DialogDescription>
              {editingTerm
                ? "Update this version of terms and conditions"
                : "Create a new version of terms and conditions for this program"}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 pr-3">
            <div className="space-y-4 pr-1">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Program Terms and Conditions"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="content">Content</Label>
                <RichTextEditor
                  value={contentHtml}
                  onChange={setContentHtml}
                  placeholder="Enter terms content..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="effective-date">Effective From</Label>
                <Input
                  id="effective-date"
                  type="date"
                  value={effectiveFrom}
                  onChange={(e) => setEffectiveFrom(e.target.value)}
                />
              </div>

              <div className="space-y-4 border rounded-lg p-4">
                <Label className="text-base font-medium">Blocking Settings</Label>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Block on First Access</p>
                    <p className="text-xs text-muted-foreground">
                      Require new users to accept before accessing program content
                    </p>
                  </div>
                  <Switch
                    checked={isBlockingOnFirstAccess}
                    onCheckedChange={setIsBlockingOnFirstAccess}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Block on Update</p>
                    <p className="text-xs text-muted-foreground">
                      Require existing users to accept updated terms before continuing
                    </p>
                  </div>
                  <Switch checked={isBlockingOnUpdate} onCheckedChange={setIsBlockingOnUpdate} />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Set as Current Version</p>
                    <p className="text-xs text-muted-foreground">
                      Make this the active version shown to users
                    </p>
                  </div>
                  <Switch checked={isCurrent} onCheckedChange={setIsCurrent} />
                </div>
              </div>
            </div>
          </ScrollArea>

          <div className="shrink-0 flex justify-end gap-2 pt-3 border-t">
            <Button variant="outline" onClick={() => setOpenDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editingTerm ? "Update" : "Create"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewTerm} onOpenChange={() => setPreviewTerm(null)}>
        <DialogContent className="max-w-2xl h-[90vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle>{previewTerm?.title}</DialogTitle>
            <DialogDescription>
              Version {previewTerm?.version} • Effective from{" "}
              {previewTerm && new Date(previewTerm.effective_from).toLocaleDateString()}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 w-full rounded-md border p-4">
            <div
              className="prose prose-sm max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(previewTerm?.content_html || ""),
              }}
            />
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Terms Version?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this version of terms. This action cannot be undone. Any
              acceptance records for this version will also be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
