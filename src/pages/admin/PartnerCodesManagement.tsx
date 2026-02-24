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
  Loader2,
  CalendarIcon,
  Copy,
  RefreshCw,
  Sparkles,
  Link as LinkIcon,
  Users,
  UserCheck,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Code generator — "PRT" prefix + 6 chars (no confusing 0/O/I/1)
// ---------------------------------------------------------------------------
function generatePartnerCode(): string {
  const prefix = "PRT";
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
interface PartnerCode {
  id: string;
  partner_id: string;
  program_id: string;
  cohort_id: string | null;
  code: string;
  label: string | null;
  grants_tier: string | null;
  discount_percent: number | null;
  is_free: boolean;
  max_uses: number | null;
  current_uses: number;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Joined
  program_name?: string;
  cohort_name?: string | null;
  partner_name?: string;
  partner_email?: string;
  referral_count?: number;
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

interface Partner {
  user_id: string;
  name: string | null;
  email: string | null;
  role: string;
}

// ---------------------------------------------------------------------------
// Default form state
// ---------------------------------------------------------------------------
const defaultFormData = {
  code: "",
  partner_id: "",
  program_id: "",
  cohort_id: "" as string,
  grants_tier: "",
  label: "",
  is_free: true,
  discount_percent: "",
  max_uses: "",
  expires_at: null as Date | null,
  is_active: true,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function PartnerCodesManagement() {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState(defaultFormData);
  const [filterPartnerId, setFilterPartnerId] = useState<string>("");

  // Quick generator state
  const [quickProgramId, setQuickProgramId] = useState("");
  const [quickPartnerId, setQuickPartnerId] = useState("");
  const [generatedCode, setGeneratedCode] = useState("");

  const generateNewCode = useCallback(() => {
    setGeneratedCode(generatePartnerCode());
  }, []);

  // -----------------------------------------------------------------------
  // Fetch programs
  // -----------------------------------------------------------------------
  const { data: programs } = useQuery({
    queryKey: ["programs-for-partner-codes"],
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
  // Fetch coaches/instructors for partner selector
  // -----------------------------------------------------------------------
  const { data: partners } = useQuery({
    queryKey: ["partners-for-codes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id, role, profiles:user_id(name, email)")
        .in("role", ["coach", "instructor"])
        .order("role");
      if (error) throw error;
      return (data || []).map((r: any) => ({
        user_id: r.user_id,
        name: r.profiles?.name || null,
        email: r.profiles?.email || null,
        role: r.role,
      })) as Partner[];
    },
  });

  // -----------------------------------------------------------------------
  // Fetch cohorts for selected program
  // -----------------------------------------------------------------------
  const activeProgramId = formData.program_id || quickProgramId;
  const { data: cohorts } = useQuery({
    queryKey: ["cohorts-for-partner-codes", activeProgramId],
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
    data: partnerCodes,
    isLoading,
    isDialogOpen,
    setIsDialogOpen,
    editingItem,
    openCreate,
    openEdit,
  } = useAdminCRUD<PartnerCode, typeof defaultFormData>({
    queryKey: "partner-codes",
    tableName: "partner_codes",
    entityName: "Partner Code",
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
      partner_id: item.partner_id,
      program_id: item.program_id,
      cohort_id: item.cohort_id || "",
      grants_tier: item.grants_tier || "",
      label: item.label || "",
      is_free: item.is_free,
      discount_percent: item.discount_percent?.toString() || "",
      max_uses: item.max_uses?.toString() || "",
      expires_at: item.expires_at ? new Date(item.expires_at) : null,
      is_active: item.is_active,
    }),
  });

  // -----------------------------------------------------------------------
  // Fetch referral counts per code
  // -----------------------------------------------------------------------
  const codeIds = (partnerCodes || []).map((c) => c.id);
  const { data: referralCounts } = useQuery({
    queryKey: ["partner-referral-counts", codeIds],
    queryFn: async () => {
      if (!codeIds.length) return {};
      const { data, error } = await supabase
        .from("partner_referrals")
        .select("partner_code_id")
        .in("partner_code_id", codeIds);
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data || []).forEach((r: any) => {
        counts[r.partner_code_id] = (counts[r.partner_code_id] || 0) + 1;
      });
      return counts;
    },
    enabled: codeIds.length > 0,
  });

  // -----------------------------------------------------------------------
  // Fetch partner names for display
  // -----------------------------------------------------------------------
  const partnerIds = [...new Set((partnerCodes || []).map((c) => c.partner_id))];
  const { data: partnerProfiles } = useQuery({
    queryKey: ["partner-profiles-for-codes", partnerIds],
    queryFn: async () => {
      if (!partnerIds.length) return {};
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, email")
        .in("id", partnerIds);
      if (error) throw error;
      const map: Record<string, { name: string; email: string }> = {};
      (data || []).forEach((p: any) => {
        map[p.id] = { name: p.name || "Unknown", email: p.email || "" };
      });
      return map;
    },
    enabled: partnerIds.length > 0,
  });

  // -----------------------------------------------------------------------
  // Quick generator mutation
  // -----------------------------------------------------------------------
  const createQuickMutation = useMutation({
    mutationFn: async () => {
      if (!generatedCode) throw new Error("Please generate a code first");
      if (!quickProgramId) throw new Error("Please select a program");
      if (!quickPartnerId) throw new Error("Please select a partner");

      const { error } = await supabase.from("partner_codes").insert({
        code: generatedCode.toUpperCase(),
        partner_id: quickPartnerId,
        program_id: quickProgramId,
        cohort_id: null,
        is_free: true,
        discount_percent: null,
        max_uses: null,
        expires_at: null,
        is_active: true,
      });
      if (error) throw error;
      return generatedCode;
    },
    onSuccess: (code) => {
      queryClient.invalidateQueries({ queryKey: ["partner-codes"] });
      const link = `${window.location.origin}/partner?code=${code}`;
      navigator.clipboard.writeText(link);
      toast.success(`Partner code ${code} created — link copied!`);
      setGeneratedCode("");
    },
    onError: (error: any) => {
      if (error.code === "23505") {
        toast.error("This code already exists. Generate a new one.");
        setGeneratedCode("");
      } else {
        toast.error(error.message || "Failed to create partner code");
      }
    },
  });

  // -----------------------------------------------------------------------
  // CRUD mutations
  // -----------------------------------------------------------------------
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!data.program_id) throw new Error("Program is required");
      if (!data.partner_id) throw new Error("Partner is required");

      const { error } = await supabase.from("partner_codes").insert({
        code: data.code.toUpperCase().trim(),
        partner_id: data.partner_id,
        program_id: data.program_id,
        cohort_id: data.cohort_id || null,
        grants_tier: data.grants_tier || null,
        label: data.label.trim() || null,
        is_free: data.is_free,
        discount_percent:
          data.is_free ? null : data.discount_percent ? parseInt(data.discount_percent) : null,
        max_uses: data.max_uses ? parseInt(data.max_uses) : null,
        expires_at: data.expires_at?.toISOString() || null,
        is_active: data.is_active,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partner-codes"] });
      setIsDialogOpen(false);
      setFormData(defaultFormData);
      toast.success("Partner code created");
    },
    onError: (error: any) => {
      if (error.code === "23505") {
        toast.error("A partner code with this code already exists");
      } else {
        toast.error(error.message || "Failed to create partner code");
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!editingItem) return;

      const { error } = await supabase
        .from("partner_codes")
        .update({
          code: data.code.toUpperCase().trim(),
          partner_id: data.partner_id,
          program_id: data.program_id,
          cohort_id: data.cohort_id || null,
          grants_tier: data.grants_tier || null,
          label: data.label.trim() || null,
          is_free: data.is_free,
          discount_percent:
            data.is_free ? null : data.discount_percent ? parseInt(data.discount_percent) : null,
          max_uses: data.max_uses ? parseInt(data.max_uses) : null,
          expires_at: data.expires_at?.toISOString() || null,
          is_active: data.is_active,
        })
        .eq("id", editingItem.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partner-codes"] });
      setIsDialogOpen(false);
      setFormData(defaultFormData);
      toast.success("Partner code updated");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update partner code");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("partner_codes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partner-codes"] });
      toast.success("Partner code deleted");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to delete partner code");
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
    if (!formData.partner_id) {
      toast.error("Partner is required");
      return;
    }

    if (editingItem) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleOpenCreate = () => {
    setFormData({ ...defaultFormData, code: generatePartnerCode() });
    openCreate();
  };

  const handleOpenEdit = (item: PartnerCode) => {
    openEdit(item);
    setFormData({
      code: item.code,
      partner_id: item.partner_id,
      program_id: item.program_id,
      cohort_id: item.cohort_id || "",
      grants_tier: item.grants_tier || "",
      label: item.label || "",
      is_free: item.is_free,
      discount_percent: item.discount_percent?.toString() || "",
      max_uses: item.max_uses?.toString() || "",
      expires_at: item.expires_at ? new Date(item.expires_at) : null,
      is_active: item.is_active,
    });
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Code copied to clipboard");
  };

  const copyLink = (code: string) => {
    const link = `${window.location.origin}/partner?code=${code}`;
    navigator.clipboard.writeText(link);
    toast.success("Partner link copied to clipboard");
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  // Get tiers from selected program (for dialog)
  const selectedProgram = (programs || []).find((p) => p.id === formData.program_id);
  const availableTiers: string[] = selectedProgram?.tiers || [];

  // -----------------------------------------------------------------------
  // Status badge helper
  // -----------------------------------------------------------------------
  const getStatusBadge = (item: PartnerCode) => {
    if (!item.is_active) {
      return <Badge variant="secondary">Inactive</Badge>;
    }
    if (item.expires_at && new Date(item.expires_at) < new Date()) {
      return <Badge variant="destructive">Expired</Badge>;
    }
    if (item.max_uses !== null && item.current_uses >= item.max_uses) {
      return <Badge variant="outline">Used Up</Badge>;
    }
    return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">Active</Badge>;
  };

  // -----------------------------------------------------------------------
  // Filter by partner
  // -----------------------------------------------------------------------
  const filteredCodes = filterPartnerId
    ? (partnerCodes || []).filter((c) => c.partner_id === filterPartnerId)
    : partnerCodes || [];

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Partner Codes</h1>
          <p className="text-muted-foreground">
            Create and manage referral codes for coaches and instructors.
          </p>
        </div>
        <Button onClick={handleOpenCreate}>
          <Plus className="mr-2 h-4 w-4" /> New Partner Code
        </Button>
      </div>

      {/* Quick Generator */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4" /> Quick Generator
          </CardTitle>
          <CardDescription>
            Select a partner and program, generate a code, and share the link.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row items-end gap-3">
            {/* Partner selector */}
            <div className="flex-1 space-y-1">
              <Label className="text-xs text-muted-foreground">Partner</Label>
              <Select value={quickPartnerId} onValueChange={setQuickPartnerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select partner..." />
                </SelectTrigger>
                <SelectContent>
                  {(partners || []).map((p) => (
                    <SelectItem key={p.user_id} value={p.user_id}>
                      {p.name || p.email || p.user_id} ({p.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Program selector */}
            <div className="flex-1 space-y-1">
              <Label className="text-xs text-muted-foreground">Program</Label>
              <Select value={quickProgramId} onValueChange={setQuickProgramId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select program..." />
                </SelectTrigger>
                <SelectContent>
                  {(programs || []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Generated code */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Code</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={generatedCode}
                  readOnly
                  className="w-40 font-mono text-center"
                  placeholder="Click generate"
                />
                <Button variant="outline" size="icon" onClick={generateNewCode}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <Button
              onClick={() => createQuickMutation.mutate()}
              disabled={!generatedCode || !quickProgramId || !quickPartnerId || createQuickMutation.isPending}
            >
              {createQuickMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <LinkIcon className="mr-2 h-4 w-4" /> Create & Copy Link
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Filter by partner */}
      <div className="flex items-center gap-3">
        <Label className="text-sm text-muted-foreground">Filter by partner:</Label>
        <Select value={filterPartnerId} onValueChange={setFilterPartnerId}>
          <SelectTrigger className="w-60">
            <SelectValue placeholder="All partners" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All partners</SelectItem>
            {(partners || []).map((p) => (
              <SelectItem key={p.user_id} value={p.user_id}>
                {p.name || p.email || p.user_id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="pt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Partner</TableHead>
                  <TableHead>Program</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead>Uses</TableHead>
                  <TableHead>Referrals</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCodes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No partner codes found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCodes.map((item) => {
                    const profile = partnerProfiles?.[item.partner_id];
                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <code className="bg-muted px-2 py-0.5 rounded text-sm font-mono">
                              {item.code}
                            </code>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => copyCode(item.code)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => copyLink(item.code)}
                              title="Copy shareable link"
                            >
                              <LinkIcon className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div className="font-medium">{profile?.name || "—"}</div>
                            <div className="text-muted-foreground text-xs">{profile?.email}</div>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[150px]">
                          <div className="truncate">{item.program_name}</div>
                          {item.grants_tier && (
                            <span className="text-xs text-muted-foreground">
                              {item.grants_tier} tier
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {item.label || "—"}
                        </TableCell>
                        <TableCell>
                          {item.current_uses}
                          {item.max_uses !== null ? ` / ${item.max_uses}` : ""}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <UserCheck className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{referralCounts?.[item.id] || 0}</span>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(item)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleOpenEdit(item)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => {
                                if (confirm("Delete this partner code?")) {
                                  deleteMutation.mutate(item.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "Edit Partner Code" : "Create Partner Code"}
            </DialogTitle>
            <DialogDescription>
              {editingItem
                ? "Update the partner code settings."
                : "Create a new referral code for a coach or instructor."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Code */}
            <div className="space-y-2">
              <Label>Code</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={formData.code}
                  onChange={(e) =>
                    setFormData({ ...formData, code: e.target.value.toUpperCase() })
                  }
                  className="font-mono"
                  placeholder="PRTABCDEF"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setFormData({ ...formData, code: generatePartnerCode() })}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Partner */}
            <div className="space-y-2">
              <Label>Partner (Coach / Instructor)</Label>
              <Select
                value={formData.partner_id}
                onValueChange={(v) => setFormData({ ...formData, partner_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select partner..." />
                </SelectTrigger>
                <SelectContent>
                  {(partners || []).map((p) => (
                    <SelectItem key={p.user_id} value={p.user_id}>
                      {p.name || p.email || p.user_id} ({p.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Program */}
            <div className="space-y-2">
              <Label>Program</Label>
              <Select
                value={formData.program_id}
                onValueChange={(v) =>
                  setFormData({ ...formData, program_id: v, cohort_id: "" })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select program..." />
                </SelectTrigger>
                <SelectContent>
                  {(programs || []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Cohort (optional) */}
            {cohorts && cohorts.length > 0 && (
              <div className="space-y-2">
                <Label>Cohort (optional)</Label>
                <Select
                  value={formData.cohort_id}
                  onValueChange={(v) => setFormData({ ...formData, cohort_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Any cohort" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Any cohort</SelectItem>
                    {cohorts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Grants Tier (optional) */}
            {formData.program_id && availableTiers.length > 0 && (
              <div className="space-y-2">
                <Label>Grants Tier (optional)</Label>
                <Select
                  value={formData.grants_tier || "none"}
                  onValueChange={(v) =>
                    setFormData({ ...formData, grants_tier: v === "none" ? "" : v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Default (lowest) tier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Default (lowest) tier</SelectItem>
                    {availableTiers.map((tier) => (
                      <SelectItem key={tier} value={tier}>
                        {tier}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  If not set, the enrollee gets the program's lowest tier.
                </p>
              </div>
            )}

            {/* Label */}
            <div className="space-y-2">
              <Label>Label (optional)</Label>
              <Input
                value={formData.label}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                placeholder="e.g. Spring 2026 Leadership"
              />
            </div>

            {/* Free toggle */}
            <div className="flex items-center gap-3">
              <Switch
                checked={formData.is_free}
                onCheckedChange={(v) => setFormData({ ...formData, is_free: v })}
              />
              <Label>Free enrollment</Label>
            </div>

            {/* Discount percent (only if not free) */}
            {!formData.is_free && (
              <div className="space-y-2">
                <Label>Discount Percent</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.discount_percent}
                  onChange={(e) => setFormData({ ...formData, discount_percent: e.target.value })}
                  placeholder="0"
                />
              </div>
            )}

            {/* Max uses */}
            <div className="space-y-2">
              <Label>Max Uses (blank = unlimited)</Label>
              <Input
                type="number"
                min="1"
                value={formData.max_uses}
                onChange={(e) => setFormData({ ...formData, max_uses: e.target.value })}
                placeholder="Unlimited"
              />
            </div>

            {/* Expires at */}
            <div className="space-y-2">
              <Label>Expires At (optional)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.expires_at && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.expires_at
                      ? format(formData.expires_at, "PPP")
                      : "No expiration"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={formData.expires_at ?? undefined}
                    onSelect={(date) => setFormData({ ...formData, expires_at: date ?? null })}
                  />
                </PopoverContent>
              </Popover>
              {formData.expires_at && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setFormData({ ...formData, expires_at: null })}
                >
                  Clear expiration
                </Button>
              )}
            </div>

            {/* Active toggle */}
            <div className="flex items-center gap-3">
              <Switch
                checked={formData.is_active}
                onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
              />
              <Label>Active</Label>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
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
