import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Euro, Copy, DollarSign, Settings } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useAdminCRUD } from "@/hooks/useAdminCRUD";
import {
  AdminPageHeader,
  AdminLoadingState,
  AdminEmptyState,
  AdminFormActions,
} from "@/components/admin";

interface PlanPrice {
  id: string;
  plan_id: string;
  billing_interval: string;
  price_cents: number;
  stripe_price_id: string | null;
  is_default: boolean;
}

interface Plan {
  id: string;
  key: string;
  name: string;
  description: string | null;
  stripe_product_id: string | null;
  is_active: boolean;
  is_free: boolean;
  tier_level: number;
  fallback_plan_id: string | null;
  plan_prices: PlanPrice[];
}

interface PlanFormData {
  key: string;
  name: string;
  display_name: string;
  description: string;
  stripe_product_id: string;
  is_active: boolean;
  is_free: boolean;
  tier_level: number;
  fallback_plan_id: string | null;
  credit_allowance: number | null;
}

interface PriceFormData {
  billing_interval: string;
  price_cents: number;
  stripe_price_id: string;
  is_default: boolean;
}

const initialPlanFormData: PlanFormData = {
  key: "",
  name: "",
  display_name: "",
  description: "",
  stripe_product_id: "",
  is_active: true,
  is_free: false,
  tier_level: 1,
  fallback_plan_id: null,
  credit_allowance: null,
};

const initialPriceFormData: PriceFormData = {
  billing_interval: "month",
  price_cents: 0,
  stripe_price_id: "",
  is_default: false,
};

export default function PlansManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isPriceDialogOpen, setIsPriceDialogOpen] = useState(false);
  const [editingPrice, setEditingPrice] = useState<PlanPrice | null>(null);
  const [selectedPlanForPrice, setSelectedPlanForPrice] = useState<Plan | null>(null);
  const [priceFormData, setPriceFormData] = useState<PriceFormData>(initialPriceFormData);

  const {
    data: plans,
    isLoading,
    isDialogOpen,
    setIsDialogOpen,
    editingItem: editingPlan,
    formData,
    setFormData,
    openCreate,
    handleEdit,
    handleDelete,
    isMutating,
  } = useAdminCRUD<Plan, PlanFormData>({
    tableName: "plans",
    queryKey: "plans",
    entityName: "Plan",
    orderBy: "tier_level",
    orderDirection: "asc",
    select: "*, plan_prices(*)",
    initialFormData: initialPlanFormData,
    mapItemToForm: (item) => ({
      key: item.key,
      name: item.name,
      display_name: (item as any).display_name || "",
      description: item.description || "",
      stripe_product_id: item.stripe_product_id || "",
      is_active: item.is_active,
      is_free: item.is_free,
      tier_level: item.tier_level,
      fallback_plan_id: item.fallback_plan_id,
      credit_allowance: (item as any).credit_allowance ?? null,
    }),
  });

  // Custom plan mutations for null handling
  const createPlanMutation = useMutation({
    mutationFn: async (data: PlanFormData) => {
      const { error } = await supabase.from("plans").insert({
        key: data.key,
        name: data.name,
        display_name: data.display_name || null,
        description: data.description || null,
        stripe_product_id: data.stripe_product_id || null,
        is_active: data.is_active,
        is_free: data.is_free,
        tier_level: data.tier_level,
        fallback_plan_id: data.fallback_plan_id,
        credit_allowance: data.credit_allowance,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plans"] });
      setIsDialogOpen(false);
      toast({ title: "Plan created successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error creating plan",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updatePlanMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: PlanFormData }) => {
      const { error } = await supabase
        .from("plans")
        .update({
          key: data.key,
          name: data.name,
          display_name: data.display_name || null,
          description: data.description || null,
          stripe_product_id: data.stripe_product_id || null,
          is_active: data.is_active,
          is_free: data.is_free,
          tier_level: data.tier_level,
          fallback_plan_id: data.fallback_plan_id,
          credit_allowance: data.credit_allowance,
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plans"] });
      setIsDialogOpen(false);
      toast({ title: "Plan updated successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error updating plan",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const clonePlanMutation = useMutation({
    mutationFn: async (plan: Plan) => {
      const { data: newPlan, error: planError } = await supabase
        .from("plans")
        .insert({
          key: `${plan.key}_copy`,
          name: `${plan.name} (Copy)`,
          description: plan.description,
          stripe_product_id: null,
          is_active: false,
          is_free: plan.is_free,
          tier_level: plan.tier_level,
          fallback_plan_id: plan.fallback_plan_id,
        })
        .select()
        .single();

      if (planError) throw planError;

      // Copy plan features
      const { data: features, error: featuresError } = await supabase
        .from("plan_features")
        .select("*")
        .eq("plan_id", plan.id);

      if (featuresError) throw featuresError;

      if (features && features.length > 0) {
        const newFeatures = features.map((f) => ({
          plan_id: newPlan.id,
          feature_id: f.feature_id,
          enabled: f.enabled,
          limit_value: f.limit_value,
        }));

        const { error: insertFeaturesError } = await supabase
          .from("plan_features")
          .insert(newFeatures);

        if (insertFeaturesError) throw insertFeaturesError;
      }

      // Copy plan prices (without Stripe IDs)
      if (plan.plan_prices && plan.plan_prices.length > 0) {
        const newPrices = plan.plan_prices.map((p) => ({
          plan_id: newPlan.id,
          billing_interval: p.billing_interval,
          price_cents: p.price_cents,
          stripe_price_id: null as string | null,
          is_default: p.is_default,
        }));

        const { error: insertPricesError } = await supabase.from("plan_prices").insert(newPrices);

        if (insertPricesError) throw insertPricesError;
      }

      return newPlan;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plans"] });
      toast({ title: "Plan cloned successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error cloning plan",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Price mutations
  const createPriceMutation = useMutation({
    mutationFn: async ({ planId, data }: { planId: string; data: PriceFormData }) => {
      const { error } = await supabase.from("plan_prices").insert({
        plan_id: planId,
        billing_interval: data.billing_interval,
        price_cents: data.price_cents,
        stripe_price_id: data.stripe_price_id || null,
        is_default: data.is_default,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plans"] });
      setIsPriceDialogOpen(false);
      resetPriceForm();
      toast({ title: "Price added successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error adding price",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updatePriceMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: PriceFormData }) => {
      const { error } = await supabase
        .from("plan_prices")
        .update({
          billing_interval: data.billing_interval,
          price_cents: data.price_cents,
          stripe_price_id: data.stripe_price_id || null,
          is_default: data.is_default,
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plans"] });
      setIsPriceDialogOpen(false);
      setEditingPrice(null);
      resetPriceForm();
      toast({ title: "Price updated successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error updating price",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deletePriceMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("plan_prices").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plans"] });
      toast({ title: "Price deleted successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error deleting price",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetPriceForm = () => {
    setPriceFormData(initialPriceFormData);
  };

  const handleOpenPriceDialog = (plan: Plan, price?: PlanPrice) => {
    setSelectedPlanForPrice(plan);
    if (price) {
      setEditingPrice(price);
      setPriceFormData({
        billing_interval: price.billing_interval,
        price_cents: price.price_cents,
        stripe_price_id: price.stripe_price_id || "",
        is_default: price.is_default,
      });
    } else {
      setEditingPrice(null);
      resetPriceForm();
    }
    setIsPriceDialogOpen(true);
  };

  const handlePlanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingPlan) {
      updatePlanMutation.mutate({ id: editingPlan.id, data: formData });
    } else {
      createPlanMutation.mutate(formData);
    }
  };

  const handlePriceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingPrice) {
      updatePriceMutation.mutate({ id: editingPrice.id, data: priceFormData });
    } else if (selectedPlanForPrice) {
      createPriceMutation.mutate({ planId: selectedPlanForPrice.id, data: priceFormData });
    }
  };

  const formatPrice = (cents: number) => {
    if (cents === 0) return "Free";
    return `€${(cents / 100).toFixed(2)}`;
  };

  const formatInterval = (interval: string) => {
    const labels: Record<string, string> = {
      month: "Monthly",
      year: "Yearly",
      week: "Weekly",
      day: "Daily",
      one_time: "One-time",
    };
    return labels[interval] || interval;
  };

  const isSubmitting = createPlanMutation.isPending || updatePlanMutation.isPending;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Plans Management"
        description="Create and manage subscription plans with multiple pricing tiers"
        actions={
          <Button onClick={openCreate} className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            Add Plan
          </Button>
        }
      />

      {isLoading ? (
        <AdminLoadingState />
      ) : !plans?.length ? (
        <AdminEmptyState
          icon={DollarSign}
          title="No plans configured"
          description="Create your first subscription plan to get started"
          actionLabel="Create Plan"
          onAction={openCreate}
        />
      ) : (
        <div className="space-y-4">
          {plans.map((plan) => (
            <Card key={plan.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <CardTitle>{plan.name}</CardTitle>
                      <Badge variant={plan.is_active ? "default" : "secondary"}>
                        {plan.is_active ? "Active" : "Inactive"}
                      </Badge>
                      {plan.is_free && <Badge variant="outline">Free</Badge>}
                      <Badge variant="outline">Tier {plan.tier_level}</Badge>
                    </div>
                    <CardDescription>
                      Key: <code className="rounded bg-muted px-1 py-0.5 text-xs">{plan.key}</code>
                      {plan.stripe_product_id && (
                        <span className="ml-2">
                          Stripe:{" "}
                          <code className="rounded bg-muted px-1 py-0.5 text-xs">
                            {plan.stripe_product_id}
                          </code>
                        </span>
                      )}
                    </CardDescription>
                    {plan.description && (
                      <p className="text-sm text-muted-foreground">{plan.description}</p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(plan)}
                      title="Edit Plan"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => clonePlanMutation.mutate(plan)}
                      title="Clone Plan"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(plan.id)}
                      title="Delete Plan"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Separator className="mb-4" />
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">Pricing</h4>
                    <Button variant="outline" size="sm" onClick={() => handleOpenPriceDialog(plan)}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add Price
                    </Button>
                  </div>
                  {plan.plan_prices?.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Interval</TableHead>
                          <TableHead>Price</TableHead>
                          <TableHead>Stripe Price ID</TableHead>
                          <TableHead>Default</TableHead>
                          <TableHead className="w-24">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {plan.plan_prices.map((price) => (
                          <TableRow key={price.id}>
                            <TableCell>{formatInterval(price.billing_interval)}</TableCell>
                            <TableCell className="font-medium">
                              {formatPrice(price.price_cents)}
                            </TableCell>
                            <TableCell>
                              {price.stripe_price_id ? (
                                <code className="text-xs bg-muted px-1 py-0.5 rounded">
                                  {price.stripe_price_id}
                                </code>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>{price.is_default && <Badge>Default</Badge>}</TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleOpenPriceDialog(plan, price)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    if (confirm("Delete this price?")) {
                                      deletePriceMutation.mutate(price.id);
                                    }
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">No prices configured</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Plan Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPlan ? "Edit Plan" : "Add Plan"}</DialogTitle>
            <DialogDescription>Configure the subscription plan details.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePlanSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="key">Key *</Label>
                <Input
                  id="key"
                  value={formData.key}
                  onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                  placeholder="e.g. pro, business"
                  required
                />
              </div>
            </div>
            <div>
              <Label htmlFor="display_name">Display Name (for upsell messages)</Label>
              <Input
                id="display_name"
                value={formData.display_name}
                onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                placeholder="e.g. subscription plan"
              />
              <p className="text-xs text-muted-foreground mt-1">
                How this plan type is described in upgrade prompts (e.g., "Available with Pro
                subscription plan")
              </p>
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="tier_level">Tier Level</Label>
                <Input
                  id="tier_level"
                  type="number"
                  min={0}
                  value={formData.tier_level}
                  onChange={(e) =>
                    setFormData({ ...formData, tier_level: parseInt(e.target.value) || 1 })
                  }
                />
              </div>
              <div>
                <Label htmlFor="stripe_product_id">Stripe Product ID</Label>
                <Input
                  id="stripe_product_id"
                  value={formData.stripe_product_id}
                  onChange={(e) => setFormData({ ...formData, stripe_product_id: e.target.value })}
                  placeholder="prod_..."
                />
              </div>
            </div>
            <div>
              <Label htmlFor="fallback_plan_id">Fallback Plan</Label>
              <Select
                value={formData.fallback_plan_id || "_none"}
                onValueChange={(value) =>
                  setFormData({ ...formData, fallback_plan_id: value === "_none" ? null : value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="No fallback" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">No fallback</SelectItem>
                  {plans
                    ?.filter((p) => p.id !== editingPlan?.id)
                    .map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="credit_allowance">Credit Allowance</Label>
              <Input
                id="credit_allowance"
                type="number"
                min={0}
                value={formData.credit_allowance ?? ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    credit_allowance: e.target.value ? parseInt(e.target.value) : null,
                  })
                }
                placeholder="e.g., 100"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Credits included monthly with this subscription plan
              </p>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="is_free">Free Plan</Label>
                <p className="text-xs text-muted-foreground">No payment required</p>
              </div>
              <Switch
                id="is_free"
                checked={formData.is_free}
                onCheckedChange={(checked) => setFormData({ ...formData, is_free: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="is_active">Active</Label>
                <p className="text-xs text-muted-foreground">Available for new subscriptions</p>
              </div>
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
            <AdminFormActions
              onCancel={() => setIsDialogOpen(false)}
              isEditing={!!editingPlan}
              isSubmitting={isSubmitting}
              submitLabel={{ create: "Create Plan", update: "Save Changes" }}
            />
          </form>
        </DialogContent>
      </Dialog>

      {/* Price Dialog */}
      <Dialog
        open={isPriceDialogOpen}
        onOpenChange={(open) => {
          setIsPriceDialogOpen(open);
          if (!open) {
            setEditingPrice(null);
            resetPriceForm();
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingPrice ? "Edit Price" : "Add Price"}</DialogTitle>
            <DialogDescription>
              Configure pricing for {selectedPlanForPrice?.name}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePriceSubmit} className="space-y-4">
            <div>
              <Label htmlFor="billing_interval">Billing Interval</Label>
              <Select
                value={priceFormData.billing_interval}
                onValueChange={(value) =>
                  setPriceFormData({ ...priceFormData, billing_interval: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">Monthly</SelectItem>
                  <SelectItem value="year">Yearly</SelectItem>
                  <SelectItem value="week">Weekly</SelectItem>
                  <SelectItem value="one_time">One-time</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="price_cents">Price (in cents)</Label>
              <Input
                id="price_cents"
                type="number"
                min={0}
                value={priceFormData.price_cents}
                onChange={(e) =>
                  setPriceFormData({ ...priceFormData, price_cents: parseInt(e.target.value) || 0 })
                }
              />
              <p className="text-xs text-muted-foreground mt-1">
                {formatPrice(priceFormData.price_cents)}
              </p>
            </div>
            <div>
              <Label htmlFor="stripe_price_id">Stripe Price ID</Label>
              <Input
                id="stripe_price_id"
                value={priceFormData.stripe_price_id}
                onChange={(e) =>
                  setPriceFormData({ ...priceFormData, stripe_price_id: e.target.value })
                }
                placeholder="price_..."
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="is_default">Default Price</Label>
                <p className="text-xs text-muted-foreground">Show as default option</p>
              </div>
              <Switch
                id="is_default"
                checked={priceFormData.is_default}
                onCheckedChange={(checked) =>
                  setPriceFormData({ ...priceFormData, is_default: checked })
                }
              />
            </div>
            <AdminFormActions
              onCancel={() => {
                setIsPriceDialogOpen(false);
                setEditingPrice(null);
                resetPriceForm();
              }}
              isEditing={!!editingPrice}
              isSubmitting={createPriceMutation.isPending || updatePriceMutation.isPending}
              submitLabel={{ create: "Add Price", update: "Save Changes" }}
            />
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
