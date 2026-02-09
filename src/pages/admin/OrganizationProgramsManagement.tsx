import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Building2, BookOpen, Plus, Trash2, Search } from 'lucide-react';
import { format } from 'date-fns';

interface Organization {
  id: string;
  name: string;
  slug: string;
}

interface Program {
  id: string;
  name: string;
  slug: string;
  category: string;
}

interface OrganizationProgram {
  id: string;
  organization_id: string;
  program_id: string;
  is_active: boolean;
  max_enrollments: number | null;
  licensed_at: string;
  expires_at: string | null;
  organization: Organization;
  program: Program;
}

export default function OrganizationProgramsManagement() {
  const { toast } = useToast();
  const [licenses, setLicenses] = useState<OrganizationProgram[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [orgFilter, setOrgFilter] = useState<string>('all');

  // Form state
  const [selectedOrg, setSelectedOrg] = useState<string>('');
  const [selectedProgram, setSelectedProgram] = useState<string>('');
  const [maxEnrollments, setMaxEnrollments] = useState<string>('');
  const [expiresAt, setExpiresAt] = useState<string>('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load organizations
      const { data: orgsData } = await supabase
        .from('organizations')
        .select('id, name, slug')
        .eq('is_active', true)
        .order('name');

      setOrganizations(orgsData || []);

      // Load programs
      const { data: programsData } = await supabase
        .from('programs')
        .select('id, name, slug, category')
        .eq('is_active', true)
        .order('name');

      setPrograms(programsData || []);

      // Load existing licenses
      const { data: licensesData, error } = await supabase
        .from('organization_programs')
        .select(`
          id,
          organization_id,
          program_id,
          is_active,
          max_enrollments,
          licensed_at,
          expires_at,
          organizations (id, name, slug),
          programs (id, name, slug, category)
        `)
        .order('licensed_at', { ascending: false });

      if (error) throw error;

      const enrichedLicenses = (licensesData || []).map(license => ({
        ...license,
        organization: license.organizations as unknown as Organization,
        program: license.programs as unknown as Program,
      }));

      setLicenses(enrichedLicenses);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddLicense = async () => {
    if (!selectedOrg || !selectedProgram) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('organization_programs')
        .insert({
          organization_id: selectedOrg,
          program_id: selectedProgram,
          max_enrollments: maxEnrollments ? parseInt(maxEnrollments) : null,
          expires_at: expiresAt || null,
        });

      if (error) {
        if (error.code === '23505') {
          throw new Error('This program is already licensed to this organization');
        }
        throw error;
      }

      toast({
        title: 'License Added',
        description: 'Program has been licensed to the organization',
      });

      setDialogOpen(false);
      resetForm();
      loadData();
    } catch (error: any) {
      console.error('Error adding license:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to add license',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveLicense = async (licenseId: string) => {
    try {
      const { error } = await supabase
        .from('organization_programs')
        .delete()
        .eq('id', licenseId);

      if (error) throw error;

      toast({
        title: 'License Removed',
        description: 'Program license has been removed',
      });
      loadData();
    } catch (error) {
      console.error('Error removing license:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove license',
        variant: 'destructive',
      });
    }
  };

  const handleToggleActive = async (licenseId: string, currentActive: boolean) => {
    try {
      const { error } = await supabase
        .from('organization_programs')
        .update({ is_active: !currentActive })
        .eq('id', licenseId);

      if (error) throw error;

      toast({
        title: currentActive ? 'License Deactivated' : 'License Activated',
        description: `Program license has been ${currentActive ? 'deactivated' : 'activated'}`,
      });
      loadData();
    } catch (error) {
      console.error('Error toggling license:', error);
      toast({
        title: 'Error',
        description: 'Failed to update license',
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setSelectedOrg('');
    setSelectedProgram('');
    setMaxEnrollments('');
    setExpiresAt('');
  };

  const filteredLicenses = licenses.filter(license => {
    const matchesSearch =
      !searchQuery ||
      license.organization?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      license.program?.name?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesOrg = orgFilter === 'all' || license.organization_id === orgFilter;

    return matchesSearch && matchesOrg;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Organization Programs</h1>
          <p className="text-muted-foreground">
            Manage which programs each organization can access
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add License
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>License Program to Organization</DialogTitle>
              <DialogDescription>
                Grant an organization access to a program
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Organization</Label>
                <Select value={selectedOrg} onValueChange={setSelectedOrg}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select organization" />
                  </SelectTrigger>
                  <SelectContent>
                    {organizations.map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Program</Label>
                <Select value={selectedProgram} onValueChange={setSelectedProgram}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select program" />
                  </SelectTrigger>
                  <SelectContent>
                    {programs.map((program) => (
                      <SelectItem key={program.id} value={program.id}>
                        {program.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Max Enrollments (optional)</Label>
                <Input
                  type="number"
                  placeholder="Unlimited"
                  value={maxEnrollments}
                  onChange={(e) => setMaxEnrollments(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty for unlimited enrollments
                </p>
              </div>
              <div className="space-y-2">
                <Label>Expires At (optional)</Label>
                <Input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty for no expiration
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleAddLicense}
                disabled={saving || !selectedOrg || !selectedProgram}
              >
                {saving ? 'Adding...' : 'Add License'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Program Licenses
          </CardTitle>
          <CardDescription>
            {licenses.length} total licenses
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={orgFilter} onValueChange={setOrgFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <Building2 className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Organization" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Organizations</SelectItem>
                {organizations.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading...
            </div>
          ) : filteredLicenses.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {licenses.length === 0
                ? 'No program licenses yet. Add one to get started.'
                : 'No licenses match your filters.'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organization</TableHead>
                  <TableHead>Program</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Max Enrollments</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Licensed</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLicenses.map((license) => (
                  <TableRow key={license.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {license.organization?.name || 'Unknown'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{license.program?.name || 'Unknown'}</TableCell>
                    <TableCell>
                      <Badge
                        variant={license.is_active ? 'default' : 'secondary'}
                        className="cursor-pointer"
                        onClick={() => handleToggleActive(license.id, license.is_active)}
                      >
                        {license.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {license.max_enrollments || (
                        <span className="text-muted-foreground">Unlimited</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {license.expires_at ? (
                        format(new Date(license.expires_at), 'MMM d, yyyy')
                      ) : (
                        <span className="text-muted-foreground">Never</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(license.licensed_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell className="text-right">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove License</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to remove this program license?
                              The organization will no longer be able to enroll members in this program.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleRemoveLicense(license.id)}
                              className="bg-destructive text-destructive-foreground"
                            >
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
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
