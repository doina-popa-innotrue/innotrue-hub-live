import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, User, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ValuesAlignment } from "@/components/decisions/ValuesAlignment";
import { OptionsAnalysis } from "@/components/decisions/OptionsAnalysis";
import { DecisionReflection } from "@/components/decisions/DecisionReflection";
import { ErrorState } from "@/components/ui/error-state";

interface Decision {
  id: string;
  title: string;
  description: string | null;
  status: string;
  importance: string | null;
  urgency: string | null;
  confidence_level: number | null;
  expected_outcome: string | null;
  actual_outcome: string | null;
  decision_date: string | null;
  buyers_model_notes: string | null;
  ten_ten_ten_notes: string | null;
  internal_check_notes: string | null;
  stop_rule_notes: string | null;
  yes_no_rule_notes: string | null;
  crossroads_notes: string | null;
  profiles: {
    name: string;
  };
}

interface Comment {
  id: string;
  body: string;
  author_role: string;
  created_at: string;
  profiles: {
    name: string;
  };
}

export default function CoachingDecisionDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (id) {
      fetchDecision();
      fetchComments();
    }
  }, [id]);

  if (!id) {
    return null;
  }

  async function fetchDecision() {
    try {
      const { data, error } = await supabase
        .from("decisions")
        .select(
          `
          *,
          profiles!decisions_user_id_fkey (name)
        `,
        )
        .eq("id", id!)
        .eq("shared_with_coach", true)
        .single();

      if (error) throw error;
      setDecision(data as any);
    } catch (error: any) {
      toast({
        title: "Error loading decision",
        description: error.message,
        variant: "destructive",
      });
      navigate("/coaching/decisions");
    } finally {
      setLoading(false);
    }
  }

  async function fetchComments() {
    try {
      const { data, error } = await supabase
        .from("decision_comments")
        .select(
          `
          *,
          profiles!decision_comments_author_id_fkey (name)
        `,
        )
        .eq("decision_id", id!)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setComments((data as any) || []);
    } catch (error: any) {
      toast({
        title: "Error loading comments",
        description: error.message,
        variant: "destructive",
      });
    }
  }

  async function handleAddComment() {
    if (!newComment.trim()) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.from("decision_comments").insert({
        decision_id: id!,
        author_id: user?.id ?? undefined,
        author_role: "coach",
        body: newComment,
      } as any);

      if (error) throw error;

      toast({
        title: "Comment added",
        description: "Your feedback has been shared",
      });
      setNewComment("");
      fetchComments();
    } catch (error: any) {
      toast({
        title: "Error adding comment",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (!decision) {
    return <ErrorState title="Not Found" description="Decision not found" />;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate("/coaching/decisions")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Shared Decisions
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <User className="h-5 w-5 text-muted-foreground" />
        <span className="text-muted-foreground">Client:</span>
        <span className="font-semibold">{decision.profiles.name}</span>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="options">Options</TabsTrigger>
          <TabsTrigger value="values">Values</TabsTrigger>
          <TabsTrigger value="models">Models</TabsTrigger>
          <TabsTrigger value="reflection">Reflection</TabsTrigger>
          <TabsTrigger value="comments">Comments</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{decision.title}</CardTitle>
              <CardDescription>Decision overview (read-only)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {decision.description && (
                <div>
                  <Label>Description</Label>
                  <p className="text-sm mt-1">{decision.description}</p>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="capitalize">
                  {decision.status.replace("_", " ")}
                </Badge>
                {decision.importance && <Badge className="capitalize">{decision.importance}</Badge>}
                {decision.urgency && (
                  <Badge variant="secondary" className="capitalize">
                    {decision.urgency} urgency
                  </Badge>
                )}
              </div>

              {decision.confidence_level !== null && (
                <div>
                  <Label>Confidence Level: {decision.confidence_level}%</Label>
                  <div className="mt-2 w-full bg-secondary rounded-full h-3">
                    <div
                      className="bg-primary rounded-full h-3 transition-all"
                      style={{ width: `${decision.confidence_level}%` }}
                    />
                  </div>
                </div>
              )}

              {decision.expected_outcome && (
                <div>
                  <Label>Expected Outcome</Label>
                  <p className="text-sm mt-1">{decision.expected_outcome}</p>
                </div>
              )}

              {decision.status === "made" && decision.actual_outcome && (
                <div>
                  <Label>Actual Outcome</Label>
                  <p className="text-sm mt-1">{decision.actual_outcome}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="options">
          <Card>
            <CardContent className="pt-6">
              <OptionsAnalysis decisionId={id!} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="values">
          <Card>
            <CardContent className="pt-6">
              <ValuesAlignment decisionId={id!} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="models">
          <Card>
            <CardHeader>
              <CardTitle>Decision Models</CardTitle>
              <CardDescription>Client's analysis using decision frameworks</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {decision.buyers_model_notes && (
                <div>
                  <Label>Buyer's Decision Model</Label>
                  <p className="text-sm mt-1">{decision.buyers_model_notes}</p>
                </div>
              )}
              {decision.ten_ten_ten_notes && (
                <div>
                  <Label>10-10-10 Rule</Label>
                  <p className="text-sm mt-1">{decision.ten_ten_ten_notes}</p>
                </div>
              )}
              {decision.internal_check_notes && (
                <div>
                  <Label>Internal Check</Label>
                  <p className="text-sm mt-1">{decision.internal_check_notes}</p>
                </div>
              )}
              {decision.stop_rule_notes && (
                <div>
                  <Label>Stop Rule</Label>
                  <p className="text-sm mt-1">{decision.stop_rule_notes}</p>
                </div>
              )}
              {decision.yes_no_rule_notes && (
                <div>
                  <Label>Yes/No Rule</Label>
                  <p className="text-sm mt-1">{decision.yes_no_rule_notes}</p>
                </div>
              )}
              {decision.crossroads_notes && (
                <div>
                  <Label>Crossroads Model</Label>
                  <p className="text-sm mt-1">{decision.crossroads_notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reflection">
          <Card>
            <CardContent className="pt-6">
              {decision.status === "made" ? (
                <DecisionReflection decisionId={id!} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Reflection will be available once the client marks this decision as "Made"
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="comments">
          <Card>
            <CardHeader>
              <CardTitle>Comments & Feedback</CardTitle>
              <CardDescription>Provide guidance and support to your client</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                {comments.map((comment) => (
                  <div key={comment.id} className="p-4 rounded-lg border">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant={comment.author_role === "coach" ? "default" : "secondary"}>
                        {comment.author_role}
                      </Badge>
                      <span className="text-sm font-medium">{comment.profiles.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(comment.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm">{comment.body}</p>
                  </div>
                ))}
                {comments.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No comments yet. Be the first to provide feedback!
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="newComment">Add your feedback</Label>
                <Textarea
                  id="newComment"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Share your insights, ask questions, or provide guidance..."
                  rows={4}
                />
                <Button onClick={handleAddComment} disabled={submitting || !newComment.trim()}>
                  <Send className="h-4 w-4 mr-2" />
                  {submitting ? "Sending..." : "Send Comment"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
