import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { UserMinus, Plus, Trash2, Search, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface ExcludedUser {
  id: string;
  user_id: string;
  reason: string | null;
  created_at: string;
  profile?: {
    name: string | null;
  } | null;
}

export function ExcludedUsersManager() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [reason, setReason] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch excluded users
  const { data: excludedUsers, isLoading } = useQuery({
    queryKey: ["analytics-excluded-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("analytics_excluded_users")
        .select(`
          id,
          user_id,
          reason,
          created_at
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch profiles separately
      if (data && data.length > 0) {
        const userIds = data.map(u => u.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, name")
          .in("id", userIds);

        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
        
        return data.map(u => ({
          ...u,
          profile: profileMap.get(u.user_id) || null,
        })) as ExcludedUser[];
      }

      return data as ExcludedUser[];
    },
  });

  // Debounced search term for better UX
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch available users to exclude
  const { data: availableUsers, isLoading: isLoadingUsers } = useQuery({
    queryKey: ["analytics-available-users", debouncedSearch, excludedUsers?.map(u => u.user_id)],
    queryFn: async () => {
      let query = supabase
        .from("profiles")
        .select("id, name")
        .order("name", { ascending: true })
        .limit(50);

      if (debouncedSearch) {
        query = query.ilike("name", `%${debouncedSearch}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Filter out already excluded users
      const excludedIds = new Set(excludedUsers?.map(u => u.user_id) || []);
      return (data || []).filter(u => !excludedIds.has(u.id));
    },
    enabled: isDialogOpen,
  });

  // Add exclusion mutation
  const addExclusion = useMutation({
    mutationFn: async ({ userId, reason }: { userId: string; reason: string }) => {
      const { error } = await supabase
        .from("analytics_excluded_users")
        .insert({
          user_id: userId,
          reason: reason || null,
          excluded_by: user?.id,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["analytics-excluded-users"] });
      queryClient.invalidateQueries({ queryKey: ["user-behavior-analytics"] });
      toast.success("User excluded from analytics");
      setIsDialogOpen(false);
      setSelectedUserId("");
      setReason("");
    },
    onError: (error) => {
      toast.error("Failed to exclude user: " + (error instanceof Error ? error.message : "Unknown error"));
    },
  });

  // Remove exclusion mutation
  const removeExclusion = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("analytics_excluded_users")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["analytics-excluded-users"] });
      queryClient.invalidateQueries({ queryKey: ["user-behavior-analytics"] });
      toast.success("User removed from exclusion list");
    },
    onError: (error) => {
      toast.error("Failed to remove exclusion: " + (error instanceof Error ? error.message : "Unknown error"));
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <UserMinus className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Excluded Users</CardTitle>
          </div>
          <CardDescription>
            Users excluded from analytics tracking (e.g., admins, test accounts)
          </CardDescription>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Add Exclusion
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Exclude User from Analytics</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Search Users</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Select User</Label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a user to exclude" />
                  </SelectTrigger>
                  <SelectContent>
                    {isLoadingUsers ? (
                      <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                        Searching...
                      </div>
                    ) : availableUsers && availableUsers.length > 0 ? (
                      availableUsers.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name || "Unnamed User"}
                        </SelectItem>
                      ))
                    ) : (
                      <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                        {debouncedSearch ? `No users found matching "${debouncedSearch}"` : "No users available"}
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Reason (optional)</Label>
                <Textarea
                  placeholder="e.g., Test account, Admin user, Developer..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => addExclusion.mutate({ userId: selectedUserId, reason })}
                disabled={!selectedUserId || addExclusion.isPending}
              >
                {addExclusion.isPending ? "Excluding..." : "Exclude User"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {excludedUsers && excludedUsers.length > 0 ? (
          <div className="space-y-3">
            {excludedUsers.map((exclusion) => (
              <div
                key={exclusion.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {exclusion.profile?.name || "Unknown User"}
                    </p>
                    {exclusion.reason && (
                      <p className="text-xs text-muted-foreground">{exclusion.reason}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {new Date(exclusion.created_at).toLocaleDateString()}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeExclusion.mutate(exclusion.id)}
                    disabled={removeExclusion.isPending}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <UserMinus className="h-12 w-12 mb-4 text-muted-foreground/50" />
            <p className="font-medium text-foreground">No users excluded</p>
            <p className="text-sm mt-1 text-center max-w-md">
              Add admin or test users here to exclude them from analytics tracking
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
