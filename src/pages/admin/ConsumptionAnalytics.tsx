import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { TrendingUp, Users, Zap, Brain, Coins, ChevronLeft, ChevronRight, Search, Download } from "lucide-react";
import { useState, useCallback } from "react";
import { BulkCreditGrantDialog } from "@/components/admin/BulkCreditGrantDialog";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { toast } from "sonner";

interface UsageRecord {
  user_id: string;
  feature_key: string;
  used_count: number;
  period_start: string;
  name: string | null;
  email: string | null;
}

interface FeatureStats {
  feature_key: string;
  feature_name: string;
  total_usage: number;
  unique_users: number;
}

interface CreditTransaction {
  id: string;
  user_id: string;
  transaction_type: string;
  amount: number;
  balance_after: number;
  action_type: string | null;
  action_reference_id: string | null;
  description: string | null;
  created_at: string;
  user_name: string | null;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];
const PAGE_SIZE = 20;

export default function ConsumptionAnalytics() {
  const [selectedFeature, setSelectedFeature] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState<string>("current");
  const [creditPage, setCreditPage] = useState(0);
  const [creditSearch, setCreditSearch] = useState("");
  const [creditActionType, setCreditActionType] = useState<string>("all");

  const getDateRange = () => {
    const now = new Date();
    if (selectedMonth === "current") {
      return { start: startOfMonth(now), end: endOfMonth(now) };
    }
    const monthsAgo = parseInt(selectedMonth);
    const targetDate = subMonths(now, monthsAgo);
    return { start: startOfMonth(targetDate), end: endOfMonth(targetDate) };
  };

  const { data: features } = useQuery({
    queryKey: ["consumable-features"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("features")
        .select("key, name")
        .eq("is_consumable", true);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: usageData, isLoading } = useQuery({
    queryKey: ["consumption-analytics", selectedFeature, selectedMonth],
    queryFn: async () => {
      const { start, end } = getDateRange();

      let query = supabase
        .from("usage_tracking")
        .select(`
          user_id,
          feature_key,
          used_count,
          period_start
        `)
        .gte("period_start", start.toISOString())
        .lte("period_start", end.toISOString());

      if (selectedFeature !== "all") {
        query = query.eq("feature_key", selectedFeature);
      }

      const { data: usageRecords, error } = await query;
      if (error) throw error;

      // Get user profiles for names
      const userIds = [...new Set((usageRecords || []).map((r) => r.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name, email:id")
        .in("id", userIds);

      // Get emails from auth function
      const profileMap = new Map<string, { name: string | null; email: string | null }>();
      for (const p of profiles || []) {
        profileMap.set(p.id, { name: p.name, email: null });
      }

      const enrichedRecords: UsageRecord[] = (usageRecords || []).map((r) => ({
        ...r,
        name: profileMap.get(r.user_id)?.name || null,
        email: profileMap.get(r.user_id)?.email || null,
      }));

      // Calculate feature statistics
      const featureStats: FeatureStats[] = [];
      const featureMap = new Map<string, { total: number; users: Set<string> }>();

      for (const record of enrichedRecords) {
        if (!featureMap.has(record.feature_key)) {
          featureMap.set(record.feature_key, { total: 0, users: new Set() });
        }
        const stat = featureMap.get(record.feature_key)!;
        stat.total += record.used_count;
        stat.users.add(record.user_id);
      }

      for (const [key, stat] of featureMap.entries()) {
        const feature = features?.find((f) => f.key === key);
        featureStats.push({
          feature_key: key,
          feature_name: feature?.name || key,
          total_usage: stat.total,
          unique_users: stat.users.size,
        });
      }

      return {
        records: enrichedRecords,
        stats: featureStats,
        totalUsage: enrichedRecords.reduce((sum, r) => sum + r.used_count, 0),
        uniqueUsers: new Set(enrichedRecords.map((r) => r.user_id)).size,
      };
    },
    enabled: !!features,
  });

  // Credit transactions query (paginated)
  const { data: creditData, isLoading: creditsLoading } = useQuery({
    queryKey: ["credit-transactions-admin", creditPage, creditSearch, creditActionType],
    queryFn: async () => {
      // Get total count first
      let countQuery = supabase
        .from("user_credit_transactions")
        .select("id", { count: "exact", head: true });

      if (creditActionType !== "all") {
        countQuery = countQuery.eq("action_type", creditActionType);
      }

      const { count } = await countQuery;

      // Get paginated data
      let query = supabase
        .from("user_credit_transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .range(creditPage * PAGE_SIZE, (creditPage + 1) * PAGE_SIZE - 1);

      if (creditActionType !== "all") {
        query = query.eq("action_type", creditActionType);
      }

      const { data: transactions, error } = await query;
      if (error) throw error;

      // Get user names
      const userIds = [...new Set((transactions || []).map((t) => t.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name")
        .in("id", userIds);

      const profileMap = new Map(profiles?.map((p) => [p.id, p.name]) || []);

      // Filter by search if provided
      let enriched: CreditTransaction[] = (transactions || []).map((t) => ({
        ...t,
        user_name: profileMap.get(t.user_id) || null,
      }));

      if (creditSearch) {
        const searchLower = creditSearch.toLowerCase();
        enriched = enriched.filter(
          (t) =>
            t.user_name?.toLowerCase().includes(searchLower) ||
            t.description?.toLowerCase().includes(searchLower) ||
            t.action_type?.toLowerCase().includes(searchLower)
        );
      }

      // Calculate summary stats
      const { data: summaryData } = await supabase
        .from("user_credit_transactions")
        .select("transaction_type, amount");

      const totalConsumed = (summaryData || [])
        .filter((t) => t.transaction_type === "consumption")
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);

      const totalGranted = (summaryData || [])
        .filter((t) => t.transaction_type !== "consumption" && t.amount > 0)
        .reduce((sum, t) => sum + t.amount, 0);

      return {
        transactions: enriched,
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / PAGE_SIZE),
        totalConsumed,
        totalGranted,
      };
    },
  });

  // Credit services for action type filter
  const { data: creditServices } = useQuery({
    queryKey: ["credit-services-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_services")
        .select("id, name, category")
        .eq("is_active", true)
        .order("category")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { start, end } = getDateRange();

  // CSV Export functions
  const exportCreditTransactionsCSV = useCallback(async () => {
    try {
      toast.info("Preparing export...");
      
      // Fetch all transactions (not paginated)
      let query = supabase
        .from("user_credit_transactions")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (creditActionType !== "all") {
        query = query.eq("action_type", creditActionType);
      }
      
      const { data: allTransactions, error } = await query;
      if (error) throw error;
      
      // Get user names
      const userIds = [...new Set((allTransactions || []).map((t) => t.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name")
        .in("id", userIds);
      
      const profileMap = new Map(profiles?.map((p) => [p.id, p.name]) || []);
      
      // Build CSV
      const headers = ["Date", "User", "Type", "Action Type", "Amount", "Balance After", "Description"];
      const rows = (allTransactions || []).map((tx) => [
        format(new Date(tx.created_at), "yyyy-MM-dd HH:mm:ss"),
        profileMap.get(tx.user_id) || tx.user_id,
        tx.transaction_type,
        tx.action_type || "",
        tx.amount,
        tx.balance_after,
        tx.description || "",
      ]);
      
      const csvContent = [
        headers.join(","),
        ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
      ].join("\n");
      
      // Download
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `credit-transactions-${format(new Date(), "yyyy-MM-dd")}.csv`;
      link.click();
      
      toast.success("Export completed");
    } catch (error) {
      console.error("Export failed:", error);
      toast.error("Failed to export data");
    }
  }, [creditActionType]);

  const exportFeatureUsageCSV = useCallback(async () => {
    try {
      toast.info("Preparing export...");
      
      let query = supabase
        .from("usage_tracking")
        .select("user_id, feature_key, used_count, period_start")
        .gte("period_start", start.toISOString())
        .lte("period_start", end.toISOString());
      
      if (selectedFeature !== "all") {
        query = query.eq("feature_key", selectedFeature);
      }
      
      const { data: usageRecords, error } = await query;
      if (error) throw error;
      
      // Get user names
      const userIds = [...new Set((usageRecords || []).map((r) => r.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name")
        .in("id", userIds);
      
      const profileMap = new Map(profiles?.map((p) => [p.id, p.name]) || []);
      
      // Build CSV
      const headers = ["Period", "User", "Feature", "Usage Count"];
      const rows = (usageRecords || []).map((record) => [
        format(new Date(record.period_start), "yyyy-MM-dd"),
        profileMap.get(record.user_id) || record.user_id,
        features?.find((f) => f.key === record.feature_key)?.name || record.feature_key,
        record.used_count,
      ]);
      
      const csvContent = [
        headers.join(","),
        ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
      ].join("\n");
      
      // Download
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `feature-usage-${format(start, "yyyy-MM")}.csv`;
      link.click();
      
      toast.success("Export completed");
    } catch (error) {
      console.error("Export failed:", error);
      toast.error("Failed to export data");
    }
  }, [start, end, selectedFeature, features]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Consumption Analytics</h1>
        <p className="text-muted-foreground">
          Track credits and consumable feature usage across users
        </p>
      </div>

      <Tabs defaultValue="credits" className="space-y-6">
        <TabsList>
          <TabsTrigger value="credits" className="gap-2">
            <Coins className="h-4 w-4" />
            Credit Transactions
          </TabsTrigger>
          <TabsTrigger value="features" className="gap-2">
            <Zap className="h-4 w-4" />
            Feature Usage
          </TabsTrigger>
        </TabsList>

        {/* Credit Transactions Tab */}
        <TabsContent value="credits" className="space-y-6">
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Consumed</CardTitle>
                <TrendingUp className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">
                  {creditData?.totalConsumed?.toLocaleString() || 0}
                </div>
                <p className="text-xs text-muted-foreground">credits consumed all time</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Granted</CardTitle>
                <Coins className="h-4 w-4 text-success" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-success">
                  {creditData?.totalGranted?.toLocaleString() || 0}
                </div>
                <p className="text-xs text-muted-foreground">credits granted all time</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Transactions</CardTitle>
                <Brain className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{creditData?.totalCount || 0}</div>
                <p className="text-xs text-muted-foreground">total transactions</p>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          {/* Actions Bar */}
          <div className="flex justify-end gap-2">
            <BulkCreditGrantDialog />
            <Button variant="outline" onClick={exportCreditTransactionsCSV}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Transaction History</CardTitle>
              <CardDescription>All credit transactions across users</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by user or description..."
                    value={creditSearch}
                    onChange={(e) => setCreditSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={creditActionType} onValueChange={setCreditActionType}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Filter by type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="enrollment">Enrollments</SelectItem>
                    <SelectItem value="credit_service">Credit Services</SelectItem>
                    <SelectItem value="topup">Top-ups</SelectItem>
                    <SelectItem value="grant">Grants</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {creditsLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-right">Balance After</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {creditData?.transactions && creditData.transactions.length > 0 ? (
                        creditData.transactions.map((tx) => (
                          <TableRow key={tx.id}>
                            <TableCell className="font-medium">
                              {tx.user_name || "Unknown"}
                            </TableCell>
                            <TableCell>
                              <Badge variant={tx.amount >= 0 ? "default" : "secondary"}>
                                {tx.action_type || tx.transaction_type}
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-[300px] truncate">
                              {tx.description || "—"}
                            </TableCell>
                            <TableCell
                              className={`text-right font-mono ${
                                tx.amount >= 0 ? "text-success" : "text-destructive"
                              }`}
                            >
                              {tx.amount >= 0 ? "+" : ""}
                              {tx.amount}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {tx.balance_after}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {format(new Date(tx.created_at), "MMM d, yyyy HH:mm")}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            No transactions found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>

                  {/* Pagination */}
                  {(creditData?.totalPages ?? 0) > 1 && (
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        Page {creditPage + 1} of {creditData?.totalPages}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCreditPage((p) => Math.max(0, p - 1))}
                          disabled={creditPage === 0}
                        >
                          <ChevronLeft className="h-4 w-4" />
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCreditPage((p) => p + 1)}
                          disabled={creditPage >= (creditData?.totalPages ?? 1) - 1}
                        >
                          Next
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Feature Usage Tab */}
        <TabsContent value="features" className="space-y-6">
          <div className="flex justify-end gap-2">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select month" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current">Current Month</SelectItem>
                <SelectItem value="1">Last Month</SelectItem>
                <SelectItem value="2">2 Months Ago</SelectItem>
                <SelectItem value="3">3 Months Ago</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedFeature} onValueChange={setSelectedFeature}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by feature" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Features</SelectItem>
                {features?.map((f) => (
                  <SelectItem key={f.key} value={f.key}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={exportFeatureUsageCSV}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>

          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-3">
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Usage</CardTitle>
                    <Zap className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{usageData?.totalUsage || 0}</div>
                    <p className="text-xs text-muted-foreground">
                      credits consumed in {format(start, "MMMM yyyy")}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Active Users</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{usageData?.uniqueUsers || 0}</div>
                    <p className="text-xs text-muted-foreground">
                      users with consumption this period
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Features Used</CardTitle>
                    <Brain className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{usageData?.stats.length || 0}</div>
                    <p className="text-xs text-muted-foreground">
                      consumable features active
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Charts */}
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Usage by Feature</CardTitle>
                    <CardDescription>Total consumption per feature</CardDescription>
                  </CardHeader>
                  <CardContent className="h-[300px]">
                    {usageData?.stats && usageData.stats.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={usageData.stats}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="feature_name" className="text-xs" />
                          <YAxis className="text-xs" />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'hsl(var(--background))', 
                              border: '1px solid hsl(var(--border))' 
                            }} 
                          />
                          <Bar dataKey="total_usage" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground">
                        No usage data for this period
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Usage Distribution</CardTitle>
                    <CardDescription>Breakdown by feature</CardDescription>
                  </CardHeader>
                  <CardContent className="h-[300px]">
                    {usageData?.stats && usageData.stats.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={usageData.stats}
                            dataKey="total_usage"
                            nameKey="feature_name"
                            cx="50%"
                            cy="50%"
                            outerRadius={100}
                            label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                          >
                            {usageData.stats.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'hsl(var(--background))', 
                              border: '1px solid hsl(var(--border))' 
                            }} 
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground">
                        No usage data for this period
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Detailed Table */}
              <Card>
                <CardHeader>
                  <CardTitle>User Consumption Details</CardTitle>
                  <CardDescription>
                    Individual user usage for {format(start, "MMMM yyyy")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Feature</TableHead>
                        <TableHead className="text-right">Usage</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {usageData?.records && usageData.records.length > 0 ? (
                        usageData.records
                          .sort((a, b) => b.used_count - a.used_count)
                          .map((record, idx) => (
                            <TableRow key={`${record.user_id}-${record.feature_key}-${idx}`}>
                              <TableCell>
                                <div className="font-medium">{record.name || "Unknown"}</div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">
                                  {features?.find((f) => f.key === record.feature_key)?.name || record.feature_key}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {record.used_count}
                              </TableCell>
                            </TableRow>
                          ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                            No consumption data for this period
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
