import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Brain, TrendingUp, Target, Calendar, ChevronRight } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useNavigate } from "react-router-dom";
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator, BreadcrumbPage } from "@/components/ui/breadcrumb";
import { CapabilityGate } from "@/components/decisions/CapabilityGate";

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))'];

export default function DecisionAnalytics() {
  const navigate = useNavigate();
  
  const { data: decisions } = useQuery({
    queryKey: ["decisions-analytics"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("decisions")
        .select("*, decision_values(*)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  // Status distribution
  const statusData = decisions?.reduce((acc, d) => {
    const existing = acc.find(item => item.name === d.status);
    if (existing) {
      existing.value++;
    } else {
      acc.push({ name: d.status, value: 1 });
    }
    return acc;
  }, [] as { name: string; value: number }[]) || [];

  // Importance/Urgency matrix
  const matrixData = decisions?.reduce((acc, d) => {
    const key = `${d.importance || 'unset'}-${d.urgency || 'unset'}`;
    const label = `${d.importance || 'unset'} / ${d.urgency || 'unset'}`;
    const existing = acc.find(item => item.name === label);
    if (existing) {
      existing.count++;
    } else {
      acc.push({ name: label, count: 1 });
    }
    return acc;
  }, [] as { name: string; count: number }[]) || [];

  // Confidence trends over time
  const confidenceTrends = decisions
    ?.filter(d => d.decision_date && d.confidence_level !== null)
    .map(d => ({
      date: format(parseISO(d.decision_date), "MMM yyyy"),
      confidence: d.confidence_level,
      title: d.title,
    })) || [];

  // Values alignment statistics
  const valuesStats = decisions?.flatMap(d => d.decision_values || []).reduce((acc, v) => {
    const existing = acc.find(item => item.name === v.value_name);
    if (existing) {
      existing.count++;
      existing.totalScore += v.alignment_score || 0;
      existing.avgScore = existing.totalScore / existing.count;
    } else {
      acc.push({
        name: v.value_name,
        count: 1,
        totalScore: v.alignment_score || 0,
        avgScore: v.alignment_score || 0,
      });
    }
    return acc;
  }, [] as { name: string; count: number; totalScore: number; avgScore: number }[])
    .sort((a, b) => b.count - a.count)
    .slice(0, 10) || [];

  const totalDecisions = decisions?.length || 0;
  const madeDecisions = decisions?.filter(d => d.status === "made").length || 0;
  const avgConfidence = decisions?.reduce((sum, d) => sum + (d.confidence_level || 0), 0) / (decisions?.length || 1);

  return (
    <CapabilityGate capability="analytics_dashboard">
      <div className="container mx-auto p-6 space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink onClick={() => navigate("/decisions")} className="cursor-pointer">
              Decisions
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator>
            <ChevronRight className="h-4 w-4" />
          </BreadcrumbSeparator>
          <BreadcrumbItem>
            <BreadcrumbPage>Analytics</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div>
        <h1 className="text-3xl font-bold">Decision Analytics</h1>
        <p className="text-muted-foreground">Insights into your decision-making patterns</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Decisions</CardTitle>
            <Brain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalDecisions}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Decisions Made</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{madeDecisions}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Confidence</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgConfidence.toFixed(0)}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {decisions?.filter(d => {
                const created = new Date(d.created_at);
                const now = new Date();
                return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
              }).length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Decision Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Decision Status Distribution</CardTitle>
            <CardDescription>Current state of your decisions</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="hsl(var(--primary))"
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Importance/Urgency Matrix */}
        <Card>
          <CardHeader>
            <CardTitle>Importance & Urgency Distribution</CardTitle>
            <CardDescription>How you categorize your decisions</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={matrixData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Confidence Trends */}
        {confidenceTrends.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Confidence Trends</CardTitle>
              <CardDescription>How confident you feel over time</CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={confidenceTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="confidence" stroke="hsl(var(--primary))" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Values Alignment Statistics */}
        {valuesStats.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Top Values</CardTitle>
              <CardDescription>Your most commonly considered values</CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={valuesStats} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 12 }} />
                  <Tooltip content={({ payload }) => {
                    if (payload && payload[0]) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-background border border-border p-2 rounded shadow-lg">
                          <p className="font-semibold">{data.name}</p>
                          <p className="text-sm">Used: {data.count} times</p>
                          <p className="text-sm">Avg Score: {data.avgScore.toFixed(1)}/10</p>
                        </div>
                      );
                    }
                    return null;
                  }} />
                  <Bar dataKey="count" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>
      </div>
    </CapabilityGate>
  );
}
