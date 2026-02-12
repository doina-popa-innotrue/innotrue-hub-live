import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { AdminPageHeader, AdminBreadcrumb, AdminLoadingState } from "@/components/admin";
import { ArrowLeft, Plus, Trash2, UserPlus, Building2, Users, BookOpen, Mail } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";

interface Organization {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  website: string | null;
  industry: string | null;
  size_range: string | null;
  is_active: boolean;
  created_at: string;
}

interface OrganizationMember {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
  user_email?: string;
  user_name?: string;
}

interface OrganizationProgram {
  id: string;
  program_id: string;
  is_active: boolean;
  created_at: string;
  program_name?: string;
}

interface AvailableUser {
  id: string;
  email: string;
  name: string | null;
}

export default function OrganizationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [programs, setPrograms] = useState<OrganizationProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<AvailableUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRole, setSelectedRole] = useState("member");
  const [userSearch, setUserSearch] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (id) {
      loadOrganization();
      loadMembers();
      loadPrograms();
    }
  }, [id]);

  if (!id) {
    return null;
  }

  const loadOrganization = async () => {
    try {
      const { data, error } = await supabase
        .from("organizations")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      setOrganization(data);
    } catch (error) {
      console.error("Error loading organization:", error);
      toast.error("Failed to load organization");
      navigate("/admin/organizations");
    } finally {
      setLoading(false);
    }
  };

  const loadMembers = async () => {
    try {
      const { data, error } = await supabase
        .from("organization_members")
        .select("*")
        .eq("organization_id", id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Get user details for each member
      const memberIds = data?.map((m) => m.user_id) || [];
      if (memberIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, name")
          .in("id", memberIds);

        // Get emails via edge function
        const membersWithDetails = await Promise.all(
          (data || []).map(async (member) => {
            const profile = profiles?.find((p) => p.id === member.user_id);
            let email = "";
            try {
              const { data: emailData } = await supabase.functions.invoke("get-user-email", {
                body: { userId: member.user_id },
              });
              email = emailData?.email || "";
            } catch {
              // Ignore email fetch errors
            }
            return {
              ...member,
              user_name: profile?.name || "",
              user_email: email,
            };
          }),
        );

        setMembers(membersWithDetails);
      } else {
        setMembers([]);
      }
    } catch (error) {
      console.error("Error loading members:", error);
    }
  };

  const loadPrograms = async () => {
    try {
      const { data, error } = await supabase
        .from("organization_programs")
        .select(
          `
          *,
          programs:program_id (name)
        `,
        )
        .eq("organization_id", id);

      if (error) throw error;

      const programsWithNames = (data || []).map((p) => ({
        ...p,
        program_name: (p.programs as any)?.name || "Unknown Program",
      }));

      setPrograms(programsWithNames as OrganizationProgram[]);
    } catch (error) {
      console.error("Error loading programs:", error);
    }
  };

  const searchUsers = async (search: string) => {
    if (!search || search.length < 2) {
      setAvailableUsers([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name")
        .ilike("name", `%${search}%`)
        .limit(10);

      if (error) throw error;

      // Filter out users who are already members
      const existingMemberIds = members.map((m) => m.user_id);
      const filtered = (data || []).filter((u) => !existingMemberIds.includes(u.id));

      // Get emails for filtered users
      const usersWithEmails = await Promise.all(
        filtered.map(async (user) => {
          let email = "";
          try {
            const { data: emailData } = await supabase.functions.invoke("get-user-email", {
              body: { userId: user.id },
            });
            email = emailData?.email || "";
          } catch {
            // Ignore
          }
          return {
            id: user.id,
            name: user.name,
            email,
          };
        }),
      );

      setAvailableUsers(usersWithEmails);
    } catch (error) {
      console.error("Error searching users:", error);
    }
  };

  const handleAddMember = async () => {
    if (!selectedUserId) {
      toast.error("Please select a user");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("organization_members").insert({
        organization_id: id,
        user_id: selectedUserId,
        role: selectedRole as "org_admin" | "org_manager" | "org_member",
      });

      if (error) throw error;

      toast.success("Member added successfully");
      setAddMemberOpen(false);
      setSelectedUserId("");
      setSelectedRole("member");
      setUserSearch("");
      setAvailableUsers([]);
      loadMembers();
    } catch (error: any) {
      console.error("Error adding member:", error);
      if (error.code === "23505") {
        toast.error("User is already a member of this organization");
      } else {
        toast.error("Failed to add member");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateMemberRole = async (memberId: string, newRole: string) => {
    try {
      const { error } = await supabase
        .from("organization_members")
        .update({ role: newRole as "org_admin" | "org_manager" | "org_member" })
        .eq("id", memberId);

      if (error) throw error;

      toast.success("Role updated");
      loadMembers();
    } catch (error) {
      console.error("Error updating role:", error);
      toast.error("Failed to update role");
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      const { error } = await supabase.from("organization_members").delete().eq("id", memberId);

      if (error) throw error;

      toast.success("Member removed");
      loadMembers();
    } catch (error) {
      console.error("Error removing member:", error);
      toast.error("Failed to remove member");
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "org_admin":
        return "default";
      case "org_manager":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "org_admin":
        return "Admin";
      case "org_manager":
        return "Manager";
      default:
        return "Member";
    }
  };

  if (loading) {
    return <AdminLoadingState message="Loading organization..." />;
  }

  if (!organization) {
    return null;
  }

  return (
    <div className="space-y-6">
      <AdminBreadcrumb
        items={[
          { label: "Organizations", href: "/admin/organizations" },
          { label: organization.name },
        ]}
      />

      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/organizations")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <AdminPageHeader
          title={organization.name}
          description={organization.description || "Organization management"}
        />
        <Badge variant={organization.is_active ? "default" : "secondary"} className="ml-auto">
          {organization.is_active ? "Active" : "Inactive"}
        </Badge>
      </div>

      {/* Organization Info Card */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Industry</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{organization.industry || "N/A"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Size</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{organization.size_range || "N/A"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{members.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Programs</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{programs.length}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="members">
        <TabsList>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="programs">Licensed Programs</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Organization Members</CardTitle>
                  <CardDescription>Manage users who belong to this organization</CardDescription>
                </div>
                <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Add Member
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Organization Member</DialogTitle>
                      <DialogDescription>
                        Search for a user and assign them a role in this organization
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Search User</Label>
                        <Input
                          placeholder="Type to search by name..."
                          value={userSearch}
                          onChange={(e) => {
                            setUserSearch(e.target.value);
                            searchUsers(e.target.value);
                          }}
                        />
                        {availableUsers.length > 0 && (
                          <div className="border rounded-md max-h-40 overflow-y-auto">
                            {availableUsers.map((user) => (
                              <div
                                key={user.id}
                                className={`p-2 cursor-pointer hover:bg-muted ${
                                  selectedUserId === user.id ? "bg-muted" : ""
                                }`}
                                onClick={() => setSelectedUserId(user.id)}
                              >
                                <div className="font-medium">{user.name || "No name"}</div>
                                <div className="text-sm text-muted-foreground">{user.email}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>Role</Label>
                        <Select value={selectedRole} onValueChange={setSelectedRole}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="org_admin">Admin</SelectItem>
                            <SelectItem value="org_manager">Manager</SelectItem>
                            <SelectItem value="member">Member</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setAddMemberOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleAddMember} disabled={saving || !selectedUserId}>
                        {saving ? "Adding..." : "Add Member"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {members.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No members yet</p>
                  <p className="text-sm">Add members to this organization to get started</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell className="font-medium">
                          {member.user_name || "Unknown"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            {member.user_email || "N/A"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={member.role}
                            onValueChange={(value) => handleUpdateMemberRole(member.id, value)}
                          >
                            <SelectTrigger className="w-32">
                              <Badge variant={getRoleBadgeVariant(member.role)}>
                                {getRoleLabel(member.role)}
                              </Badge>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="org_admin">Admin</SelectItem>
                              <SelectItem value="org_manager">Manager</SelectItem>
                              <SelectItem value="member">Member</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>{format(new Date(member.created_at), "MMM d, yyyy")}</TableCell>
                        <TableCell>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remove Member</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to remove this member from the organization?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleRemoveMember(member.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Remove
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="programs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Licensed Programs</CardTitle>
              <CardDescription>Programs available to this organization</CardDescription>
            </CardHeader>
            <CardContent>
              {programs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No programs licensed</p>
                  <p className="text-sm">
                    Go to Organization Programs to license programs for this organization
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Program</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Licensed On</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {programs.map((program) => (
                      <TableRow key={program.id}>
                        <TableCell className="font-medium">{program.program_name}</TableCell>
                        <TableCell>
                          <Badge variant={program.is_active ? "default" : "secondary"}>
                            {program.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>{format(new Date(program.created_at), "MMM d, yyyy")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="details" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Organization Details</CardTitle>
              <CardDescription>Basic information about the organization</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label className="text-muted-foreground">Name</Label>
                  <p className="font-medium">{organization.name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Slug</Label>
                  <p className="font-medium">{organization.slug}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Website</Label>
                  <p className="font-medium">{organization.website || "N/A"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Industry</Label>
                  <p className="font-medium">{organization.industry || "N/A"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Size Range</Label>
                  <p className="font-medium">{organization.size_range || "N/A"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Created</Label>
                  <p className="font-medium">{format(new Date(organization.created_at), "PPP")}</p>
                </div>
              </div>
              {organization.description && (
                <div>
                  <Label className="text-muted-foreground">Description</Label>
                  <p className="font-medium">{organization.description}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
