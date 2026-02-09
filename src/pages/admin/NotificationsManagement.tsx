import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import { 
  Bell, Trash2, Search, Filter, Users, 
  AlertTriangle, CheckSquare, Square, Loader2,
  Settings, Clock, Zap, Calendar
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AdminPageHeader, AdminLoadingState, AdminEmptyState, AdminTable } from '@/components/admin';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface NotificationWithUser {
  id: string;
  title: string;
  message: string | null;
  created_at: string;
  is_read: boolean;
  user_id: string;
  profiles: {
    name: string;
    email: string;
  } | null;
  notification_types: {
    key: string;
    name: string;
    notification_categories: {
      name: string;
    } | null;
  } | null;
}

export default function NotificationsManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showCleanupDialog, setShowCleanupDialog] = useState(false);
  const [retentionDays, setRetentionDays] = useState<string>('90');
  const [isCleanupSettingsOpen, setIsCleanupSettingsOpen] = useState(false);

  // Fetch retention setting
  const { data: retentionSetting } = useQuery({
    queryKey: ['notification-retention-setting'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'notification_retention_days')
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data?.value || '90';
    },
  });

  // Fetch notifications with user info
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['admin-notifications', searchTerm, categoryFilter],
    queryFn: async () => {
      let query = supabase
        .from('notifications')
        .select(`
          id,
          title,
          message,
          created_at,
          is_read,
          user_id,
          profiles!notifications_user_id_fkey (name, email),
          notification_types (
            key,
            name,
            notification_categories (name)
          )
        `)
        .order('created_at', { ascending: false })
        .limit(500);

      if (searchTerm) {
        query = query.or(`title.ilike.%${searchTerm}%,message.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      let result = data as unknown as NotificationWithUser[];
      
      if (categoryFilter !== 'all') {
        result = result.filter(n => 
          n.notification_types?.notification_categories?.name === categoryFilter
        );
      }
      
      return result;
    },
  });

  // Fetch categories for filter
  const { data: categories = [] } = useQuery({
    queryKey: ['notification-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notification_categories')
        .select('id, name')
        .eq('is_active', true)
        .order('order_index');
      if (error) throw error;
      return data;
    },
  });

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { data, error } = await supabase.rpc('admin_bulk_delete_notifications', {
        notification_ids: ids
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (deletedCount) => {
      toast({
        title: 'Notifications deleted',
        description: `Successfully deleted ${deletedCount} notifications.`,
      });
      queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
      setSelectedIds(new Set());
      setShowDeleteDialog(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Manual cleanup mutation
  const cleanupMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('cleanup-notifications');
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: 'Cleanup complete',
        description: `Successfully cleaned up ${data.deleted_count} old notifications.`,
      });
      queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
      setShowCleanupDialog(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Cleanup failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Update retention setting mutation
  const updateRetentionMutation = useMutation({
    mutationFn: async (days: string) => {
      const { error } = await supabase
        .from('system_settings')
        .upsert({ 
          key: 'notification_retention_days', 
          value: days,
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: 'Setting updated',
        description: `Notification retention period set to ${retentionDays} days.`,
      });
      queryClient.invalidateQueries({ queryKey: ['notification-retention-setting'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === notifications.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(notifications.map(n => n.id)));
    }
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    setShowDeleteDialog(true);
  };

  const confirmBulkDelete = () => {
    bulkDeleteMutation.mutate(Array.from(selectedIds));
  };

  const handleSaveRetention = () => {
    updateRetentionMutation.mutate(retentionDays);
  };

  if (isLoading) {
    return <AdminLoadingState message="Loading notifications..." />;
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Notifications Management"
        description="View and manage all system notifications"
        showCreateButton={false}
      />

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Notifications</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{notifications.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Unread</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {notifications.filter(n => !n.is_read).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Selected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{selectedIds.size}</div>
          </CardContent>
        </Card>
      </div>

      {/* Cleanup Settings */}
      <Collapsible open={isCleanupSettingsOpen} onOpenChange={setIsCleanupSettingsOpen}>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-lg">Cleanup Settings</CardTitle>
              </div>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm">
                  {isCleanupSettingsOpen ? 'Hide' : 'Show'}
                </Button>
              </CollapsibleTrigger>
            </div>
            <CardDescription>
              Configure automated cleanup and manually trigger notification cleanup
            </CardDescription>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                {/* Retention Settings */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-medium">Retention Period</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Notifications older than this will be automatically deleted during cleanup.
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 max-w-[200px]">
                      <Label htmlFor="retention-days" className="sr-only">Retention days</Label>
                      <Select 
                        value={retentionDays} 
                        onValueChange={setRetentionDays}
                        defaultValue={retentionSetting || '90'}
                      >
                        <SelectTrigger id="retention-days">
                          <SelectValue placeholder="Select days" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="30">30 days</SelectItem>
                          <SelectItem value="60">60 days</SelectItem>
                          <SelectItem value="90">90 days</SelectItem>
                          <SelectItem value="180">180 days</SelectItem>
                          <SelectItem value="365">1 year</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button 
                      variant="secondary" 
                      onClick={handleSaveRetention}
                      disabled={updateRetentionMutation.isPending}
                    >
                      {updateRetentionMutation.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Save
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Current setting: {retentionSetting || '90'} days
                  </p>
                </div>

                {/* Manual Cleanup */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-medium">Manual Cleanup</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Immediately delete all notifications older than the retention period.
                  </p>
                  <Button 
                    variant="outline" 
                    onClick={() => setShowCleanupDialog(true)}
                    disabled={cleanupMutation.isPending}
                  >
                    {cleanupMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    <Trash2 className="h-4 w-4 mr-2" />
                    Run Cleanup Now
                  </Button>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span>Automated cleanup runs daily at midnight UTC</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Filters and Actions */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            <div className="flex flex-1 gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search notifications..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.name}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedIds.size > 0 && (
              <Button 
                variant="destructive" 
                onClick={handleBulkDelete}
                disabled={bulkDeleteMutation.isPending}
              >
                {bulkDeleteMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Selected ({selectedIds.size})
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {notifications.length === 0 ? (
            <AdminEmptyState
              icon={Bell}
              title="No notifications found"
              description="No notifications match your search criteria."
            />
          ) : (
            <div className="rounded-md border">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-3 text-left w-10">
                      <Checkbox
                        checked={selectedIds.size === notifications.length && notifications.length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                    </th>
                    <th className="p-3 text-left font-medium">Notification</th>
                    <th className="p-3 text-left font-medium hidden md:table-cell">User</th>
                    <th className="p-3 text-left font-medium hidden lg:table-cell">Category</th>
                    <th className="p-3 text-left font-medium">Status</th>
                    <th className="p-3 text-left font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {notifications.map((notification) => (
                    <tr key={notification.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-3">
                        <Checkbox
                          checked={selectedIds.has(notification.id)}
                          onCheckedChange={() => toggleSelect(notification.id)}
                        />
                      </td>
                      <td className="p-3">
                        <div>
                          <p className="font-medium">{notification.title}</p>
                          {notification.message && (
                            <p className="text-sm text-muted-foreground line-clamp-1">
                              {notification.message}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="p-3 hidden md:table-cell">
                        <div className="text-sm">
                          <p>{notification.profiles?.name || 'Unknown'}</p>
                          <p className="text-muted-foreground">{notification.profiles?.email}</p>
                        </div>
                      </td>
                      <td className="p-3 hidden lg:table-cell">
                        <Badge variant="outline">
                          {notification.notification_types?.notification_categories?.name || 'General'}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <Badge variant={notification.is_read ? 'secondary' : 'default'}>
                          {notification.is_read ? 'Read' : 'Unread'}
                        </Badge>
                      </td>
                      <td className="p-3 text-sm text-muted-foreground">
                        {format(new Date(notification.created_at), 'MMM d, yyyy HH:mm')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete Notifications
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedIds.size} selected notification(s)?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cleanup Confirmation Dialog */}
      <AlertDialog open={showCleanupDialog} onOpenChange={setShowCleanupDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-primary" />
              Run Notification Cleanup
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all notifications older than {retentionSetting || '90'} days.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cleanupMutation.mutate()}
              disabled={cleanupMutation.isPending}
            >
              {cleanupMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Run Cleanup
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
