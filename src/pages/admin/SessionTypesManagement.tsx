import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, Users, Clock, Zap } from "lucide-react";
import { useAdminCRUD } from "@/hooks/useAdminCRUD";
import {
  AdminPageHeader,
  AdminLoadingState,
  AdminEmptyState,
  AdminFormActions,
} from "@/components/admin";

interface SessionType {
  id: string;
  name: string;
  description: string | null;
  default_duration_minutes: number;
  max_participants: number | null;
  allow_self_registration: boolean;
  feature_key: string | null;
  is_active: boolean;
  created_at: string;
}

interface SessionTypeRole {
  id: string;
  session_type_id: string;
  role_name: string;
  description: string | null;
  max_per_session: number | null;
  is_required: boolean;
  order_index: number;
}

interface Feature {
  id: string;
  key: string;
  name: string;
  is_consumable: boolean;
}

interface TypeFormData {
  name: string;
  description: string;
  default_duration_minutes: number;
  max_participants: string;
  allow_self_registration: boolean;
  feature_key: string;
  is_active: boolean;
}

interface RoleFormData {
  role_name: string;
  description: string;
  max_per_session: string;
  is_required: boolean;
  order_index: number;
}

const initialTypeFormData: TypeFormData = {
  name: "",
  description: "",
  default_duration_minutes: 60,
  max_participants: "",
  allow_self_registration: false,
  feature_key: "",
  is_active: true,
};

const initialRoleFormData: RoleFormData = {
  role_name: "",
  description: "",
  max_per_session: "",
  is_required: false,
  order_index: 0,
};

export default function SessionTypesManagement() {
  const queryClient = useQueryClient();
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<SessionTypeRole | null>(null);
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set());
  const [roleForm, setRoleForm] = useState<RoleFormData>(initialRoleFormData);

  const {
    data: sessionTypes,
    isLoading: typesLoading,
    isDialogOpen,
    setIsDialogOpen,
    editingItem,
    formData: typeForm,
    setFormData: setTypeForm,
    openCreate,
    handleEdit,
    handleDelete,
    isMutating,
  } = useAdminCRUD<SessionType, TypeFormData>({
    tableName: "session_types",
    queryKey: "session-types",
    entityName: "Session type",
    orderBy: "name",
    initialFormData: initialTypeFormData,
    mapItemToForm: (item) => ({
      name: item.name,
      description: item.description || "",
      default_duration_minutes: item.default_duration_minutes,
      max_participants: item.max_participants?.toString() || "",
      allow_self_registration: item.allow_self_registration,
      feature_key: item.feature_key || "",
      is_active: item.is_active,
    }),
  });

  // Fetch session type roles
  const { data: sessionRoles, isLoading: rolesLoading } = useQuery({
    queryKey: ["session-type-roles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("session_type_roles")
        .select("*")
        .order("order_index");
      if (error) throw error;
      return data as SessionTypeRole[];
    },
  });

  // Fetch features for dropdown
  const { data: features } = useQuery({
    queryKey: ["features-for-sessions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("features")
        .select("id, key, name, is_consumable")
        .order("name");
      if (error) throw error;
      return data as Feature[];
    },
  });

  // Custom save mutation for null handling
  const saveTypeMutation = useMutation({
    mutationFn: async (data: TypeFormData & { id?: string }) => {
      const payload = {
        name: data.name,
        description: data.description || null,
        default_duration_minutes: data.default_duration_minutes,
        max_participants: data.max_participants ? parseInt(data.max_participants) : null,
        allow_self_registration: data.allow_self_registration,
        feature_key: data.feature_key || null,
        is_active: data.is_active,
      };

      if (data.id) {
        const { error } = await supabase.from("session_types").update(payload).eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("session_types").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session-types"] });
      toast.success(editingItem ? "Session type updated" : "Session type created");
      setIsDialogOpen(false);
    },
    onError: (error) => {
      toast.error("Failed to save session type", { description: error.message });
    },
  });

  // Role mutations
  const saveRoleMutation = useMutation({
    mutationFn: async (data: RoleFormData & { id?: string; session_type_id: string }) => {
      const payload = {
        session_type_id: data.session_type_id,
        role_name: data.role_name,
        description: data.description || null,
        max_per_session: data.max_per_session ? parseInt(data.max_per_session) : null,
        is_required: data.is_required,
        order_index: data.order_index,
      };

      if (data.id) {
        const { error } = await supabase
          .from("session_type_roles")
          .update(payload)
          .eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("session_type_roles").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session-type-roles"] });
      toast.success(editingRole ? "Role updated" : "Role created");
      resetRoleForm();
    },
    onError: (error) => {
      toast.error("Failed to save role", { description: error.message });
    },
  });

  const deleteRoleMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("session_type_roles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session-type-roles"] });
      toast.success("Role deleted");
    },
    onError: (error) => {
      toast.error("Failed to delete role", { description: error.message });
    },
  });

  const resetRoleForm = () => {
    setRoleDialogOpen(false);
    setEditingRole(null);
    setSelectedTypeId(null);
    setRoleForm(initialRoleFormData);
  };

  const openAddRole = (typeId: string) => {
    setSelectedTypeId(typeId);
    const existingRoles = sessionRoles?.filter((r) => r.session_type_id === typeId) || [];
    setRoleForm({
      ...initialRoleFormData,
      order_index: existingRoles.length,
    });
    setRoleDialogOpen(true);
  };

  const openEditRole = (role: SessionTypeRole) => {
    setEditingRole(role);
    setSelectedTypeId(role.session_type_id);
    setRoleForm({
      role_name: role.role_name,
      description: role.description || "",
      max_per_session: role.max_per_session?.toString() || "",
      is_required: role.is_required,
      order_index: role.order_index,
    });
    setRoleDialogOpen(true);
  };

  const toggleExpanded = useCallback((typeId: string) => {
    setExpandedTypes((prev) => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(typeId)) {
        newExpanded.delete(typeId);
      } else {
        newExpanded.add(typeId);
      }
      return newExpanded;
    });
  }, []);

  const getRolesForType = useCallback(
    (typeId: string) => {
      return sessionRoles?.filter((r) => r.session_type_id === typeId) || [];
    },
    [sessionRoles],
  );

  const getFeatureName = useCallback(
    (featureKey: string | null) => {
      if (!featureKey) return null;
      return features?.find((f) => f.key === featureKey)?.name || featureKey;
    },
    [features],
  );

  const handleTypeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveTypeMutation.mutate({ ...typeForm, id: editingItem?.id });
  };

  const handleRoleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTypeId) return;
    saveRoleMutation.mutate({ ...roleForm, id: editingRole?.id, session_type_id: selectedTypeId });
  };

  if (typesLoading || rolesLoading) {
    return <AdminLoadingState />;
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Session Types"
        description="Manage session types and their participant roles"
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Add Session Type
          </Button>
        }
      />

      {!sessionTypes?.length ? (
        <AdminEmptyState
          icon={Clock}
          title="No session types configured"
          description="Create your first session type to get started"
          actionLabel="Create Session Type"
          onAction={openCreate}
        />
      ) : (
        <div className="space-y-4">
          {sessionTypes.map((type) => {
            const roles = getRolesForType(type.id);
            const isExpanded = expandedTypes.has(type.id);

            return (
              <Card key={type.id}>
                <Collapsible open={isExpanded} onOpenChange={() => toggleExpanded(type.id)}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6 mt-1">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                        </CollapsibleTrigger>
                        <div>
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-lg">{type.name}</CardTitle>
                            <Badge variant={type.is_active ? "default" : "secondary"}>
                              {type.is_active ? "Active" : "Inactive"}
                            </Badge>
                            {type.allow_self_registration && (
                              <Badge variant="outline">Self-Registration</Badge>
                            )}
                          </div>
                          <CardDescription className="mt-1">
                            {type.description || "No description"}
                          </CardDescription>
                          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {type.default_duration_minutes} min
                            </span>
                            {type.max_participants && (
                              <span className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                Max {type.max_participants}
                              </span>
                            )}
                            {type.feature_key && (
                              <span className="flex items-center gap-1">
                                <Zap className="h-3 w-3" />
                                {getFeatureName(type.feature_key)}
                              </span>
                            )}
                            <span>
                              {roles.length} role{roles.length !== 1 ? "s" : ""}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleEdit(type)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleDelete(type.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-medium">Participant Roles</h4>
                          <Button variant="outline" size="sm" onClick={() => openAddRole(type.id)}>
                            <Plus className="h-4 w-4 mr-1" />
                            Add Role
                          </Button>
                        </div>

                        {roles.length === 0 ? (
                          <p className="text-sm text-muted-foreground italic">
                            No roles defined for this session type.
                          </p>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Role Name</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead>Max Per Session</TableHead>
                                <TableHead>Required</TableHead>
                                <TableHead className="w-24">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {roles.map((role) => (
                                <TableRow key={role.id}>
                                  <TableCell className="font-medium capitalize">
                                    {role.role_name}
                                  </TableCell>
                                  <TableCell className="text-muted-foreground">
                                    {role.description || "-"}
                                  </TableCell>
                                  <TableCell>{role.max_per_session || "Unlimited"}</TableCell>
                                  <TableCell>
                                    <Badge variant={role.is_required ? "default" : "outline"}>
                                      {role.is_required ? "Required" : "Optional"}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-1">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => openEditRole(role)}
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => {
                                          if (confirm("Delete this role?")) {
                                            deleteRoleMutation.mutate(role.id);
                                          }
                                        }}
                                        disabled={deleteRoleMutation.isPending}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })}
        </div>
      )}

      {/* Session Type Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit Session Type" : "Add Session Type"}</DialogTitle>
            <DialogDescription>
              Configure the session type and its default settings.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleTypeSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={typeForm.name}
                onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={typeForm.description}
                onChange={(e) => setTypeForm({ ...typeForm, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="duration">Default Duration (minutes)</Label>
                <Input
                  id="duration"
                  type="number"
                  min={5}
                  value={typeForm.default_duration_minutes}
                  onChange={(e) =>
                    setTypeForm({
                      ...typeForm,
                      default_duration_minutes: parseInt(e.target.value) || 60,
                    })
                  }
                />
              </div>
              <div>
                <Label htmlFor="max_participants">Max Participants</Label>
                <Input
                  id="max_participants"
                  type="number"
                  min={1}
                  value={typeForm.max_participants}
                  onChange={(e) => setTypeForm({ ...typeForm, max_participants: e.target.value })}
                  placeholder="Unlimited"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="feature_key">Feature Gate</Label>
              <Select
                value={typeForm.feature_key || "_none"}
                onValueChange={(value) =>
                  setTypeForm({ ...typeForm, feature_key: value === "_none" ? "" : value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="No feature gate" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">No feature gate</SelectItem>
                  {features?.map((feature) => (
                    <SelectItem key={feature.id} value={feature.key}>
                      {feature.name} {feature.is_consumable && "(Consumable)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="self_registration">Allow Self-Registration</Label>
                <p className="text-xs text-muted-foreground">Users can register themselves</p>
              </div>
              <Switch
                id="self_registration"
                checked={typeForm.allow_self_registration}
                onCheckedChange={(checked) =>
                  setTypeForm({ ...typeForm, allow_self_registration: checked })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="is_active">Active</Label>
                <p className="text-xs text-muted-foreground">Session type is available</p>
              </div>
              <Switch
                id="is_active"
                checked={typeForm.is_active}
                onCheckedChange={(checked) => setTypeForm({ ...typeForm, is_active: checked })}
              />
            </div>
            <AdminFormActions
              onCancel={() => setIsDialogOpen(false)}
              isEditing={!!editingItem}
              isSubmitting={saveTypeMutation.isPending}
              submitLabel={{ create: "Create Session Type", update: "Save Changes" }}
            />
          </form>
        </DialogContent>
      </Dialog>

      {/* Role Dialog */}
      <Dialog open={roleDialogOpen} onOpenChange={(open) => !open && resetRoleForm()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingRole ? "Edit Role" : "Add Role"}</DialogTitle>
            <DialogDescription>
              Configure the participant role for this session type.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRoleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="role_name">Role Name *</Label>
              <Input
                id="role_name"
                value={roleForm.role_name}
                onChange={(e) => setRoleForm({ ...roleForm, role_name: e.target.value })}
                placeholder="e.g. Facilitator, Participant, Observer"
                required
              />
            </div>
            <div>
              <Label htmlFor="role_description">Description</Label>
              <Textarea
                id="role_description"
                value={roleForm.description}
                onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="max_per_session">Max Per Session</Label>
              <Input
                id="max_per_session"
                type="number"
                min={1}
                value={roleForm.max_per_session}
                onChange={(e) => setRoleForm({ ...roleForm, max_per_session: e.target.value })}
                placeholder="Unlimited"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="is_required">Required Role</Label>
                <p className="text-xs text-muted-foreground">Session requires this role</p>
              </div>
              <Switch
                id="is_required"
                checked={roleForm.is_required}
                onCheckedChange={(checked) => setRoleForm({ ...roleForm, is_required: checked })}
              />
            </div>
            <AdminFormActions
              onCancel={resetRoleForm}
              isEditing={!!editingRole}
              isSubmitting={saveRoleMutation.isPending}
              submitLabel={{ create: "Add Role", update: "Save Changes" }}
            />
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
