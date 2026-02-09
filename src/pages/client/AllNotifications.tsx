import { useState } from 'react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { 
  Bell, Check, CheckCheck, Trash2, Settings,
  BookOpen, Calendar, FileText, Target, Scale, 
  CreditCard, Users, Shield, Megaphone, Clock, Loader2,
  Award, Unlock, CalendarPlus, CalendarX, FilePlus,
  MessageSquare, Flag, Share, AlertTriangle, PlusCircle,
  UserPlus, ListTodo, UserCog, Hand, Square, CheckSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BackButton } from '@/components/navigation/BackButton';
import { useNotifications, Notification } from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  'bell': Bell, 'book-open': BookOpen, 'calendar': Calendar,
  'calendar-plus': CalendarPlus, 'calendar-x': CalendarX, 'calendar-clock': Clock,
  'file-text': FileText, 'file-plus': FilePlus, 'target': Target,
  'scale': Scale, 'credit-card': CreditCard, 'users': Users,
  'settings': Settings, 'shield-alert': Shield, 'megaphone': Megaphone,
  'check-circle': Check, 'check-square': Check, 'award': Award,
  'unlock': Unlock, 'message-square': MessageSquare, 'message-circle': MessageSquare,
  'flag': Flag, 'share': Share, 'alert-triangle': AlertTriangle,
  'plus-circle': PlusCircle, 'user-plus': UserPlus, 'list-todo': ListTodo,
  'user-cog': UserCog, 'hand-wave': Hand, 'clock': Clock, 'clipboard-check': Check,
};

export default function AllNotifications() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const {
    notifications, isLoading, markAsRead, markAllAsRead,
    deleteNotification, bulkDeleteNotifications, clearAll, unreadCount,
  } = useNotifications();

  const filteredNotifications = filter === 'unread' 
    ? notifications.filter(n => !n.is_read) : notifications;

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredNotifications.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredNotifications.map(n => n.id)));
  };

  const confirmBulkDelete = () => {
    bulkDeleteNotifications(Array.from(selectedIds));
    setSelectedIds(new Set());
    setShowDeleteDialog(false);
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.is_read) markAsRead(notification.id);
    if (notification.link) navigate(notification.link);
  };

  const getIcon = (notification: Notification) => {
    const iconKey = notification.notification_types?.icon || 'bell';
    const IconComponent = iconMap[iconKey] || Bell;
    return <IconComponent className="h-5 w-5" />;
  };

  const groupedNotifications = filteredNotifications.reduce((groups, notification) => {
    const date = format(new Date(notification.created_at), 'yyyy-MM-dd');
    if (!groups[date]) groups[date] = [];
    groups[date].push(notification);
    return groups;
  }, {} as Record<string, Notification[]>);

  const formatGroupDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (format(date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')) return 'Today';
    if (format(date, 'yyyy-MM-dd') === format(yesterday, 'yyyy-MM-dd')) return 'Yesterday';
    return format(date, 'MMMM d, yyyy');
  };

  return (
    <div className="container max-w-4xl py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <BackButton />
          <div>
            <h1 className="text-2xl font-bold">All Notifications</h1>
            <p className="text-muted-foreground">
              {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <Button variant="destructive" size="sm" onClick={() => setShowDeleteDialog(true)}>
              <Trash2 className="h-4 w-4 mr-2" />Delete ({selectedIds.size})
            </Button>
          )}
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={() => markAllAsRead()}>
              <CheckCheck className="h-4 w-4 mr-2" />Mark all read
            </Button>
          )}
          <Button variant="outline" size="icon" onClick={() => navigate('/settings/notifications')}>
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Tabs value={filter} onValueChange={(v) => { setFilter(v as 'all' | 'unread'); setSelectedIds(new Set()); }}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="unread">
              Unread {unreadCount > 0 && <Badge variant="secondary" className="ml-2">{unreadCount}</Badge>}
            </TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            {filteredNotifications.length > 0 && (
              <Button variant="ghost" size="sm" onClick={toggleSelectAll}>
                {selectedIds.size === filteredNotifications.length ? <CheckSquare className="h-4 w-4 mr-2" /> : <Square className="h-4 w-4 mr-2" />}
                {selectedIds.size === filteredNotifications.length ? 'Deselect All' : 'Select All'}
              </Button>
            )}
            {notifications.length > 0 && (
              <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => clearAll()}>
                <Trash2 className="h-4 w-4 mr-2" />Clear all
              </Button>
            )}
          </div>
        </div>

        <TabsContent value={filter} className="mt-6">
          {isLoading ? (
            <Card><CardContent className="py-8"><div className="flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div></CardContent></Card>
          ) : filteredNotifications.length === 0 ? (
            <Card><CardContent className="py-12">
              <div className="text-center">
                <Bell className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="font-medium mb-1">{filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}</h3>
                <p className="text-sm text-muted-foreground">{filter === 'unread' ? "You're all caught up!" : "You'll see notifications here"}</p>
              </div>
            </CardContent></Card>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedNotifications).map(([date, dayNotifications]) => (
                <div key={date}>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">{formatGroupDate(date)}</h3>
                  <Card>
                    <div className="divide-y">
                      {dayNotifications.map((notification) => (
                        <div
                          key={notification.id}
                          className={cn('p-4 hover:bg-muted/50 cursor-pointer transition-colors relative group', !notification.is_read && 'bg-primary/5')}
                          onClick={() => handleNotificationClick(notification)}
                        >
                          <div className="flex gap-4">
                            <div className="flex items-center">
                              <input
                                type="checkbox"
                                checked={selectedIds.has(notification.id)}
                                onChange={(e) => { e.stopPropagation(); toggleSelect(notification.id); }}
                                onClick={(e) => e.stopPropagation()}
                                className="h-4 w-4 mr-3"
                              />
                              <div className={cn('flex-shrink-0 p-2.5 rounded-full', notification.notification_types?.is_critical ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary')}>
                                {getIcon(notification)}
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className={cn('font-medium', !notification.is_read && 'text-foreground')}>{notification.title}</p>
                                  {notification.notification_types?.notification_categories && (
                                    <Badge variant="outline" className="text-xs mt-1">{notification.notification_types.notification_categories.name}</Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  {!notification.is_read && <div className="h-2 w-2 rounded-full bg-primary" />}
                                  <span className="text-xs text-muted-foreground whitespace-nowrap">{format(new Date(notification.created_at), 'h:mm a')}</span>
                                </div>
                              </div>
                              {notification.message && <p className="text-sm text-muted-foreground mt-1">{notification.message}</p>}
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {!notification.is_read && (
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); markAsRead(notification.id); }}>
                                  <Check className="h-4 w-4" />
                                </Button>
                              )}
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); deleteNotification(notification.id); }}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />Delete Notifications
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedIds.size} selected notification(s)? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmBulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
