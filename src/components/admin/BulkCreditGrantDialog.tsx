import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Coins,
  Users,
  Upload,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Search,
  Calendar as CalendarIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format, addMonths } from "date-fns";
import { cn } from "@/lib/utils";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface BulkCreditGrantDialogProps {
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

interface ProfileUser {
  id: string;
  name: string | null;
  plan_id: string | null;
}

export function BulkCreditGrantDialog({ trigger, onSuccess }: BulkCreditGrantDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"select" | "confirm" | "result">("select");
  const [selectionMode, setSelectionMode] = useState<"manual" | "filter">("manual");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [expiryDate, setExpiryDate] = useState<Date | undefined>();
  const [filterPlan, setFilterPlan] = useState<string>("all");
  const [results, setResults] = useState<{ success: number; failed: number }>({
    success: 0,
    failed: 0,
  });

  // Fetch default expiry months for admin_grant
  const { data: sourceTypeConfig } = useQuery({
    queryKey: ["credit-source-type", "admin_grant"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_source_types")
        .select("default_expiry_months")
        .eq("key", "admin_grant")
        .single();
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Set default expiry date when dialog opens
  useEffect(() => {
    if (open && sourceTypeConfig?.default_expiry_months && !expiryDate) {
      setExpiryDate(addMonths(new Date(), sourceTypeConfig.default_expiry_months));
    }
  }, [open, sourceTypeConfig, expiryDate]);

  // Fetch users for manual selection
  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ["admin-users-for-credits", searchQuery],
    queryFn: async () => {
      let query = supabase.from("profiles").select("id, name, plan_id").order("name");

      if (searchQuery) {
        query = query.ilike("name", `%${searchQuery}%`);
      }

      const { data, error } = await query.limit(50);
      if (error) throw error;
      return data as ProfileUser[];
    },
    enabled: open && selectionMode === "manual",
  });

  // Fetch plans for filter
  const { data: plans } = useQuery({
    queryKey: ["plans-for-filter"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plans")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: open && selectionMode === "filter",
  });

  // Get count of users matching filter
  const { data: filteredCount } = useQuery({
    queryKey: ["filtered-users-count", filterPlan],
    queryFn: async () => {
      if (filterPlan === "all") {
        const { count } = await supabase
          .from("profiles")
          .select("id", { count: "exact", head: true });
        return count ?? 0;
      }

      // Filter by plan_id on profiles table
      const { count } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("plan_id", filterPlan);

      return count ?? 0;
    },
    enabled: open && selectionMode === "filter",
  });

  // Grant credits mutation
  const grantMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");

      const creditAmount = parseInt(amount, 10);
      if (isNaN(creditAmount) || creditAmount <= 0) {
        throw new Error("Invalid credit amount");
      }

      let targetUserIds: string[] = [];

      if (selectionMode === "manual") {
        targetUserIds = selectedUserIds;
      } else {
        // Get users by filter
        let query = supabase.from("profiles").select("id");

        if (filterPlan !== "all") {
          query = query.eq("plan_id", filterPlan);
        }

        const { data } = await query;
        targetUserIds = data?.map((p) => p.id) ?? [];
      }

      if (targetUserIds.length === 0) {
        throw new Error("No users selected");
      }

      let successCount = 0;
      let failedCount = 0;

      // Use selected expiry date or default
      if (!expiryDate) {
        throw new Error("No expiry date selected");
      }

      // Grant credits to each user using grant_credit_batch RPC
      for (const userId of targetUserIds) {
        try {
          const { error } = await supabase.rpc("grant_credit_batch", {
            p_owner_type: "user",
            p_owner_id: userId,
            p_amount: creditAmount,
            p_expires_at: expiryDate.toISOString(),
            p_source_type: "admin_grant",
            p_feature_key: undefined,
            p_source_reference_id: undefined,
            p_description: reason || "Bulk credit grant by admin",
          });

          if (error) {
            console.error(`Failed to grant credits to ${userId}:`, error);
            failedCount++;
          } else {
            successCount++;
          }
        } catch (err) {
          console.error(`Error granting credits to ${userId}:`, err);
          failedCount++;
        }
      }

      return { success: successCount, failed: failedCount };
    },
    onSuccess: (result) => {
      setResults(result);
      setStep("result");
      queryClient.invalidateQueries({ queryKey: ["admin-credit-transactions"] });
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleToggleUser = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  };

  const handleSelectAll = () => {
    if (users) {
      const allIds = users.map((u) => u.id);
      const allSelected = allIds.every((id) => selectedUserIds.includes(id));
      if (allSelected) {
        setSelectedUserIds((prev) => prev.filter((id) => !allIds.includes(id)));
      } else {
        setSelectedUserIds((prev) => [...new Set([...prev, ...allIds])]);
      }
    }
  };

  const resetDialog = () => {
    setStep("select");
    setSelectionMode("manual");
    setSearchQuery("");
    setSelectedUserIds([]);
    setAmount("");
    setReason("");
    setExpiryDate(undefined);
    setFilterPlan("all");
    setResults({ success: 0, failed: 0 });
  };

  const handleClose = () => {
    setOpen(false);
    resetDialog();
  };

  const targetCount = selectionMode === "manual" ? selectedUserIds.length : (filteredCount ?? 0);
  const canProceed = targetCount > 0 && parseInt(amount, 10) > 0 && !!expiryDate;

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
          <Button variant="outline">
            <Users className="h-4 w-4 mr-2" />
            Bulk Grant Credits
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" />
            Bulk Credit Grant
          </DialogTitle>
          <DialogDescription>Grant credits to multiple users at once.</DialogDescription>
        </DialogHeader>

        {step === "select" && (
          <div className="space-y-4">
            {/* Selection Mode */}
            <div className="flex gap-2">
              <Button
                variant={selectionMode === "manual" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectionMode("manual")}
              >
                <Users className="h-4 w-4 mr-1" />
                Select Users
              </Button>
              <Button
                variant={selectionMode === "filter" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectionMode("filter")}
              >
                <Upload className="h-4 w-4 mr-1" />
                By Plan
              </Button>
            </div>

            {selectionMode === "manual" && (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search users by name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {selectedUserIds.length} user(s) selected
                  </span>
                  <Button variant="ghost" size="sm" onClick={handleSelectAll}>
                    Toggle All
                  </Button>
                </div>

                <ScrollArea className="h-48 border rounded-md p-2">
                  {usersLoading ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                  ) : users && users.length > 0 ? (
                    <div className="space-y-1">
                      {users.map((u) => (
                        <label
                          key={u.id}
                          className="flex items-center gap-3 p-2 rounded hover:bg-muted cursor-pointer"
                        >
                          <Checkbox
                            checked={selectedUserIds.includes(u.id)}
                            onCheckedChange={() => handleToggleUser(u.id)}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{u.name || "No name"}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">No users found</p>
                  )}
                </ScrollArea>
              </>
            )}

            {selectionMode === "filter" && (
              <div className="space-y-3">
                <div>
                  <Label>Filter by Plan</Label>
                  <Select value={filterPlan} onValueChange={setFilterPlan}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select plan" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Users</SelectItem>
                      {plans?.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm">
                    <strong>{filteredCount ?? "..."}</strong> users match this filter
                  </p>
                </div>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="amount">Credit Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  min="1"
                  placeholder="e.g. 50"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div>
                <Label>Expiry Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !expiryDate && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {expiryDate ? format(expiryDate, "PPP") : "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={expiryDate}
                      onSelect={setExpiryDate}
                      disabled={(date) => date < new Date()}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div>
              <Label htmlFor="reason">Reason (optional)</Label>
              <Input
                id="reason"
                placeholder="e.g. Welcome bonus"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          </div>
        )}

        {step === "confirm" && (
          <div className="space-y-4 py-4">
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <div className="flex justify-between">
                <span>Users:</span>
                <Badge variant="secondary">{targetCount}</Badge>
              </div>
              <div className="flex justify-between">
                <span>Credits per user:</span>
                <Badge variant="default">{amount}</Badge>
              </div>
              <div className="flex justify-between font-medium">
                <span>Total credits:</span>
                <Badge variant="default">{targetCount * parseInt(amount, 10)}</Badge>
              </div>
              <div className="flex justify-between">
                <span>Expires:</span>
                <Badge variant="outline">
                  {expiryDate ? format(expiryDate, "PPP") : "Not set"}
                </Badge>
              </div>
              {reason && (
                <div className="pt-2 border-t text-sm text-muted-foreground">Reason: {reason}</div>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              This action cannot be undone. Credits will be immediately added to each user's
              balance.
            </p>
          </div>
        )}

        {step === "result" && (
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-3 p-4 bg-primary/10 rounded-lg">
              <CheckCircle2 className="h-8 w-8 text-primary" />
              <div>
                <p className="font-medium">Bulk Grant Complete</p>
                <p className="text-sm text-muted-foreground">
                  {results.success} user(s) received {amount} credits each
                </p>
              </div>
            </div>
            {results.failed > 0 && (
              <div className="flex items-center gap-3 p-4 bg-destructive/10 rounded-lg">
                <AlertCircle className="h-6 w-6 text-destructive" />
                <p className="text-sm">{results.failed} user(s) failed to receive credits</p>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {step === "select" && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={() => setStep("confirm")} disabled={!canProceed}>
                Review Grant
              </Button>
            </>
          )}
          {step === "confirm" && (
            <>
              <Button variant="outline" onClick={() => setStep("select")}>
                Back
              </Button>
              <Button onClick={() => grantMutation.mutate()} disabled={grantMutation.isPending}>
                {grantMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Confirm Grant
              </Button>
            </>
          )}
          {step === "result" && <Button onClick={handleClose}>Done</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
