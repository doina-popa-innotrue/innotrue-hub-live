import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, Upload, Star, Copy, Image as ImageIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { validateFile, acceptStringForBucket } from "@/lib/fileValidation";
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

interface EmailAsset {
  id: string;
  name: string;
  description: string | null;
  file_path: string;
  file_url: string;
  mime_type: string | null;
  file_size: number | null;
  is_system_logo: boolean;
  created_at: string;
}

export default function EmailAssetsManagement() {
  const [assets, setAssets] = useState<EmailAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  async function fetchAssets() {
    const { data, error } = await supabase
      .from("email_template_assets")
      .select("*")
      .order("is_system_logo", { ascending: false })
      .order("name");

    if (error) {
      toast.error("Failed to load email assets");
      console.error(error);
    } else {
      setAssets((data || []) as EmailAsset[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchAssets();
  }, []);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const validation = validateFile(selectedFile, "email-assets");
      if (!validation.valid) {
        toast.error(validation.error);
        return;
      }
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
      if (!name) {
        setName(selectedFile.name.replace(/\.[^/.]+$/, ""));
      }
    }
  }

  async function handleUpload() {
    if (!file || !name.trim()) {
      toast.error("Please provide a name and select a file");
      return;
    }

    setUploading(true);
    try {
      // Generate unique file path
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `assets/${fileName}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("email-assets")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage.from("email-assets").getPublicUrl(filePath);

      // Save to database
      const { error: dbError } = await supabase.from("email_template_assets").insert({
        name: name.trim(),
        description: description.trim() || null,
        file_path: filePath,
        file_url: urlData.publicUrl,
        mime_type: file.type,
        file_size: file.size,
        is_system_logo: false,
      });

      if (dbError) throw dbError;

      toast.success("Asset uploaded successfully");
      setUploadOpen(false);
      resetForm();
      fetchAssets();
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(`Failed to upload asset: ${error.message}`);
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(asset: EmailAsset) {
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from("email-assets")
        .remove([asset.file_path]);

      if (storageError) {
        console.error("Storage delete error:", storageError);
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from("email_template_assets")
        .delete()
        .eq("id", asset.id);

      if (dbError) throw dbError;

      toast.success("Asset deleted successfully");
      fetchAssets();
    } catch (error: any) {
      toast.error(`Failed to delete asset: ${error.message}`);
    }
  }

  async function toggleSystemLogo(asset: EmailAsset) {
    try {
      // If setting as system logo, first unset all others
      if (!asset.is_system_logo) {
        await supabase
          .from("email_template_assets")
          .update({ is_system_logo: false })
          .eq("is_system_logo", true);
      }

      const { error } = await supabase
        .from("email_template_assets")
        .update({ is_system_logo: !asset.is_system_logo })
        .eq("id", asset.id);

      if (error) throw error;

      toast.success(asset.is_system_logo ? "Removed as system logo" : "Set as system logo");
      fetchAssets();
    } catch (error: any) {
      toast.error(`Failed to update asset: ${error.message}`);
    }
  }

  function copyImageTag(asset: EmailAsset) {
    const imgTag = `<img src="${asset.file_url}" alt="${asset.name}" style="max-width: 100%; height: auto;" />`;
    navigator.clipboard.writeText(imgTag);
    toast.success("Image tag copied to clipboard");
  }

  function resetForm() {
    setName("");
    setDescription("");
    setFile(null);
    setPreviewUrl(null);
  }

  function formatFileSize(bytes: number | null): string {
    if (!bytes) return "-";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  const systemLogo = assets.find((a) => a.is_system_logo);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Email Assets</h1>
          <p className="text-muted-foreground">Manage images for email templates</p>
        </div>
        <Dialog
          open={uploadOpen}
          onOpenChange={(open) => {
            setUploadOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Upload className="mr-2 h-4 w-4" />
              Upload Asset
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Image Asset</DialogTitle>
              <DialogDescription>
                Upload an image to use in email templates. Supports JPG, PNG, GIF (max 2MB).
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="file">Image File</Label>
                <Input id="file" type="file" accept={acceptStringForBucket("email-assets")} onChange={handleFileChange} />
                {previewUrl && (
                  <div className="mt-2 border rounded-lg p-2 bg-muted">
                    <img src={previewUrl} alt="Preview" className="max-h-32 mx-auto" />
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Asset name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of this asset"
                  rows={2}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setUploadOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleUpload} disabled={uploading || !file}>
                  {uploading ? "Uploading..." : "Upload"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* System Logo Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500" />
            System Logo
          </CardTitle>
          <CardDescription>
            The system logo can be inserted into email templates using the{" "}
            <code className="bg-muted px-1 rounded">{"{{systemLogo}}"}</code> variable.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {systemLogo ? (
            <div className="flex items-center gap-4">
              <div className="w-32 h-16 border rounded-lg flex items-center justify-center bg-muted overflow-hidden">
                <img
                  src={systemLogo.file_url}
                  alt={systemLogo.name}
                  className="max-w-full max-h-full object-contain"
                />
              </div>
              <div>
                <p className="font-medium">{systemLogo.name}</p>
                <p className="text-sm text-muted-foreground">
                  {systemLogo.description || "No description"}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">
              No system logo set. Upload an image and mark it as the system logo.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Assets Table */}
      <Card>
        <CardHeader>
          <CardTitle>Image Library</CardTitle>
          <CardDescription>All images available for use in email templates</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Preview</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assets.map((asset) => (
                <TableRow key={asset.id}>
                  <TableCell>
                    <div className="w-16 h-12 border rounded flex items-center justify-center bg-muted overflow-hidden">
                      <img
                        src={asset.file_url}
                        alt={asset.name}
                        className="max-w-full max-h-full object-contain"
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{asset.name}</span>
                      {asset.is_system_logo && (
                        <Badge variant="secondary" className="gap-1">
                          <Star className="h-3 w-3" />
                          Logo
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-[200px] truncate">
                    {asset.description || "-"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatFileSize(asset.file_size)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {asset.mime_type?.split("/")[1]?.toUpperCase() || "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyImageTag(asset)}
                        title="Copy image tag"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleSystemLogo(asset)}
                        title={
                          asset.is_system_logo ? "Remove as system logo" : "Set as system logo"
                        }
                        className={asset.is_system_logo ? "text-yellow-500" : ""}
                      >
                        <Star className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Asset</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{asset.name}"? This cannot be undone.
                              If this image is used in email templates, they will show broken
                              images.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(asset)}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {assets.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    <ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No email assets uploaded yet</p>
                    <p className="text-sm">Upload images to use in your email templates</p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
