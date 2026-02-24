import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import {
  MessageSquare,
  BookOpen,
  ClipboardCheck,
  Target,
  ArrowRight,
  Inbox,
} from "lucide-react";
import { FeatureGate } from "@/components/FeatureGate";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePageView } from "@/hooks/useAnalytics";
import { useFeedbackInbox, type FeedbackType } from "@/hooks/useFeedbackInbox";
import { PageLoadingState } from "@/components/ui/page-loading-state";
import { ErrorState } from "@/components/ui/error-state";

const typeConfig: Record<
  FeedbackType,
  { icon: typeof MessageSquare; label: string; color: string }
> = {
  scenario: {
    icon: MessageSquare,
    label: "Scenario",
    color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  },
  module: {
    icon: BookOpen,
    label: "Module",
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  },
  assignment: {
    icon: ClipboardCheck,
    label: "Assignment",
    color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  },
  goal: {
    icon: Target,
    label: "Goal",
    color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  },
};

export default function MyFeedback() {
  usePageView("My Feedback");
  const navigate = useNavigate();
  const { data: items = [], isLoading, error, refetch } = useFeedbackInbox();
  const [activeTab, setActiveTab] = useState<string>("all");

  if (isLoading) return <PageLoadingState message="Loading feedback..." />;
  if (error) return <ErrorState description="Failed to load feedback." onRetry={refetch} />;

  const filtered =
    activeTab === "all" ? items : items.filter((item) => item.type === activeTab);

  return (
    <FeatureGate featureKey="feedback_reviews">
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Feedback</h1>
        <p className="text-muted-foreground mt-1">
          All feedback from your coaches and instructors in one place.
        </p>
      </div>

      {/* Filter Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="all">All ({items.length})</TabsTrigger>
          {(Object.keys(typeConfig) as FeedbackType[]).map((type) => {
            const count = items.filter((i) => i.type === type).length;
            if (count === 0) return null;
            return (
              <TabsTrigger key={type} value={type}>
                {typeConfig[type].label} ({count})
              </TabsTrigger>
            );
          })}
        </TabsList>

        {/* Content — shared for all tabs since we filter in-memory */}
        <TabsContent value={activeTab} className="mt-4">
          {filtered.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="flex flex-col items-center text-center gap-3">
                  <Inbox className="h-10 w-10 text-muted-foreground" />
                  <div className="space-y-1">
                    <h3 className="text-lg font-semibold">No feedback yet</h3>
                    <p className="text-sm text-muted-foreground">
                      Feedback from your coaches and instructors will appear here once received.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filtered.map((item) => {
                const config = typeConfig[item.type];
                const Icon = config.icon;
                return (
                  <Card
                    key={item.id}
                    className="hover:border-primary transition-colors cursor-pointer"
                    onClick={() => navigate(item.linkTo)}
                  >
                    <CardContent className="py-4">
                      <div className="flex items-start gap-4">
                        <div className="shrink-0 mt-0.5">
                          <Icon className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-medium truncate">{item.title}</h3>
                            <Badge
                              variant="secondary"
                              className={`text-xs shrink-0 ${config.color}`}
                            >
                              {config.label}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {item.summary}
                          </p>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span>{item.givenBy}</span>
                            <span>•</span>
                            <span>{item.contextLabel}</span>
                            {item.givenAt && (
                              <>
                                <span>•</span>
                                <span>
                                  {format(new Date(item.givenAt), "MMM d, yyyy")}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" className="shrink-0">
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
    </FeatureGate>
  );
}
