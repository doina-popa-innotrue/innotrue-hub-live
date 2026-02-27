import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { FeatureGate } from "@/components/FeatureGate";
import {
  WHEEL_OF_LIFE_CATEGORIES,
  WHEEL_CATEGORY_DESCRIPTIONS,
  WheelCategory,
  WheelSnapshot,
  getSnapshotRatings,
} from "@/lib/wheelOfLifeCategories";
import { useCategoryLookup } from "@/hooks/useWheelCategories";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";
import {
  Camera,
  History,
  Target,
  Plus,
  Calendar,
  ArrowRight,
  Share2,
  MessageSquare,
  Lock,
  Crown,
} from "lucide-react";
import { format } from "date-fns";
import { Switch } from "@/components/ui/switch";
import { DomainReflectionDialog } from "@/components/wheel/DomainReflectionDialog";
import { useWheelFreePlanLimits } from "@/hooks/useWheelFreePlanLimits";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { WheelShareConsentDialog } from "@/components/wheel/WheelShareConsentDialog";
import { PageLoadingState } from "@/components/ui/page-loading-state";

export default function WheelOfLife() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedCategory = searchParams.get("category");
  const planLimits = useWheelFreePlanLimits();
  const { colors: categoryColors, snapshotToGoalKey } = useCategoryLookup();

  const [snapshots, setSnapshots] = useState<WheelSnapshot[]>([]);
  const [goalCounts, setGoalCounts] = useState<Record<WheelCategory, number>>(
    {} as Record<WheelCategory, number>,
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [compareSnapshot, setCompareSnapshot] = useState<string | null>(null);
  const [updatingShare, setUpdatingShare] = useState<string | null>(null);
  const [reflectionCategory, setReflectionCategory] = useState<WheelCategory | null>(null);
  const [shareConsentSnapshot, setShareConsentSnapshot] = useState<{
    id: string;
    date: string;
  } | null>(null);

  const [currentRatings, setCurrentRatings] = useState<Record<WheelCategory, number>>(() => {
    const initial: Record<WheelCategory, number> = {} as Record<WheelCategory, number>;
    (Object.keys(WHEEL_OF_LIFE_CATEGORIES) as WheelCategory[]).forEach((cat) => {
      initial[cat] = 5;
    });
    return initial;
  });
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (user) {
      fetchSnapshots();
      fetchGoalCounts();
    }
  }, [user]);

  const fetchSnapshots = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("wheel_of_life_snapshots")
        .select("*")
        .eq("user_id", user.id)
        .order("snapshot_date", { ascending: false });

      if (error) throw error;
      setSnapshots((data || []) as WheelSnapshot[]);

      // Pre-fill with latest snapshot values if available
      if (data && data.length > 0) {
        const latest = data[0] as WheelSnapshot;
        const ratings: Record<WheelCategory, number> = {} as Record<WheelCategory, number>;
        (Object.keys(WHEEL_OF_LIFE_CATEGORIES) as WheelCategory[]).forEach((cat) => {
          ratings[cat] = latest[cat] || 5;
        });
        setCurrentRatings(ratings);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load wheel of life data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchGoalCounts = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("goals")
        .select("category")
        .eq("user_id", user.id);

      if (error) throw error;

      const counts: Record<WheelCategory, number> = {} as Record<WheelCategory, number>;
      (Object.keys(WHEEL_OF_LIFE_CATEGORIES) as WheelCategory[]).forEach((cat) => {
        counts[cat] = 0;
      });

      (data || []).forEach((goal: { category: string }) => {
        if (goal.category in counts) {
          counts[goal.category as WheelCategory]++;
        }
      });

      setGoalCounts(counts);
    } catch (error) {
      console.error("Failed to fetch goal counts:", error);
    }
  };

  const handleSaveSnapshot = async () => {
    if (!user) return;
    setSaving(true);

    try {
      const snapshotData = {
        user_id: user.id,
        snapshot_date: new Date().toISOString().split("T")[0],
        notes: notes || null,
        ...currentRatings,
      };

      const { error } = await supabase.from("wheel_of_life_snapshots").insert([snapshotData]);

      if (error) throw error;

      toast({
        title: "Snapshot Saved",
        description: "Your Wheel of Life snapshot has been saved.",
      });

      setShowForm(false);
      setNotes("");
      fetchSnapshots();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to save snapshot",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const getChartData = (snapshot?: WheelSnapshot) => {
    const source = snapshot || ({ ...currentRatings } as any);
    return (Object.keys(WHEEL_OF_LIFE_CATEGORIES) as WheelCategory[]).map((cat) => ({
      category: WHEEL_OF_LIFE_CATEGORIES[cat],
      value: source[cat] || 0,
      fullMark: 10,
    }));
  };

  const getComparisonData = () => {
    if (!compareSnapshot || snapshots.length < 2) return null;

    const compareSnap = snapshots.find((s) => s.id === compareSnapshot);
    const latestSnap = snapshots[0];

    if (!compareSnap || !latestSnap) return null;

    return (Object.keys(WHEEL_OF_LIFE_CATEGORIES) as WheelCategory[]).map((cat) => ({
      category: WHEEL_OF_LIFE_CATEGORIES[cat],
      current: latestSnap[cat] || 0,
      previous: compareSnap[cat] || 0,
      fullMark: 10,
    }));
  };

  /** Translate a wheel snapshot column key to the DB goal category key */
  const toGoalCategoryKey = (snapshotCol: WheelCategory): string =>
    snapshotToGoalKey[snapshotCol] || snapshotCol;

  const navigateToGoals = (category: WheelCategory) => {
    navigate(`/goals?category=${toGoalCategoryKey(category)}`);
  };

  const handleAddGoal = (category: WheelCategory) => {
    if (planLimits.isFreePlan && !planLimits.canAddGoal) {
      toast({
        title: "Goal Limit Reached",
        description: `Free plan allows ${planLimits.maxGoals} wheel goals. Upgrade to add more.`,
        variant: "destructive",
      });
      return;
    }
    navigate(`/goals?category=${toGoalCategoryKey(category)}&new=true`);
  };

  const navigateToAddGoal = (category: WheelCategory) => {
    navigate(`/goals?category=${toGoalCategoryKey(category)}&new=true`);
  };

  const handleShareToggle = (snapshotId: string, snapshotDate: string, currentValue: boolean) => {
    if (!currentValue) {
      // Show consent dialog when enabling sharing
      setShareConsentSnapshot({
        id: snapshotId,
        date: format(new Date(snapshotDate), "MMMM d, yyyy"),
      });
    } else {
      // Immediately disable sharing (no consent needed to revoke)
      executeShareUpdate(snapshotId, false);
    }
  };

  const executeShareUpdate = async (snapshotId: string, newValue: boolean) => {
    setUpdatingShare(snapshotId);
    try {
      const { error } = await supabase
        .from("wheel_of_life_snapshots")
        .update({ shared_with_coach: newValue })
        .eq("id", snapshotId);

      if (error) throw error;

      setSnapshots((prev) =>
        prev.map((s) => (s.id === snapshotId ? { ...s, shared_with_coach: newValue } : s)),
      );

      toast({
        title: newValue ? "Shared with Coach" : "Sharing Disabled",
        description: newValue
          ? "Your coach can now view this snapshot."
          : "This snapshot is now private.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to update sharing settings",
        variant: "destructive",
      });
    } finally {
      setUpdatingShare(null);
    }
  };

  const handleConsentConfirm = () => {
    if (shareConsentSnapshot) {
      executeShareUpdate(shareConsentSnapshot.id, true);
      setShareConsentSnapshot(null);
    }
  };

  if (loading) {
    return <PageLoadingState />;
  }

  const latestSnapshot = snapshots[0];
  const comparisonData = getComparisonData();

  return (
    <FeatureGate featureKey="wheel_of_life">
      <div className="container mx-auto py-8 px-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <Target className="h-8 w-8 text-primary shrink-0" />
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">Wheel of Life</h1>
              <p className="text-muted-foreground">Assess your life balance across 10 key areas</p>
            </div>
          </div>
          <Button onClick={() => setShowForm(true)} className="shrink-0 w-full sm:w-auto">
            <Camera className="mr-2 h-4 w-4" />
            Take Snapshot
          </Button>
        </div>

        {planLimits.isFreePlan && (
          <Card className="bg-gradient-to-r from-primary/5 via-primary/10 to-amber-500/10 border-primary/20 mb-6">
            <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-5">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-primary/10 p-2 mt-0.5">
                  <Crown className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">
                    Ready to turn insights into lasting change?
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Unlock unlimited goals, reflections, and historical tracking to see your growth
                    over time.
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Currently using {planLimits.currentGoalCount}/{planLimits.maxGoals} goals ·{" "}
                    {planLimits.currentReflectionCount}/{planLimits.maxReflections} reflections
                  </p>
                </div>
              </div>
              <Button onClick={() => navigate("/subscription")} className="shrink-0">
                <Crown className="mr-2 h-4 w-4" />
                Upgrade Plan
              </Button>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="current" className="space-y-6">
          <TabsList>
            <TabsTrigger value="current">Current View</TabsTrigger>
            {planLimits.canViewHistory ? (
              <>
                <TabsTrigger value="history">History</TabsTrigger>
                {snapshots.length >= 2 && <TabsTrigger value="compare">Compare</TabsTrigger>}
              </>
            ) : (
              <TabsTrigger value="history" disabled className="opacity-50 cursor-not-allowed">
                <Lock className="h-3 w-3 mr-1" />
                History
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="current" className="space-y-6">
            {showForm ? (
              <Card>
                <CardHeader>
                  <CardTitle>Take a Snapshot</CardTitle>
                  <CardDescription>
                    Rate your satisfaction in each life area from 1-10
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-6 md:grid-cols-2">
                    {(Object.keys(WHEEL_OF_LIFE_CATEGORIES) as WheelCategory[]).map((cat) => (
                      <div key={cat} className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <Label className="font-medium">{WHEEL_OF_LIFE_CATEGORIES[cat]}</Label>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {WHEEL_CATEGORY_DESCRIPTIONS[cat]}
                            </p>
                          </div>
                          <Badge variant="secondary" className="ml-2">
                            {currentRatings[cat]}
                          </Badge>
                        </div>
                        <Slider
                          value={[currentRatings[cat]]}
                          onValueChange={([value]) =>
                            setCurrentRatings((prev) => ({ ...prev, [cat]: value }))
                          }
                          min={1}
                          max={10}
                          step={1}
                          className="w-full"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <Label>Notes (optional)</Label>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Any thoughts or context about your current life balance..."
                      rows={3}
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setShowForm(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleSaveSnapshot} disabled={saving}>
                      {saving ? "Saving..." : "Save Snapshot"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : latestSnapshot ? (
              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Calendar className="h-5 w-5" />
                          Latest Snapshot
                        </CardTitle>
                        <CardDescription>
                          {format(new Date(latestSnapshot.snapshot_date), "MMMM d, yyyy")}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Share2
                          className={`h-4 w-4 ${latestSnapshot.shared_with_coach ? "text-primary" : "text-muted-foreground"}`}
                        />
                        <Switch
                          checked={latestSnapshot.shared_with_coach}
                          onCheckedChange={() =>
                            handleShareToggle(
                              latestSnapshot.id,
                              latestSnapshot.snapshot_date,
                              latestSnapshot.shared_with_coach,
                            )
                          }
                          disabled={updatingShare === latestSnapshot.id}
                        />
                        <span className="text-sm text-muted-foreground">
                          {latestSnapshot.shared_with_coach ? "Shared" : "Private"}
                        </span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[400px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart data={getChartData(latestSnapshot)}>
                          <PolarGrid />
                          <PolarAngleAxis dataKey="category" tick={{ fontSize: 11 }} />
                          <PolarRadiusAxis angle={90} domain={[0, 10]} tick={{ fontSize: 10 }} />
                          <Radar
                            name="Current"
                            dataKey="value"
                            stroke="hsl(var(--primary))"
                            fill="hsl(var(--primary))"
                            fillOpacity={0.5}
                          />
                          <Tooltip />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Categories & Goals</CardTitle>
                    <CardDescription>
                      Click a category to view goals or add reflections
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {getSnapshotRatings(latestSnapshot).map(({ category, label, value }) => {
                        const color = categoryColors[category] || "hsl(var(--primary))";
                        return (
                          <div
                            key={category}
                            onClick={() => navigateToGoals(category)}
                            className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer group"
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className="w-10 h-10 rounded-full flex items-center justify-center"
                                style={{ backgroundColor: `${color}20` }}
                              >
                                <span className="font-semibold" style={{ color }}>
                                  {value}
                                </span>
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-2.5 h-2.5 rounded-full shrink-0"
                                    style={{ backgroundColor: color }}
                                  />
                                  <span className="font-medium">{label}</span>
                                  {goalCounts[category] > 0 && (
                                    <Badge variant="secondary" className="text-xs">
                                      {goalCounts[category]}{" "}
                                      {goalCounts[category] === 1 ? "goal" : "goals"}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground line-clamp-1 ml-4">
                                  {WHEEL_CATEGORY_DESCRIPTIONS[category]}
                                </p>
                              </div>
                            </div>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setReflectionCategory(category);
                                }}
                                title="Reflections"
                              >
                                <MessageSquare className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigateToGoals(category);
                                }}
                                className="group-hover:bg-primary/10"
                              >
                                Goals
                                <ArrowRight className="ml-1 h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAddGoal(category);
                                }}
                                title={
                                  planLimits.isFreePlan && !planLimits.canAddGoal
                                    ? "Goal limit reached"
                                    : "Add Goal"
                                }
                                disabled={planLimits.isFreePlan && !planLimits.canAddGoal}
                              >
                                {planLimits.isFreePlan && !planLimits.canAddGoal ? (
                                  <Lock className="h-4 w-4" />
                                ) : (
                                  <Plus className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                {latestSnapshot.notes && (
                  <Card className="lg:col-span-2">
                    <CardHeader>
                      <CardTitle>Notes</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground">{latestSnapshot.notes}</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Target className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2">No snapshots yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Take your first Wheel of Life snapshot to track your life balance
                  </p>
                  <Button onClick={() => setShowForm(true)}>
                    <Camera className="mr-2 h-4 w-4" />
                    Take Your First Snapshot
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            {snapshots.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <History className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2">No history yet</h3>
                  <p className="text-muted-foreground">
                    Take snapshots over time to track your progress
                  </p>
                </CardContent>
              </Card>
            ) : (
              snapshots.map((snapshot) => (
                <Card key={snapshot.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        {format(new Date(snapshot.snapshot_date), "MMMM d, yyyy")}
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <Share2
                          className={`h-4 w-4 ${snapshot.shared_with_coach ? "text-primary" : "text-muted-foreground"}`}
                        />
                        <Switch
                          checked={snapshot.shared_with_coach}
                          onCheckedChange={() =>
                            handleShareToggle(
                              snapshot.id,
                              snapshot.snapshot_date,
                              snapshot.shared_with_coach,
                            )
                          }
                          disabled={updatingShare === snapshot.id}
                        />
                        <span className="text-sm text-muted-foreground">
                          {snapshot.shared_with_coach ? "Shared" : "Private"}
                        </span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                      {getSnapshotRatings(snapshot).map(({ category, label, value }) => (
                        <div key={category} className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-sm font-semibold text-primary">{value}</span>
                          </div>
                          <span className="text-sm">{label}</span>
                        </div>
                      ))}
                    </div>
                    {snapshot.notes && (
                      <div className="mt-4 p-3 rounded-lg bg-muted/50">
                        <p className="text-sm text-muted-foreground">{snapshot.notes}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {snapshots.length >= 2 && (
            <TabsContent value="compare" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Compare Snapshots</CardTitle>
                  <CardDescription>
                    Select a previous snapshot to compare with your latest
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center gap-4">
                    <Label>Compare with:</Label>
                    <Select value={compareSnapshot || ""} onValueChange={setCompareSnapshot}>
                      <SelectTrigger className="w-[250px]">
                        <SelectValue placeholder="Select a snapshot" />
                      </SelectTrigger>
                      <SelectContent>
                        {snapshots.slice(1).map((snapshot) => (
                          <SelectItem key={snapshot.id} value={snapshot.id}>
                            {format(new Date(snapshot.snapshot_date), "MMMM d, yyyy")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {comparisonData && (
                    <div className="h-[450px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart data={comparisonData}>
                          <PolarGrid />
                          <PolarAngleAxis dataKey="category" tick={{ fontSize: 11 }} />
                          <PolarRadiusAxis angle={90} domain={[0, 10]} tick={{ fontSize: 10 }} />
                          <Radar
                            name="Current"
                            dataKey="current"
                            stroke="hsl(var(--primary))"
                            fill="hsl(var(--primary))"
                            fillOpacity={0.5}
                          />
                          <Radar
                            name="Previous"
                            dataKey="previous"
                            stroke="hsl(var(--muted-foreground))"
                            fill="hsl(var(--muted-foreground))"
                            fillOpacity={0.3}
                          />
                          <Legend />
                          <Tooltip />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>

        {reflectionCategory && (
          <DomainReflectionDialog
            open={!!reflectionCategory}
            onOpenChange={(open) => !open && setReflectionCategory(null)}
            category={reflectionCategory}
            canAddReflection={planLimits.canAddReflection}
            isFreePlan={planLimits.isFreePlan}
            currentReflectionCount={planLimits.currentReflectionCount}
            maxReflections={planLimits.maxReflections}
          />
        )}

        <WheelShareConsentDialog
          open={!!shareConsentSnapshot}
          onOpenChange={(open) => !open && setShareConsentSnapshot(null)}
          onConfirm={handleConsentConfirm}
          snapshotDate={shareConsentSnapshot?.date || ""}
        />
      </div>
    </FeatureGate>
  );
}
