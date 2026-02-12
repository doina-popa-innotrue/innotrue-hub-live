import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, ThumbsUp, ThumbsDown, ListTodo } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

interface OptionsAnalysisProps {
  decisionId: string;
}

export function OptionsAnalysis({ decisionId }: OptionsAnalysisProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newOption, setNewOption] = useState({ label: "", description: "" });
  const [expandedOption, setExpandedOption] = useState<string | null>(null);
  const [taskDialog, setTaskDialog] = useState<{ open: boolean; optionId: string | null }>({
    open: false,
    optionId: null,
  });
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    importance: false,
    urgency: false,
    dueDate: "",
  });

  // Fetch options with pros and cons
  const { data: options } = useQuery({
    queryKey: ["decision-options", decisionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("decision_options")
        .select(
          `
          *,
          decision_pros(*),
          decision_cons(*)
        `,
        )
        .eq("decision_id", decisionId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  // Fetch tasks linked to options
  const { data: tasks } = useQuery({
    queryKey: ["option-tasks", decisionId],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("decision_id", decisionId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as Tables<"tasks">[];
    },
  });

  const createOption = useMutation({
    mutationFn: async (data: { label: string; description: string }) => {
      const { error } = await supabase.from("decision_options").insert({
        decision_id: decisionId,
        label: data.label,
        description: data.description || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["decision-options", decisionId] });
      toast({ title: "Option added" });
      setNewOption({ label: "", description: "" });
    },
  });

  const updateOption = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { error } = await supabase.from("decision_options").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["decision-options", decisionId] });
    },
  });

  const deleteOption = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("decision_options").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["decision-options", decisionId] });
      toast({ title: "Option deleted" });
    },
  });

  const addPro = useMutation({
    mutationFn: async ({
      optionId,
      text,
      weight,
    }: {
      optionId: string;
      text: string;
      weight: number;
    }) => {
      const { error } = await supabase.from("decision_pros").insert({
        decision_id: decisionId,
        option_id: optionId,
        text,
        weight,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["decision-options", decisionId] });
      toast({ title: "Pro added" });
    },
  });

  const addCon = useMutation({
    mutationFn: async ({
      optionId,
      text,
      weight,
    }: {
      optionId: string;
      text: string;
      weight: number;
    }) => {
      const { error } = await supabase.from("decision_cons").insert({
        decision_id: decisionId,
        option_id: optionId,
        text,
        weight,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["decision-options", decisionId] });
      toast({ title: "Con added" });
    },
  });

  const deletePro = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("decision_pros").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["decision-options", decisionId] });
      toast({ title: "Pro deleted" });
    },
  });

  const deleteCon = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("decision_cons").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["decision-options", decisionId] });
      toast({ title: "Con deleted" });
    },
  });

  const createTask = useMutation({
    mutationFn: async (data: {
      title: string;
      description: string;
      importance: boolean;
      urgency: boolean;
      dueDate: string;
      optionId: string;
    }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let quadrant:
        | "important_urgent"
        | "important_not_urgent"
        | "not_important_urgent"
        | "not_important_not_urgent";
      if (data.importance && data.urgency) quadrant = "important_urgent";
      else if (data.importance && !data.urgency) quadrant = "important_not_urgent";
      else if (!data.importance && data.urgency) quadrant = "not_important_urgent";
      else quadrant = "not_important_not_urgent";

      const { error } = await supabase.from("tasks").insert({
        user_id: user.id,
        title: data.title,
        description: data.description,
        importance: data.importance,
        urgency: data.urgency,
        quadrant,
        decision_id: decisionId,
        option_id: data.optionId,
        source_type: "decision",
        status: "todo",
        due_date: data.dueDate || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["option-tasks", decisionId] });
      toast({ title: "Task created and linked to option" });
      setTaskDialog({ open: false, optionId: null });
      setNewTask({ title: "", description: "", importance: false, urgency: false, dueDate: "" });
    },
  });

  const calculateScore = (optionId: string) => {
    const option = options?.find((o) => o.id === optionId);
    if (!option) return { prosScore: 0, consScore: 0, net: 0 };

    const prosScore = (option.decision_pros || []).reduce((sum, p) => sum + (p.weight || 3), 0);
    const consScore = (option.decision_cons || []).reduce((sum, c) => sum + (c.weight || 3), 0);

    return { prosScore, consScore, net: prosScore - consScore };
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Options & Pros/Cons Analysis</h3>
        <p className="text-sm text-muted-foreground">
          Evaluate each option by listing pros and cons, and create action plans
        </p>
      </div>

      {/* Add new option */}
      <div className="space-y-2">
        <Label>Add New Option</Label>
        <div className="flex gap-2">
          <Input
            placeholder="Option label..."
            value={newOption.label}
            onChange={(e) => setNewOption({ ...newOption, label: e.target.value })}
          />
          <Button
            onClick={() => createOption.mutate(newOption)}
            disabled={!newOption.label || createOption.isPending}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Options list */}
      <div className="space-y-4">
        {options?.map((option) => {
          const scores = calculateScore(option.id);
          const optionTasks = tasks?.filter((t) => t.option_id === option.id) || [];

          return (
            <Card key={option.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-2">
                    <CardTitle className="text-lg">{option.label}</CardTitle>
                    <div className="flex gap-2 flex-wrap">
                      <Badge variant="default">
                        <ThumbsUp className="h-3 w-3 mr-1" />
                        {scores.prosScore}
                      </Badge>
                      <Badge variant="secondary">
                        <ThumbsDown className="h-3 w-3 mr-1" />
                        {scores.consScore}
                      </Badge>
                      <Badge
                        variant={
                          scores.net > 0 ? "default" : scores.net < 0 ? "destructive" : "outline"
                        }
                      >
                        Net: {scores.net > 0 ? "+" : ""}
                        {scores.net}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setTaskDialog({ open: true, optionId: option.id })}
                    >
                      <ListTodo className="h-4 w-4 mr-1" />
                      Add Task
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setExpandedOption(expandedOption === option.id ? null : option.id)
                      }
                    >
                      {expandedOption === option.id ? "Collapse" : "Expand"}
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Linked Tasks */}
                {optionTasks.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm flex items-center gap-2">
                      <ListTodo className="h-4 w-4" />
                      Tasks for this option:
                    </h4>
                    <div className="space-y-2">
                      {optionTasks.map((task) => (
                        <div
                          key={task.id}
                          className="flex items-center justify-between p-2 border rounded-md bg-muted/50"
                        >
                          <div className="flex-1">
                            <p className="font-medium text-sm">{task.title}</p>
                            {task.description && (
                              <p className="text-xs text-muted-foreground">{task.description}</p>
                            )}
                          </div>
                          <div className="flex gap-1">
                            {task.importance && (
                              <Badge variant="secondary" className="text-xs">
                                Important
                              </Badge>
                            )}
                            {task.urgency && (
                              <Badge variant="secondary" className="text-xs">
                                Urgent
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-xs">
                              {task.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {expandedOption === option.id && (
                  <div className="space-y-6">
                    <div>
                      <Label>Description</Label>
                      <Textarea
                        value={option.description || ""}
                        onChange={(e) =>
                          updateOption.mutate({
                            id: option.id,
                            updates: { description: e.target.value },
                          })
                        }
                        placeholder="Describe this option..."
                      />
                    </div>

                    <div>
                      <Label>Emotional Response</Label>
                      <Textarea
                        value={option.emotion_notes || ""}
                        onChange={(e) =>
                          updateOption.mutate({
                            id: option.id,
                            updates: { emotion_notes: e.target.value },
                          })
                        }
                        placeholder="How does this option feel?"
                      />
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      {/* Pros */}
                      <div className="space-y-3">
                        <Label className="text-base font-semibold flex items-center gap-2">
                          <ThumbsUp className="h-4 w-4" />
                          Pros
                        </Label>
                        <div className="space-y-2">
                          {option.decision_pros?.map((pro) => (
                            <div
                              key={pro.id}
                              className="flex items-center gap-2 p-2 border rounded-md"
                            >
                              <span className="flex-1 text-sm">{pro.text}</span>
                              <Badge variant="outline" className="text-xs">
                                W: {pro.weight || 3}
                              </Badge>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => deletePro.mutate(pro.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                          <AddProCon
                            type="pro"
                            onAdd={(text) =>
                              addPro.mutate({ optionId: option.id, text, weight: 3 })
                            }
                          />
                        </div>
                      </div>

                      {/* Cons */}
                      <div className="space-y-3">
                        <Label className="text-base font-semibold flex items-center gap-2">
                          <ThumbsDown className="h-4 w-4" />
                          Cons
                        </Label>
                        <div className="space-y-2">
                          {option.decision_cons?.map((con) => (
                            <div
                              key={con.id}
                              className="flex items-center gap-2 p-2 border rounded-md"
                            >
                              <span className="flex-1 text-sm">{con.text}</span>
                              <Badge variant="outline" className="text-xs">
                                W: {con.weight || 3}
                              </Badge>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => deleteCon.mutate(con.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                          <AddProCon
                            type="con"
                            onAdd={(text) =>
                              addCon.mutate({ optionId: option.id, text, weight: 3 })
                            }
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end pt-4 border-t">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => deleteOption.mutate(option.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Option
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Task Creation Dialog */}
      <Dialog
        open={taskDialog.open}
        onOpenChange={(open) => setTaskDialog({ open, optionId: null })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Task for Option</DialogTitle>
            <DialogDescription>
              Create an action item linked to this decision option
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="task-title">Task Title</Label>
              <Input
                id="task-title"
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                placeholder="What needs to be done?"
              />
            </div>
            <div>
              <Label htmlFor="task-description">Description (optional)</Label>
              <Textarea
                id="task-description"
                value={newTask.description}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                placeholder="Additional details..."
              />
            </div>
            <div>
              <Label htmlFor="task-due-date">Due Date (optional)</Label>
              <Input
                id="task-due-date"
                type="date"
                value={newTask.dueDate}
                onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
              />
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={newTask.importance}
                  onChange={(e) => setNewTask({ ...newTask, importance: e.target.checked })}
                />
                <span className="text-sm">Important</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={newTask.urgency}
                  onChange={(e) => setNewTask({ ...newTask, urgency: e.target.checked })}
                />
                <span className="text-sm">Urgent</span>
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setTaskDialog({ open: false, optionId: null })}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (taskDialog.optionId && newTask.title) {
                  createTask.mutate({
                    ...newTask,
                    optionId: taskDialog.optionId,
                  });
                }
              }}
              disabled={!newTask.title || createTask.isPending}
            >
              Create Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AddProCon({ type, onAdd }: { type: "pro" | "con"; onAdd: (text: string) => void }) {
  const [text, setText] = useState("");

  return (
    <div className="flex gap-2">
      <Input
        placeholder={`Add a ${type}...`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyPress={(e) => {
          if (e.key === "Enter" && text.trim()) {
            onAdd(text);
            setText("");
          }
        }}
      />
      <Button
        size="sm"
        onClick={() => {
          if (text.trim()) {
            onAdd(text);
            setText("");
          }
        }}
        disabled={!text.trim()}
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}
