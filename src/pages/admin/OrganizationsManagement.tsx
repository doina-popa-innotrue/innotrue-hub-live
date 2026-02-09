import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Building2, Plus, Pencil, Trash2, Users, Search, ExternalLink, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';

interface Organization {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  website: string | null;
  industry: string | null;
  size_range: string | null;
  is_active: boolean;
  created_at: string;
  memberCount?: number;
  programCount?: number;
}

const SIZE_RANGES = [
  { value: '1-10', label: '1-10 employees' },
  { value: '11-50', label: '11-50 employees' },
  { value: '51-200', label: '51-200 employees' },
  { value: '201-500', label: '201-500 employees' },
  { value: '501-1000', label: '501-1000 employees' },
  { value: '1000+', label: '1000+ employees' },
];

const INDUSTRIES = [
  'Technology',
  'Healthcare',
  'Finance',
  'Education',
  'Manufacturing',
  'Retail',
  'Professional Services',
  'Non-profit',
  'Government',
  'Other',
];

export default function OrganizationsManagement() {
  const { toast } = useToast();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    website: '',
    industry: '',
    size_range: '',
  });

  useEffect(() => {
    loadOrganizations();
  }, []);

  const loadOrganizations = async () => {
    try {
      setLoading(true);

      const { data: orgsData, error } = await supabase
        .from('organizations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get member counts for each org
      const orgsWithCounts = await Promise.all(
        (orgsData || []).map(async (org) => {
          const { count: memberCount } = await supabase
            .from('organization_members')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', org.id)
            .eq('is_active', true);

          const { count: programCount } = await supabase
            .from('organization_programs')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', org.id)
            .eq('is_active', true);

          return {
            ...org,
            memberCount: memberCount || 0,
            programCount: programCount || 0,
          };
        })
      );

      setOrganizations(orgsWithCounts);
    } catch (error) {
      console.error('Error loading organizations:', error);
      toast({
        title: 'Error',
        description: 'Failed to load organizations',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const handleNameChange = (name: string) => {
    setFormData(prev => ({
      ...prev,
      name,
      slug: editingOrg ? prev.slug : generateSlug(name),
    }));
  };

  const resetForm = () => {
    setFormData({
      name: '',
      slug: '',
      description: '',
      website: '',
      industry: '',
      size_range: '',
    });
    setEditingOrg(null);
  };

  const handleEdit = (org: Organization) => {
    setEditingOrg(org);
    setFormData({
      name: org.name,
      slug: org.slug,
      description: org.description || '',
      website: org.website || '',
      industry: org.industry || '',
      size_range: org.size_range || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.slug) {
      toast({
        title: 'Validation Error',
        description: 'Name and slug are required',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      if (editingOrg) {
        // Update existing
        const { error } = await supabase
          .from('organizations')
          .update({
            name: formData.name,
            description: formData.description || null,
            website: formData.website || null,
            industry: formData.industry || null,
            size_range: formData.size_range || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingOrg.id);

        if (error) throw error;

        toast({
          title: 'Organization Updated',
          description: 'Organization has been updated successfully',
        });
      } else {
        // Create new
        const { error } = await supabase
          .from('organizations')
          .insert({
            name: formData.name,
            slug: formData.slug,
            description: formData.description || null,
            website: formData.website || null,
            industry: formData.industry || null,
            size_range: formData.size_range || null,
          });

        if (error) {
          if (error.code === '23505') {
            throw new Error('An organization with this slug already exists');
          }
          throw error;
        }

        toast({
          title: 'Organization Created',
          description: 'New organization has been created successfully',
        });
      }

      setDialogOpen(false);
      resetForm();
      loadOrganizations();
    } catch (error: any) {
      console.error('Error saving organization:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save organization',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (org: Organization) => {
    try {
      const { error } = await supabase
        .from('organizations')
        .update({ 
          is_active: !org.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', org.id);

      if (error) throw error;

      toast({
        title: org.is_active ? 'Organization Deactivated' : 'Organization Activated',
        description: `${org.name} has been ${org.is_active ? 'deactivated' : 'activated'}`,
      });
      loadOrganizations();
    } catch (error) {
      console.error('Error toggling organization:', error);
      toast({
        title: 'Error',
        description: 'Failed to update organization',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (org: Organization) => {
    try {
      const { error } = await supabase
        .from('organizations')
        .delete()
        .eq('id', org.id);

      if (error) throw error;

      toast({
        title: 'Organization Deleted',
        description: `${org.name} has been deleted`,
      });
      loadOrganizations();
    } catch (error) {
      console.error('Error deleting organization:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete organization. Make sure all members and programs are removed first.',
        variant: 'destructive',
      });
    }
  };

  const filteredOrganizations = organizations.filter(org =>
    !searchQuery ||
    org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    org.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Organizations</h1>
          <p className="text-muted-foreground">
            Manage B2B organizations and their access
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Organization
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingOrg ? 'Edit Organization' : 'Create Organization'}
              </DialogTitle>
              <DialogDescription>
                {editingOrg 
                  ? 'Update organization details'
                  : 'Add a new B2B organization to the platform'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Organization Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Acme Corporation"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">URL Slug *</Label>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  placeholder="acme-corp"
                  disabled={!!editingOrg}
                  className={editingOrg ? 'bg-muted' : ''}
                />
                {!editingOrg && (
                  <p className="text-xs text-muted-foreground">
                    This cannot be changed after creation
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of the organization..."
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  type="url"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  placeholder="https://www.example.com"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Industry</Label>
                  <Select 
                    value={formData.industry} 
                    onValueChange={(v) => setFormData({ ...formData, industry: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select industry" />
                    </SelectTrigger>
                    <SelectContent>
                      {INDUSTRIES.map((industry) => (
                        <SelectItem key={industry} value={industry}>
                          {industry}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Company Size</Label>
                  <Select 
                    value={formData.size_range} 
                    onValueChange={(v) => setFormData({ ...formData, size_range: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select size" />
                    </SelectTrigger>
                    <SelectContent>
                      {SIZE_RANGES.map((size) => (
                        <SelectItem key={size.value} value={size.value}>
                          {size.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : editingOrg ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Organizations</CardDescription>
            <CardTitle className="text-2xl">{organizations.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active</CardDescription>
            <CardTitle className="text-2xl text-green-600">
              {organizations.filter(o => o.is_active).length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Members</CardDescription>
            <CardTitle className="text-2xl">
              {organizations.reduce((sum, o) => sum + (o.memberCount || 0), 0)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            All Organizations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search organizations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading organizations...
            </div>
          ) : filteredOrganizations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {organizations.length === 0 
                ? 'No organizations yet. Create your first one!'
                : 'No organizations match your search.'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organization</TableHead>
                  <TableHead>Industry</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead>Programs</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrganizations.map((org) => (
                  <TableRow key={org.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Building2 className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <div className="font-medium">{org.name}</div>
                          <div className="text-sm text-muted-foreground">{org.slug}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {org.industry || <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        {org.memberCount}
                      </div>
                    </TableCell>
                    <TableCell>{org.programCount}</TableCell>
                    <TableCell>
                      <Badge
                        variant={org.is_active ? 'default' : 'secondary'}
                        className="cursor-pointer"
                        onClick={() => handleToggleActive(org)}
                      >
                        {org.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(org.created_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link to={`/admin/organizations/${org.id}`}>
                          <Button variant="ghost" size="sm" title="View Details">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Link to={`/admin/organization-programs?org=${org.id}`}>
                          <Button variant="ghost" size="sm" title="View Programs">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(org)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Organization</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete "{org.name}"? 
                                This will also remove all members and program licenses.
                                This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(org)}
                                className="bg-destructive text-destructive-foreground"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
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
