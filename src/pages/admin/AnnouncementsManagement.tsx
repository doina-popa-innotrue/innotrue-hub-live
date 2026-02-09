import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, Megaphone, Settings, Trash, Loader2, Pin } from 'lucide-react';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import {
  AdminPageHeader,
  AdminLoadingState,
  AdminEmptyState,
  AdminFormActions,
} from '@/components/admin';
import { IconPicker, DynamicIcon } from '@/components/admin/IconPicker';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { Link } from 'react-router-dom';

interface AnnouncementCategory {
  id: string;
  name: string;
  label: string;
  icon: string;
  color: string;
}

interface Announcement {
  id: string;
  title: string;
  content: string | null;
  category_id: string | null;
  icon: string | null;
  is_active: boolean;
  is_pinned: boolean;
  display_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  announcement_categories?: AnnouncementCategory | null;
}

type FormData = {
  title: string;
  content: string;
  category_id: string;
  icon: string;
  is_active: boolean;
  is_pinned: boolean;
  display_order: number;
};

const initialFormData: FormData = {
  title: '',
  content: '',
  category_id: '',
  icon: '',
  is_active: false,
  is_pinned: false,
  display_order: 0,
};

export default function AnnouncementsManagement() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Announcement | null>(null);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [showCleanupDialog, setShowCleanupDialog] = useState(false);
  const [cleanupDays, setCleanupDays] = useState(30);
  const [isCleaningUp, setIsCleaningUp] = useState(false);

  // Fetch announcements
  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ['announcements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('announcements')
        .select('*, announcement_categories(*)')
        .order('is_pinned', { ascending: false })
        .order('display_order')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Announcement[];
    },
  });

  // Toggle pinned mutation
  const togglePinnedMutation = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: boolean }) => {
      const { error } = await supabase
        .from('announcements')
        .update({ is_pinned: value })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      queryClient.invalidateQueries({ queryKey: ['active-announcements'] });
    },
  });

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ['announcement-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('announcement_categories')
        .select('*')
        .order('display_order');
      if (error) throw error;
      return data as AnnouncementCategory[];
    },
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload = {
        title: data.title,
        content: data.content || null,
        category_id: data.category_id || null,
        icon: data.icon || null,
        is_active: data.is_active,
        is_pinned: data.is_pinned,
        display_order: data.display_order,
        created_by: user?.id,
      };

      if (editingItem) {
        const { error } = await supabase
          .from('announcements')
          .update(payload)
          .eq('id', editingItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('announcements')
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: editingItem ? 'Announcement updated' : 'Announcement created',
        description: 'Your changes have been saved.',
      });
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      setIsDialogOpen(false);
      setEditingItem(null);
      setFormData(initialFormData);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('announcements')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Announcement deleted' });
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Toggle active mutation
  const toggleMutation = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: boolean }) => {
      const { error } = await supabase
        .from('announcements')
        .update({ is_active: value })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      queryClient.invalidateQueries({ queryKey: ['active-announcements'] });
    },
  });

  // Mass cleanup
  const handleCleanup = async () => {
    setIsCleaningUp(true);
    try {
      const { data, error } = await supabase.rpc('cleanup_old_announcements', {
        days_old: cleanupDays,
      });
      if (error) throw error;
      toast({
        title: 'Cleanup complete',
        description: `Deleted ${data} inactive announcement(s) older than ${cleanupDays} days.`,
      });
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      setShowCleanupDialog(false);
    } catch (error: any) {
      toast({
        title: 'Cleanup failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsCleaningUp(false);
    }
  };

  const openCreate = () => {
    setEditingItem(null);
    setFormData(initialFormData);
    setIsDialogOpen(true);
  };

  const openEdit = (item: Announcement) => {
    setEditingItem(item);
    setFormData({
      title: item.title,
      content: item.content || '',
      category_id: item.category_id || '',
      icon: item.icon || '',
      is_active: item.is_active,
      is_pinned: item.is_pinned,
      display_order: item.display_order,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          required
          placeholder="e.g., New Feature: Decision Journal"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="category">Category</Label>
        <Select
          value={formData.category_id}
          onValueChange={(value) => setFormData({ ...formData, category_id: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a category" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                <div className="flex items-center gap-2">
                  <DynamicIcon name={cat.icon} className="h-4 w-4" />
                  {cat.label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <IconPicker
        label="Custom Icon (overrides category icon)"
        value={formData.icon}
        onChange={(icon) => setFormData({ ...formData, icon })}
        allowClear
        clearLabel="Use category default"
      />

      <div className="space-y-2">
        <Label>Content (Rich Text)</Label>
        <RichTextEditor
          value={formData.content}
          onChange={(value) => setFormData({ ...formData, content: value })}
          placeholder="Write your announcement content here..."
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="display_order">Display Order</Label>
          <Input
            id="display_order"
            type="number"
            value={formData.display_order}
            onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
          />
        </div>
        <div className="flex items-center gap-2 pt-6">
          <Switch
            id="is_active"
            checked={formData.is_active}
            onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
          />
          <Label htmlFor="is_active">Published</Label>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Switch
          id="is_pinned"
          checked={formData.is_pinned}
          onCheckedChange={(checked) => setFormData({ ...formData, is_pinned: checked })}
        />
        <Label htmlFor="is_pinned">
          Pinned (always visible at top of widget)
        </Label>
      </div>

      <AdminFormActions
        isEditing={!!editingItem}
        isSubmitting={saveMutation.isPending}
        onCancel={() => setIsDialogOpen(false)}
      />
    </form>
  );

  if (isLoading) {
    return <AdminLoadingState />;
  }

  const activeCount = announcements.filter(a => a.is_active).length;
  const inactiveCount = announcements.filter(a => !a.is_active).length;
  const pinnedCount = announcements.filter(a => a.is_pinned).length;

  return (
    <div>
      <Breadcrumb className="mb-4">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/admin">Dashboard</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Announcements</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold">Announcements</h1>
            <p className="text-muted-foreground">Manage news and updates shown to authenticated users on their dashboard</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Link to="/admin/announcement-categories">
              <Button variant="outline" size="sm" className="sm:size-default">
                <Settings className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Manage Categories</span>
              </Button>
            </Link>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="sm:size-default">
                  <Trash className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Mass Cleanup</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Mass Cleanup</DialogTitle>
                  <DialogDescription>
                    Delete inactive announcements older than a specified number of days.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Delete inactive announcements older than:</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={cleanupDays}
                        onChange={(e) => setCleanupDays(parseInt(e.target.value) || 30)}
                        className="w-24"
                      />
                      <span>days</span>
                    </div>
                  </div>
                  <Button 
                    onClick={() => setShowCleanupDialog(true)} 
                    variant="destructive"
                    disabled={isCleaningUp}
                  >
                    {isCleaningUp && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Run Cleanup
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openCreate} size="sm" className="sm:size-default">
                  <Megaphone className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">New Announcement</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingItem ? 'Edit Announcement' : 'Create Announcement'}</DialogTitle>
                </DialogHeader>
                {formContent}
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{announcements.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Published</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{activeCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-1">
                <Pin className="h-3.5 w-3.5" /> Pinned
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{pinnedCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Drafts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-muted-foreground">{inactiveCount}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Announcements</CardTitle>
            <CardDescription>
              Published announcements are visible to all authenticated users on their dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {announcements.length === 0 ? (
              <AdminEmptyState
                icon={Megaphone}
                title="No announcements yet"
                description="Create your first announcement to share news with your users!"
                actionLabel="New Announcement"
                onAction={openCreate}
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Icon</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="w-16">Order</TableHead>
                    <TableHead className="w-16">Pinned</TableHead>
                    <TableHead className="w-20">Status</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {announcements.map((announcement) => {
                    const displayIcon = announcement.icon || announcement.announcement_categories?.icon || 'Info';
                    return (
                      <TableRow key={announcement.id}>
                        <TableCell>
                          <DynamicIcon name={displayIcon} className="h-5 w-5" />
                        </TableCell>
                        <TableCell className="font-medium max-w-xs truncate">
                          {announcement.title}
                        </TableCell>
                        <TableCell>
                          {announcement.announcement_categories ? (
                            <Badge variant="outline">
                              {announcement.announcement_categories.label}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>{announcement.display_order}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => togglePinnedMutation.mutate({ 
                              id: announcement.id, 
                              value: !announcement.is_pinned 
                            })}
                            className={announcement.is_pinned ? 'text-primary hover:text-primary/80' : 'text-muted-foreground hover:text-foreground'}
                            title={announcement.is_pinned ? 'Unpin announcement' : 'Pin announcement'}
                          >
                            <Pin className="h-4 w-4" />
                          </Button>
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={announcement.is_active}
                            onCheckedChange={(checked) => 
                              toggleMutation.mutate({ id: announcement.id, value: checked })
                            }
                          />
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(announcement.updated_at), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm" onClick={() => openEdit(announcement)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-destructive"
                              onClick={() => deleteMutation.mutate(announcement.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cleanup Confirmation Dialog */}
      <AlertDialog open={showCleanupDialog} onOpenChange={setShowCleanupDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Cleanup</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all inactive announcements older than {cleanupDays} days.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCleanup}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Old Announcements
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
