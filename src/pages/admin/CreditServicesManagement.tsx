import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader, AdminLoadingState, AdminEmptyState } from "@/components/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Coins, Plus, Pencil, Trash2, Tag, Link2 } from "lucide-react";
import { toast } from "sonner";

interface CreditService {
  id: string;
  name: string;
  description: string | null;
  credit_cost: number;
  category: string;
  feature_id: string | null;
  track_id: string | null;
  linked_entity_type: string | null;
  linked_entity_id: string | null;
  track_discounted_cost: number | null;
  is_active: boolean;
  created_at: string;
  features?: { name: string } | null;
  tracks?: { name: string } | null;
}

interface Feature {
  id: string;
  name: string;
  key: string;
}

interface Track {
  id: string;
  name: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  ai: "AI",
  goals: "Goals",
  programs: "Programs",
  sessions: "Sessions",
  specialty: "Specialty",
  // Legacy / fallback categories
  general: "General",
  session: "Sessions",
  assessment: "Assessments",
  coaching: "Coaching",
  resource: "Resources",
  certification: "Certifications",
};

const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS).map(([value, label]) => ({
  value,
  label,
}));

const ENTITY_TYPES = [
  { value: "none", label: "None" },
  { value: "session_type", label: "Session Type" },
  { value: "assessment", label: "Assessment" },
  { value: "resource", label: "Resource" },
  { value: "program_module", label: "Program Module" },
];

export default function CreditServicesManagement() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<CreditService | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    credit_cost: 0,
    category: "general",
    feature_id: "",
    track_id: "",
    linked_entity_type: "",
    linked_entity_id: "",
    track_discounted_cost: "",
    is_active: true,
  });

  // Fetch credit services
  const { data: services, isLoading } = useQuery({
    queryKey: ["credit-services"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_services")
        .select(
          `
          *,
          features:feature_id(name),
          tracks:track_id(name)
        `,
        )
        .order("category", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return data as CreditService[];
    },
  });

  // Fetch features for dropdown
  const { data: features } = useQuery({
    queryKey: ["features-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("features").select("id, name, key").order("name");
      if (error) throw error;
      return data as Feature[];
    },
  });

  // Fetch tracks for dropdown
  const { data: tracks } = useQuery({
    queryKey: ["tracks-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tracks")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as Track[];
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from("credit_services").insert({
        name: data.name,
        description: data.description || null,
        credit_cost: data.credit_cost,
        category: data.category,
        feature_id: data.feature_id || null,
        track_id: data.track_id || null,
        linked_entity_type: data.linked_entity_type || null,
        linked_entity_id: data.linked_entity_id || null,
        track_discounted_cost: data.track_discounted_cost
          ? parseInt(data.track_discounted_cost)
          : null,
        is_active: data.is_active,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credit-services"] });
      toast.success("Credit service created");
      handleCloseDialog();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { error } = await supabase
        .from("credit_services")
        .update({
          name: data.name,
          description: data.description || null,
          credit_cost: data.credit_cost,
          category: data.category,
          feature_id: data.feature_id || null,
          track_id: data.track_id || null,
          linked_entity_type: data.linked_entity_type || null,
          linked_entity_id: data.linked_entity_id || null,
          track_discounted_cost: data.track_discounted_cost
            ? parseInt(data.track_discounted_cost)
            : null,
          is_active: data.is_active,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credit-services"] });
      toast.success("Credit service updated");
      handleCloseDialog();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("credit_services").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credit-services"] });
      toast.success("Credit service deleted");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleOpenDialog = (service?: CreditService) => {
    if (service) {
      setEditingService(service);
      setFormData({
        name: service.name,
        description: service.description || "",
        credit_cost: service.credit_cost,
        category: service.category,
        feature_id: service.feature_id || "",
        track_id: service.track_id || "",
        linked_entity_type: service.linked_entity_type || "",
        linked_entity_id: service.linked_entity_id || "",
        track_discounted_cost: service.track_discounted_cost?.toString() || "",
        is_active: service.is_active,
      });
    } else {
      setEditingService(null);
      setFormData({
        name: "",
        description: "",
        credit_cost: 0,
        category: "general",
        feature_id: "",
        track_id: "",
        linked_entity_type: "",
        linked_entity_id: "",
        track_discounted_cost: "",
        is_active: true,
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingService(null);
  };

  const handleSubmit = () => {
    if (!formData.name) {
      toast.error("Name is required");
      return;
    }
    if (editingService) {
      updateMutation.mutate({ id: editingService.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  // Group services by category
  const groupedServices = services?.reduce(
    (acc, service) => {
      const cat = service.category || "general";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(service);
      return acc;
    },
    {} as Record<string, CreditService[]>,
  );

  if (isLoading) return <AdminLoadingState />;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Credit Services"
        description="Configure services and their credit costs. Users consume credits when using these services."
        actions={
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            Add Service
          </Button>
        }
      />

      {!services || services.length === 0 ? (
        <AdminEmptyState
          title="No credit services"
          description="Create your first credit service to define what users can spend credits on."
          icon={Coins}
          actionLabel="Add Service"
          onAction={() => handleOpenDialog()}
        />
      ) : (
        <div className="space-y-6">
          {Object.keys(groupedServices ?? {})
            .sort((a, b) => (CATEGORY_LABELS[a] || a).localeCompare(CATEGORY_LABELS[b] || b))
            .map((categoryKey) => {
              const categoryServices = groupedServices?.[categoryKey];
              if (!categoryServices || categoryServices.length === 0) return null;

              return (
                <Card key={categoryKey}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Tag className="h-5 w-5" />
                      {CATEGORY_LABELS[categoryKey] || categoryKey}
                    </CardTitle>
                    <CardDescription>
                      {categoryServices.length} service{categoryServices.length !== 1 ? "s" : ""}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Service</TableHead>
                          <TableHead>Credit Cost</TableHead>
                          <TableHead>Track Discount</TableHead>
                          <TableHead>Feature Gate</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {categoryServices.map((service) => (
                          <TableRow key={service.id}>
                            <TableCell>
                              <div>
                                <div className="font-medium">{service.name}</div>
                                {service.description && (
                                  <div className="text-sm text-muted-foreground line-clamp-1">
                                    {service.description}
                                  </div>
                                )}
                                {service.linked_entity_type && (
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                    <Link2 className="h-3 w-3" />
                                    Linked to {service.linked_entity_type}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="font-mono">
                                {service.credit_cost} credits
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {service.track_discounted_cost !== null ? (
                                <div className="text-sm">
                                  <Badge variant="outline" className="font-mono">
                                    {service.track_discounted_cost} credits
                                  </Badge>
                                  {service.tracks?.name && (
                                    <span className="text-muted-foreground ml-2">
                                      ({service.tracks.name})
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {service.features?.name ? (
                                <Badge variant="outline">{service.features.name}</Badge>
                              ) : (
                                <span className="text-muted-foreground">None</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant={service.is_active ? "default" : "secondary"}>
                                {service.is_active ? "Active" : "Inactive"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleOpenDialog(service)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    if (confirm("Delete this credit service?")) {
                                      deleteMutation.mutate(service.id);
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
                  </CardContent>
                </Card>
              );
            })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingService ? "Edit Credit Service" : "Add Credit Service"}
            </DialogTitle>
            <DialogDescription>Define a service that costs credits to use.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Live Review Board Mock"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of the service"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="credit_cost">Credit Cost *</Label>
                <Input
                  id="credit_cost"
                  type="number"
                  min="0"
                  value={formData.credit_cost}
                  onChange={(e) =>
                    setFormData({ ...formData, credit_cost: parseInt(e.target.value) || 0 })
                  }
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="feature_id">Feature Gate (optional)</Label>
              <Select
                value={formData.feature_id || "none"}
                onValueChange={(value) =>
                  setFormData({ ...formData, feature_id: value === "none" ? "" : value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="No feature gate" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No feature gate</SelectItem>
                  {features?.map((feature) => (
                    <SelectItem key={feature.id} value={feature.id}>
                      {feature.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                If set, users must have access to this feature to use the service.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="track_id">Track Discount (optional)</Label>
                <Select
                  value={formData.track_id || "none"}
                  onValueChange={(value) =>
                    setFormData({ ...formData, track_id: value === "none" ? "" : value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="No track discount" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No track discount</SelectItem>
                    {tracks?.map((track) => (
                      <SelectItem key={track.id} value={track.id}>
                        {track.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="track_discounted_cost">Discounted Cost</Label>
                <Input
                  id="track_discounted_cost"
                  type="number"
                  min="0"
                  value={formData.track_discounted_cost}
                  onChange={(e) =>
                    setFormData({ ...formData, track_discounted_cost: e.target.value })
                  }
                  placeholder="e.g., 600"
                  disabled={!formData.track_id}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="linked_entity_type">Link to Entity Type</Label>
                <Select
                  value={formData.linked_entity_type || "none"}
                  onValueChange={(value) =>
                    setFormData({ ...formData, linked_entity_type: value === "none" ? "" : value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    {ENTITY_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="linked_entity_id">Entity ID</Label>
                <Input
                  id="linked_entity_id"
                  value={formData.linked_entity_id}
                  onChange={(e) => setFormData({ ...formData, linked_entity_id: e.target.value })}
                  placeholder="UUID"
                  disabled={!formData.linked_entity_type}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="is_active">Active</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editingService ? "Save Changes" : "Create Service"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
