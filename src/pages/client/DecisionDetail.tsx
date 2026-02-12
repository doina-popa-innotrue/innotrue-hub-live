import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { ValuesAlignment } from "@/components/decisions/ValuesAlignment";
import { OptionsAnalysis } from "@/components/decisions/OptionsAnalysis";
import { DecisionReflection } from "@/components/decisions/DecisionReflection";
import { DecisionJournal } from "@/components/decisions/DecisionJournal";
import { DecisionTimeline } from "@/components/decisions/DecisionTimeline";
import { DecisionReminders } from "@/components/decisions/DecisionReminders";
import { CapabilityGate } from "@/components/decisions/CapabilityGate";
import { useDecisionFeatureAccess } from "@/hooks/useDecisionFeatureAccess";
import { FeatureGate } from "@/components/FeatureGate";
import { SessionMismatchGuard } from "@/components/auth/SessionMismatchGuard";

export default function DecisionDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { hasCapability } = useDecisionFeatureAccess();
  const isNew = id === "new";

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Decision data
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<string>("upcoming");
  const [importance, setImportance] = useState<string>("medium");
  const [urgency, setUrgency] = useState<string>("medium");
  const [confidenceLevel, setConfidenceLevel] = useState<number[]>([50]);
  const [expectedOutcome, setExpectedOutcome] = useState("");
  const [actualOutcome, setActualOutcome] = useState("");
  const [decisionDate, setDecisionDate] = useState("");
  const [deadline, setDeadline] = useState("");
  const [sharedWithCoach, setSharedWithCoach] = useState(false);

  // Decision models notes
  const [buyersModelNotes, setBuyersModelNotes] = useState("");
  const [tenTenTenNotes, setTenTenTenNotes] = useState("");
  const [internalCheckNotes, setInternalCheckNotes] = useState("");
  const [stopRuleNotes, setStopRuleNotes] = useState("");
  const [yesNoRuleNotes, setYesNoRuleNotes] = useState("");
  const [crossroadsNotes, setCrossroadsNotes] = useState("");

  useEffect(() => {
    if (!isNew && id) {
      fetchDecision();
    }
  }, [id, isNew]);

  async function fetchDecision() {
    try {
      const { data, error } = await supabase.from("decisions").select("*").eq("id", id!).single();

      if (error) throw error;

      setTitle(data.title);
      setDescription(data.description || "");
      setStatus(data.status);
      setImportance(data.importance || "medium");
      setUrgency(data.urgency || "medium");
      setConfidenceLevel([data.confidence_level || 50]);
      setExpectedOutcome(data.expected_outcome || "");
      setActualOutcome(data.actual_outcome || "");
      setDecisionDate(data.decision_date || "");
      setDeadline(data.deadline || "");
      setSharedWithCoach(data.shared_with_coach || false);
      setBuyersModelNotes(data.buyers_model_notes || "");
      setTenTenTenNotes(data.ten_ten_ten_notes || "");
      setInternalCheckNotes(data.internal_check_notes || "");
      setStopRuleNotes(data.stop_rule_notes || "");
      setYesNoRuleNotes(data.yes_no_rule_notes || "");
      setCrossroadsNotes(data.crossroads_notes || "");
    } catch (error: any) {
      toast({
        title: "Error loading decision",
        description: error.message,
        variant: "destructive",
      });
      navigate("/decisions");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!title.trim()) {
      toast({
        title: "Title required",
        description: "Please enter a title for your decision",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const decisionData = {
        user_id: user!.id,
        title,
        description,
        status: status as "upcoming" | "in_progress" | "made" | "cancelled",
        importance: importance as "low" | "medium" | "high" | "critical",
        urgency: urgency as "low" | "medium" | "high",
        confidence_level: confidenceLevel[0],
        expected_outcome: expectedOutcome,
        actual_outcome: actualOutcome,
        decision_date: decisionDate || null,
        deadline: deadline || null,
        shared_with_coach: sharedWithCoach,
        buyers_model_notes: buyersModelNotes,
        ten_ten_ten_notes: tenTenTenNotes,
        internal_check_notes: internalCheckNotes,
        stop_rule_notes: stopRuleNotes,
        yes_no_rule_notes: yesNoRuleNotes,
        crossroads_notes: crossroadsNotes,
      };

      if (isNew) {
        const { data, error } = await supabase
          .from("decisions")
          .insert([decisionData])
          .select()
          .single();

        if (error) throw error;

        toast({
          title: "Decision created",
          description: "Your decision has been saved successfully",
        });
        navigate(`/decisions/${data.id}`);
      } else {
        const { error } = await supabase.from("decisions").update(decisionData).eq("id", id!);

        if (error) throw error;

        toast({
          title: "Decision updated",
          description: "Your changes have been saved",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error saving decision",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (isNew || !id) return;

    setDeleting(true);
    try {
      const { error } = await supabase.from("decisions").delete().eq("id", id);

      if (error) throw error;

      toast({
        title: "Decision deleted",
        description: "The decision and all related data have been removed",
      });
      navigate("/decisions");
    } catch (error: any) {
      toast({
        title: "Error deleting decision",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return <div className="p-6">Loading decision...</div>;
  }

  return (
    <SessionMismatchGuard>
      <FeatureGate featureKey="decision_toolkit_basic">
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between gap-2">
            <Button variant="ghost" onClick={() => navigate("/decisions")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Back to Decisions</span>
              <span className="sm:hidden">Back</span>
            </Button>
            <div className="flex items-center gap-2">
              {!isNew && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      disabled={deleting}
                    >
                      <Trash2 className="h-4 w-4 sm:mr-2" />
                      <span className="hidden sm:inline">Delete</span>
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this decision?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete the decision and all associated data including
                        journal entries, options, and comments. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDelete}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {deleting ? "Deleting..." : "Delete"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              <Button onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">{saving ? "Saving..." : "Save Decision"}</span>
                <span className="sm:hidden">{saving ? "..." : "Save"}</span>
              </Button>
            </div>
          </div>

          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList className="grid w-full grid-cols-4 md:grid-cols-8">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="options">Options</TabsTrigger>
              {hasCapability("values_alignment") && (
                <TabsTrigger value="values">Values</TabsTrigger>
              )}
              {hasCapability("advanced_frameworks") && (
                <TabsTrigger value="models">Models</TabsTrigger>
              )}
              {hasCapability("reminders_followups") && (
                <TabsTrigger value="reminders">Follow-Ups</TabsTrigger>
              )}
              {hasCapability("decision_journaling") && (
                <TabsTrigger value="journal">Journal</TabsTrigger>
              )}
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
              <TabsTrigger value="reflection">Reflection</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Decision Overview</CardTitle>
                  <CardDescription>Basic information about your decision</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Title *</Label>
                    <Input
                      id="title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="What decision are you making?"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Describe the decision context and what's at stake..."
                      rows={4}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="status">Status</Label>
                      <Select value={status} onValueChange={setStatus}>
                        <SelectTrigger id="status">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="upcoming">Upcoming</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="made">Made</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="importance">Importance</Label>
                      <Select value={importance} onValueChange={setImportance}>
                        <SelectTrigger id="importance">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="critical">Critical</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="urgency">Urgency</Label>
                      <Select value={urgency} onValueChange={setUrgency}>
                        <SelectTrigger id="urgency">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="deadline">Decision Due By</Label>
                    <p className="text-sm text-muted-foreground">
                      By when do you need to make this decision?
                    </p>
                    <Input
                      id="deadline"
                      type="date"
                      value={deadline}
                      onChange={(e) => setDeadline(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Confidence Level: {confidenceLevel[0]}%</Label>
                    <Slider
                      value={confidenceLevel}
                      onValueChange={setConfidenceLevel}
                      min={0}
                      max={100}
                      step={5}
                      className="w-full"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="expectedOutcome">Expected Outcome</Label>
                    <Textarea
                      id="expectedOutcome"
                      value={expectedOutcome}
                      onChange={(e) => setExpectedOutcome(e.target.value)}
                      placeholder="What do you expect to happen?"
                      rows={3}
                    />
                  </div>

                  {status === "made" && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="decisionDate">Decision Date</Label>
                        <Input
                          id="decisionDate"
                          type="date"
                          value={decisionDate}
                          onChange={(e) => setDecisionDate(e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="actualOutcome">Actual Outcome</Label>
                        <Textarea
                          id="actualOutcome"
                          value={actualOutcome}
                          onChange={(e) => setActualOutcome(e.target.value)}
                          placeholder="What actually happened?"
                          rows={3}
                        />
                      </div>
                    </>
                  )}

                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <Label htmlFor="shareWithCoach">Share with Coach</Label>
                      <p className="text-sm text-muted-foreground">
                        Allow your coach to view and comment on this decision
                      </p>
                    </div>
                    <Switch
                      id="shareWithCoach"
                      checked={sharedWithCoach}
                      onCheckedChange={setSharedWithCoach}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="options">
              <Card>
                <CardContent className="pt-6">
                  {!isNew && id ? (
                    <OptionsAnalysis decisionId={id} />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Save your decision first to add options
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="values">
              <CapabilityGate capability="values_alignment">
                <Card>
                  <CardContent className="pt-6">
                    {!isNew && id ? (
                      <ValuesAlignment decisionId={id} />
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Save your decision first to add values
                      </p>
                    )}
                  </CardContent>
                </Card>
              </CapabilityGate>
            </TabsContent>

            <TabsContent value="models" className="space-y-4">
              <CapabilityGate capability="advanced_frameworks">
                <Card>
                  <CardHeader>
                    <CardTitle>Decision Models</CardTitle>
                    <CardDescription>Use these frameworks to analyze your decision</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="buyersModel">Buyer's Decision Model</Label>
                      <p className="text-sm text-muted-foreground">
                        What are you buying (gaining) and what are you selling (giving up)?
                      </p>
                      <Textarea
                        id="buyersModel"
                        value={buyersModelNotes}
                        onChange={(e) => setBuyersModelNotes(e.target.value)}
                        rows={4}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="tenTenTen">10-10-10 Rule</Label>
                      <p className="text-sm text-muted-foreground">
                        How will you feel about this in 10 minutes, 10 months, and 10 years?
                      </p>
                      <Textarea
                        id="tenTenTen"
                        value={tenTenTenNotes}
                        onChange={(e) => setTenTenTenNotes(e.target.value)}
                        rows={4}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="internalCheck">Internal Check</Label>
                      <p className="text-sm text-muted-foreground">
                        What does your gut feeling tell you?
                      </p>
                      <Textarea
                        id="internalCheck"
                        value={internalCheckNotes}
                        onChange={(e) => setInternalCheckNotes(e.target.value)}
                        rows={4}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="stopRule">Stop Rule</Label>
                      <p className="text-sm text-muted-foreground">
                        What conditions would make you reconsider or stop?
                      </p>
                      <Textarea
                        id="stopRule"
                        value={stopRuleNotes}
                        onChange={(e) => setStopRuleNotes(e.target.value)}
                        rows={4}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="yesNoRule">Yes/No Rule</Label>
                      <p className="text-sm text-muted-foreground">
                        If it's not a clear yes, then it's a no.
                      </p>
                      <Textarea
                        id="yesNoRule"
                        value={yesNoRuleNotes}
                        onChange={(e) => setYesNoRuleNotes(e.target.value)}
                        rows={4}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="crossroads">Crossroads Model</Label>
                      <p className="text-sm text-muted-foreground">
                        What paths open up? What paths close?
                      </p>
                      <Textarea
                        id="crossroads"
                        value={crossroadsNotes}
                        onChange={(e) => setCrossroadsNotes(e.target.value)}
                        rows={4}
                      />
                    </div>
                  </CardContent>
                </Card>
              </CapabilityGate>
            </TabsContent>

            <TabsContent value="reminders">
              <CapabilityGate capability="reminders_followups">
                <Card>
                  <CardHeader>
                    <CardTitle>Follow-Up Reminders</CardTitle>
                    <CardDescription>
                      Schedule check-ins to track outcomes and capture reflections
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6">
                    {!isNew && id ? (
                      <DecisionReminders decisionId={id} />
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Save the decision first to add reminders
                      </p>
                    )}
                  </CardContent>
                </Card>
              </CapabilityGate>
            </TabsContent>

            <TabsContent value="journal">
              <CapabilityGate capability="decision_journaling">
                <Card>
                  <CardHeader>
                    <CardTitle>Decision Journal</CardTitle>
                    <CardDescription>
                      Document your thoughts and observations throughout the decision process
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6">
                    {!isNew && id ? (
                      <DecisionJournal decisionId={id} />
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Save the decision first to start journaling
                      </p>
                    )}
                  </CardContent>
                </Card>
              </CapabilityGate>
            </TabsContent>

            <TabsContent value="timeline">
              <Card>
                <CardHeader>
                  <CardTitle>Decision Timeline</CardTitle>
                  <CardDescription>
                    Complete progression of your decision with all key events
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  {!isNew && id ? (
                    <DecisionTimeline decisionId={id} />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Save the decision first to view timeline
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="reflection">
              <Card>
                <CardHeader>
                  <CardTitle>Decision Reflection</CardTitle>
                  <CardDescription>
                    {status === "made"
                      ? "Reflect on how the decision went"
                      : "Available after decision is made"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  {status === "made" && !isNew && id ? (
                    <DecisionReflection decisionId={id} />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Reflection section will become available once you mark this decision as "Made"
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </FeatureGate>
    </SessionMismatchGuard>
  );
}
