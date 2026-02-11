import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, FolderOpen } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface DriveMapping {
  id: string;
  user_id: string;
  folder_url: string;
  folder_name: string | null;
  user_name?: string;
  user_email?: string;
}

interface Profile {
  id: string;
  name: string;
  email?: string;
}

export default function GoogleDriveManagement() {
  const [mappings, setMappings] = useState<DriveMapping[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMapping, setEditingMapping] = useState<DriveMapping | null>(null);
  const [formData, setFormData] = useState({
    user_id: '',
    folder_url: '',
    folder_name: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    
    // Fetch all profiles
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, name');

    // Fetch all mappings
    const { data: mappingsData } = await supabase
      .from('google_drive_users')
      .select('*');

    if (profilesData) {
      setProfiles(profilesData.map(profile => ({
        ...profile,
        email: undefined as string | undefined // Email not needed for display - name is sufficient
      })));
    }

    if (mappingsData && profilesData) {
      const enrichedMappings = mappingsData.map(mapping => {
        const profile = profilesData.find(p => p.id === mapping.user_id);
        return {
          ...mapping,
          user_name: profile?.name,
          user_email: profiles.find(p => p.id === mapping.user_id)?.email
        };
      });
      setMappings(enrichedMappings);
    }

    setIsLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.user_id || !formData.folder_url) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      if (editingMapping) {
        const { error } = await supabase
          .from('google_drive_users')
          .update({
            folder_url: formData.folder_url,
            folder_name: formData.folder_name || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingMapping.id);

        if (error) throw error;
        toast.success('Google Drive mapping updated');
      } else {
        const { error } = await supabase
          .from('google_drive_users')
          .insert({
            user_id: formData.user_id,
            folder_url: formData.folder_url,
            folder_name: formData.folder_name || null
          });

        if (error) throw error;
        toast.success('Google Drive mapping created');
      }

      setIsDialogOpen(false);
      setEditingMapping(null);
      setFormData({ user_id: '', folder_url: '', folder_name: '' });
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save mapping');
    }
  };

  const handleEdit = (mapping: DriveMapping) => {
    setEditingMapping(mapping);
    setFormData({
      user_id: mapping.user_id,
      folder_url: mapping.folder_url,
      folder_name: mapping.folder_name || ''
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this mapping?')) return;

    const { error } = await supabase
      .from('google_drive_users')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Failed to delete mapping');
    } else {
      toast.success('Mapping deleted');
      fetchData();
    }
  };

  const unmappedUsers = profiles.filter(
    p => !mappings.find(m => m.user_id === p.id)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Google Drive Management</h1>
          <p className="text-muted-foreground">
            Manage Google Drive folder assignments for users
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setEditingMapping(null);
            setFormData({ user_id: '', folder_url: '', folder_name: '' });
          }
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Mapping
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingMapping ? 'Edit' : 'Add'} Google Drive Mapping
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="user">User *</Label>
                <Select
                  value={formData.user_id}
                  onValueChange={(value) => setFormData({ ...formData, user_id: value })}
                  disabled={!!editingMapping}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a user" />
                  </SelectTrigger>
                  <SelectContent>
                    {(editingMapping ? profiles : unmappedUsers).map((profile) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.name} {profile.email && `(${profile.email})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="folder_url">Folder URL *</Label>
                <Input
                  id="folder_url"
                  value={formData.folder_url}
                  onChange={(e) => setFormData({ ...formData, folder_url: e.target.value })}
                  placeholder="https://drive.google.com/drive/folders/..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="folder_name">Folder Name (optional)</Label>
                <Input
                  id="folder_name"
                  value={formData.folder_name}
                  onChange={(e) => setFormData({ ...formData, folder_name: e.target.value })}
                  placeholder="e.g., Client Resources"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingMapping ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            User Mappings
          </CardTitle>
          <CardDescription>
            Users with assigned Google Drive folders
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : mappings.length === 0 ? (
            <p className="text-muted-foreground">No mappings configured yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Folder Name</TableHead>
                  <TableHead>Folder URL</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mappings.map((mapping) => (
                  <TableRow key={mapping.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{mapping.user_name || 'Unknown'}</p>
                        <p className="text-sm text-muted-foreground">{mapping.user_email}</p>
                      </div>
                    </TableCell>
                    <TableCell>{mapping.folder_name || '-'}</TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      <a 
                        href={mapping.folder_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {mapping.folder_url}
                      </a>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(mapping)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(mapping.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
