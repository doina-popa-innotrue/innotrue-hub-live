import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2, ExternalLink } from "lucide-react";
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

interface LucidMapping {
  id: string;
  user_id: string;
  lucid_email: string;
  lucid_url: string;
  created_at: string;
  user_name?: string;
  user_email?: string;
}

export default function LucidManagement() {
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingMapping, setEditingMapping] = useState<LucidMapping | null>(null);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [lucidEmail, setLucidEmail] = useState("");
  const [lucidUrl, setLucidUrl] = useState("https://lucid.app");

  // Fetch all Lucid mappings with user details
  const { data: mappings, isLoading: mappingsLoading } = useQuery({
    queryKey: ["lucid-mappings"],
    queryFn: async () => {
      const { data: lucidUsers, error } = await supabase
        .from("lucid_users")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch user profiles for each mapping (using username which is synced with email)
      const mappingsWithUsers = await Promise.all(
        (lucidUsers || []).map(async (mapping) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("name, username")
            .eq("id", mapping.user_id)
            .single();

          return {
            ...mapping,
            user_name: profile?.name || "Unknown",
            user_email: profile?.username || "Unknown",
          };
        }),
      );

      return mappingsWithUsers as LucidMapping[];
    },
  });

  // Fetch all users (for dropdown)
  const { data: allUsers } = useQuery({
    queryKey: ["all-users-for-lucid"],
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("id, name")
        .order("name");

      if (error) throw error;
      return profiles;
    },
  });

  // Get unmapped users
  const mappedUserIds = mappings?.map((m) => m.user_id) || [];
  const unmappedUsers = allUsers?.filter((u) => !mappedUserIds.includes(u.id)) || [];

  // Add mapping mutation
  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("lucid_users").insert({
        user_id: selectedUserId,
        lucid_email: lucidEmail,
        lucid_url: lucidUrl || "https://lucid.app",
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lucid-mappings"] });
      toast.success("Lucid mapping added");
      resetForm();
      setIsAddDialogOpen(false);
    },
    onError: (error) => {
      console.error("Error adding mapping:", error);
      toast.error("Failed to add mapping");
    },
  });

  // Update mapping mutation
  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingMapping) return;

      const { error } = await supabase
        .from("lucid_users")
        .update({
          lucid_email: lucidEmail,
          lucid_url: lucidUrl || "https://lucid.app",
        })
        .eq("id", editingMapping.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lucid-mappings"] });
      toast.success("Lucid mapping updated");
      resetForm();
      setEditingMapping(null);
    },
    onError: (error) => {
      console.error("Error updating mapping:", error);
      toast.error("Failed to update mapping");
    },
  });

  // Delete mapping mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lucid_users").delete().eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lucid-mappings"] });
      toast.success("Lucid mapping deleted");
    },
    onError: (error) => {
      console.error("Error deleting mapping:", error);
      toast.error("Failed to delete mapping");
    },
  });

  const resetForm = () => {
    setSelectedUserId("");
    setLucidEmail("");
    setLucidUrl("https://lucid.app");
  };

  const handleEdit = (mapping: LucidMapping) => {
    setEditingMapping(mapping);
    setLucidEmail(mapping.lucid_email);
    setLucidUrl(mapping.lucid_url || "https://lucid.app");
  };

  const handleSubmit = () => {
    if (editingMapping) {
      updateMutation.mutate();
    } else {
      addMutation.mutate();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Lucid Management</h1>
          <p className="text-muted-foreground">
            Manage user connections to Lucid (LucidChart, LucidSpark)
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Add Mapping
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Lucid Mapping</DialogTitle>
              <DialogDescription>Link a user to their Lucid account</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>User</Label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a user" />
                  </SelectTrigger>
                  <SelectContent>
                    {unmappedUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Lucid Email</Label>
                <Input
                  type="email"
                  value={lucidEmail}
                  onChange={(e) => setLucidEmail(e.target.value)}
                  placeholder="user@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Lucid URL (optional)</Label>
                <Input
                  type="url"
                  value={lucidUrl}
                  onChange={(e) => setLucidUrl(e.target.value)}
                  placeholder="https://lucid.app"
                />
                <p className="text-sm text-muted-foreground">
                  Custom Lucid workspace URL if different from default
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!selectedUserId || !lucidEmail || addMutation.isPending}
              >
                {addMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Add Mapping
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>User Mappings</CardTitle>
          <CardDescription>Users linked to their Lucid accounts</CardDescription>
        </CardHeader>
        <CardContent>
          {mappingsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : mappings?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No Lucid mappings found. Add a mapping to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Lucid Email</TableHead>
                  <TableHead>Lucid URL</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mappings?.map((mapping) => (
                  <TableRow key={mapping.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{mapping.user_name}</div>
                        <div className="text-sm text-muted-foreground">{mapping.user_email}</div>
                      </div>
                    </TableCell>
                    <TableCell>{mapping.lucid_email}</TableCell>
                    <TableCell>
                      <a
                        href={mapping.lucid_url || "https://lucid.app"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-primary hover:underline"
                      >
                        {mapping.lucid_url || "https://lucid.app"}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </TableCell>
                    <TableCell>{new Date(mapping.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Dialog
                          open={editingMapping?.id === mapping.id}
                          onOpenChange={(open) => !open && setEditingMapping(null)}
                        >
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(mapping)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Edit Lucid Mapping</DialogTitle>
                              <DialogDescription>
                                Update Lucid account details for {mapping.user_name}
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div className="space-y-2">
                                <Label>Lucid Email</Label>
                                <Input
                                  type="email"
                                  value={lucidEmail}
                                  onChange={(e) => setLucidEmail(e.target.value)}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Lucid URL (optional)</Label>
                                <Input
                                  type="url"
                                  value={lucidUrl}
                                  onChange={(e) => setLucidUrl(e.target.value)}
                                  placeholder="https://lucid.app"
                                />
                              </div>
                            </div>
                            <DialogFooter>
                              <Button variant="outline" onClick={() => setEditingMapping(null)}>
                                Cancel
                              </Button>
                              <Button
                                onClick={handleSubmit}
                                disabled={!lucidEmail || updateMutation.isPending}
                              >
                                {updateMutation.isPending && (
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                )}
                                Save Changes
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Mapping</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to remove the Lucid mapping for{" "}
                                {mapping.user_name}? This will disconnect their account from Lucid.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteMutation.mutate(mapping.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
