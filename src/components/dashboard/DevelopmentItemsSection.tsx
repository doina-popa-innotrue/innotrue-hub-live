import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FileText,
  BookOpen,
  Target,
  StickyNote,
  ChevronRight,
  Plus,
  Sparkles,
  GitBranch,
} from "lucide-react";
import { format, parseISO } from "date-fns";

interface DevelopmentItem {
  id: string;
  item_type: "reflection" | "note" | "resource" | "action_item";
  title: string | null;
  content: string | null;
  created_at: string;
  goal_links?: Array<{ goal_id: string; goal: { id: string; title: string } }>;
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

const TYPE_LABELS: Record<string, string> = {
  reflection: "Reflection",
  note: "Note",
  resource: "Resource",
  action_item: "Action",
};

export function DevelopmentItemsSection() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: items, isLoading } = useQuery({
    queryKey: ["recent-development-items", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("development_items")
        .select(`
          id,
          item_type,
          title,
          content,
          created_at,
          goal_links:development_item_goal_links(
            goal_id,
            goal:goals(id, title)
          )
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(4);

      if (error) throw error;
      return data as DevelopmentItem[];
    },
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Development Items
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/development-timeline")}
              className="text-xs"
            >
              <GitBranch className="h-3 w-3 mr-1" />
              Timeline
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/development-items")}
              className="text-xs"
            >
              View All
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!items || items.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground mb-4">
              Track your growth with reflections, notes, resources, and action items.
            </p>
            <Button onClick={() => navigate("/development-items")} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Item
            </Button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {items.map((item) => {
              const Icon = TYPE_ICONS[item.item_type];
              const goalLink = item.goal_links?.[0];

              return (
                <div
                  key={item.id}
                  className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => navigate("/development-items")}
                >
                  <div className={`p-2 rounded-lg shrink-0 ${TYPE_COLORS[item.item_type]}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Badge variant="outline" className="text-xs">
                        {TYPE_LABELS[item.item_type]}
                      </Badge>
                      {goalLink && (
                        <Badge
                          variant="secondary"
                          className="text-xs cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/goals/${goalLink.goal_id}`);
                          }}
                        >
                          <Target className="h-3 w-3 mr-1" />
                          {goalLink.goal.title}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm font-medium line-clamp-1">
                      {item.title || (item.content ? item.content.substring(0, 50) + "..." : "Untitled")}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(parseISO(item.created_at), "MMM d, yyyy")}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
