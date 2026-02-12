import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckSquare, Calendar, User, ArrowLeft, CheckCircle, Circle, Clock } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface TaskWithProfiles {
  id: string;
  group_id: string;
  title: string;
  description: string | null;
  status: string;
  due_date: string | null;
  created_by: string;
  assigned_to: string | null;
  created_at: string;
  creator?: { id: string; name: string | null; avatar_url: string | null } | null;
  assignee?: { id: string; name: string | null; avatar_url: string | null } | null;
}

export default function GroupTaskDetail() {
  const { groupId, taskId } = useParams<{ groupId: string; taskId: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: task, isLoading } = useQuery<TaskWithProfiles | null>({
    queryKey: ["group-task", taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_tasks")
        .select("*")
        .eq("id", taskId!)
        .single();
      if (error) throw error;

      // Fetch creator and assignee profiles
      const userIds = [data.created_by, data.assigned_to].filter(Boolean) as string[];
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, name, avatar_url")
          .in("id", userIds);
        const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);
        return {
          ...data,
          creator: profileMap.get(data.created_by),
          assignee: data.assigned_to ? profileMap.get(data.assigned_to) : null,
        } as TaskWithProfiles;
      }
      return data as TaskWithProfiles;
    },
    enabled: !!taskId,
  });

  const { data: group } = useQuery({
    queryKey: ["group-basic", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("groups")
        .select("id, name")
        .eq("id", groupId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!groupId,
  });

  const updateStatus = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase.from("group_tasks").update({ status }).eq("id", taskId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-task", taskId] });
      queryClient.invalidateQueries({ queryKey: ["group-tasks", groupId] });
      toast({ title: "Task updated" });
    },
  });

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Task not found</p>
            <Button asChild className="mt-4">
              <Link to={`/groups/${groupId}`}>Back to Group</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge variant="default">
            <CheckCircle className="mr-1 h-3 w-3" />
            Completed
          </Badge>
        );
      case "in_progress":
        return (
          <Badge variant="secondary">
            <Clock className="mr-1 h-3 w-3" />
            In Progress
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            <Circle className="mr-1 h-3 w-3" />
            Pending
          </Badge>
        );
    }
  };

  const isOverdue =
    task.due_date && new Date(task.due_date) < new Date() && task.status !== "completed";

  return (
    <div className="container mx-auto py-6 space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/groups">Groups</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to={`/groups/${groupId}`}>{group?.name || "Group"}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{task.title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <Button variant="ghost" size="sm" asChild>
        <Link to={`/groups/${groupId}`}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Group
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CheckSquare className="h-5 w-5 text-muted-foreground" />
                <CardTitle>{task.title}</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                {getStatusBadge(task.status)}
                {isOverdue && <Badge variant="destructive">Overdue</Badge>}
              </div>
            </div>
            <div className="flex gap-2">
              {task.status !== "completed" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    updateStatus.mutate(task.status === "pending" ? "in_progress" : "completed")
                  }
                  disabled={updateStatus.isPending}
                >
                  {task.status === "pending" ? "Start" : "Complete"}
                </Button>
              )}
              {task.status === "completed" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateStatus.mutate("pending")}
                  disabled={updateStatus.isPending}
                >
                  Reopen
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            {task.due_date && (
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Due Date</p>
                  <p className={`font-medium ${isOverdue ? "text-destructive" : ""}`}>
                    {format(new Date(task.due_date), "PPP")}
                  </p>
                </div>
              </div>
            )}
            {task.creator && (
              <div className="flex items-center gap-3">
                <User className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Created by</p>
                  <p className="font-medium">{task.creator.name}</p>
                </div>
              </div>
            )}
            {task.assignee && (
              <div className="flex items-center gap-3">
                <User className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Assigned to</p>
                  <p className="font-medium">{task.assignee.name}</p>
                </div>
              </div>
            )}
          </div>

          {task.description && (
            <div>
              <h3 className="font-semibold mb-2">Description</h3>
              <p className="text-muted-foreground whitespace-pre-wrap">{task.description}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
