import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useWheelCategories } from "@/hooks/useWheelCategories";
import type { Database } from "@/integrations/supabase/types";

type GoalCategory = Database["public"]["Enums"]["goal_category"];
type GoalTimeframe = Database["public"]["Enums"]["goal_timeframe"];
type GoalPriority = Database["public"]["Enums"]["goal_priority"];
type GoalStatus = Database["public"]["Enums"]["goal_status"];

interface GoalFormProps {
  goalId?: string;
  defaultCategory?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function GoalForm({ goalId, defaultCategory, onSuccess, onCancel }: GoalFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: categories = [], isLoading: categoriesLoading } = useWheelCategories({
    includeLegacy: false,
  });
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<{
    title: string;
    description: string;
    category: GoalCategory;
    timeframe_type: GoalTimeframe;
    priority: GoalPriority;
    target_date: string;
    status: GoalStatus;
    is_private: boolean;
  }>({
    title: "",
    description: "",
    category: (defaultCategory || "personal_growth") as GoalCategory,
    timeframe_type: "short_term" as GoalTimeframe,
    priority: "medium" as GoalPriority,
    target_date: "",
    status: "active" as GoalStatus,
    is_private: false,
  });

  useEffect(() => {
    if (goalId) {
      fetchGoal();
    }
  }, [goalId]);

  const fetchGoal = async () => {
    try {
      const { data, error } = await supabase
        .from("goals")
        .select("*")
        .eq("id", goalId ?? "")
        .single();

      if (error) throw error;

      setFormData({
        title: data.title,
        description: data.description || "",
        category: data.category as GoalCategory,
        timeframe_type: data.timeframe_type as GoalTimeframe,
        priority: data.priority as GoalPriority,
        target_date: data.target_date || "",
        status: data.status as GoalStatus,
        is_private: data.is_private || false,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load goal",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const goalData = {
        ...formData,
        description: formData.description || null,
        target_date: formData.target_date || null,
        user_id: user.id,
      };

      if (goalId) {
        const { error } = await supabase.from("goals").update(goalData).eq("id", goalId);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Goal updated successfully",
        });
      } else {
        const { error } = await supabase.from("goals").insert([goalData]);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Goal created successfully",
        });
      }

      onSuccess();
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Failed to ${goalId ? "update" : "create"} goal`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Title *</Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          required
          placeholder="Enter goal title"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Describe your goal"
          rows={4}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="category">Category *</Label>
          <Select
            value={formData.category}
            onValueChange={(value) => setFormData({ ...formData, category: value as GoalCategory })}
            disabled={categoriesLoading}
          >
            <SelectTrigger>
              <SelectValue placeholder={categoriesLoading ? "Loading..." : "Select category"} />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat.key} value={cat.key}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="timeframe">Timeframe *</Label>
          <Select
            value={formData.timeframe_type}
            onValueChange={(value) =>
              setFormData({ ...formData, timeframe_type: value as GoalTimeframe })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="short_term">Short-term (1-6 months)</SelectItem>
              <SelectItem value="medium_term">Medium-term (12 months)</SelectItem>
              <SelectItem value="long_term">Long-term (3+ years)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="priority">Priority *</Label>
          <Select
            value={formData.priority}
            onValueChange={(value) => setFormData({ ...formData, priority: value as GoalPriority })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">Status *</Label>
          <Select
            value={formData.status}
            onValueChange={(value) => setFormData({ ...formData, status: value as GoalStatus })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="on_hold">On Hold</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="retired">Retired</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="target_date">Target Date</Label>
        <Input
          id="target_date"
          type="date"
          value={formData.target_date}
          onChange={(e) => setFormData({ ...formData, target_date: e.target.value })}
        />
      </div>

      <div className="flex items-center justify-between rounded-lg border p-4">
        <div className="space-y-1">
          <Label htmlFor="is_private">Private Goal</Label>
          <p className="text-xs text-muted-foreground">
            Only visible to you and admins. Hidden from coaches/instructors.
          </p>
        </div>
        <Switch
          id="is_private"
          checked={formData.is_private}
          onCheckedChange={(checked) => setFormData({ ...formData, is_private: checked })}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Saving..." : goalId ? "Update Goal" : "Create Goal"}
        </Button>
      </div>
    </form>
  );
}
