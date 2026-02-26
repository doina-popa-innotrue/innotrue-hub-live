import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  ListTodo,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  Circle,
  Calendar,
  ArrowUpRight,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { useActionItems, useToggleActionItemStatus } from "@/hooks/useActionItems";
import { useEntitlements } from "@/hooks/useEntitlements";
import { PromoteToTaskDialog } from "@/components/capabilities/PromoteToTaskDialog";

export function ActionItemsSection() {
  const navigate = useNavigate();
  const { data: actionItems = [], isLoading } = useActionItems();
  const toggleStatus = useToggleActionItemStatus();
  const { hasFeature } = useEntitlements();
  const canPromoteToTask = hasFeature("decision_toolkit_basic");
  const [promotingItem, setPromotingItem] = useState<(typeof actionItems)[number] | null>(null);

  const pendingItems = actionItems.filter((ai) => ai.status !== "completed");
  const hasPending = pendingItems.length > 0;
  const [isOpen, setIsOpen] = useState(hasPending);

  // Update open state when pending items change
  if (hasPending && !isOpen && actionItems.length > 0) {
    // Don't auto-open if user explicitly closed it
  }

  if (isLoading || actionItems.length === 0) return null;

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <ListTodo className="h-5 w-5 text-violet-500" />
                  <CardTitle className="text-base">Action Items from Development</CardTitle>
                  <Badge variant="secondary" className="text-xs">
                    {pendingItems.length} pending
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate("/development-items");
                  }}
                >
                  View All
                </Button>
              </div>
            </CardHeader>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <CardContent className="pt-0">
              <div className="space-y-2">
                {actionItems.map((item) => {
                  const isCompleted = item.status === "completed";
                  const displayTitle =
                    item.title ||
                    (item.content
                      ? item.content.slice(0, 60) + (item.content.length > 60 ? "…" : "")
                      : "Untitled Action");
                  const hasTaskLink = item.task_links && item.task_links.length > 0;

                  return (
                    <div
                      key={item.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                        isCompleted ? "bg-muted/50 border-muted" : "hover:bg-accent/50"
                      }`}
                    >
                      {/* Status toggle */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={() =>
                          toggleStatus.mutate({
                            itemId: item.id,
                            newStatus: isCompleted ? "pending" : "completed",
                          })
                        }
                      >
                        {isCompleted ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <Circle className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>

                      {/* Title + metadata */}
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-sm font-medium truncate ${
                            isCompleted ? "line-through text-muted-foreground" : ""
                          }`}
                        >
                          {displayTitle}
                        </p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {item.due_date && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(parseISO(item.due_date), "MMM d")}
                            </span>
                          )}
                          {hasTaskLink && (
                            <Badge variant="outline" className="text-xs h-5">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              {item.task_links[0].task.title}
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Promote button */}
                      {canPromoteToTask && !hasTaskLink && !isCompleted && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 text-violet-600 hover:text-violet-700"
                          title="Promote to Task"
                          onClick={() => setPromotingItem(item)}
                        >
                          <ArrowUpRight className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <PromoteToTaskDialog
        open={!!promotingItem}
        onOpenChange={(open) => {
          if (!open) setPromotingItem(null);
        }}
        actionItem={promotingItem}
      />
    </>
  );
}
