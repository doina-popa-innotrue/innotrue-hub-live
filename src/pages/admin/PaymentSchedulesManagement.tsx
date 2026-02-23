import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { CreditCard, AlertTriangle, CheckCircle, Clock, XCircle } from "lucide-react";
import { format } from "date-fns";
import { formatPriceFromCents } from "@/hooks/useUserCredits";

interface PaymentSchedule {
  id: string;
  enrollment_id: string | null;
  user_id: string;
  stripe_subscription_id: string;
  total_amount_cents: number;
  currency: string;
  installment_count: number;
  installment_amount_cents: number;
  installments_paid: number;
  amount_paid_cents: number;
  next_payment_date: string | null;
  status: string;
  credits_granted: number;
  created_at: string;
  completed_at: string | null;
  cancelled_at: string | null;
  // Joined data
  user_name?: string;
  user_email?: string;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof CheckCircle }> = {
  active: { label: "Active", variant: "default", icon: Clock },
  completed: { label: "Completed", variant: "secondary", icon: CheckCircle },
  defaulted: { label: "Defaulted", variant: "destructive", icon: XCircle },
  cancelled: { label: "Cancelled", variant: "outline", icon: XCircle },
};

export default function PaymentSchedulesManagement() {
  const { data: schedules, isLoading } = useQuery({
    queryKey: ["admin-payment-schedules"],
    queryFn: async (): Promise<PaymentSchedule[]> => {
      const { data, error } = await supabase
        .from("payment_schedules")
        .select(`
          *,
          profiles:user_id (name, username)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data || []).map((s: Record<string, unknown>) => ({
        ...s,
        user_name: (s.profiles as Record<string, unknown>)?.name as string || "Unknown",
        user_email: (s.profiles as Record<string, unknown>)?.username as string || "",
      })) as PaymentSchedule[];
    },
  });

  // Summary stats
  const activeCount = schedules?.filter((s) => s.status === "active").length ?? 0;
  const defaultedCount = schedules?.filter((s) => s.status === "defaulted").length ?? 0;
  const totalOutstanding = schedules
    ?.filter((s) => s.status === "active")
    .reduce((sum, s) => sum + (s.total_amount_cents - s.amount_paid_cents), 0) ?? 0;
  const totalCollected = schedules?.reduce((sum, s) => sum + s.amount_paid_cents, 0) ?? 0;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <CreditCard className="h-8 w-8 text-primary" />
          Payment Schedules
        </h1>
        <p className="text-muted-foreground">
          Track installment payment plans across all enrollments
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Active Plans</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeCount}</div>
          </CardContent>
        </Card>
        <Card className={defaultedCount > 0 ? "border-destructive/50" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Defaulted
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${defaultedCount > 0 ? "text-destructive" : ""}`}>
              {defaultedCount}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Outstanding</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatPriceFromCents(totalOutstanding)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total Collected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              {formatPriceFromCents(totalCollected)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Schedules Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead>Next Payment</TableHead>
                <TableHead>Credits</TableHead>
                <TableHead>Started</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schedules && schedules.length > 0 ? (
                schedules.map((schedule) => {
                  const config = statusConfig[schedule.status] || statusConfig.active;
                  const StatusIcon = config.icon;
                  const progress = `${schedule.installments_paid}/${schedule.installment_count}`;
                  const progressPercent = Math.round(
                    (schedule.installments_paid / schedule.installment_count) * 100,
                  );

                  return (
                    <TableRow key={schedule.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{schedule.user_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {schedule.user_email}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={config.variant} className="flex items-center gap-1 w-fit">
                          <StatusIcon className="h-3 w-3" />
                          {config.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{progress}</span>
                          <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full transition-all"
                              style={{ width: `${progressPercent}%` }}
                            />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatPriceFromCents(schedule.total_amount_cents, schedule.currency)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatPriceFromCents(schedule.amount_paid_cents, schedule.currency)}
                      </TableCell>
                      <TableCell>
                        {schedule.next_payment_date && schedule.status === "active"
                          ? format(new Date(schedule.next_payment_date), "MMM d, yyyy")
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {schedule.credits_granted.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(schedule.created_at), "MMM d, yyyy")}
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    No payment schedules yet. Installment plans will appear here when clients
                    purchase credits with payment plans.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
