import { useState, useMemo, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  FileText,
  BookOpen,
  Target,
  Plus,
  Home,
  Loader2,
  ExternalLink,
  Calendar,
  Trash2,
  CheckCircle,
  Circle,
  Link2,
  Search,
  StickyNote,
  Pencil,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  X,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DevelopmentItemDialog } from "@/components/capabilities/DevelopmentItemDialog";

interface DevelopmentItem {
  id: string;
  item_type: "reflection" | "note" | "resource" | "action_item";
  title: string | null;
  content: string | null;
  resource_url: string | null;
  resource_type: string | null;
  status: string | null;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  // Linked entities
  goal_links?: Array<{ goal_id: string; goal: { id: string; title: string } }>;
  milestone_links?: Array<{
    milestone_id: string;
    milestone: { id: string; title: string; goal_id: string };
  }>;
  question_links?: Array<{ question_id: string; snapshot_id: string | null }>;
  domain_links?: Array<{ domain_id: string; snapshot_id: string | null }>;
}

const TYPE_ICONS: Record<string, any> = {
  reflection: FileText,
  note: StickyNote,
  resource: BookOpen,
  action_item: Target,
};

const TYPE_COLORS: Record<string, string> = {
  reflection: "bg-chart-1/15 text-chart-1",
  note: "bg-chart-2/15 text-chart-2",
  resource: "bg-chart-3/15 text-chart-3",
  action_item: "bg-chart-4/15 text-chart-4",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-warning/15 text-warning",
  in_progress: "bg-primary/15 text-primary",
  completed: "bg-success/15 text-success",
};

type ViewMode = "list" | "grouped";

export default function DevelopmentItems() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // URL filter params
  const urlSnapshotId = searchParams.get("snapshotId");
  const urlQuestionId = searchParams.get("questionId");
  const urlDomainId = searchParams.get("domainId");

  // Filters
  const [showReflections, setShowReflections] = useState(true);
  const [showNotes, setShowNotes] = useState(true);
  const [showResources, setShowResources] = useState(true);
  const [showActions, setShowActions] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<DevelopmentItem | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(["unlinked"]));

  // Context filter state (synced with URL params)
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string>("all");
  const [selectedDomainId, setSelectedDomainId] = useState<string>("all");
  const [selectedQuestionId, setSelectedQuestionId] = useState<string>("all");
  const [selectedGoalId, setSelectedGoalId] = useState<string>("all");

  // Sync URL params to state on mount/change
  useEffect(() => {
    if (urlSnapshotId) setSelectedSnapshotId(urlSnapshotId);
    else setSelectedSnapshotId("all");

    if (urlDomainId) setSelectedDomainId(urlDomainId);
    else setSelectedDomainId("all");

    if (urlQuestionId) setSelectedQuestionId(urlQuestionId);
    else setSelectedQuestionId("all");
  }, [urlSnapshotId, urlDomainId, urlQuestionId]);

  // Update URL when filters change
  const updateUrlFilters = (snapshot: string, domain: string, question: string) => {
    const params = new URLSearchParams();
    if (snapshot !== "all") params.set("snapshotId", snapshot);
    if (domain !== "all") params.set("domainId", domain);
    if (question !== "all") params.set("questionId", question);
    setSearchParams(params);
  };

  // Cascading filter handlers
  const handleSnapshotChange = (value: string) => {
    setSelectedSnapshotId(value);
    setSelectedDomainId("all");
    setSelectedQuestionId("all");
    updateUrlFilters(value, "all", "all");
  };

  const handleDomainChange = (value: string) => {
    setSelectedDomainId(value);
    setSelectedQuestionId("all");
    updateUrlFilters(selectedSnapshotId, value, "all");
  };

  const handleQuestionChange = (value: string) => {
    setSelectedQuestionId(value);
    updateUrlFilters(selectedSnapshotId, selectedDomainId, value);
  };

  // Clear all filters including URL params
  const clearAllFilters = () => {
    setShowReflections(true);
    setShowNotes(true);
    setShowResources(true);
    setShowActions(true);
    setSelectedStatus("all");
    setSearchQuery("");
    setSelectedSnapshotId("all");
    setSelectedDomainId("all");
    setSelectedQuestionId("all");
    setSelectedGoalId("all");
    setSearchParams({});
  };

  // Check if any context filters are active
  const hasActiveContextFilters = selectedSnapshotId !== "all" || selectedGoalId !== "all";

  // Fetch user's completed snapshots with assessment names
  const { data: snapshots } = useQuery({
    queryKey: ["user-snapshots-for-filter", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("capability_snapshots")
        .select(
          `
          id,
          completed_at,
          assessment:capability_assessments(id, name)
        `,
        )
        .eq("user_id", user.id)
        .eq("status", "completed")
        .order("completed_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch domains for selected snapshot's assessment
  const { data: domains } = useQuery({
    queryKey: ["domains-for-filter", selectedSnapshotId, snapshots],
    queryFn: async () => {
      if (selectedSnapshotId === "all" || !snapshots) return [];
      const selectedSnapshot = snapshots.find((s) => s.id === selectedSnapshotId);
      if (!selectedSnapshot?.assessment?.id) return [];

      const { data, error } = await supabase
        .from("capability_domains")
        .select("id, name")
        .eq("assessment_id", selectedSnapshot.assessment.id)
        .order("order_index");
      if (error) throw error;
      return data;
    },
    enabled: selectedSnapshotId !== "all" && !!snapshots,
  });

  // Fetch questions for selected domain
  const { data: questions } = useQuery({
    queryKey: ["questions-for-filter", selectedDomainId],
    queryFn: async () => {
      if (selectedDomainId === "all") return [];
      const { data, error } = await supabase
        .from("capability_domain_questions")
        .select("id, question_text")
        .eq("domain_id", selectedDomainId)
        .order("order_index");
      if (error) throw error;
      return data;
    },
    enabled: selectedDomainId !== "all",
  });

  // Fetch user's goals
  const { data: goals } = useQuery({
    queryKey: ["goals-for-filter", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("goals")
        .select("id, title")
        .eq("user_id", user.id)
        .order("title");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch development items with all links
  const { data: items, isLoading } = useQuery({
    queryKey: ["development-items", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("development_items")
        .select(
          `
          *,
          goal_links:development_item_goal_links(
            goal_id,
            goal:goals(id, title)
          ),
          milestone_links:development_item_milestone_links(
            milestone_id,
            milestone:goal_milestones(id, title, goal_id)
          ),
          question_links:development_item_question_links(question_id, snapshot_id),
          domain_links:development_item_domain_links(domain_id, snapshot_id)
        `,
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as DevelopmentItem[];
    },
    enabled: !!user,
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.from("development_items").delete().eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ description: "Development item deleted" });
      queryClient.invalidateQueries({ queryKey: ["development-items"] });
      queryClient.invalidateQueries({ queryKey: ["recent-development-items"] });
      setItemToDelete(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Toggle action item status
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ itemId, newStatus }: { itemId: string; newStatus: string }) => {
      const updates: any = { status: newStatus };
      if (newStatus === "completed") {
        updates.completed_at = new Date().toISOString();
      } else {
        updates.completed_at = null;
      }

      const { error } = await supabase.from("development_items").update(updates).eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["development-items"] });
      queryClient.invalidateQueries({ queryKey: ["recent-development-items"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Filter items
  const filteredItems = useMemo(() => {
    if (!items) return [];

    return items.filter((item) => {
      // Context filters (URL-synced: snapshotId, domainId, questionId)
      if (selectedQuestionId !== "all") {
        const matchesQuestion = item.question_links?.some(
          (link) =>
            link.question_id === selectedQuestionId &&
            (selectedSnapshotId === "all" || link.snapshot_id === selectedSnapshotId),
        );
        if (!matchesQuestion) return false;
      } else if (selectedDomainId !== "all") {
        const matchesDomain = item.domain_links?.some(
          (link) =>
            link.domain_id === selectedDomainId &&
            (selectedSnapshotId === "all" || link.snapshot_id === selectedSnapshotId),
        );
        if (!matchesDomain) return false;
      } else if (selectedSnapshotId !== "all") {
        // Filter by snapshot (question or domain linked)
        const matchesSnapshot =
          item.question_links?.some((link) => link.snapshot_id === selectedSnapshotId) ||
          item.domain_links?.some((link) => link.snapshot_id === selectedSnapshotId);
        if (!matchesSnapshot) return false;
      }

      // Goal filter
      if (selectedGoalId !== "all") {
        const matchesGoal = item.goal_links?.some((link) => link.goal_id === selectedGoalId);
        if (!matchesGoal) return false;
      }

      // Type filter
      if (item.item_type === "reflection" && !showReflections) return false;
      if (item.item_type === "note" && !showNotes) return false;
      if (item.item_type === "resource" && !showResources) return false;
      if (item.item_type === "action_item" && !showActions) return false;

      // Status filter (for action items)
      if (selectedStatus !== "all" && item.item_type === "action_item") {
        if (selectedStatus === "pending" && item.status !== "pending") return false;
        if (selectedStatus === "completed" && item.status !== "completed") return false;
      }

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = item.title?.toLowerCase().includes(query);
        const matchesContent = item.content?.toLowerCase().includes(query);
        if (!matchesTitle && !matchesContent) return false;
      }

      return true;
    });
  }, [
    items,
    showReflections,
    showNotes,
    showResources,
    showActions,
    selectedStatus,
    searchQuery,
    selectedSnapshotId,
    selectedDomainId,
    selectedQuestionId,
    selectedGoalId,
  ]);

  // Group items by context (goal)
  const groupedItems = useMemo(() => {
    const groups: Record<string, { name: string; items: DevelopmentItem[]; goalId?: string }> = {
      unlinked: { name: "Unlinked Items", items: [] },
    };

    filteredItems.forEach((item) => {
      if (item.goal_links && item.goal_links.length > 0) {
        const goalLink = item.goal_links[0];
        const goalId = goalLink.goal_id;
        if (!groups[goalId]) {
          groups[goalId] = {
            name: goalLink.goal.title,
            items: [],
            goalId: goalId,
          };
        }
        groups[goalId].items.push(item);
      } else {
        groups.unlinked.items.push(item);
      }
    });

    // Sort groups: goals first (alphabetically), then unlinked at the end
    const sortedEntries = Object.entries(groups)
      .filter(([_, group]) => group.items.length > 0)
      .sort((a, b) => {
        if (a[0] === "unlinked") return 1;
        if (b[0] === "unlinked") return -1;
        return a[1].name.localeCompare(b[1].name);
      });

    return sortedEntries;
  }, [filteredItems]);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "reflection":
        return "Reflection";
      case "note":
        return "Note";
      case "resource":
        return "Resource";
      case "action_item":
        return "Action";
      default:
        return type;
    }
  };

  const getLinkedEntitiesCount = (item: DevelopmentItem) => {
    return (
      (item.goal_links?.length || 0) +
      (item.milestone_links?.length || 0) +
      (item.question_links?.length || 0) +
      (item.domain_links?.length || 0)
    );
  };

  const handleEdit = (item: DevelopmentItem) => {
    setEditItem(item);
    setDialogOpen(true);
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditItem(null);
    }
  };

  const renderItemCard = (item: DevelopmentItem) => {
    const Icon = TYPE_ICONS[item.item_type];
    const linkedCount = getLinkedEntitiesCount(item);

    return (
      <Card key={item.id} className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            {/* Type icon */}
            <div className={`p-2 rounded-lg shrink-0 ${TYPE_COLORS[item.item_type]}`}>
              <Icon className="h-5 w-5" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs">
                      {getTypeLabel(item.item_type)}
                    </Badge>
                    {item.item_type === "action_item" && item.status && (
                      <Badge className={`text-xs ${STATUS_COLORS[item.status] || "bg-secondary"}`}>
                        {item.status}
                      </Badge>
                    )}
                    {viewMode === "list" && linkedCount > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        <Link2 className="h-3 w-3 mr-1" />
                        {linkedCount} linked
                      </Badge>
                    )}
                  </div>
                  <h3 className="font-medium mt-1">{item.title || "Untitled"}</h3>
                  {item.content && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {item.content}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  {item.item_type === "action_item" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() =>
                        toggleStatusMutation.mutate({
                          itemId: item.id,
                          newStatus: item.status === "completed" ? "pending" : "completed",
                        })
                      }
                    >
                      {item.status === "completed" ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  )}
                  {item.resource_url && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                      <a href={item.resource_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleEdit(item)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => setItemToDelete(item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Linked entities - show in list view */}
              {viewMode === "list" && (item.goal_links?.length || item.milestone_links?.length) ? (
                <div className="flex flex-wrap gap-2 mt-3">
                  {item.goal_links?.map((link) => (
                    <Button
                      key={link.goal_id}
                      variant="outline"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={() => navigate(`/goals/${link.goal_id}`)}
                    >
                      <Target className="h-3 w-3 mr-1" />
                      {link.goal.title}
                    </Button>
                  ))}
                  {item.milestone_links?.map((link) => (
                    <Button
                      key={link.milestone_id}
                      variant="outline"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={() => navigate(`/goals/${link.milestone.goal_id}`)}
                    >
                      <Target className="h-3 w-3 mr-1" />
                      {link.milestone.title}
                    </Button>
                  ))}
                </div>
              ) : null}

              {/* Metadata */}
              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                <span>Added {format(parseISO(item.created_at), "MMM d, yyyy")}</span>
                {item.due_date && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Due {format(parseISO(item.due_date), "MMM d, yyyy")}
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (isLoading) {
    return <PageLoadingState />;
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/dashboard" className="flex items-center gap-1">
                <Home className="h-4 w-4" />
                Dashboard
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Development Items</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Development Items</h1>
          <p className="text-muted-foreground">
            Your reflections, resources, and action items for growth
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Item
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Filters Sidebar */}
        <Card className="lg:col-span-1 h-fit">
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Search className="h-4 w-4" />
                Filters
              </span>
              {hasActiveContextFilters && (
                <Button variant="ghost" size="sm" onClick={clearAllFilters} className="h-6 text-xs">
                  <X className="h-3 w-3 mr-1" />
                  Clear All
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Search */}
            <div className="space-y-2">
              <Label>Search</Label>
              <Input
                placeholder="Search items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <Separator />

            {/* View mode toggle */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">View</Label>
              <Select value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="list">
                    <span className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      List View
                    </span>
                  </SelectItem>
                  <SelectItem value="grouped">
                    <span className="flex items-center gap-2">
                      <FolderOpen className="h-4 w-4" />
                      Grouped by Goal
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Type filters with descriptions */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Item Types</Label>
              <div className="space-y-3">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="show-reflections"
                      checked={showReflections}
                      onCheckedChange={(checked) => setShowReflections(!!checked)}
                    />
                    <label
                      htmlFor="show-reflections"
                      className="flex items-center gap-2 text-sm cursor-pointer font-medium"
                    >
                      <FileText className="h-4 w-4 text-blue-500" />
                      Reflections
                    </label>
                  </div>
                  <p className="text-xs text-muted-foreground ml-6">
                    What you learned or how you've grown
                  </p>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="show-notes"
                      checked={showNotes}
                      onCheckedChange={(checked) => setShowNotes(!!checked)}
                    />
                    <label
                      htmlFor="show-notes"
                      className="flex items-center gap-2 text-sm cursor-pointer font-medium"
                    >
                      <StickyNote className="h-4 w-4 text-amber-500" />
                      Notes
                    </label>
                  </div>
                  <p className="text-xs text-muted-foreground ml-6">
                    What happened or what you observed
                  </p>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="show-resources"
                      checked={showResources}
                      onCheckedChange={(checked) => setShowResources(!!checked)}
                    />
                    <label
                      htmlFor="show-resources"
                      className="flex items-center gap-2 text-sm cursor-pointer font-medium"
                    >
                      <BookOpen className="h-4 w-4 text-emerald-500" />
                      Resources
                    </label>
                  </div>
                  <p className="text-xs text-muted-foreground ml-6">
                    External materials that support your learning
                  </p>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="show-actions"
                      checked={showActions}
                      onCheckedChange={(checked) => setShowActions(!!checked)}
                    />
                    <label
                      htmlFor="show-actions"
                      className="flex items-center gap-2 text-sm cursor-pointer font-medium"
                    >
                      <Target className="h-4 w-4 text-violet-500" />
                      Actions
                    </label>
                  </div>
                  <p className="text-xs text-muted-foreground ml-6">
                    Concrete next steps or commitments
                  </p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Status filter */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Action Status</Label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Context Filters */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Context Filters</Label>

              {/* Assessment filter */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Assessment</Label>
                <Select value={selectedSnapshotId} onValueChange={handleSnapshotChange}>
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="All assessments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All assessments</SelectItem>
                    {snapshots?.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        <span className="line-clamp-1">
                          {s.assessment?.name} (
                          {s.completed_at ? format(parseISO(s.completed_at), "MMM d") : "N/A"})
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Domain filter (enabled when assessment selected) */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Domain</Label>
                <Select
                  value={selectedDomainId}
                  onValueChange={handleDomainChange}
                  disabled={selectedSnapshotId === "all"}
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue
                      placeholder={
                        selectedSnapshotId === "all" ? "Select assessment first" : "All domains"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All domains</SelectItem>
                    {domains?.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Question filter (enabled when domain selected) */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Question</Label>
                <Select
                  value={selectedQuestionId}
                  onValueChange={handleQuestionChange}
                  disabled={selectedDomainId === "all"}
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue
                      placeholder={
                        selectedDomainId === "all" ? "Select domain first" : "All questions"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All questions</SelectItem>
                    {questions?.map((q) => (
                      <SelectItem key={q.id} value={q.id}>
                        <span className="line-clamp-1">{q.question_text}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Goal filter */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Goal</Label>
                <Select value={selectedGoalId} onValueChange={setSelectedGoalId}>
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="All goals" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All goals</SelectItem>
                    {goals?.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        <span className="line-clamp-1">{g.title}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            {/* Summary */}
            <div className="text-sm text-muted-foreground">
              Showing {filteredItems.length} of {items?.length || 0} items
            </div>
          </CardContent>
        </Card>

        {/* Items List */}
        <div className="lg:col-span-3 space-y-4">
          {filteredItems.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No development items yet</h3>
                <p className="text-muted-foreground mb-4">
                  Start adding reflections, resources, or action items to track your growth.
                </p>
                <Button onClick={() => setDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Your First Item
                </Button>
              </CardContent>
            </Card>
          ) : viewMode === "list" ? (
            <ScrollArea className="h-[calc(100vh-280px)]">
              <div className="space-y-3 pr-4">{filteredItems.map(renderItemCard)}</div>
            </ScrollArea>
          ) : (
            <ScrollArea className="h-[calc(100vh-280px)]">
              <div className="space-y-4 pr-4">
                {groupedItems.map(([groupId, group]) => (
                  <Collapsible
                    key={groupId}
                    open={expandedGroups.has(groupId)}
                    onOpenChange={() => toggleGroup(groupId)}
                  >
                    <Card>
                      <CollapsibleTrigger asChild>
                        <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {expandedGroups.has(groupId) ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                              {groupId === "unlinked" ? (
                                <FolderOpen className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <Target className="h-4 w-4 text-primary" />
                              )}
                              <span className="font-medium">{group.name}</span>
                              <Badge variant="secondary" className="text-xs">
                                {group.items.length}
                              </Badge>
                            </div>
                            {group.goalId && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/goals/${group.goalId}`);
                                }}
                              >
                                View Goal
                              </Button>
                            )}
                          </div>
                        </CardHeader>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <CardContent className="pt-0 space-y-3">
                          {group.items.map(renderItemCard)}
                        </CardContent>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </div>

      {/* Development Item Dialog */}
      <DevelopmentItemDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        snapshotId="standalone"
        editItem={editItem}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!itemToDelete} onOpenChange={() => setItemToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Development Item?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The item and all its links will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => itemToDelete && deleteMutation.mutate(itemToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
