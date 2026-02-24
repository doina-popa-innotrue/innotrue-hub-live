import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users,
  UserPlus,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Search,
  AlertTriangle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface BulkEnrollmentDialogProps {
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

type Step = "program" | "clients" | "confirm" | "result";

interface ProgramOption {
  id: string;
  name: string;
  tiers: string[] | null;
  default_program_plan_id: string | null;
}

interface ClientOption {
  id: string;
  name: string | null;
  email: string | null;
  plan_name: string | null;
  already_enrolled: boolean;
}

interface EnrollResult {
  success: number;
  failed: number;
  errors: { name: string; error: string }[];
}

export function BulkEnrollmentDialog({ trigger, onSuccess }: BulkEnrollmentDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("program");

  // Program selection
  const [selectedProgramId, setSelectedProgramId] = useState("");
  const [selectedTier, setSelectedTier] = useState("");
  const [selectedCohortId, setSelectedCohortId] = useState("");
  const [adminDiscount, setAdminDiscount] = useState("");

  // Client selection
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [filterPlan, setFilterPlan] = useState("all");

  // Results
  const [results, setResults] = useState<EnrollResult>({ success: 0, failed: 0, errors: [] });

  // ── Queries ──────────────────────────────────────────────────────────

  const { data: programs } = useQuery({
    queryKey: ["bulk-enrol-programs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("programs")
        .select("id, name, tiers, default_program_plan_id")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as ProgramOption[];
    },
    enabled: open,
  });

  const selectedProgram = programs?.find((p) => p.id === selectedProgramId);

  // Cohorts for selected program
  const { data: cohorts } = useQuery({
    queryKey: ["bulk-enrol-cohorts", selectedProgramId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("program_cohorts")
        .select("id, name, max_capacity, status")
        .eq("program_id", selectedProgramId)
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      // Get current enrollment counts
      const cohortIds = (data || []).map((c) => c.id);
      if (cohortIds.length === 0) return data || [];
      const { data: enrollCounts } = await supabase
        .from("client_enrollments")
        .select("cohort_id")
        .in("cohort_id", cohortIds)
        .eq("status", "active");
      const countMap: Record<string, number> = {};
      for (const e of enrollCounts || []) {
        if (e.cohort_id) countMap[e.cohort_id] = (countMap[e.cohort_id] || 0) + 1;
      }
      return (data || []).map((c) => ({
        ...c,
        current_count: countMap[c.id] || 0,
      }));
    },
    enabled: open && !!selectedProgramId,
  });

  // Credit cost for selected tier
  const { data: tierCost } = useQuery({
    queryKey: ["bulk-enrol-tier-cost", selectedProgramId, selectedTier],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("program_tier_plans")
        .select("credit_cost, program_plan_id")
        .eq("program_id", selectedProgramId)
        .ilike("tier_name", selectedTier)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: open && !!selectedProgramId && !!selectedTier,
  });

  // Plans for filter
  const { data: plans } = useQuery({
    queryKey: ["bulk-enrol-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plans")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: open && step === "clients",
  });

  // Clients for selection
  const { data: clients, isLoading: clientsLoading } = useQuery({
    queryKey: ["bulk-enrol-clients", searchQuery, filterPlan, selectedProgramId],
    queryFn: async () => {
      // Fetch users with client role
      let profileQuery = supabase
        .from("profiles")
        .select("id, name, email, plan_id, plans(name)")
        .order("name")
        .limit(100);

      if (searchQuery) {
        profileQuery = profileQuery.ilike("name", `%${searchQuery}%`);
      }
      if (filterPlan !== "all") {
        profileQuery = profileQuery.eq("plan_id", filterPlan);
      }

      const { data: profilesData, error } = await profileQuery;
      if (error) throw error;

      // Check which users are already enrolled in the selected program
      const userIds = (profilesData || []).map((p) => p.id);
      let enrolledSet = new Set<string>();
      if (userIds.length > 0 && selectedProgramId) {
        const { data: existingEnrollments } = await supabase
          .from("client_enrollments")
          .select("client_user_id")
          .eq("program_id", selectedProgramId)
          .in("client_user_id", userIds);
        enrolledSet = new Set((existingEnrollments || []).map((e) => e.client_user_id));
      }

      return (profilesData || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        email: p.email,
        plan_name: p.plans?.name || null,
        already_enrolled: enrolledSet.has(p.id),
      })) as ClientOption[];
    },
    enabled: open && step === "clients",
  });

  // ── Mutations ────────────────────────────────────────────────────────

  const enrollMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      if (!selectedProgramId || !selectedTier) throw new Error("Program and tier required");

      const program = programs?.find((p) => p.id === selectedProgramId);
      const discount = adminDiscount ? parseFloat(adminDiscount) : null;
      const validDiscount = discount && discount > 0 && discount <= 100 ? discount : null;
      const originalCost = tierCost?.credit_cost ?? null;
      let finalCost = originalCost;
      if (validDiscount && originalCost !== null && originalCost > 0) {
        finalCost = Math.round(originalCost * (1 - validDiscount / 100));
      }
      const programPlanId = tierCost?.program_plan_id || program?.default_program_plan_id || null;

      let successCount = 0;
      let failedCount = 0;
      const errors: { name: string; error: string }[] = [];

      for (const clientId of selectedClientIds) {
        try {
          const client = clients?.find((c) => c.id === clientId);
          const { data: result, error } = await supabase.rpc("enroll_with_credits", {
            p_client_user_id: clientId,
            p_program_id: selectedProgramId,
            p_tier: selectedTier,
            p_program_plan_id: programPlanId,
            p_discount_percent: validDiscount,
            p_original_credit_cost: originalCost,
            p_final_credit_cost: finalCost,
            p_description: `Enrolled in ${program?.name} (${selectedTier}) by admin (bulk)`,
            p_cohort_id: selectedCohortId || null,
            p_force: true,
            p_enrollment_source: "admin",
            p_referred_by: user.id,
            p_referral_note: "Bulk enrollment by admin",
          });

          if (error) {
            failedCount++;
            errors.push({
              name: client?.name || clientId,
              error: error.message,
            });
          } else if (result && typeof result === "object" && !(result as any).success) {
            failedCount++;
            errors.push({
              name: client?.name || clientId,
              error: (result as any).error || "Unknown error",
            });
          } else {
            successCount++;
          }
        } catch (err) {
          failedCount++;
          const client = clients?.find((c) => c.id === clientId);
          errors.push({
            name: client?.name || clientId,
            error: err instanceof Error ? err.message : "Unknown error",
          });
        }
      }

      return { success: successCount, failed: failedCount, errors };
    },
    onSuccess: (result) => {
      setResults(result);
      setStep("result");
      queryClient.invalidateQueries({ queryKey: ["admin-enrolments"] });
      queryClient.invalidateQueries({ queryKey: ["admin-enrolment-stats"] });
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // ── Handlers ─────────────────────────────────────────────────────────

  const handleToggleClient = (clientId: string) => {
    setSelectedClientIds((prev) =>
      prev.includes(clientId) ? prev.filter((id) => id !== clientId) : [...prev, clientId],
    );
  };

  const handleToggleAll = () => {
    if (!clients) return;
    const eligibleIds = clients.filter((c) => !c.already_enrolled).map((c) => c.id);
    const allSelected = eligibleIds.every((id) => selectedClientIds.includes(id));
    if (allSelected) {
      setSelectedClientIds((prev) => prev.filter((id) => !eligibleIds.includes(id)));
    } else {
      setSelectedClientIds((prev) => [...new Set([...prev, ...eligibleIds])]);
    }
  };

  const resetDialog = () => {
    setStep("program");
    setSelectedProgramId("");
    setSelectedTier("");
    setSelectedCohortId("");
    setAdminDiscount("");
    setSearchQuery("");
    setSelectedClientIds([]);
    setFilterPlan("all");
    setResults({ success: 0, failed: 0, errors: [] });
  };

  const handleClose = () => {
    setOpen(false);
    resetDialog();
  };

  // ── Computed values ──────────────────────────────────────────────────

  const tiers = selectedProgram?.tiers as string[] | null;
  const creditCost = tierCost?.credit_cost ?? 0;
  const discount = adminDiscount ? parseFloat(adminDiscount) : 0;
  const finalCostPerClient =
    discount > 0 && creditCost > 0
      ? Math.round(creditCost * (1 - discount / 100))
      : creditCost;
  const totalCost = finalCostPerClient * selectedClientIds.length;

  const canProceedToClients = !!selectedProgramId && !!selectedTier;
  const canProceedToConfirm = selectedClientIds.length > 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) resetDialog();
      }}
    >
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <UserPlus className="h-4 w-4 mr-2" />
            Bulk Enrol
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Bulk Enrolment
          </DialogTitle>
          <DialogDescription>
            {step === "program" && "Select a programme and enrolment options."}
            {step === "clients" && "Select clients to enrol."}
            {step === "confirm" && "Review and confirm the bulk enrolment."}
            {step === "result" && "Enrolment complete."}
          </DialogDescription>
        </DialogHeader>

        {/* ── Step 1: Program ──────────────────────────────────────── */}
        {step === "program" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Programme</Label>
              <Select value={selectedProgramId} onValueChange={(v) => {
                setSelectedProgramId(v);
                setSelectedTier("");
                setSelectedCohortId("");
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a programme" />
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

            {selectedProgramId && tiers && tiers.length > 0 && (
              <div className="space-y-2">
                <Label>Tier</Label>
                <Select value={selectedTier} onValueChange={setSelectedTier}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select tier" />
                  </SelectTrigger>
                  <SelectContent>
                    {tiers.map((tier) => (
                      <SelectItem key={tier} value={tier.toLowerCase()}>
                        {tier}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {selectedProgramId && (!tiers || tiers.length === 0) && (
              <div className="space-y-2">
                <Label>Tier</Label>
                <Input
                  value={selectedTier}
                  onChange={(e) => setSelectedTier(e.target.value)}
                  placeholder="e.g. essentials"
                />
              </div>
            )}

            {cohorts && cohorts.length > 0 && (
              <div className="space-y-2">
                <Label>Cohort (optional)</Label>
                <Select value={selectedCohortId} onValueChange={setSelectedCohortId}>
                  <SelectTrigger>
                    <SelectValue placeholder="No cohort" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No cohort</SelectItem>
                    {cohorts.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                        {c.max_capacity && (
                          <span className="text-muted-foreground ml-1">
                            ({c.current_count}/{c.max_capacity})
                          </span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Admin Discount % (optional)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={adminDiscount}
                onChange={(e) => setAdminDiscount(e.target.value)}
                placeholder="0"
              />
            </div>

            {selectedTier && (
              <div className="p-3 bg-muted rounded-lg text-sm space-y-1">
                <div className="flex justify-between">
                  <span>Credit cost per client:</span>
                  <span className="font-medium">
                    {creditCost > 0 ? `${creditCost} credits` : "Free"}
                  </span>
                </div>
                {discount > 0 && creditCost > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>After {discount}% discount:</span>
                    <span className="font-medium">{finalCostPerClient} credits</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Step 2: Clients ──────────────────────────────────────── */}
        {step === "clients" && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search clients by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={filterPlan} onValueChange={setFilterPlan}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="All Plans" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Plans</SelectItem>
                  {plans?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                <Badge variant="secondary" className="mr-1">
                  {selectedClientIds.length}
                </Badge>
                client(s) selected
              </span>
              <Button variant="ghost" size="sm" onClick={handleToggleAll}>
                Toggle All
              </Button>
            </div>

            <ScrollArea className="h-64 border rounded-md p-2">
              {clientsLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : clients && clients.length > 0 ? (
                <div className="space-y-1">
                  {clients.map((client) => (
                    <label
                      key={client.id}
                      className={`flex items-center gap-3 p-2 rounded hover:bg-muted cursor-pointer ${
                        client.already_enrolled ? "opacity-60" : ""
                      }`}
                    >
                      <Checkbox
                        checked={selectedClientIds.includes(client.id)}
                        onCheckedChange={() => handleToggleClient(client.id)}
                        disabled={client.already_enrolled}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">
                            {client.name || "No name"}
                          </p>
                          {client.plan_name && (
                            <Badge variant="outline" className="text-xs shrink-0">
                              {client.plan_name}
                            </Badge>
                          )}
                          {client.already_enrolled && (
                            <Badge
                              variant="secondary"
                              className="text-xs shrink-0 gap-1"
                            >
                              <AlertTriangle className="h-3 w-3" />
                              Already enrolled
                            </Badge>
                          )}
                        </div>
                        {client.email && (
                          <p className="text-xs text-muted-foreground truncate">
                            {client.email}
                          </p>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No clients found
                </p>
              )}
            </ScrollArea>
          </div>
        )}

        {/* ── Step 3: Confirm ──────────────────────────────────────── */}
        {step === "confirm" && (
          <div className="space-y-4 py-4">
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <div className="flex justify-between">
                <span>Programme:</span>
                <span className="font-medium">{selectedProgram?.name}</span>
              </div>
              <div className="flex justify-between">
                <span>Tier:</span>
                <Badge variant="outline" className="capitalize">
                  {selectedTier}
                </Badge>
              </div>
              {selectedCohortId && (
                <div className="flex justify-between">
                  <span>Cohort:</span>
                  <span className="font-medium">
                    {cohorts?.find((c: any) => c.id === selectedCohortId)?.name || "—"}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Clients:</span>
                <Badge variant="secondary">{selectedClientIds.length}</Badge>
              </div>
              {creditCost > 0 && (
                <>
                  <div className="flex justify-between">
                    <span>Cost per client:</span>
                    <span>{finalCostPerClient} credits</span>
                  </div>
                  <div className="flex justify-between font-medium pt-2 border-t">
                    <span>Total credits:</span>
                    <Badge variant="default">{totalCost}</Badge>
                  </div>
                </>
              )}
              {creditCost === 0 && (
                <div className="flex justify-between">
                  <span>Cost:</span>
                  <Badge variant="outline">Free</Badge>
                </div>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              This will enrol {selectedClientIds.length} client(s) in {selectedProgram?.name}.
              Each enrolment uses the admin override (bypasses capacity and tier checks).
            </p>
          </div>
        )}

        {/* ── Step 4: Result ───────────────────────────────────────── */}
        {step === "result" && (
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-3 p-4 bg-primary/10 rounded-lg">
              <CheckCircle2 className="h-8 w-8 text-primary shrink-0" />
              <div>
                <p className="font-medium">Bulk Enrolment Complete</p>
                <p className="text-sm text-muted-foreground">
                  {results.success} client(s) successfully enrolled in {selectedProgram?.name}
                </p>
              </div>
            </div>
            {results.failed > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-3 p-4 bg-destructive/10 rounded-lg">
                  <AlertCircle className="h-6 w-6 text-destructive shrink-0" />
                  <p className="text-sm">{results.failed} client(s) failed to enrol</p>
                </div>
                <ScrollArea className="h-32 border rounded-md p-2">
                  {results.errors.map((err, i) => (
                    <div key={i} className="text-sm py-1 border-b last:border-0">
                      <span className="font-medium">{err.name}:</span>{" "}
                      <span className="text-muted-foreground">{err.error}</span>
                    </div>
                  ))}
                </ScrollArea>
              </div>
            )}
          </div>
        )}

        {/* ── Footer ───────────────────────────────────────────────── */}
        <DialogFooter>
          {step === "program" && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={() => setStep("clients")}
                disabled={!canProceedToClients}
              >
                Next: Select Clients
              </Button>
            </>
          )}
          {step === "clients" && (
            <>
              <Button variant="outline" onClick={() => setStep("program")}>
                Back
              </Button>
              <Button
                onClick={() => setStep("confirm")}
                disabled={!canProceedToConfirm}
              >
                Review ({selectedClientIds.length} selected)
              </Button>
            </>
          )}
          {step === "confirm" && (
            <>
              <Button variant="outline" onClick={() => setStep("clients")}>
                Back
              </Button>
              <Button
                onClick={() => enrollMutation.mutate()}
                disabled={enrollMutation.isPending}
              >
                {enrollMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Enrol {selectedClientIds.length} Client(s)
              </Button>
            </>
          )}
          {step === "result" && <Button onClick={handleClose}>Done</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
