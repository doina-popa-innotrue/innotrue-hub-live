import { useEffect, useState } from "react";
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Link2, UserPlus, Pencil, Trash2, RefreshCw, Info } from "lucide-react";

interface UserMapping {
  id: string;
  user_id: string;
  talentlms_user_id: string;
  talentlms_username: string;
  created_at: string;
  profiles?: {
    name: string;
  };
}

interface User {
  id: string;
  email: string;
  name?: string;
}

export default function TalentLmsUsers() {
  const [mappings, setMappings] = useState<UserMapping[]>([]);
  const [allProfiles, setAllProfiles] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMapping, setEditingMapping] = useState<UserMapping | null>(null);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [talentlmsUserId, setTalentlmsUserId] = useState("");
  const [talentlmsUsername, setTalentlmsUsername] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);

    // Fetch all mappings
    const { data: mappingsData, error: mappingsError } = await supabase
      .from("talentlms_users")
      .select("*")
      .order("created_at", { ascending: false });

    if (mappingsError) {
      toast.error("Failed to load InnoTrue Academy mappings");
      console.error(mappingsError);
      setLoading(false);
      return;
    }

    // Fetch profiles for the mapped users
    const userIds = mappingsData?.map((m) => m.user_id) || [];
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("id, name")
      .in("id", userIds);

    const profilesMap = new Map(profilesData?.map((p) => [p.id, p]) || []);

    const enrichedMappings =
      mappingsData?.map((mapping) => ({
        ...mapping,
        profiles: profilesMap.get(mapping.user_id),
      })) || [];

    setMappings(enrichedMappings as UserMapping[]);

    // Fetch all profiles for dropdown
    const { data: allProfilesData } = await supabase
      .from("profiles")
      .select("id, name")
      .order("name");

    setAllProfiles(allProfilesData || []);

    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const userId = editingMapping ? editingMapping.user_id : selectedUserId;

    if (!userId || !talentlmsUsername) {
      toast.error("Please fill in username");
      return;
    }

    if (editingMapping) {
      // Update existing mapping
      const { error } = await supabase
        .from("talentlms_users")
        .update({
          talentlms_user_id: talentlmsUserId,
          talentlms_username: talentlmsUsername,
        })
        .eq("id", editingMapping.id);

      if (error) {
        toast.error("Failed to update mapping");
        console.error(error);
      } else {
        toast.success("InnoTrue Academy mapping updated");
        resetForm();
        fetchData();
      }
    } else {
      // Create new mapping
      const { error } = await supabase.from("talentlms_users").insert({
        user_id: userId,
        talentlms_user_id: talentlmsUserId,
        talentlms_username: talentlmsUsername,
      });

      if (error) {
        toast.error("Failed to create mapping");
        console.error(error);
      } else {
        toast.success("InnoTrue Academy mapping created");
        resetForm();
        fetchData();
      }
    }
  }

  async function handleDelete(mappingId: string) {
    if (!confirm("Are you sure you want to delete this mapping?")) return;

    const { error } = await supabase.from("talentlms_users").delete().eq("id", mappingId);

    if (error) {
      toast.error("Failed to delete mapping");
      console.error(error);
    } else {
      toast.success("Mapping deleted");
      fetchData();
    }
  }

  function openEditDialog(mapping: UserMapping) {
    setEditingMapping(mapping);
    setTalentlmsUserId(mapping.talentlms_user_id);
    setTalentlmsUsername(mapping.talentlms_username);
    setIsDialogOpen(true);
  }

  function resetForm() {
    setEditingMapping(null);
    setSelectedUserId("");
    setTalentlmsUserId("");
    setTalentlmsUsername("");
    setIsDialogOpen(false);
  }

  const mappedUserIds = new Set(mappings.map((m) => m.user_id));
  const unmappedProfiles = allProfiles.filter((p) => !mappedUserIds.has(p.id));

  if (loading) return <PageLoadingState />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">InnoTrue Academy User Mappings</h1>
          <p className="text-muted-foreground mt-2">
            Link InnoTrue Hub users to their InnoTrue Academy accounts for SSO access
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => resetForm()}>
              <UserPlus className="mr-2 h-4 w-4" />
              Add Mapping
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingMapping ? "Edit InnoTrue Academy Mapping" : "Add InnoTrue Academy Mapping"}
              </DialogTitle>
              <DialogDescription>
                {editingMapping
                  ? "Update the InnoTrue Academy credentials for this user"
                  : "Link a user to their InnoTrue Academy account"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!editingMapping && (
                <div className="space-y-2">
                  <Label>User</Label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2"
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    required
                  >
                    <option value="">Select a user</option>
                    {unmappedProfiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="space-y-2">
                <Label>
                  Academy Username <span className="text-destructive">*</span>
                </Label>
                <Input
                  placeholder="e.g., john.doe"
                  value={talentlmsUsername}
                  onChange={(e) => setTalentlmsUsername(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  The username used in InnoTrue Academy (used for SSO login)
                </p>
              </div>
              <div className="space-y-2">
                <Label>
                  Academy User ID <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  placeholder="e.g., 12345"
                  value={talentlmsUserId}
                  onChange={(e) => setTalentlmsUserId(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  The numeric user ID from InnoTrue Academy (for reference only)
                </p>
              </div>
              <div className="flex gap-2">
                <Button type="submit" className="flex-1">
                  {editingMapping ? "Update" : "Create"} Mapping
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Mapped Users ({mappings.length})
          </CardTitle>
          <CardDescription>Users who have been linked to InnoTrue Academy accounts</CardDescription>
        </CardHeader>
        <CardContent>
          {mappings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No user mappings yet. Click "Add Mapping" to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Academy Username</TableHead>
                  <TableHead>Academy User ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mappings.map((mapping) => {
                  return (
                    <TableRow key={mapping.id}>
                      <TableCell className="font-medium">
                        {mapping.profiles?.name || "Unknown"}
                      </TableCell>
                      <TableCell>{mapping.talentlms_username}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {mapping.talentlms_user_id || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">Linked</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="ghost" onClick={() => openEditDialog(mapping)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(mapping.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Progress Synchronization
          </CardTitle>
          <CardDescription>
            InnoTrue Academy progress is synced via API when users access their programs
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
            <h4 className="font-medium">How Sync Works:</h4>
            <ul className="text-sm space-y-2 list-disc list-inside text-muted-foreground">
              <li>Progress is synced automatically when users view their program pages</li>
              <li>Users can manually trigger sync by clicking "Sync Academy" button</li>
              <li>
                When an Academy course is completed, the corresponding InnoTrue module is
                automatically marked as complete
              </li>
              <li>Test scores and time spent are tracked alongside completion status</li>
            </ul>
          </div>

          <div className="rounded-lg border-l-4 border-primary bg-primary/5 p-4">
            <p className="text-sm">
              <Info className="h-4 w-4 inline mr-2" />
              <strong>Note:</strong> The sync uses the InnoTrue Academy API with your configured API
              key and domain to fetch user course progress securely.
            </p>
          </div>
        </CardContent>
      </Card>

      {unmappedProfiles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Unmapped Users ({unmappedProfiles.length})</CardTitle>
            <CardDescription>
              Users who haven't been linked to an InnoTrue Academy account yet
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unmappedProfiles.map((profile) => (
                  <TableRow key={profile.id}>
                    <TableCell>{profile.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">Not Linked</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
