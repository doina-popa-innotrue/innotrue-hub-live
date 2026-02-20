import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAdminCRUD } from "@/hooks/useAdminCRUD";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  Ticket,
  Loader2,
  CalendarIcon,
  Copy,
  RefreshCw,
  Sparkles,
  Link as LinkIcon,
  ExternalLink,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

// ---------------------------------------------------------------------------
// Code generator — "ENR" prefix + 6 chars (no confusing 0/O/I/1)
// ---------------------------------------------------------------------------
function generateEnrollmentCode(): string {
  const prefix = "ENR";
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}${code}`;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface EnrollmentCode {
  id: string;
  program_id: string;
  cohort_id: string | null;
  code: string;
  code_type: "single_use" | "multi_use";
  max_uses: number | null;
  current_uses: number;
  grants_plan_id: string | null;
  grants_tier: string | null;
  discount_percent: number | null;
  is_free: boolean;
  expires_at: string | null;
  created_by: string;
  created_at: string;
  is_active: boolean;
  // Joined fields
  program_name?: string;
  cohort_name?: string | null;
}

interface Program {
  id: string;
  name: string;
  tiers: string[] | null;
}

interface Cohort {
  id: string;
  name: string;
  program_id: string;
}

// ---------------------------------------------------------------------------
// Default form state
// ---------------------------------------------------------------------------
const defaultFormData = {
  code: "",
  program_id: "",
  cohort_id: "" as string,
  code_type: "multi_use" as "single_use" | "multi_use",
  max_uses: "",
  grants_tier: "",
  is_free: true,
  discount_percent: "",
  expires_at: null as Date | null,
  is_active: true,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function EnrollmentCodesManagement() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState(defaultFormData);

  // Quick generator state
  const [quickProgramId, setQuickProgramId] = useState("");
  const [generatedCode, setGeneratedCode] = useState("");

  const generateNewCode = useCallback(() => {
    setGeneratedCode(generateEnrollmentCode());
  }, []);

  // -----------------------------------------------------------------------
  // Fetch programs for selectors
  // -----------------------------------------------------------------------
  const { data: programs } = useQuery({
    queryKey: ["programs-for-enrollment-codes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("programs")
        .select("id, name, tiers")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as Program[];
    },
  });

  // -----------------------------------------------------------------------
  // Fetch cohorts for the currently selected program (in form or quick gen)
  // -----------------------------------------------------------------------
  const activeProgramId = formData.program_id || quickProgramId;
  const { data: cohorts } = useQuery({
    queryKey: ["cohorts-for-enrollment-codes", activeProgramId],
    queryFn: async () => {
      if (!activeProgramId) return [];
      const { data, error } = await supabase
        .from("program_cohorts")
        .select("id, name, program_id")
        .eq("program_id", activeProgramId)
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data as Cohort[];
    },
    enabled: !!activeProgramId,
  });

  // -----------------------------------------------------------------------
  // useAdminCRUD for query + dialog state
  // -----------------------------------------------------------------------
  const {
    data: enrollmentCodes,
    isLoading,
    isDialogOpen,
    setIsDialogOpen,
    editingItem,
    openCreate,
    openEdit,
  } = useAdminCRUD<EnrollmentCode, typeof defaultFormData>({
    queryKey: "enrollment-codes",
    tableName: "enrollment_codes",
    entityName: "Enrollment Code",
    orderBy: "created_at",
    orderDirection: "desc",
    select: "*, programs:program_id(name), program_cohorts:cohort_id(name)",
    transform: (rows) =>
      rows.map((row: any) => ({
        ...row,
        program_name: row.programs?.name ?? "Unknown",
        cohort_name: row.program_cohorts?.name ?? null,
      })),
    initialFormData: defaultFormData,
    mapItemToForm: (item) => ({
      code: item.code,
      program_id: item.program_id,
      cohort_id: item.cohort_id || "",
      code_type: item.code_type,
      max_uses: item.max_uses?.toString() || "",
      grants_tier: item.grants_tier || "",
      is_free: item.is_free,
      discount_percent: item.discount_percent?.toString() || "",
      expires_at: item.expires_at ? new Date(item.expires_at) : null,
      is_active: item.is_active,
    }),
  });

  // -----------------------------------------------------------------------
  // Quick generator mutation
  // -----------------------------------------------------------------------
  const createQuickMutation = useMutation({
    mutationFn: async () => {
      if (!generatedCode) throw new Error("Please generate a code first");
      if (!quickProgramId) throw new Error("Please select a program");

      const insertData = {
        code: generatedCode.toUpperCase(),
        program_id: quickProgramId,
        cohort_id: null as string | null,
        code_type: "multi_use" as const,
        max_uses: null as number | null,
        is_free: true,
        discount_percent: null as number | null,
        grants_plan_id: null as string | null,
        grants_tier: null as string | null,
        expires_at: null as string | null,
        is_active: true,
        created_by: user?.id,
      };

      const { error } = await supabase
        .from("enrollment_codes" as any)
        .insert(insertData as any);
      if (error) throw error;
      return generatedCode;
    },
    onSuccess: (code) => {
      queryClient.invalidateQueries({ queryKey: ["enrollment-codes"] });
      const link = `${window.location.origin}/enroll?code=${code}`;
      navigator.clipboard.writeText(link);
      toast.success(`Enrollment code ${code} created — link copied!`);
      setGeneratedCode("");
    },
    onError: (error: any) => {
      if (error.code === "23505") {
        toast.error("This code already exists. Generate a new one.");
        setGeneratedCode("");
      } else {
        toast.error(error.message || "Failed to create enrollment code");
      }
    },
  });

  // -----------------------------------------------------------------------
  // CRUD mutations
  // -----------------------------------------------------------------------
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!data.program_id) throw new Error("Program is required");

      const insertData: any = {
        code: data.code.toUpperCase().trim(),
        program_id: data.program_id,
        cohort_id: data.cohort_id || null,
        code_type: data.code_type,
        max_uses: data.max_uses ? parseInt(data.max_uses) : null,
        grants_tier: data.grants_tier || null,
        grants_plan_id: null,
        is_free: data.is_free,
        discount_percent:
          data.is_free ? null : data.discount_percent ? parseInt(data.discount_percent) : null,
        expires_at: data.expires_at?.toISOString() || null,
        is_active: data.is_active,
        created_by: user?.id,
      };

      const { error } = await supabase
        .from("enrollment_codes" as any)
        .insert(insertData);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enrollment-codes"] });
      setIsDialogOpen(false);
      setFormData(defaultFormData);
      toast.success("Enrollment code created");
    },
    onError: (error: any) => {
      if (error.code === "23505") {
        toast.error("An enrollment code with this code already exists");
      } else {
        toast.error(error.message || "Failed to create enrollment code");
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!editingItem) return;

      const updateData: any = {
        code: data.code.toUpperCase().trim(),
        program_id: data.program_id,
        cohort_id: data.cohort_id || null,
        code_type: data.code_type,
        max_uses: data.max_uses ? parseInt(data.max_uses) : null,
        grants_tier: data.grants_tier || null,
        is_free: data.is_free,
        discount_percent:
          data.is_free ? null : data.discount_percent ? parseInt(data.discount_percent) : null,
        expires_at: data.expires_at?.toISOString() || null,
        is_active: data.is_active,
      };

      const { error } = await supabase
        .from("enrollment_codes" as any)
        .update(updateData)
        .eq("id", editingItem.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enrollment-codes"] });
      setIsDialogOpen(false);
      setFormData(defaultFormData);
      toast.success("Enrollment code updated");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update enrollment code");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("enrollment_codes" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enrollment-codes"] });
      toast.success("Enrollment code deleted");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to delete enrollment code");
    },
  });

  // -----------------------------------------------------------------------
  // Form handlers
  // -----------------------------------------------------------------------
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code.trim()) {
      toast.error("Code is required");
      return;
    }
    if (!formData.program_id) {
      toast.error("Program is required");
      return;
    }
    if (
      !formData.is_free &&
      formData.discount_percent &&
      (parseInt(formData.discount_percent) < 0 || parseInt(formData.discount_percent) > 100)
    ) {
      toast.error("Discount percent must be between 0 and 100");
      return;
    }

    if (editingItem) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleOpenCreate = () => {
    setFormData({ ...defaultFormData, code: generateEnrollmentCode() });
    openCreate();
  };

  const handleOpenEdit = (item: EnrollmentCode) => {
    openEdit(item);
    setFormData({
      code: item.code,
      program_id: item.program_id,
      cohort_id: item.cohort_id || "",
      code_type: item.code_type,
      max_uses: item.max_uses?.toString() || "",
      grants_tier: item.grants_tier || "",
      is_free: item.is_free,
      discount_percent: item.discount_percent?.toString() || "",
      expires_at: item.expires_at ? new Date(item.expires_at) : null,
      is_active: item.is_active,
    });
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Code copied to clipboard");
  };

  const copyLink = (code: string) => {
    const link = `${window.location.origin}/enroll?code=${code}`;
    navigator.clipboard.writeText(link);
    toast.success("Enrollment link copied to clipboard");
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  // -----------------------------------------------------------------------
  // Status badge helper
  // -----------------------------------------------------------------------
  const getStatusBadge = (item: EnrollmentCode) => {
    if (!item.is_active) {
      return <Badge variant="secondary">Inactive</Badge>;
    }
    if (item.expires_at && new Date(item.expires_at) < new Date()) {
      return <Badge variant="destructive">Expired</Badge>;
    }
    if (item.max_uses !== null && item.current_uses >= item.max_uses) {
      return <Badge variant="outline">Used Up</Badge>;
    }
    return (
      <Badge className="bg-success/10 text-success border-success/20">Active</Badge>
    );
  };

  // Get tiers from selected program (for dialog)
  const selectedProgram = programs?.find((p) => p.id === formData.program_id);
  const availableTiers = selectedProgram?.tiers || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Ticket className="h-8 w-8" />
            Enrollment Codes
          </h1>
          <p className="text-muted-foreground mt-1">
            Create shareable codes so users can self-enroll in programs
          </p>
        </div>
        <Button onClick={handleOpenCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Create Code
        </Button>
      </div>

      {/* Quick Code Generator */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Quick Enrollment Code Generator
          </CardTitle>
          <CardDescription>
            Generate a free, unlimited-use enrollment code for a program. The shareable link is
            automatically copied to your clipboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label>Program *</Label>
              <Select value={quickProgramId} onValueChange={setQuickProgramId}>
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="Select program" />
                </SelectTrigger>
                <SelectContent>
                  {programs?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Generated Code</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={generatedCode}
                  readOnly
                  placeholder="Click generate"
                  className="w-40 font-mono"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={generateNewCode}
                  title="Generate new code"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <Button
              onClick={() => createQuickMutation.mutate()}
              disabled={!generatedCode || !quickProgramId || createQuickMutation.isPending}
              className="gap-2"
            >
              {createQuickMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LinkIcon className="h-4 w-4" />
              )}
              Create & Copy Link
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Creates a free, unlimited multi-use code.{" "}
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0"
              onClick={handleOpenCreate}
            >
              Create a custom code
            </Button>{" "}
            for more options (single-use, expiry, tier, cohort).
          </p>
        </CardContent>
      </Card>

      {/* Codes Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Enrollment Codes</CardTitle>
          <CardDescription>
            {enrollmentCodes?.length || 0} enrollment codes configured
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : enrollmentCodes && enrollmentCodes.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Program</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead>Enrollment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enrollmentCodes.map((item) => (
                  <TableRow key={item.id}>
                    {/* Code + copy */}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="bg-muted px-2 py-1 rounded font-mono text-sm">
                          {item.code}
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => copyCode(item.code)}
                          title="Copy code"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => copyLink(item.code)}
                          title="Copy enrollment link"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>

                    {/* Program + Cohort */}
                    <TableCell>
                      <div>
                        <span className="font-medium">{item.program_name}</span>
                        {item.cohort_name && (
                          <p className="text-xs text-muted-foreground">{item.cohort_name}</p>
                        )}
                      </div>
                    </TableCell>

                    {/* Code type */}
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {item.code_type === "single_use" ? "Single Use" : "Multi Use"}
                      </Badge>
                    </TableCell>

                    {/* Usage */}
                    <TableCell>
                      <span className="text-sm">
                        {item.current_uses}
                        {item.max_uses !== null ? ` / ${item.max_uses}` : " uses"}
                      </span>
                    </TableCell>

                    {/* Enrollment details */}
                    <TableCell>
                      <div className="space-y-1 text-xs">
                        {item.is_free ? (
                          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">
                            Free
                          </Badge>
                        ) : item.discount_percent ? (
                          <Badge variant="outline">{item.discount_percent}% off</Badge>
                        ) : (
                          <span className="text-muted-foreground">Full price</span>
                        )}
                        {item.grants_tier && (
                          <p className="text-muted-foreground">Tier: {item.grants_tier}</p>
                        )}
                        {item.expires_at && (
                          <p className="text-muted-foreground">
                            Exp: {format(new Date(item.expires_at), "MMM d, yyyy")}
                          </p>
                        )}
                      </div>
                    </TableCell>

                    {/* Status */}
                    <TableCell>{getStatusBadge(item)}</TableCell>

                    {/* Actions */}
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenEdit(item)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm("Delete this enrollment code?")) {
                              deleteMutation.mutate(item.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Ticket className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No enrollment codes yet</p>
              <p className="text-sm">
                Create your first enrollment code to let users self-enroll
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "Edit Enrollment Code" : "Create Enrollment Code"}
            </DialogTitle>
            <DialogDescription>
              {editingItem
                ? "Update the enrollment code settings"
                : "Create a new code that users can use to self-enroll in a program"}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Code + Program */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="code">Code *</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) =>
                      setFormData({ ...formData, code: e.target.value.toUpperCase() })
                    }
                    placeholder="e.g. ENRABCDEF"
                    className="font-mono"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() =>
                      setFormData({ ...formData, code: generateEnrollmentCode() })
                    }
                    title="Generate new code"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Program *</Label>
                <Select
                  value={formData.program_id}
                  onValueChange={(v) =>
                    setFormData({ ...formData, program_id: v, cohort_id: "", grants_tier: "" })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select program" />
                  </SelectTrigger>
                  <SelectContent>
                    {programs?.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Cohort + Code Type */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cohort (optional)</Label>
                <Select
                  value={formData.cohort_id || "none"}
                  onValueChange={(v) =>
                    setFormData({ ...formData, cohort_id: v === "none" ? "" : v })
                  }
                  disabled={!formData.program_id}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="No cohort" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No cohort</SelectItem>
                    {cohorts?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Code Type *</Label>
                <Select
                  value={formData.code_type}
                  onValueChange={(v) =>
                    setFormData({
                      ...formData,
                      code_type: v as "single_use" | "multi_use",
                      max_uses: v === "single_use" ? "1" : formData.max_uses,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="multi_use">Multi Use</SelectItem>
                    <SelectItem value="single_use">Single Use</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Max uses + Tier */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="max_uses">
                  Max Uses {formData.code_type === "multi_use" ? "(empty = unlimited)" : ""}
                </Label>
                <Input
                  id="max_uses"
                  type="number"
                  min="1"
                  value={formData.max_uses}
                  onChange={(e) => setFormData({ ...formData, max_uses: e.target.value })}
                  placeholder={formData.code_type === "single_use" ? "1" : "e.g. 50"}
                  disabled={formData.code_type === "single_use"}
                />
              </div>
              <div className="space-y-2">
                <Label>Grants Tier (optional)</Label>
                {availableTiers.length > 0 ? (
                  <Select
                    value={formData.grants_tier || "none"}
                    onValueChange={(v) =>
                      setFormData({ ...formData, grants_tier: v === "none" ? "" : v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Default tier" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Default tier</SelectItem>
                      {availableTiers.map((tier) => (
                        <SelectItem key={tier} value={tier}>
                          {tier}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={formData.grants_tier}
                    onChange={(e) => setFormData({ ...formData, grants_tier: e.target.value })}
                    placeholder="e.g. premium"
                  />
                )}
              </div>
            </div>

            {/* Free toggle + discount */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center space-x-2 pt-6">
                <Switch
                  id="is_free"
                  checked={formData.is_free}
                  onCheckedChange={(checked) =>
                    setFormData({
                      ...formData,
                      is_free: checked,
                      discount_percent: checked ? "" : formData.discount_percent,
                    })
                  }
                />
                <Label htmlFor="is_free">Free enrollment</Label>
              </div>
              {!formData.is_free && (
                <div className="space-y-2">
                  <Label htmlFor="discount_percent">Discount Percent (%)</Label>
                  <Input
                    id="discount_percent"
                    type="number"
                    min="0"
                    max="100"
                    value={formData.discount_percent}
                    onChange={(e) =>
                      setFormData({ ...formData, discount_percent: e.target.value })
                    }
                    placeholder="e.g. 50"
                  />
                  <p className="text-xs text-muted-foreground">
                    Note: only 100% discount (free) codes can be redeemed right now
                  </p>
                </div>
              )}
            </div>

            {/* Expiry + Active */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Expires At (optional)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      type="button"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !formData.expires_at && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.expires_at
                        ? format(formData.expires_at, "PPP")
                        : "No expiry"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={formData.expires_at || undefined}
                      onSelect={(date) =>
                        setFormData({ ...formData, expires_at: date || null })
                      }
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="flex items-center space-x-2 pt-6">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, is_active: checked })
                  }
                />
                <Label htmlFor="is_active">Active</Label>
              </div>
            </div>

            {/* Shareable link preview */}
            {formData.code.trim() && (
              <div className="rounded-md bg-muted p-3">
                <Label className="text-xs text-muted-foreground">Shareable Link</Label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="text-sm flex-1 break-all">
                    {window.location.origin}/enroll?code={formData.code.toUpperCase().trim()}
                  </code>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={() => copyLink(formData.code.trim())}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingItem ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
