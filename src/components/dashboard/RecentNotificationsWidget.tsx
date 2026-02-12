import { useNotifications } from "@/hooks/useNotifications";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, CheckCircle, Calendar, FileText, FilePlus, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

const notificationIcons: Record<string, React.ElementType> = {
  assignment_graded: FileText,
  session_scheduled: Calendar,
  content_updated: FilePlus,
  default: Bell,
};

export function RecentNotificationsWidget() {
  const { notifications, unreadCount, isLoading, markAsRead } = useNotifications();
  const navigate = useNavigate();

  // Get recent unread notifications (max 5)
  const recentUnread = notifications.filter((n) => !n.is_read).slice(0, 5);

  const handleNotificationClick = (notification: (typeof notifications)[0]) => {
    markAsRead(notification.id);
    if (notification.link) {
      navigate(notification.link);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bell className="h-5 w-5" />
            Recent Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (recentUnread.length === 0) {
    return null; // Don't show widget if no unread notifications
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bell className="h-5 w-5 text-primary" />
            Recent Notifications
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-2">
                {unreadCount} new
              </Badge>
            )}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/notifications")}
            className="text-sm"
          >
            View All
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {recentUnread.map((notification) => {
          const typeKey = notification.notification_types?.key || "default";
          const Icon = notificationIcons[typeKey] || notificationIcons.default;

          return (
            <div
              key={notification.id}
              className="flex items-start gap-3 p-3 rounded-lg bg-background border cursor-pointer hover:border-primary transition-colors"
              onClick={() => handleNotificationClick(notification)}
            >
              <div className="rounded-full bg-primary/10 p-2">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{notification.title}</p>
                {notification.message && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                    {notification.message}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 h-8 w-8"
                onClick={(e) => {
                  e.stopPropagation();
                  markAsRead(notification.id);
                }}
                title="Mark as read"
              >
                <CheckCircle className="h-4 w-4 text-muted-foreground hover:text-primary" />
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
