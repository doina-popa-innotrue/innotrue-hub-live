import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Coins, Star, Loader2 } from "lucide-react";
import { PageLoadingState } from "@/components/ui/page-loading-state";
import { useCreditRatio, formatRatioText } from "@/hooks/useCreditRatio";

interface TopupPackage {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price_cents: number;
  credit_value: number;
  currency: string;
  validity_months: number | null;
  display_order: number | null;
  is_active: boolean | null;
  is_featured: boolean | null;
  max_per_user: number | null;
  stripe_price_id: string | null;
  created_at: string | null;
}

const defaultFormData = {
  name: "",
  slug: "",
  description: "",
  price_cents: "",
  credit_value: "",
  currency: "eur",
  validity_months: "120",
  display_order: "0",
  is_active: true,
  is_featured: false,
  max_per_user: "",
  stripe_price_id: "",
};

export default function CreditTopupPackagesManagement() {
  const queryClient = useQueryClient();
  const { creditRatio } = useCreditRatio();
  const [formData, setFormData] = useState(defaultFormData);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<TopupPackage | null>(null);

  const { data: packages, isLoading } = useQuery({
    queryKey: ["admin-credit-topup-packages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_topup_packages")
        .select("*")
        .order("display_order", { ascending: true });

      if (error) throw error;
      return data as TopupPackage[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from("credit_topup_packages").insert({
        name: data.name,
        slug: data.slug,
        description: data.description || null,
        price_cents: parseInt(data.price_cents) || 0,
        credit_value: parseInt(data.credit_value) || 0,
        currency: data.currency,
        validity_months: data.validity_months ? parseInt(data.validity_months) : null,
        display_order: parseInt(data.display_order) || 0,
        is_active: data.is_active,
        is_featured: data.is_featured,
        max_per_user: data.max_per_user ? parseInt(data.max_per_user) : null,
        stripe_price_id: data.stripe_price_id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-credit-topup-packages"] });
      setIsDialogOpen(false);
      resetForm();
      toast.success("Package created successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create package: ${error.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { error } = await supabase
        .from("credit_topup_packages")
        .update({
          name: data.name,
          slug: data.slug,
          description: data.description || null,
          price_cents: parseInt(data.price_cents) || 0,
          credit_value: parseInt(data.credit_value) || 0,
          currency: data.currency,
          validity_months: data.validity_months ? parseInt(data.validity_months) : null,
          display_order: parseInt(data.display_order) || 0,
          is_active: data.is_active,
          is_featured: data.is_featured,
          max_per_user: data.max_per_user ? parseInt(data.max_per_user) : null,
          stripe_price_id: data.stripe_price_id || null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-credit-topup-packages"] });
      setIsDialogOpen(false);
      resetForm();
      setEditingPackage(null);
      toast.success("Package updated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update package: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("credit_topup_packages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-credit-topup-packages"] });
      toast.success("Package deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete package: ${error.message}`);
    },
  });

  const resetForm = () => {
    setFormData(defaultFormData);
    setEditingPackage(null);
  };

  const openCreate = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEdit = (pkg: TopupPackage) => {
    setEditingPackage(pkg);
    setFormData({
      name: pkg.name,
      slug: pkg.slug,
      description: pkg.description || "",
      price_cents: String(pkg.price_cents),
      credit_value: String(pkg.credit_value),
      currency: pkg.currency,
      validity_months: pkg.validity_months != null ? String(pkg.validity_months) : "",
      display_order: pkg.display_order != null ? String(pkg.display_order) : "0",
      is_active: pkg.is_active ?? true,
      is_featured: pkg.is_featured ?? false,
      max_per_user: pkg.max_per_user != null ? String(pkg.max_per_user) : "",
      stripe_price_id: pkg.stripe_price_id || "",
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.slug || !formData.price_cents || !formData.credit_value) {
      toast.error("Please fill in all required fields (name, slug, price, credits)");
      return;
    }

    if (editingPackage) {
      updateMutation.mutate({ id: editingPackage.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const formatPrice = (cents: number) => {
    return `€${(cents / 100).toFixed(2)}`;
  };

  const calculateRatio = (priceCents: number, credits: number) => {
    if (credits === 0) return "N/A";
    const eurPerCredit = priceCents / 100 / credits;
    return `€${eurPerCredit.toFixed(3)}/credit`;
  };

  const calculateBonus = (priceCents: number, credits: number) => {
    const baseCredits = (priceCents / 100) * creditRatio;
    if (baseCredits === 0 || credits <= baseCredits) return null;
    const bonusPct = Math.round(((credits - baseCredits) / baseCredits) * 100);
    return bonusPct > 0 ? bonusPct : null;
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  if (isLoading) {
    return <PageLoadingState message="Loading credit packages..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Credit Top-Up Packages</h1>
          <p className="text-muted-foreground">
            Manage individual user credit packages available for purchase
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          New Package
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Packages</CardTitle>
          <CardDescription>
            {packages?.length ?? 0} package{(packages?.length ?? 0) !== 1 ? "s" : ""} configured.
            Base ratio: {formatRatioText(creditRatio)}. Packages may include volume bonuses.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Credits</TableHead>
                <TableHead className="text-right">Ratio</TableHead>
                <TableHead className="text-right">Validity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {packages?.map((pkg) => {
                const bonus = calculateBonus(pkg.price_cents, pkg.credit_value);
                return (
                  <TableRow key={pkg.id} className={!pkg.is_active ? "opacity-50" : ""}>
                    <TableCell className="text-muted-foreground">
                      {pkg.display_order ?? "-"}
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {pkg.name}
                        {pkg.is_featured && (
                          <Badge variant="secondary" className="text-xs">
                            <Star className="h-3 w-3 mr-1" />
                            Featured
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">
                      {pkg.slug}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatPrice(pkg.price_cents)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {pkg.credit_value.toLocaleString()}
                        {bonus && (
                          <Badge variant="outline" className="text-xs text-green-600">
                            +{bonus}%
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {calculateRatio(pkg.price_cents, pkg.credit_value)}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {pkg.validity_months ? `${pkg.validity_months} mo` : "None"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {pkg.is_active ? (
                          <Badge variant="default">Active</Badge>
                        ) : (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(pkg)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm(`Delete package "${pkg.name}"? This cannot be undone.`)) {
                              deleteMutation.mutate(pkg.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {(!packages || packages.length === 0) && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    No packages configured. Click "New Package" to create one.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            resetForm();
          }
          setIsDialogOpen(open);
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Coins className="h-5 w-5" />
              {editingPackage ? "Edit Package" : "Create Package"}
            </DialogTitle>
            <DialogDescription>
              {editingPackage
                ? "Update credit top-up package details."
                : "Create a new credit top-up package for users to purchase."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Session Top-Up"
                />
              </div>
              <div className="space-y-2">
                <Label>Slug *</Label>
                <Input
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  placeholder="e.g., session-topup"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description shown to users"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Price (cents) *</Label>
                <Input
                  type="number"
                  value={formData.price_cents}
                  onChange={(e) => setFormData({ ...formData, price_cents: e.target.value })}
                  placeholder="e.g., 7500 for €75.00"
                />
                {formData.price_cents && (
                  <p className="text-xs text-muted-foreground">
                    = {formatPrice(parseInt(formData.price_cents) || 0)}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Credit Value *</Label>
                <Input
                  type="number"
                  value={formData.credit_value}
                  onChange={(e) => setFormData({ ...formData, credit_value: e.target.value })}
                  placeholder="e.g., 150"
                />
                {formData.price_cents && formData.credit_value && (
                  <p className="text-xs text-muted-foreground">
                    {calculateRatio(
                      parseInt(formData.price_cents) || 0,
                      parseInt(formData.credit_value) || 0,
                    )}
                    {(() => {
                      const b = calculateBonus(
                        parseInt(formData.price_cents) || 0,
                        parseInt(formData.credit_value) || 0,
                      );
                      return b ? ` (+${b}% bonus)` : "";
                    })()}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Currency</Label>
                <Input
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  placeholder="eur"
                />
              </div>
              <div className="space-y-2">
                <Label>Validity (months)</Label>
                <Input
                  type="number"
                  value={formData.validity_months}
                  onChange={(e) => setFormData({ ...formData, validity_months: e.target.value })}
                  placeholder="e.g., 120"
                />
              </div>
              <div className="space-y-2">
                <Label>Display Order</Label>
                <Input
                  type="number"
                  value={formData.display_order}
                  onChange={(e) => setFormData({ ...formData, display_order: e.target.value })}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Max Per User</Label>
                <Input
                  type="number"
                  value={formData.max_per_user}
                  onChange={(e) => setFormData({ ...formData, max_per_user: e.target.value })}
                  placeholder="Unlimited if empty"
                />
              </div>
              <div className="space-y-2">
                <Label>Stripe Price ID</Label>
                <Input
                  value={formData.stripe_price_id}
                  onChange={(e) => setFormData({ ...formData, stripe_price_id: e.target.value })}
                  placeholder="price_... (auto-created if empty)"
                />
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label>Active</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_featured}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_featured: checked })}
                />
                <Label>Featured</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingPackage ? "Save Changes" : "Create Package"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
