import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Lightbulb } from "lucide-react";

interface Props {
  userId: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  in_progress: "bg-primary/15 text-primary",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

const TYPE_LABELS: Record<string, string> = {
  reflection: "Reflection",
  resource: "Resource",
  action_item: "Action Item",
};

export function ActiveDevelopmentItems({ userId }: Props) {
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["dev-profile-items", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("development_items")
        .select(
          `
          id, title, content, item_type, status, created_at,
          development_item_links(linked_type, linked_id)
        `,
        )
        .eq("user_id", userId)
        .in("status", ["pending", "in_progress"])
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data || [];
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            Active Development Items
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5" />
          Active Development Items
          {items.length > 0 && (
            <Badge variant="secondary" className="ml-auto">
              {items.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No active development items
          </p>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 rounded-lg border"
              >
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium truncate block">
                    {item.title || item.content?.slice(0, 60) || "Untitled"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {TYPE_LABELS[item.item_type] || item.item_type}
                  </span>
                </div>
                <Badge
                  variant="outline"
                  className={STATUS_COLORS[item.status || "pending"]}
                >
                  {(item.status || "pending").replace("_", " ")}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
