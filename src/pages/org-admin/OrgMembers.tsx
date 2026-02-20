import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Trash2, Users, Clock, Mail, RefreshCw, Crown } from "lucide-react";
import { format } from "date-fns";

interface Plan {
  id: string;
  name: string;
  tier_level: number;
}

interface Member {
  id: string;
  user_id: string;
  role: "org_admin" | "org_manager" | "org_member";
  is_active: boolean;
  created_at: string;
  sponsored_plan_id: string | null;
  profile?: {
    name: string | null;
  };
  sponsored_plan?: Plan | null;
}

interface PendingInvite {
  id: string;
  email: string;
  role: "org_admin" | "org_manager" | "org_member";
  expires_at: string;
  created_at: string;
  accepted_at: string | null;
}

export default function OrgMembers() {
  const { organizationMembership, user } = useAuth();
  const { toast } = useToast();
  if (!user) return null;
  const [members, setMembers] = useState<Member[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"org_admin" | "org_manager" | "org_member">(
    "org_member",
  );
  const [inviting, setInviting] = useState(false);
  const [allowMemberInvites, setAllowMemberInvites] = useState(false);

  // Sponsored seat limits
  const [seatUsage, setSeatUsage] = useState<{ used: number; max: number | null }>({
    used: 0,
    max: 0,
  });
  const [canAssignSeats, setCanAssignSeats] = useState(false);

  // Check if current user can invite: org_admin always can, org_manager only if allowMemberInvites is enabled
  const canInvite =
    organizationMembership?.role === "org_admin" ||
    (organizationMembership?.role === "org_manager" && allowMemberInvites);

  // Only org_admin can change roles and manage members
  const isOrgAdmin = organizationMembership?.role === "org_admin";

  // Get available roles for the dropdown based on current user's role
  const getAvailableRoles = () => {
    if (isOrgAdmin) {
      return [
        { value: "org_member", label: "Member" },
        { value: "org_manager", label: "Manager" },
        { value: "org_admin", label: "Admin" },
      ];
    }
    // Managers can only assign member roles (not promote to manager or admin)
    return [{ value: "org_member", label: "Member" }];
  };

  useEffect(() => {
    if (organizationMembership?.organization_id) {
      loadMembers();
      loadPendingInvites();
      loadOrgSettings();
      loadPlans();
      loadSeatUsage();
    }
  }, [organizationMembership?.organization_id]);

  const loadSeatUsage = async () => {
    if (!organizationMembership?.organization_id) return;

    try {
      // Get used seats
      const { data: usedData } = await supabase.rpc("get_org_sponsored_seat_count", {
        p_organization_id: organizationMembership.organization_id,
      });

      // Get max seats
      const { data: maxData } = await supabase.rpc("get_org_max_sponsored_seats", {
        p_organization_id: organizationMembership.organization_id,
      });

      // Check if can assign more
      const { data: canAssign } = await supabase.rpc("can_assign_sponsored_seat", {
        p_organization_id: organizationMembership.organization_id,
      });

      setSeatUsage({
        used: usedData || 0,
        max: maxData === null ? null : maxData || 0,
      });
      setCanAssignSeats(canAssign || false);
    } catch (error) {
      console.error("Error loading seat usage:", error);
    }
  };

  const loadPlans = async () => {
    try {
      const { data } = await supabase
        .from("plans")
        .select("id, name, tier_level")
        .eq("is_active", true)
        .order("tier_level");

      setPlans(data || []);
    } catch (error) {
      console.error("Error loading plans:", error);
    }
  };

  const loadOrgSettings = async () => {
    if (!organizationMembership?.organization_id) return;

    try {
      const { data } = await supabase
        .from("organizations")
        .select("settings")
        .eq("id", organizationMembership.organization_id)
        .single();

      const settings = data?.settings as { allowMemberInvites?: boolean } | null;
      setAllowMemberInvites(settings?.allowMemberInvites ?? false);
    } catch (error) {
      console.error("Error loading org settings:", error);
    }
  };

  const loadMembers = async () => {
    if (!organizationMembership?.organization_id) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("organization_members")
        .select(
          `
          id,
          user_id,
          role,
          is_active,
          created_at,
          sponsored_plan_id
        `,
        )
        .eq("organization_id", organizationMembership.organization_id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch profiles for each member
      const memberIds = data?.map((m) => m.user_id) || [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name")
        .in("id", memberIds);

      // Fetch sponsored plans
      const sponsoredPlanIds =
        data?.filter((m) => m.sponsored_plan_id).map((m) => m.sponsored_plan_id!) || [];
      let sponsoredPlans: Plan[] = [];
      if (sponsoredPlanIds.length > 0) {
        const { data: plansData } = await supabase
          .from("plans")
          .select("id, name, tier_level")
          .in("id", sponsoredPlanIds);
        sponsoredPlans = plansData || [];
      }

      const membersWithProfiles =
        data?.map((member) => ({
          ...member,
          profile: {
            name: profiles?.find((p) => p.id === member.user_id)?.name || null,
          },
          sponsored_plan: member.sponsored_plan_id
            ? sponsoredPlans.find((p) => p.id === member.sponsored_plan_id) || null
            : null,
        })) || [];

      setMembers(membersWithProfiles);
    } catch (error) {
      console.error("Error loading members:", error);
      toast({
        title: "Error",
        description: "Failed to load organization members",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadPendingInvites = async () => {
    if (!organizationMembership?.organization_id) return;

    try {
      const { data, error } = await supabase
        .from("organization_invites")
        .select("id, email, role, expires_at, created_at, accepted_at")
        .eq("organization_id", organizationMembership.organization_id)
        .is("accepted_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPendingInvites((data || []) as PendingInvite[]);
    } catch (error) {
      console.error("Error loading invites:", error);
    }
  };

  const handleInviteMember = async () => {
    if (!inviteEmail || !organizationMembership?.organization_id) return;

    setInviting(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-org-invite", {
        body: {
          organization_id: organizationMembership.organization_id,
          email: inviteEmail,
          role: inviteRole,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Invitation Sent",
        description: data?.message || `An invitation has been sent to ${inviteEmail}`,
      });
      setInviteDialogOpen(false);
      setInviteEmail("");
      setInviteRole("org_member");
      loadPendingInvites();
    } catch (error: any) {
      console.error("Error inviting member:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to send invitation",
        variant: "destructive",
      });
    } finally {
      setInviting(false);
    }
  };

  const handleResendInvite = async (invite: PendingInvite) => {
    if (!organizationMembership?.organization_id) return;

    try {
      const { data, error } = await supabase.functions.invoke("send-org-invite", {
        body: {
          organization_id: organizationMembership.organization_id,
          email: invite.email,
          role: invite.role,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Invitation Resent",
        description: `A new invitation has been sent to ${invite.email}`,
      });
      loadPendingInvites();
    } catch (error: any) {
      console.error("Error resending invite:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to resend invitation",
        variant: "destructive",
      });
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    try {
      const { error } = await supabase.from("organization_invites").delete().eq("id", inviteId);

      if (error) throw error;

      toast({
        title: "Invitation Cancelled",
        description: "The invitation has been cancelled",
      });
      loadPendingInvites();
    } catch (error) {
      console.error("Error cancelling invite:", error);
      toast({
        title: "Error",
        description: "Failed to cancel invitation",
        variant: "destructive",
      });
    }
  };

  const handleRemoveMember = async (memberId: string, memberRole: string) => {
    // Security check: only org_admin can remove members
    if (!isOrgAdmin) {
      toast({
        title: "Permission Denied",
        description: "Only organization admins can remove members",
        variant: "destructive",
      });
      return;
    }

    // Check if trying to remove the last admin
    if (memberRole === "org_admin") {
      const adminCount = activeMembers.filter((m) => m.role === "org_admin").length;
      if (adminCount <= 1) {
        toast({
          title: "Cannot Remove",
          description: "You cannot remove the last admin from the organization",
          variant: "destructive",
        });
        return;
      }
    }

    try {
      const { error } = await supabase
        .from("organization_members")
        .update({ is_active: false })
        .eq("id", memberId);

      if (error) throw error;

      toast({
        title: "Member Removed",
        description: "The member has been removed from the organization",
      });
      loadMembers();
    } catch (error) {
      console.error("Error removing member:", error);
      toast({
        title: "Error",
        description: "Failed to remove member",
        variant: "destructive",
      });
    }
  };

  const handleRoleChange = async (
    memberId: string,
    newRole: "org_admin" | "org_manager" | "org_member",
  ) => {
    // Security check: only org_admin can promote to org_admin or org_manager
    if (!isOrgAdmin && (newRole === "org_admin" || newRole === "org_manager")) {
      toast({
        title: "Permission Denied",
        description: "Only organization admins can assign admin or manager roles",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("organization_members")
        .update({ role: newRole })
        .eq("id", memberId);

      if (error) throw error;

      toast({
        title: "Role Updated",
        description: "Member role has been updated",
      });
      loadMembers();
    } catch (error) {
      console.error("Error updating role:", error);
      toast({
        title: "Error",
        description: "Failed to update member role",
        variant: "destructive",
      });
    }
  };

  const handleSponsoredPlanChange = async (
    memberId: string,
    planId: string | null,
    currentPlanId: string | null,
  ) => {
    // Security check: only org_admin can assign sponsored plans
    if (!isOrgAdmin) {
      toast({
        title: "Permission Denied",
        description: "Only organization admins can assign sponsored plans",
        variant: "destructive",
      });
      return;
    }

    // Check seat limits when assigning (not when removing)
    if (planId && !currentPlanId && !canAssignSeats) {
      toast({
        title: "Seat Limit Reached",
        description:
          seatUsage.max === 0
            ? "Your plan does not include sponsored seats. Upgrade to add sponsored access for members."
            : `You've used all ${seatUsage.max} sponsored seats included in your plan. Upgrade to add more.`,
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("organization_members")
        .update({ sponsored_plan_id: planId })
        .eq("id", memberId);

      if (error) throw error;

      toast({
        title: "Sponsored Plan Updated",
        description: planId
          ? "Member now has org-sponsored platform access"
          : "Org-sponsored access removed",
      });

      // Check if we should send seat limit alerts (only when assigning, not removing)
      if (planId && !currentPlanId && seatUsage.max !== null && seatUsage.max > 0) {
        const newUsed = seatUsage.used + 1;
        const percentUsed = Math.round((newUsed / seatUsage.max) * 100);

        // Send alert at 80% or 100% thresholds
        if (percentUsed >= 80) {
          // Get org name for the email
          const { data: orgData } = await supabase
            .from("organizations")
            .select("name")
            .eq("id", organizationMembership.organization_id)
            .single();

          const alertType =
            percentUsed >= 100 ? "org_seat_limit_reached" : "org_seat_limit_warning";

          // Get current user's profile for the email
          const { data: profile } = await supabase
            .from("profiles")
            .select("name")
            .eq("id", user?.id)
            .single();

          // Send the notification (fire and forget - don't block UI)
          supabase.functions
            .invoke("send-notification-email", {
              body: {
                userId: user?.id,
                name: profile?.name || "Admin",
                type: alertType,
                timestamp: new Date().toISOString(),
                organizationName: orgData?.name || "Your Organization",
                usedSeats: newUsed,
                maxSeats: seatUsage.max,
                percentUsed: percentUsed,
              },
            })
            .then(({ error }) => {
              if (error) console.error("Failed to send seat limit alert:", error);
            });
        }
      }

      loadMembers();
      loadSeatUsage(); // Refresh seat count
    } catch (error) {
      console.error("Error updating sponsored plan:", error);
      toast({
        title: "Error",
        description: "Failed to update sponsored plan",
        variant: "destructive",
      });
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

  const activeMembers = members.filter((m) => m.is_active);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Members</h1>
          <p className="text-muted-foreground">Manage your organization's team members</p>
        </div>
        {canInvite && (
          <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4 mr-2" />
                Invite Member
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite Team Member</DialogTitle>
                <DialogDescription>Send an invitation to join your organization</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="colleague@company.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="org_member">Member</SelectItem>
                      <SelectItem value="org_manager">Manager</SelectItem>
                      <SelectItem value="org_admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleInviteMember} disabled={inviting || !inviteEmail}>
                  {inviting ? "Sending..." : "Send Invite"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Tabs defaultValue="members">
        <TabsList>
          <TabsTrigger value="members" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Members ({activeMembers.length})
          </TabsTrigger>
          <TabsTrigger value="pending" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Pending Invites ({pendingInvites.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="members">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Team Members
              </CardTitle>
              <CardDescription className="flex items-center justify-between">
                <span>{activeMembers.length} active members</span>
                <span className="flex items-center gap-1 text-sm">
                  <Crown className="h-3.5 w-3.5 text-amber-500" />
                  Sponsored seats: {seatUsage.used} / {seatUsage.max === null ? "∞" : seatUsage.max}
                  {seatUsage.max !== null && seatUsage.used >= seatUsage.max && (
                    <Badge variant="secondary" className="ml-2 text-xs">
                      Limit reached
                    </Badge>
                  )}
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading members...</div>
              ) : activeMembers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No members found. Invite your first team member!
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Sponsored Plan</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeMembers.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-sm font-medium text-primary">
                                {member.profile?.name?.[0]?.toUpperCase() || "?"}
                              </span>
                            </div>
                            <span className="font-medium">
                              {member.profile?.name || "Unknown User"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {isOrgAdmin ? (
                            <Select
                              value={member.role}
                              onValueChange={(v) => handleRoleChange(member.id, v as any)}
                            >
                              <SelectTrigger className="w-32">
                                <Badge variant={getRoleBadgeVariant(member.role)}>
                                  {getRoleLabel(member.role)}
                                </Badge>
                              </SelectTrigger>
                              <SelectContent>
                                {getAvailableRoles().map((role) => (
                                  <SelectItem key={role.value} value={role.value}>
                                    {role.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge variant={getRoleBadgeVariant(member.role)}>
                              {getRoleLabel(member.role)}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {isOrgAdmin ? (
                            <Select
                              value={member.sponsored_plan_id || "none"}
                              onValueChange={(v) =>
                                handleSponsoredPlanChange(
                                  member.id,
                                  v === "none" ? null : v,
                                  member.sponsored_plan_id,
                                )
                              }
                            >
                              <SelectTrigger className="w-36">
                                {member.sponsored_plan ? (
                                  <div className="flex items-center gap-1">
                                    <Crown className="h-3 w-3 text-amber-500" />
                                    <span className="truncate">{member.sponsored_plan.name}</span>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">None</span>
                                )}
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">
                                  <span className="text-muted-foreground">No sponsored access</span>
                                </SelectItem>
                                {plans.map((plan) => (
                                  <SelectItem key={plan.id} value={plan.id}>
                                    <div className="flex items-center gap-1">
                                      <Crown className="h-3 w-3 text-amber-500" />
                                      {plan.name}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : member.sponsored_plan ? (
                            <div className="flex items-center gap-1">
                              <Crown className="h-3 w-3 text-amber-500" />
                              <span>{member.sponsored_plan.name}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="default">Active</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(member.created_at), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell className="text-right">
                          {isOrgAdmin && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="text-destructive">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Remove Member</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to remove this member from your
                                    organization? They will lose access to all organization
                                    resources.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleRemoveMember(member.id, member.role)}
                                    className="bg-destructive text-destructive-foreground"
                                  >
                                    Remove
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Pending Invitations
              </CardTitle>
              <CardDescription>{pendingInvites.length} pending invites</CardDescription>
            </CardHeader>
            <CardContent>
              {pendingInvites.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No pending invitations</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead>Sent</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingInvites.map((invite) => (
                      <TableRow key={invite.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <span>{invite.email}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getRoleBadgeVariant(invite.role)}>
                            {getRoleLabel(invite.role)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(invite.expires_at), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(invite.created_at), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleResendInvite(invite)}
                            >
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="text-destructive">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Cancel Invitation</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to cancel this invitation?
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Keep</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleCancelInvite(invite.id)}
                                    className="bg-destructive text-destructive-foreground"
                                  >
                                    Cancel Invite
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
