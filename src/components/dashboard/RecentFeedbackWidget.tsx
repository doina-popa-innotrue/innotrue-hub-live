import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { MessageSquare, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useFeedbackInbox } from "@/hooks/useFeedbackInbox";

export function RecentFeedbackWidget() {
  const navigate = useNavigate();
  const { data: items = [], isLoading } = useFeedbackInbox(3);

  // Don't render if loading or no feedback
  if (isLoading || items.length === 0) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Recent Feedback
        </h2>
        <Button variant="ghost" size="sm" onClick={() => navigate("/feedback")}>
          View All
        </Button>
      </div>
      <div className="space-y-3">
        {items.map((item) => (
          <Card
            key={item.id}
            className="hover:border-primary transition-colors cursor-pointer"
            onClick={() => navigate(item.linkTo)}
          >
            <CardContent className="py-3">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate text-sm">{item.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {item.givenBy} · {item.contextLabel}
                    {item.givenAt &&
                      ` · ${format(new Date(item.givenAt), "MMM d, yyyy")}`}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
