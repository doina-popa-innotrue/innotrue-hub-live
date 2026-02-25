import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Upload, Trash2, Plus, Award, ExternalLink, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
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
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { validateFile, acceptStringForBucket } from "@/lib/fileValidation";

interface ProgramBadge {
  id: string;
  program_id: string;
  name: string;
  description: string | null;
  image_path: string | null;
  is_active: boolean;
  renewal_period_months: number | null;
  created_at: string;
  program_badge_credentials: ProgramBadgeCredential[];
}

interface ProgramBadgeCredential {
  id: string;
  service_name: string;
  service_display_name: string | null;
  credential_template_url: string | null;
}

interface Props {
  programId: string;
  programName: string;
}

export default function ProgramBadgeManager({ programId, programName }: Props) {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    is_active: true,
    renewal_period_months: "" as string,
  });

  const [credentials, setCredentials] = useState<
    Array<{
      service_name: string;
      service_display_name: string;
      credential_template_url: string;
    }>
  >([]);

  const [newCredential, setNewCredential] = useState({
    service_name: "",
    service_display_name: "",
    credential_template_url: "",
  });

  const { data: badge, isLoading } = useQuery({
    queryKey: ["program-badge", programId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("program_badges")
        .select(
          `
          *,
          program_badge_credentials (*)
        `,
        )
        .eq("program_id", programId)
        .maybeSingle();

      if (error) throw error;
      return data as ProgramBadge | null;
    },
  });

  const createBadgeMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const renewalMonths = data.renewal_period_months ? parseInt(data.renewal_period_months, 10) : null;
      const { data: newBadge, error } = await supabase
        .from("program_badges")
        .insert({
          program_id: programId,
          name: data.name,
          description: data.description || null,
          is_active: data.is_active,
          renewal_period_months: renewalMonths,
        })
        .select()
        .single();

      if (error) throw error;

      // Add credentials if any
      if (credentials.length > 0) {
        const { error: credError } = await supabase.from("program_badge_credentials").insert(
          credentials.map((cred) => ({
            program_badge_id: newBadge.id,
            service_name: cred.service_name,
            service_display_name: cred.service_display_name || null,
            credential_template_url: cred.credential_template_url || null,
          })),
        );

        if (credError) throw credError;
      }

      return newBadge;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["program-badge", programId] });
      toast.success("Badge created successfully");
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(`Failed to create badge: ${error.message}`);
    },
  });

  const updateBadgeMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!badge) return;

      const renewalMonths = data.renewal_period_months ? parseInt(data.renewal_period_months, 10) : null;
      const { error } = await supabase
        .from("program_badges")
        .update({
          name: data.name,
          description: data.description || null,
          is_active: data.is_active,
          renewal_period_months: renewalMonths,
        })
        .eq("id", badge.id);

      if (error) throw error;

      // Update credentials - delete existing and insert new
      await supabase.from("program_badge_credentials").delete().eq("program_badge_id", badge.id);

      if (credentials.length > 0) {
        const { error: credError } = await supabase.from("program_badge_credentials").insert(
          credentials.map((cred) => ({
            program_badge_id: badge.id,
            service_name: cred.service_name,
            service_display_name: cred.service_display_name || null,
            credential_template_url: cred.credential_template_url || null,
          })),
        );

        if (credError) throw credError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["program-badge", programId] });
      toast.success("Badge updated successfully");
      setIsDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(`Failed to update badge: ${error.message}`);
    },
  });

  const deleteBadgeMutation = useMutation({
    mutationFn: async () => {
      if (!badge) return;

      // Delete image from storage if exists
      if (badge.image_path) {
        await supabase.storage.from("program-logos").remove([badge.image_path]);
      }

      const { error } = await supabase.from("program_badges").delete().eq("id", badge.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["program-badge", programId] });
      toast.success("Badge deleted successfully");
      setShowDeleteDialog(false);
    },
    onError: (error: any) => {
      toast.error(`Failed to delete badge: ${error.message}`);
    },
  });

  const resetForm = () => {
    setFormData({ name: "", description: "", is_active: true, renewal_period_months: "" });
    setCredentials([]);
    setNewCredential({ service_name: "", service_display_name: "", credential_template_url: "" });
  };

  const handleEditOpen = () => {
    if (badge) {
      setFormData({
        name: badge.name,
        description: badge.description || "",
        is_active: badge.is_active,
        renewal_period_months: badge.renewal_period_months?.toString() || "",
      });
      setCredentials(
        badge.program_badge_credentials.map((c) => ({
          service_name: c.service_name,
          service_display_name: c.service_display_name || "",
          credential_template_url: c.credential_template_url || "",
        })),
      );
    }
    setIsDialogOpen(true);
  };

  const handleCreateOpen = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const addCredential = () => {
    if (!newCredential.service_name.trim()) {
      toast.error("Please enter a service name");
      return;
    }
    setCredentials([...credentials, { ...newCredential }]);
    setNewCredential({ service_name: "", service_display_name: "", credential_template_url: "" });
  };

  const removeCredential = (index: number) => {
    setCredentials(credentials.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Please enter a badge name");
      return;
    }

    if (badge) {
      updateBadgeMutation.mutate(formData);
    } else {
      createBadgeMutation.mutate(formData);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !badge) return;

    const validation = validateFile(file, "program-logos");
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    setUploading(true);

    try {
      // Delete old image if exists
      if (badge.image_path) {
        await supabase.storage.from("program-logos").remove([badge.image_path]);
      }

      // Upload new image
      const fileExt = file.name.split(".").pop();
      const fileName = `badge-${Date.now()}.${fileExt}`;
      const filePath = `${programId}/badges/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("program-logos")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Update badge with image path
      const { error: updateError } = await supabase
        .from("program_badges")
        .update({ image_path: filePath })
        .eq("id", badge.id);

      if (updateError) throw updateError;

      toast.success("Badge image uploaded successfully");
      queryClient.invalidateQueries({ queryKey: ["program-badge", programId] });
    } catch (error: any) {
      toast.error(`Failed to upload image: ${error.message}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const removeImage = async () => {
    if (!badge?.image_path) return;

    try {
      await supabase.storage.from("program-logos").remove([badge.image_path]);

      const { error } = await supabase
        .from("program_badges")
        .update({ image_path: null })
        .eq("id", badge.id);

      if (error) throw error;

      toast.success("Badge image removed");
      queryClient.invalidateQueries({ queryKey: ["program-badge", programId] });
    } catch (error: any) {
      toast.error(`Failed to remove image: ${error.message}`);
    }
  };

  const getPublicUrl = (path: string) => {
    const { data } = supabase.storage.from("program-logos").getPublicUrl(path);
    return data.publicUrl;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="h-5 w-5" />
          Program Badge
        </CardTitle>
        <CardDescription>Configure a completion badge for this program</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {badge ? (
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              {badge.image_path ? (
                <div className="relative group">
                  <img
                    src={getPublicUrl(badge.image_path)}
                    alt={badge.name}
                    className="w-24 h-24 object-contain rounded-lg border"
                  />
                  <Button
                    size="icon"
                    variant="destructive"
                    className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={removeImage}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div className="w-24 h-24 border-2 border-dashed rounded-lg flex items-center justify-center bg-muted/50">
                  <Award className="h-8 w-8 text-muted-foreground" />
                </div>
              )}

              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{badge.name}</h3>
                  {badge.is_active ? (
                    <Badge variant="default">Active</Badge>
                  ) : (
                    <Badge variant="secondary">Inactive</Badge>
                  )}
                </div>
                {badge.description && (
                  <p className="text-sm text-muted-foreground">{badge.description}</p>
                )}
                {badge.renewal_period_months && (
                  <p className="text-xs text-muted-foreground">
                    Renewal: every {badge.renewal_period_months} month{badge.renewal_period_months !== 1 ? "s" : ""}
                  </p>
                )}

                {badge.program_badge_credentials.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {badge.program_badge_credentials.map((cred) => (
                      <Badge key={cred.id} variant="outline" className="gap-1">
                        <ExternalLink className="h-3 w-3" />
                        {cred.service_display_name || cred.service_name}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept={acceptStringForBucket("program-logos")}
                onChange={handleImageUpload}
                className="hidden"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                {badge.image_path ? "Change Image" : "Upload Image"}
              </Button>
              <Button variant="outline" size="sm" onClick={handleEditOpen}>
                Edit Badge
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-6">
            <Award className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">No badge configured for this program</p>
            <Button onClick={handleCreateOpen}>
              <Plus className="h-4 w-4 mr-2" />
              Create Badge
            </Button>
          </div>
        )}

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{badge ? "Edit Badge" : "Create Badge"}</DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Badge Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Program Completion Badge"
                    maxLength={100}
                  />
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Describe what this badge represents..."
                    rows={3}
                    maxLength={500}
                  />
                </div>

                <div>
                  <Label htmlFor="renewal_period_months">Renewal Period (months)</Label>
                  <Input
                    id="renewal_period_months"
                    type="number"
                    min={1}
                    max={120}
                    value={formData.renewal_period_months}
                    onChange={(e) => setFormData({ ...formData, renewal_period_months: e.target.value })}
                    placeholder="Leave empty for non-expiring badges"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    How long the badge is valid after issuance. Leave empty for non-expiring badges.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                  <Label htmlFor="is_active">Active</Label>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>External Credential Services</Label>
                </div>

                {credentials.length > 0 && (
                  <div className="space-y-2">
                    {credentials.map((cred, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg"
                      >
                        <div className="flex-1">
                          <p className="font-medium text-sm">
                            {cred.service_display_name || cred.service_name}
                          </p>
                          {cred.credential_template_url && (
                            <p className="text-xs text-muted-foreground truncate">
                              {cred.credential_template_url}
                            </p>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeCredential(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <Card>
                  <CardContent className="pt-4 space-y-3">
                    <div>
                      <Label htmlFor="service_name">Service Name</Label>
                      <Input
                        id="service_name"
                        value={newCredential.service_name}
                        onChange={(e) =>
                          setNewCredential({ ...newCredential, service_name: e.target.value })
                        }
                        placeholder="e.g., credly, accredible"
                      />
                    </div>
                    <div>
                      <Label htmlFor="service_display_name">Display Name</Label>
                      <Input
                        id="service_display_name"
                        value={newCredential.service_display_name}
                        onChange={(e) =>
                          setNewCredential({
                            ...newCredential,
                            service_display_name: e.target.value,
                          })
                        }
                        placeholder="e.g., Credly"
                      />
                    </div>
                    <div>
                      <Label htmlFor="credential_url">Credential Template URL</Label>
                      <Input
                        id="credential_url"
                        value={newCredential.credential_template_url}
                        onChange={(e) =>
                          setNewCredential({
                            ...newCredential,
                            credential_template_url: e.target.value,
                          })
                        }
                        placeholder="https://..."
                      />
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={addCredential}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Credential Service
                    </Button>
                  </CardContent>
                </Card>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createBadgeMutation.isPending || updateBadgeMutation.isPending}
                >
                  {(createBadgeMutation.isPending || updateBadgeMutation.isPending) && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  {badge ? "Update Badge" : "Create Badge"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Badge?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the badge and all associated credentials. This action
                cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteBadgeMutation.mutate()}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
