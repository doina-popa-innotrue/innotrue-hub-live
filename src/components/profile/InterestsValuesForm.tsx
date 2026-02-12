import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { X, Plus, Loader2, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function InterestsValuesForm() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newInterest, setNewInterest] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newDrive, setNewDrive] = useState("");

  const { data: userInterests, isLoading } = useQuery({
    queryKey: ["user-interests"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("user_interests")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  const upsertMutation = useMutation({
    mutationFn: async (updates: {
      interests?: string[];
      values?: string[];
      drives?: string[];
      is_private?: boolean;
    }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("user_interests").upsert(
        {
          user_id: user.id,
          ...updates,
        },
        { onConflict: "user_id" },
      );

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-interests"] });
      toast({ description: "Successfully updated" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleTogglePrivate = (isPrivate: boolean) => {
    upsertMutation.mutate({ is_private: isPrivate });
  };

  const handleAddInterest = () => {
    if (!newInterest.trim()) return;
    const current = userInterests?.interests || [];
    upsertMutation.mutate({ interests: [...current, newInterest.trim()] });
    setNewInterest("");
  };

  const handleRemoveInterest = (interest: string) => {
    const current = userInterests?.interests || [];
    upsertMutation.mutate({ interests: current.filter((i) => i !== interest) });
  };

  const handleAddValue = () => {
    if (!newValue.trim()) return;
    const current = userInterests?.values || [];
    upsertMutation.mutate({ values: [...current, newValue.trim()] });
    setNewValue("");
  };

  const handleRemoveValue = (value: string) => {
    const current = userInterests?.values || [];
    upsertMutation.mutate({ values: current.filter((v) => v !== value) });
  };

  const handleAddDrive = () => {
    if (!newDrive.trim()) return;
    const current = userInterests?.drives || [];
    upsertMutation.mutate({ drives: [...current, newDrive.trim()] });
    setNewDrive("");
  };

  const handleRemoveDrive = (drive: string) => {
    const current = userInterests?.drives || [];
    upsertMutation.mutate({ drives: current.filter((d) => d !== drive) });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                Privacy Settings
                {userInterests?.is_private && <Lock className="h-4 w-4 text-muted-foreground" />}
              </CardTitle>
              <CardDescription>
                Control who can see your interests, values, and motivations
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-1">
              <Label htmlFor="interests-private">Keep Private</Label>
              <p className="text-xs text-muted-foreground">
                Only visible to you and admins. Hidden from coaches/instructors.
              </p>
            </div>
            <Switch
              id="interests-private"
              checked={userInterests?.is_private || false}
              onCheckedChange={handleTogglePrivate}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Interests</CardTitle>
          <CardDescription>
            What topics, activities, or areas are you interested in?
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {userInterests?.interests?.map((interest) => (
              <Badge key={interest} variant="secondary" className="gap-1">
                {interest}
                <button
                  onClick={() => handleRemoveInterest(interest)}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Add an interest"
              value={newInterest}
              onChange={(e) => setNewInterest(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddInterest()}
            />
            <Button onClick={handleAddInterest} size="icon">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Values</CardTitle>
          <CardDescription>
            What principles and values guide your decisions and actions?
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {userInterests?.values?.map((value) => (
              <Badge key={value} variant="secondary" className="gap-1">
                {value}
                <button
                  onClick={() => handleRemoveValue(value)}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Add a value"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddValue()}
            />
            <Button onClick={handleAddValue} size="icon">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Personal Motivators</CardTitle>
          <CardDescription>
            What motivates you? What fuels your personal and professional growth?
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {userInterests?.drives?.map((drive) => (
              <Badge key={drive} variant="secondary" className="gap-1">
                {drive}
                <button
                  onClick={() => handleRemoveDrive(drive)}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Add a personal motivator"
              value={newDrive}
              onChange={(e) => setNewDrive(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddDrive()}
            />
            <Button onClick={handleAddDrive} size="icon">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
