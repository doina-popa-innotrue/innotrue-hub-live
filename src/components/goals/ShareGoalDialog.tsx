import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Share2, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ShareGoalDialogProps {
  goalId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface User {
  id: string;
  name: string;
  roles: string[];
}

interface Share {
  shared_with_user_id: string;
}

export default function ShareGoalDialog({ goalId, open, onOpenChange }: ShareGoalDialogProps) {
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [existingShares, setExistingShares] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      fetchUsersAndShares();
    }
  }, [open, goalId]);

  const fetchUsersAndShares = async () => {
    setLoading(true);
    try {
      // Fetch instructors and coaches
      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["instructor", "coach"]);

      if (rolesError) throw rolesError;

      // Get unique user IDs
      const userIds = [...new Set(rolesData.map((r) => r.user_id))];

      // Fetch user profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, name")
        .in("id", userIds);

      if (profilesError) throw profilesError;

      // Combine data
      const usersWithRoles = profilesData.map((profile) => ({
        id: profile.id,
        name: profile.name,
        roles: rolesData.filter((r) => r.user_id === profile.id).map((r) => r.role),
      }));

      setUsers(usersWithRoles);

      // Fetch existing shares
      const { data: sharesData, error: sharesError } = await supabase
        .from("goal_shares")
        .select("shared_with_user_id")
        .eq("goal_id", goalId);

      if (sharesError) throw sharesError;

      const sharedUserIds = new Set(sharesData.map((s) => s.shared_with_user_id));
      setExistingShares(sharedUserIds);
      setSelectedUsers(new Set(sharedUserIds));
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load users",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleUser = (userId: string) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUsers(newSelected);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Find users to add (selected but not in existing)
      const toAdd = [...selectedUsers].filter((id) => !existingShares.has(id));

      // Find users to remove (in existing but not selected)
      const toRemove = [...existingShares].filter((id) => !selectedUsers.has(id));

      // Add new shares
      if (toAdd.length > 0) {
        const { error: insertError } = await supabase.from("goal_shares").insert(
          toAdd.map((userId) => ({
            goal_id: goalId,
            shared_with_user_id: userId,
            shared_by_user_id: user.id,
          })),
        );

        if (insertError) throw insertError;

        // Get goal and sharer info for notifications
        const { data: goalData } = await supabase
          .from("goals")
          .select("title")
          .eq("id", goalId)
          .single();

        const { data: sharerProfile } = await supabase
          .from("profiles")
          .select("name")
          .eq("id", user.id)
          .single();

        // Send notifications to each newly shared user
        for (const userId of toAdd) {
          const sharedUser = users.find((u) => u.id === userId);
          if (!sharedUser) continue;

          try {
            await supabase.functions.invoke("send-notification-email", {
              body: {
                userId, // Backend will fetch email
                name: sharedUser.name,
                type: "goal_shared",
                timestamp: new Date().toISOString(),
                goalTitle: goalData?.title || "Your Goal",
                sharedByName: sharerProfile?.name || "A client",
                entityLink: `${window.location.origin}/teaching/shared-goals`,
              },
            });
          } catch (err) {
            console.error("Failed to send notification:", err);
          }
        }
      }

      // Remove shares
      if (toRemove.length > 0) {
        const { error: deleteError } = await supabase
          .from("goal_shares")
          .delete()
          .eq("goal_id", goalId)
          .in("shared_with_user_id", toRemove);

        if (deleteError) throw deleteError;
      }

      toast({
        title: "Success",
        description: "Goal sharing updated successfully",
      });

      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to update sharing",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Share Goal
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-muted-foreground">
            Loading instructors and coaches...
          </div>
        ) : users.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            No instructors or coaches available
          </div>
        ) : (
          <>
            <ScrollArea className="max-h-[400px] pr-4">
              <div className="space-y-3">
                {users.map((user) => (
                  <div key={user.id} className="flex items-start gap-3 p-3 border rounded-lg">
                    <Checkbox
                      checked={selectedUsers.has(user.id)}
                      onCheckedChange={() => handleToggleUser(user.id)}
                      id={`user-${user.id}`}
                    />
                    <div className="flex-1">
                      <Label htmlFor={`user-${user.id}`} className="cursor-pointer font-medium">
                        {user.name}
                      </Label>
                      <div className="flex gap-1 mt-1">
                        {user.roles.map((role) => (
                          <Badge key={role} variant="secondary" className="text-xs">
                            {role}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
