import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { CircleDot, Save, Loader2, RotateCcw } from "lucide-react";
import { PageLoadingState } from "@/components/ui/page-loading-state";

interface WheelCategory {
  id: string;
  key: string;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  order_index: number;
  is_active: boolean;
  is_legacy: boolean;
}

// Default accessible colors for reset
const DEFAULT_COLORS: Record<string, string> = {
  health_fitness: "#10B981",
  career_business: "#3B82F6",
  finances: "#F59E0B",
  relationships: "#8B5CF6",
  personal_growth: "#EC4899",
  fun_recreation: "#06B6D4",
  physical_environment: "#A855F7",
  family_friends: "#F97316",
  romance: "#EF4444",
  contribution: "#14B8A6",
  family_home: "#F97316",
  financial_career: "#3B82F6",
  mental_educational: "#EC4899",
  spiritual_ethical: "#14B8A6",
  social_cultural: "#8B5CF6",
  physical_health: "#10B981",
};

export default function WheelCategoriesManagement() {
  const queryClient = useQueryClient();
  const [editedColors, setEditedColors] = useState<Record<string, string>>({});

  const { data: categories, isLoading } = useQuery({
    queryKey: ["admin-wheel-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wheel_categories")
        .select("*")
        .order("order_index", { ascending: true });

      if (error) throw error;
      return data as WheelCategory[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, color }: { id: string; color: string }) => {
      const { error } = await supabase.from("wheel_categories").update({ color }).eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["admin-wheel-categories"] });
      queryClient.invalidateQueries({ queryKey: ["wheel-categories"] });
      setEditedColors((prev) => {
        const updated = { ...prev };
        delete updated[id];
        return updated;
      });
      toast({
        title: "Color Updated",
        description: "The category color has been saved.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update color. Please try again.",
        variant: "destructive",
      });
      console.error("Error updating color:", error);
    },
  });

  const resetAllMutation = useMutation({
    mutationFn: async () => {
      const updates = Object.entries(DEFAULT_COLORS).map(([key, color]) =>
        supabase.from("wheel_categories").update({ color }).eq("key", key),
      );

      await Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-wheel-categories"] });
      queryClient.invalidateQueries({ queryKey: ["wheel-categories"] });
      setEditedColors({});
      toast({
        title: "Colors Reset",
        description: "All category colors have been reset to defaults.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to reset colors. Please try again.",
        variant: "destructive",
      });
      console.error("Error resetting colors:", error);
    },
  });

  const handleColorChange = (id: string, color: string) => {
    setEditedColors((prev) => ({ ...prev, [id]: color }));
  };

  const handleSave = (id: string) => {
    const color = editedColors[id];
    if (color !== undefined) {
      updateMutation.mutate({ id, color });
    }
  };

  const activeCategories = categories?.filter((c) => !c.is_legacy && c.is_active) || [];
  const legacyCategories = categories?.filter((c) => c.is_legacy) || [];

  if (isLoading) {
    return <PageLoadingState />;
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <CircleDot className="h-8 w-8" />
            Wheel Categories
          </h1>
          <p className="text-muted-foreground mt-2">
            Customize the colors for each Wheel of Life category.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => resetAllMutation.mutate()}
          disabled={resetAllMutation.isPending}
        >
          {resetAllMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RotateCcw className="h-4 w-4 mr-2" />
          )}
          Reset to Defaults
        </Button>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Active Categories</CardTitle>
          <CardDescription>
            These are the current Wheel of Life categories displayed to users.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            {activeCategories.map((category) => {
              const currentColor = editedColors[category.id] ?? category.color ?? "#6B7280";
              const hasChanges =
                editedColors[category.id] !== undefined &&
                editedColors[category.id] !== category.color;

              return (
                <div key={category.id} className="flex items-center gap-3 p-3 rounded-lg border">
                  <div
                    className="w-10 h-10 rounded-full shrink-0 border-2 border-background shadow-sm"
                    style={{ backgroundColor: currentColor }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{category.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{category.key}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`color-${category.id}`} className="sr-only">
                      Color for {category.name}
                    </Label>
                    <Input
                      id={`color-${category.id}`}
                      type="color"
                      value={currentColor}
                      onChange={(e) => handleColorChange(category.id, e.target.value)}
                      className="w-12 h-9 p-1 cursor-pointer"
                    />
                    <Button
                      size="sm"
                      onClick={() => handleSave(category.id)}
                      disabled={!hasChanges || updateMutation.isPending}
                    >
                      {updateMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-1" />
                          Save
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {legacyCategories.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Legacy Categories</CardTitle>
            <CardDescription>
              These are older categories that may still be used by existing data.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              {legacyCategories.map((category) => {
                const currentColor = editedColors[category.id] ?? category.color ?? "#6B7280";
                const hasChanges =
                  editedColors[category.id] !== undefined &&
                  editedColors[category.id] !== category.color;

                return (
                  <div
                    key={category.id}
                    className="flex items-center gap-3 p-3 rounded-lg border opacity-75"
                  >
                    <div
                      className="w-10 h-10 rounded-full shrink-0 border-2 border-background shadow-sm"
                      style={{ backgroundColor: currentColor }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{category.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{category.key}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`color-${category.id}`} className="sr-only">
                        Color for {category.name}
                      </Label>
                      <Input
                        id={`color-${category.id}`}
                        type="color"
                        value={currentColor}
                        onChange={(e) => handleColorChange(category.id, e.target.value)}
                        className="w-12 h-9 p-1 cursor-pointer"
                      />
                      <Button
                        size="sm"
                        onClick={() => handleSave(category.id)}
                        disabled={!hasChanges || updateMutation.isPending}
                      >
                        {updateMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Save className="h-4 w-4 mr-1" />
                            Save
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
