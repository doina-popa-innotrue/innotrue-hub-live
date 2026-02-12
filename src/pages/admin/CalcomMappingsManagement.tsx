import { useAdminCRUD } from "@/hooks/useAdminCRUD";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Users } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AdminPageHeader,
  AdminLoadingState,
  AdminFormActions,
  AdminTable,
  AdminTableActions,
  AdminBreadcrumb,
  AdminStatusBadge,
  InstructorCalcomEventTypes,
} from "@/components/admin";
import type { AdminTableColumn } from "@/components/admin";

interface CalcomMapping {
  id: string;
  calcom_event_type_id: number;
  calcom_event_type_slug: string | null;
  calcom_event_type_name: string | null;
  session_target: "module_session" | "group_session";
  default_program_id: string | null;
  default_group_id: string | null;
  default_module_id: string | null;
  module_type: string | null;
  scheduling_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface Program {
  id: string;
  name: string;
}

interface Group {
  id: string;
  name: string;
}

interface Module {
  id: string;
  title: string;
  program_id: string;
}

interface ModuleType {
  id: string;
  name: string;
  description: string | null;
}

type FormData = {
  calcom_event_type_id: string;
  calcom_event_type_name: string;
  session_target: "module_session" | "group_session";
  default_program_id: string;
  default_group_id: string;
  default_module_id: string;
  module_type: string;
  scheduling_url: string;
  is_active: boolean;
};

const initialFormData: FormData = {
  calcom_event_type_id: "",
  calcom_event_type_name: "",
  session_target: "module_session",
  default_program_id: "",
  default_group_id: "",
  default_module_id: "",
  module_type: "",
  scheduling_url: "",
  is_active: true,
};

export default function CalcomMappingsManagement() {
  const {
    data: mappings = [],
    isLoading,
    formData,
    setFormData,
    editingItem,
    isDialogOpen,
    setIsDialogOpen,
    openCreate,
    openEdit,
    handleSubmit: originalHandleSubmit,
    handleDelete,
    isSubmitting,
  } = useAdminCRUD<CalcomMapping, FormData>({
    tableName: "calcom_event_type_mappings",
    queryKey: "calcom-mappings",
    entityName: "Cal.com mapping",
    orderBy: "calcom_event_type_name",
    initialFormData,
    mapItemToForm: (item) => ({
      calcom_event_type_id: String(item.calcom_event_type_id),
      calcom_event_type_name: item.calcom_event_type_name || "",
      session_target: item.session_target,
      default_program_id: item.default_program_id || "",
      default_group_id: item.default_group_id || "",
      default_module_id: item.default_module_id || "",
      module_type: item.module_type || "",
      scheduling_url: item.scheduling_url || "",
      is_active: item.is_active,
    }),
  });

  // Fetch programs for dropdown
  const { data: programs = [] } = useQuery({
    queryKey: ["programs-for-calcom"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("programs")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as Program[];
    },
  });

  // Fetch groups for dropdown
  const { data: groups = [] } = useQuery({
    queryKey: ["groups-for-calcom"],
    queryFn: async () => {
      const { data, error } = await supabase.from("groups").select("id, name").order("name");
      if (error) throw error;
      return data as Group[];
    },
  });

  // Fetch modules for dropdown (filtered by selected program)
  const { data: modules = [] } = useQuery({
    queryKey: ["modules-for-calcom", formData.default_program_id],
    queryFn: async () => {
      if (!formData.default_program_id) return [];
      const { data, error } = await supabase
        .from("program_modules")
        .select("id, title, program_id")
        .eq("program_id", formData.default_program_id)
        .eq("is_active", true)
        .order("order_index");
      if (error) throw error;
      return data as Module[];
    },
    enabled: !!formData.default_program_id,
  });

  // Fetch module types for dropdown
  const { data: moduleTypes = [] } = useQuery({
    queryKey: ["module-types-for-calcom"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("module_types")
        .select("id, name, description")
        .order("name");
      if (error) throw error;
      return data as ModuleType[];
    },
  });

  // Transform form data before submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields for module sessions
    if (formData.session_target === "module_session") {
      if (!formData.module_type) {
        alert("Module Type is required for module sessions");
        return;
      }
    }

    const submitData = {
      calcom_event_type_id: parseInt(formData.calcom_event_type_id, 10),
      calcom_event_type_name: formData.calcom_event_type_name || null,
      session_target: formData.session_target,
      default_program_id: formData.default_program_id || null,
      default_group_id:
        formData.session_target === "group_session" ? formData.default_group_id || null : null,
      default_module_id:
        formData.session_target === "module_session" ? formData.default_module_id || null : null,
      module_type: formData.session_target === "module_session" ? formData.module_type : null,
      scheduling_url: formData.scheduling_url || null,
      is_active: formData.is_active,
    };
    originalHandleSubmit(submitData as any);
  };

  const columns: AdminTableColumn<CalcomMapping>[] = [
    {
      key: "calcom_event_type_name",
      header: "Event Type",
      accessor: (item) => item.calcom_event_type_name || `ID: ${item.calcom_event_type_id}`,
      sortable: true,
      className: "font-medium",
    },
    {
      key: "module_type",
      header: "Module Type",
      accessor: (item) => item.module_type || "—",
      hideOnMobile: true,
    },
    {
      key: "session_target",
      header: "Target",
      accessor: (item) => (
        <span className="capitalize">{item.session_target.replace("_", " ")}</span>
      ),
    },
    {
      key: "scheduling_url",
      header: "Booking URL",
      accessor: (item) =>
        item.scheduling_url ? (
          <a
            href={item.scheduling_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline truncate max-w-[200px] inline-block"
          >
            {new URL(item.scheduling_url).pathname}
          </a>
        ) : (
          "—"
        ),
      hideOnMobile: true,
    },
    {
      key: "is_active",
      header: "Status",
      accessor: (item) => <AdminStatusBadge isActive={item.is_active} />,
    },
  ];

  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="calcom_event_type_id">Parent Event Type ID *</Label>
        <Input
          id="calcom_event_type_id"
          type="number"
          value={formData.calcom_event_type_id}
          onChange={(e) => setFormData({ ...formData, calcom_event_type_id: e.target.value })}
          required
          placeholder="e.g., 123456"
        />
        <p className="text-xs text-muted-foreground">
          The <strong>parent/team event ID</strong> from Cal.com for webhook routing
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="calcom_event_type_name">Display Name</Label>
        <Input
          id="calcom_event_type_name"
          value={formData.calcom_event_type_name}
          onChange={(e) => setFormData({ ...formData, calcom_event_type_name: e.target.value })}
          placeholder="e.g., 1:1 Coaching Session"
        />
        <p className="text-xs text-muted-foreground">Friendly name shown in admin lists</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="session_target">Session Target *</Label>
          <Select
            value={formData.session_target}
            onValueChange={(value: "module_session" | "group_session") =>
              setFormData({
                ...formData,
                session_target: value,
                default_group_id: "",
                default_module_id: "",
                module_type: "",
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select target" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="module_session">Module Session</SelectItem>
              <SelectItem value="group_session">Group Session</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {formData.session_target === "module_session" && (
          <div className="space-y-2">
            <Label htmlFor="module_type">Module Type *</Label>
            <Select
              value={formData.module_type || ""}
              onValueChange={(value) => setFormData({ ...formData, module_type: value })}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Select module type" />
              </SelectTrigger>
              <SelectContent>
                <ScrollArea className="max-h-60">
                  {moduleTypes.map((type) => (
                    <SelectItem key={type.id} value={type.name}>
                      {type.name}
                    </SelectItem>
                  ))}
                </ScrollArea>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Determines which modules use this event type
            </p>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="scheduling_url">Scheduling URL (optional)</Label>
        <Input
          id="scheduling_url"
          type="url"
          value={formData.scheduling_url}
          onChange={(e) => setFormData({ ...formData, scheduling_url: e.target.value })}
          placeholder="https://cal.com/team/event-type"
        />
        <p className="text-xs text-muted-foreground">
          Override URL for client self-booking. Leave empty to use Event Type ID for all bookings
          via API.
        </p>
      </div>

      {formData.session_target === "module_session" && (
        <>
          <div className="space-y-2">
            <Label htmlFor="default_program_id">Default Program (Fallback)</Label>
            <Select
              value={formData.default_program_id || "__none__"}
              onValueChange={(value) =>
                setFormData({
                  ...formData,
                  default_program_id: value === "__none__" ? "" : value,
                  default_module_id: "",
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select program (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No default program</SelectItem>
                {programs.map((program) => (
                  <SelectItem key={program.id} value={program.id}>
                    {program.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              <strong>Leave empty</strong> for module types shared across multiple programs. The
              system uses metadata from booking URLs to link sessions to the correct enrollment.
              Only set a default if this event type is always for one specific program.
            </p>
          </div>

          {formData.default_program_id && (
            <div className="space-y-2">
              <Label htmlFor="default_module_id">Default Module</Label>
              <Select
                value={formData.default_module_id || "__none__"}
                onValueChange={(value) =>
                  setFormData({ ...formData, default_module_id: value === "__none__" ? "" : value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select module (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No default module</SelectItem>
                  {modules.map((module) => (
                    <SelectItem key={module.id} value={module.id}>
                      {module.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </>
      )}

      {formData.session_target === "group_session" && (
        <div className="space-y-2">
          <Label htmlFor="default_group_id">Default Group</Label>
          <Select
            value={formData.default_group_id || "__none__"}
            onValueChange={(value) =>
              setFormData({ ...formData, default_group_id: value === "__none__" ? "" : value })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select group (optional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">No default group</SelectItem>
              {groups.map((group) => (
                <SelectItem key={group.id} value={group.id}>
                  {group.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex items-center space-x-2">
        <Switch
          id="is_active"
          checked={formData.is_active}
          onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
        />
        <Label htmlFor="is_active">Active</Label>
      </div>

      <AdminFormActions
        isEditing={!!editingItem}
        isSubmitting={isSubmitting}
        onCancel={() => setIsDialogOpen(false)}
      />
    </form>
  );

  if (isLoading) {
    return <AdminLoadingState />;
  }

  return (
    <div className="space-y-6">
      <AdminBreadcrumb items={[{ label: "Cal.com Mappings" }]} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cal.com Integration</h1>
          <p className="text-muted-foreground">
            Configure event type mappings and instructor-specific booking URLs
          </p>
        </div>
      </div>

      <Tabs defaultValue="event-mappings" className="space-y-6">
        <TabsList>
          <TabsTrigger value="event-mappings" className="gap-2">
            <Calendar className="h-4 w-4" />
            Event Type Mappings
          </TabsTrigger>
          <TabsTrigger value="instructor-events" className="gap-2">
            <Users className="h-4 w-4" />
            Instructor Event Types
          </TabsTrigger>
        </TabsList>

        <TabsContent value="event-mappings" className="space-y-6">
          <div className="rounded-lg border p-4 bg-muted/30 text-sm">
            <p className="text-muted-foreground">
              <strong className="text-foreground">Purpose:</strong> Event Type Mappings handle{" "}
              <strong>incoming Cal.com webhooks</strong>. When a booking is created in Cal.com,
              these mappings determine whether to create a module session or group session, and can
              set default program/group associations. The Module Type field links this event to the
              correct session category.
            </p>
          </div>

          <AdminPageHeader
            title="Event Type Mappings"
            description="Map Cal.com event types to program modules or groups for automatic session creation"
            isDialogOpen={isDialogOpen}
            onDialogOpenChange={setIsDialogOpen}
            dialogTitle={editingItem ? "Edit Mapping" : "Create Mapping"}
            dialogContent={formContent}
            createButtonLabel="New Mapping"
          />

          <AdminTable
            title="All Mappings"
            description="Configure how Cal.com bookings are routed to sessions"
            data={mappings}
            columns={columns}
            renderActions={(mapping) => (
              <AdminTableActions
                onEdit={() => openEdit(mapping)}
                onDelete={() =>
                  handleDelete(
                    mapping.id,
                    `Delete mapping for "${mapping.calcom_event_type_name || mapping.calcom_event_type_id}"?`,
                  )
                }
              />
            )}
            emptyState={{
              icon: Calendar,
              title: "No mappings yet",
              description: "Create your first Cal.com event type mapping.",
              actionLabel: "New Mapping",
              onAction: openCreate,
            }}
          />
        </TabsContent>

        <TabsContent value="instructor-events">
          <InstructorCalcomEventTypes />
        </TabsContent>
      </Tabs>
    </div>
  );
}
