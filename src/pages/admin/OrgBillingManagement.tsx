import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
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
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Pencil,
  Trash2,
  Coins,
  CreditCard,
  Building2,
  Loader2,
  Gift,
  TrendingUp,
} from "lucide-react";
import { formatPrice, calculateBonus } from "@/hooks/useCreditBatches";

interface CreditPackage {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price_cents: number;
  credit_value: number;
  currency: string;
  stripe_price_id: string | null;
  validity_months: number | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

interface PlatformTier {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  annual_fee_cents: number;
  monthly_fee_cents: number | null;
  currency: string;
  stripe_annual_price_id: string | null;
  stripe_monthly_price_id: string | null;
  features: string[];
  max_members: number | null;
  max_sponsored_seats: number | null;
  includes_analytics: boolean;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

export default function OrgBillingManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("packages");

  // Package dialog state
  const [packageDialogOpen, setPackageDialogOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<CreditPackage | null>(null);
  const [packageForm, setPackageForm] = useState({
    name: "",
    slug: "",
    description: "",
    price_cents: 0,
    credit_value: 0,
    currency: "eur",
    validity_months: 24,
    display_order: 0,
    is_active: true,
  });

  // Tier dialog state
  const [tierDialogOpen, setTierDialogOpen] = useState(false);
  const [editingTier, setEditingTier] = useState<PlatformTier | null>(null);
  const [tierForm, setTierForm] = useState({
    name: "",
    slug: "",
    description: "",
    annual_fee_cents: 0,
    monthly_fee_cents: 0,
    currency: "eur",
    features: "",
    max_members: "",
    max_sponsored_seats: "",
    includes_analytics: true,
    display_order: 0,
    is_active: true,
  });

  // Fetch packages
  const { data: packages, isLoading: packagesLoading } = useQuery({
    queryKey: ["admin-org-credit-packages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("org_credit_packages")
        .select("*")
        .order("display_order");
      if (error) throw error;
      return data as CreditPackage[];
    },
  });

  // Fetch tiers
  const { data: tiers, isLoading: tiersLoading } = useQuery({
    queryKey: ["admin-org-platform-tiers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("org_platform_tiers")
        .select("*")
        .order("display_order");
      if (error) throw error;
      return (data || []).map((tier) => ({
        ...tier,
        features: Array.isArray(tier.features) ? tier.features : [],
      })) as PlatformTier[];
    },
  });

  // Package mutations
  const savePackage = useMutation({
    mutationFn: async (data: typeof packageForm & { id?: string }) => {
      if (data.id) {
        const { error } = await supabase
          .from("org_credit_packages")
          .update({
            name: data.name,
            description: data.description || null,
            price_cents: data.price_cents,
            credit_value: data.credit_value,
            currency: data.currency,
            validity_months: data.validity_months || null,
            display_order: data.display_order,
            is_active: data.is_active,
            updated_at: new Date().toISOString(),
          })
          .eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("org_credit_packages").insert({
          name: data.name,
          slug: data.slug,
          description: data.description || null,
          price_cents: data.price_cents,
          credit_value: data.credit_value,
          currency: data.currency,
          validity_months: data.validity_months || null,
          display_order: data.display_order,
          is_active: data.is_active,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-org-credit-packages"] });
      toast({ title: editingPackage ? "Package updated" : "Package created" });
      setPackageDialogOpen(false);
      resetPackageForm();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deletePackage = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("org_credit_packages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-org-credit-packages"] });
      toast({ title: "Package deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Tier mutations
  const saveTier = useMutation({
    mutationFn: async (data: typeof tierForm & { id?: string }) => {
      const features = data.features.split("\n").filter((f) => f.trim());
      const maxSponsoredSeats =
        data.max_sponsored_seats === "" ? null : parseInt(data.max_sponsored_seats);
      if (data.id) {
        const { error } = await supabase
          .from("org_platform_tiers")
          .update({
            name: data.name,
            description: data.description || null,
            annual_fee_cents: data.annual_fee_cents,
            monthly_fee_cents: data.monthly_fee_cents || null,
            currency: data.currency,
            features,
            max_members: data.max_members ? parseInt(data.max_members) : null,
            max_sponsored_seats: maxSponsoredSeats,
            includes_analytics: data.includes_analytics,
            display_order: data.display_order,
            is_active: data.is_active,
            updated_at: new Date().toISOString(),
          })
          .eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("org_platform_tiers").insert({
          name: data.name,
          slug: data.slug,
          description: data.description || null,
          annual_fee_cents: data.annual_fee_cents,
          monthly_fee_cents: data.monthly_fee_cents || null,
          currency: data.currency,
          features,
          max_members: data.max_members ? parseInt(data.max_members) : null,
          max_sponsored_seats: maxSponsoredSeats,
          includes_analytics: data.includes_analytics,
          display_order: data.display_order,
          is_active: data.is_active,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-org-platform-tiers"] });
      toast({ title: editingTier ? "Tier updated" : "Tier created" });
      setTierDialogOpen(false);
      resetTierForm();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteTier = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("org_platform_tiers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-org-platform-tiers"] });
      toast({ title: "Tier deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const resetPackageForm = () => {
    setPackageForm({
      name: "",
      slug: "",
      description: "",
      price_cents: 0,
      credit_value: 0,
      currency: "eur",
      validity_months: 24,
      display_order: 0,
      is_active: true,
    });
    setEditingPackage(null);
  };

  const resetTierForm = () => {
    setTierForm({
      name: "",
      slug: "",
      description: "",
      annual_fee_cents: 0,
      monthly_fee_cents: 0,
      currency: "eur",
      features: "",
      max_members: "",
      max_sponsored_seats: "",
      includes_analytics: true,
      display_order: 0,
      is_active: true,
    });
    setEditingTier(null);
  };

  const handleEditPackage = (pkg: CreditPackage) => {
    setEditingPackage(pkg);
    setPackageForm({
      name: pkg.name,
      slug: pkg.slug,
      description: pkg.description || "",
      price_cents: pkg.price_cents,
      credit_value: pkg.credit_value,
      currency: pkg.currency,
      validity_months: pkg.validity_months || 24,
      display_order: pkg.display_order,
      is_active: pkg.is_active,
    });
    setPackageDialogOpen(true);
  };

  const handleEditTier = (tier: PlatformTier) => {
    setEditingTier(tier);
    setTierForm({
      name: tier.name,
      slug: tier.slug,
      description: tier.description || "",
      annual_fee_cents: tier.annual_fee_cents,
      monthly_fee_cents: tier.monthly_fee_cents || 0,
      currency: tier.currency,
      features: tier.features.join("\n"),
      max_members: tier.max_members?.toString() || "",
      max_sponsored_seats: tier.max_sponsored_seats?.toString() || "",
      includes_analytics: tier.includes_analytics,
      display_order: tier.display_order,
      is_active: tier.is_active,
    });
    setTierDialogOpen(true);
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Organization Billing</h1>
          <p className="text-muted-foreground">
            Manage credit packages and platform subscription tiers for organizations
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="packages" className="flex items-center gap-2">
              <Coins className="h-4 w-4" />
              Credit Packages
            </TabsTrigger>
            <TabsTrigger value="tiers" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Platform Tiers
            </TabsTrigger>
          </TabsList>

          <TabsContent value="packages" className="space-y-4">
            <div className="flex justify-end">
              <Dialog
                open={packageDialogOpen}
                onOpenChange={(open) => {
                  setPackageDialogOpen(open);
                  if (!open) resetPackageForm();
                }}
              >
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Package
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>
                      {editingPackage ? "Edit Package" : "Create Credit Package"}
                    </DialogTitle>
                    <DialogDescription>
                      Configure a credit package that organizations can purchase
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Name</Label>
                        <Input
                          value={packageForm.name}
                          onChange={(e) => {
                            const name = e.target.value;
                            setPackageForm((prev) => ({
                              ...prev,
                              name,
                              slug: editingPackage ? prev.slug : generateSlug(name),
                            }));
                          }}
                          placeholder="Growth Package"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Slug</Label>
                        <Input
                          value={packageForm.slug}
                          onChange={(e) =>
                            setPackageForm((prev) => ({ ...prev, slug: e.target.value }))
                          }
                          disabled={!!editingPackage}
                          className={editingPackage ? "bg-muted" : ""}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Textarea
                        value={packageForm.description}
                        onChange={(e) =>
                          setPackageForm((prev) => ({ ...prev, description: e.target.value }))
                        }
                        placeholder="Best value for growing teams"
                        rows={2}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Price (cents)</Label>
                        <Input
                          type="number"
                          value={packageForm.price_cents}
                          onChange={(e) =>
                            setPackageForm((prev) => ({
                              ...prev,
                              price_cents: parseInt(e.target.value) || 0,
                            }))
                          }
                        />
                        <p className="text-xs text-muted-foreground">
                          = {formatPrice(packageForm.price_cents, packageForm.currency)}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label>Credit Value</Label>
                        <Input
                          type="number"
                          value={packageForm.credit_value}
                          onChange={(e) =>
                            setPackageForm((prev) => ({
                              ...prev,
                              credit_value: parseInt(e.target.value) || 0,
                            }))
                          }
                        />
                        {packageForm.price_cents > 0 && (
                          <p className="text-xs text-green-600">
                            +{calculateBonus(packageForm.price_cents, packageForm.credit_value)}%
                            bonus
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Currency</Label>
                        <Input
                          value={packageForm.currency}
                          onChange={(e) =>
                            setPackageForm((prev) => ({ ...prev, currency: e.target.value }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Validity (months)</Label>
                        <Input
                          type="number"
                          value={packageForm.validity_months}
                          onChange={(e) =>
                            setPackageForm((prev) => ({
                              ...prev,
                              validity_months: parseInt(e.target.value) || 0,
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Order</Label>
                        <Input
                          type="number"
                          value={packageForm.display_order}
                          onChange={(e) =>
                            setPackageForm((prev) => ({
                              ...prev,
                              display_order: parseInt(e.target.value) || 0,
                            }))
                          }
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={packageForm.is_active}
                        onCheckedChange={(checked) =>
                          setPackageForm((prev) => ({ ...prev, is_active: checked }))
                        }
                      />
                      <Label>Active</Label>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setPackageDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      onClick={() => savePackage.mutate({ ...packageForm, id: editingPackage?.id })}
                      disabled={savePackage.isPending}
                    >
                      {savePackage.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      {editingPackage ? "Update" : "Create"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {packagesLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Package</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Credits</TableHead>
                      <TableHead>Bonus</TableHead>
                      <TableHead>Validity</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {packages?.map((pkg) => (
                      <TableRow key={pkg.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{pkg.name}</div>
                            <div className="text-sm text-muted-foreground">{pkg.slug}</div>
                          </div>
                        </TableCell>
                        <TableCell>{formatPrice(pkg.price_cents, pkg.currency)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Coins className="h-4 w-4 text-yellow-500" />
                            {pkg.credit_value.toLocaleString()}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-green-600">
                            <Gift className="h-3 w-3 mr-1" />+
                            {calculateBonus(pkg.price_cents, pkg.credit_value)}%
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {pkg.validity_months ? `${pkg.validity_months} months` : "Never"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={pkg.is_active ? "default" : "secondary"}>
                            {pkg.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEditPackage(pkg)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive"
                              onClick={() => deletePackage.mutate(pkg.id)}
                            >
                              <Trash2 className="h-4 w-4" />
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

          <TabsContent value="tiers" className="space-y-4">
            <div className="flex justify-end">
              <Dialog
                open={tierDialogOpen}
                onOpenChange={(open) => {
                  setTierDialogOpen(open);
                  if (!open) resetTierForm();
                }}
              >
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Tier
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>{editingTier ? "Edit Tier" : "Create Platform Tier"}</DialogTitle>
                    <DialogDescription>
                      Configure a platform subscription tier for organizations
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Name</Label>
                        <Input
                          value={tierForm.name}
                          onChange={(e) => {
                            const name = e.target.value;
                            setTierForm((prev) => ({
                              ...prev,
                              name,
                              slug: editingTier ? prev.slug : generateSlug(name),
                            }));
                          }}
                          placeholder="Professional"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Slug</Label>
                        <Input
                          value={tierForm.slug}
                          onChange={(e) =>
                            setTierForm((prev) => ({ ...prev, slug: e.target.value }))
                          }
                          disabled={!!editingTier}
                          className={editingTier ? "bg-muted" : ""}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Textarea
                        value={tierForm.description}
                        onChange={(e) =>
                          setTierForm((prev) => ({ ...prev, description: e.target.value }))
                        }
                        rows={2}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Annual Fee (cents)</Label>
                        <Input
                          type="number"
                          value={tierForm.annual_fee_cents}
                          onChange={(e) =>
                            setTierForm((prev) => ({
                              ...prev,
                              annual_fee_cents: parseInt(e.target.value) || 0,
                            }))
                          }
                        />
                        <p className="text-xs text-muted-foreground">
                          = {formatPrice(tierForm.annual_fee_cents, tierForm.currency)}/year
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label>Monthly Fee (cents)</Label>
                        <Input
                          type="number"
                          value={tierForm.monthly_fee_cents}
                          onChange={(e) =>
                            setTierForm((prev) => ({
                              ...prev,
                              monthly_fee_cents: parseInt(e.target.value) || 0,
                            }))
                          }
                        />
                        <p className="text-xs text-muted-foreground">
                          = {formatPrice(tierForm.monthly_fee_cents, tierForm.currency)}/month
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Features (one per line)</Label>
                      <Textarea
                        value={tierForm.features}
                        onChange={(e) =>
                          setTierForm((prev) => ({ ...prev, features: e.target.value }))
                        }
                        placeholder="Organization dashboard&#10;Basic analytics&#10;Email support"
                        rows={4}
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Max Members</Label>
                        <Input
                          type="number"
                          value={tierForm.max_members}
                          onChange={(e) =>
                            setTierForm((prev) => ({ ...prev, max_members: e.target.value }))
                          }
                          placeholder="Unlimited"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Sponsored Seats</Label>
                        <Input
                          type="number"
                          value={tierForm.max_sponsored_seats}
                          onChange={(e) =>
                            setTierForm((prev) => ({
                              ...prev,
                              max_sponsored_seats: e.target.value,
                            }))
                          }
                          placeholder="0 (leave empty for unlimited)"
                        />
                        <p className="text-xs text-muted-foreground">Leave empty for unlimited</p>
                      </div>
                      <div className="space-y-2">
                        <Label>Order</Label>
                        <Input
                          type="number"
                          value={tierForm.display_order}
                          onChange={(e) =>
                            setTierForm((prev) => ({
                              ...prev,
                              display_order: parseInt(e.target.value) || 0,
                            }))
                          }
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={tierForm.includes_analytics}
                          onCheckedChange={(checked) =>
                            setTierForm((prev) => ({ ...prev, includes_analytics: checked }))
                          }
                        />
                        <Label>Analytics</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={tierForm.is_active}
                          onCheckedChange={(checked) =>
                            setTierForm((prev) => ({ ...prev, is_active: checked }))
                          }
                        />
                        <Label>Active</Label>
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setTierDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      onClick={() => saveTier.mutate({ ...tierForm, id: editingTier?.id })}
                      disabled={saveTier.isPending}
                    >
                      {saveTier.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      {editingTier ? "Update" : "Create"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {tiersLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {tiers?.map((tier) => (
                  <Card key={tier.id} className={!tier.is_active ? "opacity-60" : ""}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                          <Building2 className="h-5 w-5" />
                          {tier.name}
                        </CardTitle>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => handleEditTier(tier)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => deleteTier.mutate(tier.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <CardDescription>{tier.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold">
                          {formatPrice(tier.annual_fee_cents, tier.currency)}
                        </span>
                        <span className="text-muted-foreground">/year</span>
                      </div>
                      {tier.monthly_fee_cents && (
                        <p className="text-sm text-muted-foreground">
                          or {formatPrice(tier.monthly_fee_cents, tier.currency)}/month
                        </p>
                      )}
                      <div className="space-y-2">
                        {tier.features.map((feature, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm">
                            <TrendingUp className="h-4 w-4 text-green-500" />
                            {feature}
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Badge variant={tier.is_active ? "default" : "secondary"}>
                          {tier.is_active ? "Active" : "Inactive"}
                        </Badge>
                        {tier.max_members && (
                          <Badge variant="outline">Max {tier.max_members} members</Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
