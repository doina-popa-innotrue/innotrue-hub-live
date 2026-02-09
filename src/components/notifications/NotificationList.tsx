import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { 
  Bell, Check, CheckCheck, Trash2, Settings, 
  BookOpen, Calendar, FileText, Target, Scale, 
  CreditCard, Users, Shield, Megaphone, Clock,
  Award, Unlock, CalendarPlus, CalendarX, FilePlus,
  MessageSquare, Flag, Share, AlertTriangle, PlusCircle,
  UserPlus, ListTodo, UserCog, Hand
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useNotifications, Notification } from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  'bell': Bell,
  'book-open': BookOpen,
  'calendar': Calendar,
  'calendar-plus': CalendarPlus,
  'calendar-x': CalendarX,
  'calendar-clock': Clock,
  'file-text': FileText,
  'file-plus': FilePlus,
  'target': Target,
  'scale': Scale,
  'credit-card': CreditCard,
  'users': Users,
  'settings': Settings,
  'shield-alert': Shield,
  'megaphone': Megaphone,
  'check-circle': Check,
  'check-square': Check,
  'award': Award,
  'unlock': Unlock,
  'message-square': MessageSquare,
  'message-circle': MessageSquare,
  'flag': Flag,
  'share': Share,
  'alert-triangle': AlertTriangle,
  'plus-circle': PlusCircle,
  'user-plus': UserPlus,
  'list-todo': ListTodo,
  'user-cog': UserCog,
  'hand-wave': Hand,
  'clock': Clock,
  'clipboard-check': Check,
};

interface NotificationListProps {
  onClose?: () => void;
}

export function NotificationList({ onClose }: NotificationListProps) {
  const navigate = useNavigate();
  const {
    notifications,
    isLoading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
    unreadCount,
  } = useNotifications();

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.is_read) {
      markAsRead(notification.id);
    }
    if (notification.link) {
      navigate(notification.link);
      onClose?.();
    }
  };

  const getIcon = (notification: Notification) => {
    const iconKey = notification.notification_types?.icon || 'bell';
    const IconComponent = iconMap[iconKey] || Bell;
    return <IconComponent className="h-4 w-4" />;
  };

  if (isLoading) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        Loading notifications...
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold">Notifications</h3>
        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllAsRead()}
              className="text-xs"
            >
              <CheckCheck className="h-4 w-4 mr-1" />
              Mark all read
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => {
              navigate('/settings/notifications');
              onClose?.();
            }}
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Notification list */}
      <ScrollArea className="max-h-[400px]">
        {notifications.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No notifications yet</p>
          </div>
        ) : (
          <div className="divide-y">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={cn(
                  'p-4 hover:bg-muted/50 cursor-pointer transition-colors relative group',
                  !notification.is_read && 'bg-primary/5'
                )}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="flex gap-3">
                  <div className={cn(
                    'flex-shrink-0 p-2 rounded-full',
                    notification.notification_types?.is_critical 
                      ? 'bg-destructive/10 text-destructive' 
                      : 'bg-primary/10 text-primary'
                  )}>
                    {getIcon(notification)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={cn(
                        'text-sm',
                        !notification.is_read && 'font-medium'
                      )}>
                        {notification.title}
                      </p>
                      {!notification.is_read && (
                        <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                      )}
                    </div>
                    {notification.message && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
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
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNotification(notification.id);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Footer */}
      {notifications.length > 0 && (
        <>
          <Separator />
          <div className="p-2 flex justify-between">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
              onClick={() => clearAll()}
            >
              Clear all
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => {
                navigate('/notifications');
                onClose?.();
              }}
            >
              View all
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
