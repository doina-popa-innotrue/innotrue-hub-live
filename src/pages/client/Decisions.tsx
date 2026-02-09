import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import { Plus, Target, Clock, CheckCircle2, XCircle, BarChart3, FileText, Bell, Lightbulb } from "lucide-react";
import { useState } from "react";
import { DecisionTemplateDialog } from "@/components/decisions/DecisionTemplateDialog";
import { DecisionTemplate } from "@/lib/decisionTemplates";
import { useToast } from "@/hooks/use-toast";
import { FeatureGate } from "@/components/FeatureGate";
import { CapabilityGate } from "@/components/decisions/CapabilityGate";
import { useDecisionFeatureAccess } from "@/hooks/useDecisionFeatureAccess";

export default function Decisions() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { hasCapability } = useDecisionFeatureAccess();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [importanceFilter, setImportanceFilter] = useState<string>("all");
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);

  const { data: decisions } = useQuery({
    queryKey: ["decisions"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("decisions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const createDecision = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("decisions")
      .insert({
        user_id: user.id,
        title: "New Decision",
        status: "upcoming",
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating decision:", error);
      return;
    }

    if (data) {
      navigate(`/decisions/${data.id}`);
    }
  };

  const createFromTemplate = useMutation({
    mutationFn: async (template: DecisionTemplate) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Create decision with template data
      const { data: decision, error: decisionError } = await supabase
        .from("decisions")
        .insert({
          user_id: user.id,
          title: template.name,
          description: template.description,
          status: "upcoming",
          importance: template.defaultImportance,
          ...template.modelNotes,
        })
        .select()
        .single();

      if (decisionError) throw decisionError;

      // Create default options
      const optionsData = template.defaultOptions.map(label => ({
        decision_id: decision.id,
        label,
      }));
      const { error: optionsError } = await supabase
        .from("decision_options")
        .insert(optionsData);

      if (optionsError) throw optionsError;

      // Create default values
      const valuesData = template.defaultValues.map(value_name => ({
        decision_id: decision.id,
        value_name,
      }));
      const { error: valuesError } = await supabase
        .from("decision_values")
        .insert(valuesData);

      if (valuesError) throw valuesError;

      return decision;
    },
    onSuccess: (decision) => {
      queryClient.invalidateQueries({ queryKey: ["decisions"] });
      toast({ title: "Decision created from template" });
      navigate(`/decisions/${decision.id}`);
    },
  });

  const filteredDecisions = decisions?.filter((d) => {
    const matchesStatus = statusFilter === "all" || d.status === statusFilter;
    const matchesImportance = importanceFilter === "all" || d.importance === importanceFilter;
    return matchesStatus && matchesImportance;
  }) || [];

  const groupedDecisions = {
    upcoming: filteredDecisions.filter((d) => d.status === "upcoming"),
    in_progress: filteredDecisions.filter((d) => d.status === "in_progress"),
    made: filteredDecisions.filter((d) => d.status === "made"),
  };

  function getStatusIcon(status: string) {
    switch (status) {
      case "upcoming": return <Clock className="h-5 w-5" />;
      case "in_progress": return <Target className="h-5 w-5" />;
      case "made": return <CheckCircle2 className="h-5 w-5" />;
      case "cancelled": return <XCircle className="h-5 w-5" />;
      default: return null;
    }
  }

  function getImportanceBadgeColor(importance: string | null) {
    switch (importance) {
      case "critical": return "destructive";
      case "high": return "destructive";
      case "medium": return "default";
      case "low": return "secondary";
      default: return "outline";
    }
  }

  return (
    <FeatureGate featureKey="decision_toolkit_basic">
      <div className="container mx-auto p-6 space-y-6 max-w-7xl">
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">Decision Toolkit</h1>
              <p className="text-muted-foreground">Analyze and track your important decisions</p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              {hasCapability('decision_templates') && (
                <Button variant="outline" onClick={() => setTemplateDialogOpen(true)} className="flex-1 sm:flex-initial">
                  <FileText className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Use Template</span>
                  <span className="sm:hidden">Template</span>
                </Button>
              )}
              <Button onClick={createDecision} className="flex-1 sm:flex-initial">
                <Plus className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">New Decision</span>
                <span className="sm:hidden">New</span>
              </Button>
            </div>
          </div>
          
          <div className="flex gap-2 flex-wrap">
            {hasCapability('reminders_followups') && (
              <Button variant="outline" size="sm" onClick={() => navigate("/decisions/follow-ups")}>
                <Bell className="h-4 w-4 mr-2" />
                Follow-Ups
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => navigate("/decisions/insights")}>
              <Lightbulb className="h-4 w-4 mr-2" />
              AI Insights
            </Button>
            {hasCapability('outcome_tracking') && (
              <Button variant="outline" size="sm" onClick={() => navigate("/decisions/outcomes")}>
                <Target className="h-4 w-4 mr-2" />
                Outcomes
              </Button>
            )}
            {hasCapability('analytics_dashboard') && (
              <Button variant="outline" size="sm" onClick={() => navigate("/decisions/analytics")}>
                <BarChart3 className="mr-2 h-4 w-4" />
                Analytics
              </Button>
            )}
          </div>
        </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="upcoming">Upcoming</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="made">Made</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>

            <Select value={importanceFilter} onValueChange={setImportanceFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Importance" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Importance</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Grouped Decisions */}
      <div className="space-y-6">
        {/* Upcoming */}
        <div>
          <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Upcoming Decisions ({groupedDecisions.upcoming.length})
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {groupedDecisions.upcoming.map((decision) => (
              <Card key={decision.id} className="cursor-pointer hover:border-primary transition-colors" onClick={() => navigate(`/decisions/${decision.id}`)}>
                <CardHeader>
                  <CardTitle>{decision.title}</CardTitle>
                  {decision.description && <CardDescription>{decision.description}</CardDescription>}
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex gap-2 flex-wrap">
                    {decision.importance && (
                      <Badge variant={getImportanceBadgeColor(decision.importance) as any}>
                        {decision.importance}
                      </Badge>
                    )}
                    {decision.urgency && (
                      <Badge variant="secondary">{decision.urgency} urgency</Badge>
                    )}
                  </div>
                  {decision.confidence_level !== null && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Confidence:</span>
                      <div className="flex-1 bg-secondary rounded-full h-2">
                        <div
                          className="bg-primary rounded-full h-2 transition-all"
                          style={{ width: `${decision.confidence_level}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium">{decision.confidence_level}%</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
            {groupedDecisions.upcoming.length === 0 && (
              <p className="text-muted-foreground col-span-full">No upcoming decisions</p>
            )}
          </div>
        </div>

        {/* In Progress */}
        <div>
          <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
            <Target className="h-5 w-5" />
            In Progress ({groupedDecisions.in_progress.length})
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {groupedDecisions.in_progress.map((decision) => (
              <Card key={decision.id} className="cursor-pointer hover:border-primary transition-colors" onClick={() => navigate(`/decisions/${decision.id}`)}>
                <CardHeader>
                  <CardTitle>{decision.title}</CardTitle>
                  {decision.description && <CardDescription>{decision.description}</CardDescription>}
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex gap-2 flex-wrap">
                    {decision.importance && (
                      <Badge variant={getImportanceBadgeColor(decision.importance) as any}>
                        {decision.importance}
                      </Badge>
                    )}
                    {decision.urgency && (
                      <Badge variant="secondary">{decision.urgency} urgency</Badge>
                    )}
                  </div>
                  {decision.confidence_level !== null && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Confidence:</span>
                      <div className="flex-1 bg-secondary rounded-full h-2">
                        <div
                          className="bg-primary rounded-full h-2 transition-all"
                          style={{ width: `${decision.confidence_level}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium">{decision.confidence_level}%</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
            {groupedDecisions.in_progress.length === 0 && (
              <p className="text-muted-foreground col-span-full">No decisions in progress</p>
            )}
          </div>
        </div>

        {/* Made */}
        <div>
          <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5" />
            Made Decisions ({groupedDecisions.made.length})
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {groupedDecisions.made.map((decision) => (
              <Card key={decision.id} className="cursor-pointer hover:border-primary transition-colors" onClick={() => navigate(`/decisions/${decision.id}`)}>
                <CardHeader>
                  <CardTitle>{decision.title}</CardTitle>
                  {decision.description && <CardDescription>{decision.description}</CardDescription>}
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex gap-2 flex-wrap">
                    {decision.importance && (
                      <Badge variant={getImportanceBadgeColor(decision.importance) as any}>
                        {decision.importance}
                      </Badge>
                    )}
                    {decision.urgency && (
                      <Badge variant="secondary">{decision.urgency} urgency</Badge>
                    )}
                  </div>
                  {decision.confidence_level !== null && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Confidence:</span>
                      <div className="flex-1 bg-secondary rounded-full h-2">
                        <div
                          className="bg-primary rounded-full h-2 transition-all"
                          style={{ width: `${decision.confidence_level}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium">{decision.confidence_level}%</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
            {groupedDecisions.made.length === 0 && (
              <p className="text-muted-foreground col-span-full">No made decisions</p>
            )}
          </div>
        </div>
      </div>

        <DecisionTemplateDialog
          open={templateDialogOpen}
          onOpenChange={setTemplateDialogOpen}
          onSelectTemplate={(template) => createFromTemplate.mutate(template)}
        />
      </div>
    </FeatureGate>
  );
}
