import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Edit,
  Trash2,
  Package,
  Zap,
  ChevronDown,
  ChevronRight,
  Lock,
  Coins,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface ProgramPlan {
  id: string;
  name: string;
  description: string | null;
  tier_level: number;
  is_active: boolean;
  created_at: string;
  credit_allowance: number | null;
}

interface Feature {
  id: string;
  key: string;
  name: string;
  description: string | null;
  is_consumable: boolean;
  is_system: boolean;
  category_id: string | null;
  feature_categories?: { name: string } | null;
}

interface FeatureCategory {
  id: string;
  name: string;
  display_order: number;
}

interface ProgramPlanFeature {
  id: string;
  program_plan_id: string;
  feature_id: string;
  enabled: boolean;
  limit_value: number | null;
}

export default function ProgramPlansManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isPlanDialogOpen, setIsPlanDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<ProgramPlan | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(["uncategorized"]),
  );
  const [planForm, setPlanForm] = useState({
    name: "",
    display_name: "",
    description: "",
    tier_level: 0,
    is_active: true,
    credit_allowance: null as number | null,
  });

  // Fetch program plans
  const { data: programPlans, isLoading: plansLoading } = useQuery({
    queryKey: ["program-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("program_plans")
        .select("*")
        .order("tier_level", { ascending: true });
      if (error) throw error;
      return data as ProgramPlan[];
    },
  });

  // Fetch features
  const { data: features } = useQuery({
    queryKey: ["features"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("features")
        .select("*, feature_categories(name)")
        .order("name");
      if (error) throw error;
      return data as Feature[];
    },
  });

  // Fetch feature categories
  const { data: categories } = useQuery({
    queryKey: ["feature-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feature_categories")
        .select("*")
        .order("display_order");
      if (error) throw error;
      return data as FeatureCategory[];
    },
  });

  // Fetch program plan features
  const { data: planFeatures } = useQuery({
    queryKey: ["program-plan-features"],
    queryFn: async () => {
      const { data, error } = await supabase.from("program_plan_features").select("*");
      if (error) throw error;
      return data as ProgramPlanFeature[];
    },
  });

  // Create program plan mutation
  const createPlanMutation = useMutation({
    mutationFn: async (plan: typeof planForm) => {
      const { error } = await supabase.from("program_plans").insert(plan);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["program-plans"] });
      toast({ title: "Program plan created successfully" });
      setIsPlanDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Error creating program plan",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update program plan mutation
  const updatePlanMutation = useMutation({
    mutationFn: async ({ id, ...plan }: { id: string } & typeof planForm) => {
      const { error } = await supabase.from("program_plans").update(plan).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["program-plans"] });
      toast({ title: "Program plan updated successfully" });
      setIsPlanDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Error updating program plan",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete program plan mutation
  const deletePlanMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("program_plans").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["program-plans"] });
      toast({ title: "Program plan deleted successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error deleting program plan",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Toggle feature for a plan
  const toggleFeatureMutation = useMutation({
    mutationFn: async ({
      planId,
      featureId,
      enabled,
    }: {
      planId: string;
      featureId: string;
      enabled: boolean;
    }) => {
      const existing = planFeatures?.find(
        (pf) => pf.program_plan_id === planId && pf.feature_id === featureId,
      );

      if (existing) {
        const { error } = await supabase
          .from("program_plan_features")
          .update({ enabled })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("program_plan_features")
          .insert({ program_plan_id: planId, feature_id: featureId, enabled });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["program-plan-features"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error updating feature",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update limit value
  const updateLimitMutation = useMutation({
    mutationFn: async ({
      planId,
      featureId,
      limitValue,
    }: {
      planId: string;
      featureId: string;
      limitValue: number | null;
    }) => {
      const existing = planFeatures?.find(
        (pf) => pf.program_plan_id === planId && pf.feature_id === featureId,
      );

      if (existing) {
        const { error } = await supabase
          .from("program_plan_features")
          .update({ limit_value: limitValue })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("program_plan_features")
          .insert({
            program_plan_id: planId,
            feature_id: featureId,
            enabled: true,
            limit_value: limitValue,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["program-plan-features"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error updating limit", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setPlanForm({
      name: "",
      display_name: "",
      description: "",
      tier_level: 0,
      is_active: true,
      credit_allowance: null,
    });
    setEditingPlan(null);
  };

  const handleOpenDialog = (plan?: ProgramPlan) => {
    if (plan) {
      setEditingPlan(plan);
      setPlanForm({
        name: plan.name,
        display_name: (plan as any).display_name || "",
        description: plan.description || "",
        tier_level: plan.tier_level,
        is_active: plan.is_active,
        credit_allowance: plan.credit_allowance,
      });
    } else {
      resetForm();
    }
    setIsPlanDialogOpen(true);
  };

  const handleSubmit = () => {
    if (editingPlan) {
      updatePlanMutation.mutate({ id: editingPlan.id, ...planForm });
    } else {
      createPlanMutation.mutate(planForm);
    }
  };

  const getFeatureStatus = (planId: string, featureId: string): boolean => {
    const pf = planFeatures?.find(
      (pf) => pf.program_plan_id === planId && pf.feature_id === featureId,
    );
    return pf?.enabled ?? false;
  };

  const getFeatureLimit = (planId: string, featureId: string): number | null => {
    const pf = planFeatures?.find(
      (pf) => pf.program_plan_id === planId && pf.feature_id === featureId,
    );
    return pf?.limit_value ?? null;
  };

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  // Group features by category
  const groupedFeatures =
    features?.reduce(
      (acc, feature) => {
        const categoryId = feature.category_id || "uncategorized";
        if (!acc[categoryId]) {
          acc[categoryId] = [];
        }
        acc[categoryId].push(feature);
        return acc;
      },
      {} as Record<string, Feature[]>,
    ) || {};

  if (plansLoading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Program Plans</h1>
          <p className="text-muted-foreground">
            Define feature access levels for different program enrollments (e.g., CTA programs vs.
            standard programs)
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="mr-2 h-4 w-4" />
          New Program Plan
        </Button>
      </div>

      <Tabs defaultValue="plans" className="space-y-4">
        <TabsList>
          <TabsTrigger value="plans">Program Plans</TabsTrigger>
          <TabsTrigger value="features">Feature Configuration</TabsTrigger>
        </TabsList>

        <TabsContent value="plans" className="space-y-4">
          {programPlans?.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Package className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No program plans yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Create program plans to define different feature access levels for enrollments
                </p>
                <Button onClick={() => handleOpenDialog()}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create First Program Plan
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-center">Tier</TableHead>
                    <TableHead className="text-center">Credits</TableHead>
                    <TableHead className="text-center">Features</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {programPlans?.map((plan) => (
                    <TableRow key={plan.id} className={!plan.is_active ? "opacity-60" : ""}>
                      <TableCell className="font-medium">{plan.name}</TableCell>
                      <TableCell className="max-w-xs truncate text-muted-foreground">
                        {plan.description || "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{plan.tier_level}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Coins className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">{plan.credit_allowance ?? "—"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Zap className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">
                            {planFeatures?.filter(
                              (pf) => pf.program_plan_id === plan.id && pf.enabled,
                            ).length || 0}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={plan.is_active ? "default" : "secondary"}>
                          {plan.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenDialog(plan)}
                          >
                            <Edit className="h-4 w-4 mr-1" /> Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => deletePlanMutation.mutate(plan.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-1" /> Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="features" className="space-y-4">
          {!programPlans?.length ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">
                  Create program plans first to configure features
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Feature Access by Program Plan</CardTitle>
                <CardDescription>
                  Configure which features are available for each program plan.
                  <span className="block mt-1 text-xs">
                    <Lock className="h-3 w-3 inline mr-1" />
                    <strong>System</strong> features are required for core functionality or menu
                    visibility.
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent className="max-h-[60vh] overflow-auto">
                <div className="min-w-max space-y-4 p-6">
                  {/* Header row with plan names */}
                  <div className="sticky top-0 z-10 -mx-6 px-6 py-2 bg-card border-b">
                    <div className="flex items-center">
                      <div className="min-w-[280px] pr-4 font-medium">Feature</div>
                      {programPlans?.map((plan) => (
                        <div
                          key={plan.id}
                          className="w-40 px-4 text-center font-medium text-sm border-l"
                        >
                          {plan.name}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Categorized features */}
                  {categories?.map((category) => (
                    <Collapsible
                      key={category.id}
                      open={expandedCategories.has(category.id)}
                      onOpenChange={() => toggleCategory(category.id)}
                    >
                      <CollapsibleTrigger className="flex items-center gap-2 w-full hover:bg-muted/50 p-2 rounded-md">
                        {expandedCategories.has(category.id) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        <span className="font-medium">{category.name}</span>
                        <Badge variant="outline" className="ml-2">
                          {groupedFeatures[category.id]?.length || 0}
                        </Badge>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pl-6 space-y-2 mt-2">
                        {groupedFeatures[category.id]?.map((feature) => (
                          <div key={feature.id} className="flex items-start py-2">
                            <div className="min-w-[280px] pr-4 flex-shrink-0">
                              <div className="font-medium text-sm flex items-center gap-2 flex-wrap">
                                <span className="whitespace-nowrap">{feature.name}</span>
                                {feature.is_system && (
                                  <Badge
                                    variant="outline"
                                    className="text-xs border-amber-500 text-amber-600 whitespace-nowrap"
                                  >
                                    <Lock className="h-3 w-3 mr-1" />
                                    System
                                  </Badge>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground">{feature.key}</div>
                            </div>
                            {programPlans?.map((plan) => (
                              <div
                                key={plan.id}
                                className="w-40 px-4 border-l flex flex-col items-center gap-1"
                              >
                                <Switch
                                  checked={getFeatureStatus(plan.id, feature.id)}
                                  onCheckedChange={(checked) =>
                                    toggleFeatureMutation.mutate({
                                      planId: plan.id,
                                      featureId: feature.id,
                                      enabled: checked,
                                    })
                                  }
                                />
                                {feature.is_consumable && getFeatureStatus(plan.id, feature.id) && (
                                  <Input
                                    type="number"
                                    placeholder="Limit"
                                    className="w-20 h-6 text-xs"
                                    value={getFeatureLimit(plan.id, feature.id) ?? ""}
                                    onChange={(e) =>
                                      updateLimitMutation.mutate({
                                        planId: plan.id,
                                        featureId: feature.id,
                                        limitValue: e.target.value
                                          ? parseInt(e.target.value)
                                          : null,
                                      })
                                    }
                                  />
                                )}
                              </div>
                            ))}
                          </div>
                        ))}
                      </CollapsibleContent>
                    </Collapsible>
                  ))}

                  {/* Uncategorized features */}
                  {groupedFeatures["uncategorized"]?.length > 0 && (
                    <Collapsible
                      open={expandedCategories.has("uncategorized")}
                      onOpenChange={() => toggleCategory("uncategorized")}
                    >
                      <CollapsibleTrigger className="flex items-center gap-2 w-full hover:bg-muted/50 p-2 rounded-md">
                        {expandedCategories.has("uncategorized") ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        <span className="font-medium">Uncategorized</span>
                        <Badge variant="outline" className="ml-2">
                          {groupedFeatures["uncategorized"]?.length || 0}
                        </Badge>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pl-6 space-y-2 mt-2">
                        {groupedFeatures["uncategorized"]?.map((feature) => (
                          <div key={feature.id} className="flex items-start py-2">
                            <div className="min-w-[280px] pr-4 flex-shrink-0">
                              <div className="font-medium text-sm flex items-center gap-2 flex-wrap">
                                <span className="whitespace-nowrap">{feature.name}</span>
                                {feature.is_system && (
                                  <Badge
                                    variant="outline"
                                    className="text-xs border-amber-500 text-amber-600 whitespace-nowrap"
                                  >
                                    <Lock className="h-3 w-3 mr-1" />
                                    System
                                  </Badge>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground">{feature.key}</div>
                            </div>
                            {programPlans?.map((plan) => (
                              <div
                                key={plan.id}
                                className="w-40 px-4 border-l flex flex-col items-center gap-1"
                              >
                                <Switch
                                  checked={getFeatureStatus(plan.id, feature.id)}
                                  onCheckedChange={(checked) =>
                                    toggleFeatureMutation.mutate({
                                      planId: plan.id,
                                      featureId: feature.id,
                                      enabled: checked,
                                    })
                                  }
                                />
                                {feature.is_consumable && getFeatureStatus(plan.id, feature.id) && (
                                  <Input
                                    type="number"
                                    placeholder="Limit"
                                    className="w-20 h-6 text-xs"
                                    value={getFeatureLimit(plan.id, feature.id) ?? ""}
                                    onChange={(e) =>
                                      updateLimitMutation.mutate({
                                        planId: plan.id,
                                        featureId: feature.id,
                                        limitValue: e.target.value
                                          ? parseInt(e.target.value)
                                          : null,
                                      })
                                    }
                                  />
                                )}
                              </div>
                            ))}
                          </div>
                        ))}
                      </CollapsibleContent>
                    </Collapsible>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Plan Dialog */}
      <Dialog open={isPlanDialogOpen} onOpenChange={setIsPlanDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPlan ? "Edit Program Plan" : "Create Program Plan"}</DialogTitle>
            <DialogDescription>
              Program plans define which features are available based on program enrollment
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={planForm.name}
                onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                placeholder="e.g., CTA Premium, Leadership Essentials"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="display_name">Display Name (for upsell messages)</Label>
              <Input
                id="display_name"
                value={planForm.display_name}
                onChange={(e) => setPlanForm({ ...planForm, display_name: e.target.value })}
                placeholder="e.g., program tier"
              />
              <p className="text-xs text-muted-foreground">
                How this program plan type is described in upgrade prompts
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={planForm.description}
                onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })}
                placeholder="Describe what this program plan includes..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tier_level">Tier Level</Label>
              <Input
                id="tier_level"
                type="number"
                min={0}
                value={planForm.tier_level}
                onChange={(e) =>
                  setPlanForm({ ...planForm, tier_level: parseInt(e.target.value) || 0 })
                }
              />
              <p className="text-xs text-muted-foreground">
                Higher tiers inherit access from lower tiers
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="credit_allowance">Credit Allowance</Label>
              <Input
                id="credit_allowance"
                type="number"
                min={0}
                value={planForm.credit_allowance ?? ""}
                onChange={(e) =>
                  setPlanForm({
                    ...planForm,
                    credit_allowance: e.target.value ? parseInt(e.target.value) : null,
                  })
                }
                placeholder="e.g., 100"
              />
              <p className="text-xs text-muted-foreground">
                Credits included with this program plan for enrolled users
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={planForm.is_active}
                onCheckedChange={(checked) => setPlanForm({ ...planForm, is_active: checked })}
              />
              <Label htmlFor="is_active">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPlanDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!planForm.name}>
              {editingPlan ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
