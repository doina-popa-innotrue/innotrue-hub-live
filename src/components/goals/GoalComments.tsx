import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MessageSquare, Send, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
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

interface Comment {
  id: string;
  comment: string;
  created_at: string;
  user_id: string;
  profiles: {
    name: string;
  };
}

interface GoalCommentsProps {
  goalId: string;
}

export default function GoalComments({ goalId }: GoalCommentsProps) {
  const { toast } = useToast();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    fetchComments();
    getCurrentUser();
  }, [goalId]);

  const getCurrentUser = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || null);
  };

  const fetchComments = async () => {
    try {
      const { data: commentsData, error: commentsError } = await supabase
        .from("goal_comments")
        .select("id, comment, created_at, user_id")
        .eq("goal_id", goalId)
        .order("created_at", { ascending: true });

      if (commentsError) throw commentsError;

      if (!commentsData || commentsData.length === 0) {
        setComments([]);
        setLoading(false);
        return;
      }

      // Fetch profiles for each comment
      const userIds = [...new Set(commentsData.map((c) => c.user_id))];
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, name")
        .in("id", userIds);

      if (profilesError) throw profilesError;

      const profilesMap = new Map(profilesData?.map((p) => [p.id, p.name]) || []);

      const commentsWithProfiles = commentsData.map((comment) => ({
        ...comment,
        profiles: {
          name: profilesMap.get(comment.user_id) || "Unknown User",
        },
      }));

      setComments(commentsWithProfiles);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load comments",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setSubmitting(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("goal_comments").insert([
        {
          goal_id: goalId,
          user_id: user.id,
          comment: newComment.trim(),
        },
      ]);

      if (error) throw error;

      // Check if commenter is instructor/coach and send notification to goal owner
      const { data: userRoles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const isInstructorOrCoach = userRoles?.some(
        (r) => r.role === "instructor" || r.role === "coach",
      );

      if (isInstructorOrCoach) {
        // Get goal details and owner info
        const { data: goalData } = await supabase
          .from("goals")
          .select("title, user_id")
          .eq("id", goalId)
          .single();

        if (goalData) {
          const { data: ownerProfile } = await supabase
            .from("profiles")
            .select("name")
            .eq("id", goalData.user_id)
            .single();

          const { data: commenterProfile } = await supabase
            .from("profiles")
            .select("name")
            .eq("id", user.id)
            .single();

          if (ownerProfile && commenterProfile) {
            try {
              await supabase.functions.invoke("send-notification-email", {
                body: {
                  userId: goalData.user_id, // Backend will fetch email
                  name: ownerProfile.name,
                  type: "goal_feedback",
                  timestamp: new Date().toISOString(),
                  goalTitle: goalData.title,
                  feedbackAuthor: commenterProfile.name,
                  feedbackPreview: newComment.trim().substring(0, 150),
                  entityLink: `${window.location.origin}/goals/${goalId}`,
                },
              });
            } catch (err) {
              console.error("Failed to send notification:", err);
            }
          }
        }
      }

      toast({
        title: "Success",
        description: "Comment added",
      });

      setNewComment("");
      fetchComments();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to add comment",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      const { error } = await supabase.from("goal_comments").delete().eq("id", deleteId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Comment deleted",
      });

      fetchComments();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to delete comment",
        variant: "destructive",
      });
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Feedback & Comments ({comments.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading ? (
            <div className="text-center text-muted-foreground py-4">Loading comments...</div>
          ) : (
            <>
              {comments.length > 0 && (
                <div className="space-y-4">
                  {comments.map((comment) => (
                    <div key={comment.id} className="flex gap-3 p-4 border rounded-lg">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback>
                          {comment.profiles.name.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium">{comment.profiles.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(comment.created_at), "MMM d, yyyy at h:mm a")}
                            </p>
                          </div>
                          {currentUserId === comment.user_id && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteId(comment.id)}
                            >
                              <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                            </Button>
                          )}
                        </div>
                        <p className="mt-2 text-sm whitespace-pre-wrap">{comment.comment}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3">
                <Textarea
                  placeholder="Add your feedback or comment..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  rows={3}
                  disabled={submitting}
                />
                <div className="flex justify-end">
                  <Button type="submit" disabled={!newComment.trim() || submitting}>
                    <Send className="mr-2 h-4 w-4" />
                    {submitting ? "Posting..." : "Post Comment"}
                  </Button>
                </div>
              </form>
            </>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Comment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this comment? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
