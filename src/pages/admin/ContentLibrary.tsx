import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Package,
  Upload,
  Search,
  Trash2,
  Globe,
  Gamepad2,
  FileArchive,
  RefreshCw,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  useContentPackages,
  useContentPackage,
  useDeleteContentPackage,
  type ContentPackage,
} from "@/hooks/useContentPackages";
import { useQueryClient } from "@tanstack/react-query";

export default function ContentLibrary() {
  const { data: packages, isLoading } = useContentPackages();
  const deletePackage = useDeleteContentPackage();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [detailPackageId, setDetailPackageId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ContentPackage | null>(null);

  // Upload state
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Replace state
  const [replaceTarget, setReplaceTarget] = useState<ContentPackage | null>(null);
  const [replacing, setReplacing] = useState(false);
  const [replaceProgress, setReplaceProgress] = useState(0);
  const replaceFileInputRef = useRef<HTMLInputElement>(null);

  const filtered = (packages || []).filter((pkg) => {
    const matchesSearch =
      pkg.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (pkg.original_filename || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === "all" || pkg.package_type === typeFilter;
    return matchesSearch && matchesType;
  });

  const stats = {
    total: packages?.length || 0,
    web: packages?.filter((p) => p.package_type === "web").length || 0,
    xapi: packages?.filter((p) => p.package_type === "xapi").length || 0,
    modulesUsingShared: packages?.reduce((sum, p) => sum + (p.module_count || 0), 0) || 0,
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".zip")) {
      toast.error("Please upload a ZIP file");
      return;
    }

    if (!uploadTitle.trim()) {
      toast.error("Please enter a title for the content package");
      return;
    }

    setUploading(true);
    setUploadProgress(10);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error("Authentication required");
        return;
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", uploadTitle.trim());
      if (uploadDescription.trim()) {
        formData.append("description", uploadDescription.trim());
      }

      setUploadProgress(30);

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
      const response = await fetch(`${supabaseUrl}/functions/v1/upload-content-package`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      });

      setUploadProgress(80);
      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || "Upload failed");
        return;
      }

      setUploadProgress(100);
      toast.success(`Content package created (${result.files_uploaded} files extracted)`);
      setUploadDialogOpen(false);
      setUploadTitle("");
      setUploadDescription("");
      queryClient.invalidateQueries({ queryKey: ["content-packages"] });
      queryClient.invalidateQueries({ queryKey: ["content-packages-list"] });
    } catch {
      toast.error("Upload failed — check your connection");
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleReplace = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !replaceTarget) return;

    if (!file.name.endsWith(".zip")) {
      toast.error("Please upload a ZIP file");
      return;
    }

    setReplacing(true);
    setReplaceProgress(10);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error("Authentication required");
        return;
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("contentPackageId", replaceTarget.id);

      setReplaceProgress(30);

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
      const response = await fetch(`${supabaseUrl}/functions/v1/upload-content-package`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      });

      setReplaceProgress(80);
      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || "Replace failed");
        return;
      }

      setReplaceProgress(100);
      toast.success(
        `Content replaced (${result.files_uploaded} files). All ${replaceTarget.module_count || 0} linked modules will use the new version.`,
      );
      setReplaceTarget(null);
      queryClient.invalidateQueries({ queryKey: ["content-packages"] });
      queryClient.invalidateQueries({ queryKey: ["content-packages-list"] });
      queryClient.invalidateQueries({ queryKey: ["content-package", replaceTarget.id] });
    } catch {
      toast.error("Replace failed — check your connection");
    } finally {
      setReplacing(false);
      setReplaceProgress(0);
      if (replaceFileInputRef.current) replaceFileInputRef.current.value = "";
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    if ((deleteTarget.module_count || 0) > 0) {
      toast.error("Cannot delete — this package is still assigned to modules. Remove it from all modules first.");
      setDeleteTarget(null);
      return;
    }

    try {
      await deletePackage.mutateAsync(deleteTarget.id);
      toast.success("Content package deleted");
    } catch {
      toast.error("Failed to delete content package");
    } finally {
      setDeleteTarget(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Package className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Content Library</h1>
            <p className="text-muted-foreground">
              Upload Rise content once, assign to multiple modules across programs
            </p>
          </div>
        </div>
        <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Upload className="mr-2 h-4 w-4" />
              Upload Package
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Content Package</DialogTitle>
              <DialogDescription>
                Upload a Rise ZIP export. It will be stored in the shared content library and can be
                assigned to any module.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Title *</Label>
                <Input
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="e.g., Module 1 — Leadership Fundamentals"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  placeholder="Optional description..."
                />
              </div>
              <div className="space-y-2">
                <Label>ZIP File *</Label>
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading || !uploadTitle.trim()}
                  >
                    <FileArchive className="mr-2 h-4 w-4" />
                    {uploading ? "Uploading..." : "Select ZIP"}
                  </Button>
                  <p className="text-xs text-muted-foreground">Rise Web or xAPI export, up to 500 MB</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".zip"
                  className="hidden"
                  onChange={handleUpload}
                />
                {uploading && (
                  <div className="space-y-1">
                    <Progress value={uploadProgress} />
                    <p className="text-xs text-muted-foreground text-center">
                      {uploadProgress < 30
                        ? "Preparing..."
                        : uploadProgress < 80
                          ? "Uploading and extracting..."
                          : "Finalizing..."}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Packages
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Web Packages</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-blue-500" />
              <p className="text-2xl font-bold">{stats.web}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              xAPI Packages
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Gamepad2 className="h-5 w-5 text-green-500" />
              <p className="text-2xl font-bold">{stats.xapi}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Modules Using Shared Content
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.modulesUsingShared}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by title or filename..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="web">Web</SelectItem>
            <SelectItem value="xapi">xAPI</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Packages Table */}
      <Card>
        <CardHeader>
          <CardTitle>Content Packages</CardTitle>
          <CardDescription>
            Each package can be assigned to multiple modules across different programs
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {searchQuery || typeFilter !== "all"
                ? "No packages match your filters"
                : "No content packages uploaded yet. Click 'Upload Package' to get started."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Files</TableHead>
                  <TableHead>Modules</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead>By</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((pkg) => (
                  <TableRow key={pkg.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{pkg.title}</p>
                        {pkg.original_filename && (
                          <p className="text-xs text-muted-foreground">{pkg.original_filename}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={pkg.package_type === "xapi" ? "default" : "secondary"}>
                        {pkg.package_type === "xapi" ? "xAPI" : "Web"}
                      </Badge>
                    </TableCell>
                    <TableCell>{pkg.file_count}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{pkg.module_count || 0}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(pkg.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {pkg.uploader_name || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDetailPackageId(pkg.id)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setReplaceTarget(pkg)}
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteTarget(pkg)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
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

      {/* Detail Dialog */}
      <PackageDetailDialog
        packageId={detailPackageId}
        onClose={() => setDetailPackageId(null)}
      />

      {/* Replace Dialog */}
      <Dialog open={!!replaceTarget} onOpenChange={(open) => !open && setReplaceTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Replace Content Package</DialogTitle>
            <DialogDescription>
              Upload a new ZIP to replace "{replaceTarget?.title}". All{" "}
              {replaceTarget?.module_count || 0} linked modules will automatically use the new
              version.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => replaceFileInputRef.current?.click()}
                disabled={replacing}
              >
                <FileArchive className="mr-2 h-4 w-4" />
                {replacing ? "Replacing..." : "Select New ZIP"}
              </Button>
              <p className="text-xs text-muted-foreground">Rise Web or xAPI export, up to 500 MB</p>
            </div>
            <input
              ref={replaceFileInputRef}
              type="file"
              accept=".zip"
              className="hidden"
              onChange={handleReplace}
            />
            {replacing && (
              <div className="space-y-1">
                <Progress value={replaceProgress} />
                <p className="text-xs text-muted-foreground text-center">
                  {replaceProgress < 30
                    ? "Preparing..."
                    : replaceProgress < 80
                      ? "Uploading and extracting..."
                      : "Finalizing..."}
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Content Package?</AlertDialogTitle>
            <AlertDialogDescription>
              {(deleteTarget?.module_count || 0) > 0
                ? `This package is assigned to ${deleteTarget?.module_count} module(s). Remove it from all modules before deleting.`
                : `This will permanently remove "${deleteTarget?.title}" from the content library.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={(deleteTarget?.module_count || 0) > 0}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/**
 * Dialog showing which modules use a specific content package.
 */
function PackageDetailDialog({
  packageId,
  onClose,
}: {
  packageId: string | null;
  onClose: () => void;
}) {
  const { data: pkg, isLoading } = useContentPackage(packageId || undefined);

  return (
    <Dialog open={!!packageId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{pkg?.title || "Content Package"}</DialogTitle>
          <DialogDescription>
            {pkg?.description || "Modules using this shared content package"}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
          </div>
        ) : pkg?.modules && pkg.modules.length > 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Used by {pkg.modules.length} module{pkg.modules.length !== 1 ? "s" : ""}:
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Module</TableHead>
                  <TableHead>Program</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pkg.modules.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.title}</TableCell>
                    <TableCell className="text-muted-foreground">{m.program_name}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Not assigned to any modules yet. Assign it via the module edit form.
          </p>
        )}

        <DialogFooter>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant={pkg?.package_type === "xapi" ? "default" : "secondary"}>
              {pkg?.package_type === "xapi" ? "xAPI" : "Web"}
            </Badge>
            <span>{pkg?.file_count} files</span>
            {pkg?.original_filename && <span>({pkg.original_filename})</span>}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
