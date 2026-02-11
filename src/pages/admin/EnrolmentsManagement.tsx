import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Users, ExternalLink, Search, X, Download } from 'lucide-react';

interface Enrolment {
  id: string;
  client_user_id: string;
  program_id: string;
  status: string;
  tier: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  programs: {
    id: string;
    name: string;
    slug: string;
  };
  profiles: {
    id: string;
    name: string;
    username: string | null;
  } | null;
  program_plans: {
    id: string;
    name: string;
    tier_level: number;
  } | null;
}

interface Program {
  id: string;
  name: string;
}

export default function EnrolmentsManagement() {
  const navigate = useNavigate();
  const [enrolments, setEnrolments] = useState<Enrolment[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [programFilter, setProgramFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    
    // Fetch all programs for the filter dropdown
    const { data: programsData } = await supabase
      .from('programs')
      .select('id, name')
      .order('name');
    
    setPrograms(programsData || []);

    // Fetch all enrolments with related data
    const { data: enrolmentsData, error } = await supabase
      .from('client_enrollments')
      .select(`
        id,
        client_user_id,
        program_id,
        status,
        tier,
        start_date,
        end_date,
        created_at,
        programs (id, name, slug),
        program_plans (id, name, tier_level)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to load enrolments');
      setLoading(false);
      return;
    }

    // Fetch profiles for all client_user_ids
    const userIds = [...new Set((enrolmentsData || []).map(e => e.client_user_id).filter((x): x is string => x != null))];
    
    let profilesMap: Record<string, { id: string; name: string; username: string | null }> = {};
    
    if (userIds.length > 0) {
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, name, username')
        .in('id', userIds);
      
      profilesMap = (profilesData || []).reduce((acc, p) => {
        acc[p.id] = p;
        return acc;
      }, {} as Record<string, { id: string; name: string; username: string | null }>);
    }

    // Merge profiles into enrolments
    const enrichedEnrolments = (enrolmentsData || []).map(e => ({
      ...e,
      profiles: e.client_user_id ? profilesMap[e.client_user_id] || null : null
    }));

    setEnrolments(enrichedEnrolments as Enrolment[]);
    setLoading(false);
  }

  // Apply filters
  const filteredEnrolments = enrolments.filter(e => {
    // Status filter
    if (statusFilter !== 'all' && e.status !== statusFilter) return false;
    
    // Program filter
    if (programFilter !== 'all' && e.program_id !== programFilter) return false;
    
    // Search query (client name or email)
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const clientName = e.profiles?.name?.toLowerCase() || '';
      const clientEmail = e.profiles?.username?.toLowerCase() || '';
      if (!clientName.includes(query) && !clientEmail.includes(query)) return false;
    }
    
    // Date range filter (based on created_at)
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      const enrolmentDate = new Date(e.created_at);
      if (enrolmentDate < fromDate) return false;
    }
    
    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      const enrolmentDate = new Date(e.created_at);
      if (enrolmentDate > toDate) return false;
    }
    
    return true;
  });

  // Stats
  const activeCount = enrolments.filter(e => e.status === 'active').length;
  const completedCount = enrolments.filter(e => e.status === 'completed').length;
  const pausedCount = enrolments.filter(e => e.status === 'paused').length;

  function clearFilters() {
    setStatusFilter('all');
    setProgramFilter('all');
    setSearchQuery('');
    setDateFrom('');
    setDateTo('');
  }

  function getStatusVariant(status: string): 'default' | 'secondary' | 'outline' | 'destructive' {
    switch (status) {
      case 'active': return 'default';
      case 'completed': return 'secondary';
      case 'paused': return 'outline';
      case 'cancelled': return 'destructive';
      default: return 'outline';
    }
  }

  function exportToCsv() {
    const headers = ['Client Name', 'Email', 'Programme', 'Status', 'Tier', 'Plan', 'Start Date', 'Enrolled On'];
    const rows = filteredEnrolments.map(e => [
      e.profiles?.name || 'Unknown',
      e.profiles?.username || '',
      e.programs?.name || '',
      e.status,
      e.tier || '',
      e.program_plans?.name || '',
      e.start_date ? format(new Date(e.start_date), 'yyyy-MM-dd') : '',
      format(new Date(e.created_at), 'yyyy-MM-dd')
    ]);
    
    const csvContent = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `enrolments-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Enrolments</h1>
        <p className="text-muted-foreground">View and manage all programme enrolments</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Enrolments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{enrolments.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-600">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-600">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-amber-600">Paused</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pausedCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-2">
              <Label>Search Client</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Programme</Label>
              <Select value={programFilter} onValueChange={setProgramFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Programmes</SelectItem>
                  {programs.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Enrolled From</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Enrolled To</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>
          
          <div className="flex gap-2 mt-4">
            <Button variant="outline" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4 mr-1" />
              Clear Filters
            </Button>
            <Button variant="outline" size="sm" onClick={exportToCsv}>
              <Download className="h-4 w-4 mr-1" />
              Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Enrolments ({filteredEnrolments.length})
          </CardTitle>
          <CardDescription>
            {filteredEnrolments.length !== enrolments.length && 
              `Showing ${filteredEnrolments.length} of ${enrolments.length} enrolments`
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredEnrolments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No enrolments found matching your filters.
            </div>
          ) : (
            <ScrollArea className="w-full whitespace-nowrap">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[180px]">Client</TableHead>
                    <TableHead className="min-w-[150px]">Programme</TableHead>
                    <TableHead className="min-w-[90px]">Status</TableHead>
                    <TableHead className="min-w-[90px]">Tier</TableHead>
                    <TableHead className="min-w-[100px]">Plan</TableHead>
                    <TableHead className="min-w-[110px]">Start Date</TableHead>
                    <TableHead className="min-w-[110px]">Enrolled On</TableHead>
                    <TableHead className="min-w-[120px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEnrolments.map((enrolment) => (
                    <TableRow key={enrolment.id}>
                      <TableCell>
                        <div className="min-w-[180px]">
                          <div className="font-medium truncate">{enrolment.profiles?.name || 'Unknown'}</div>
                          <div className="text-sm text-muted-foreground truncate">{enrolment.profiles?.username}</div>
                        </div>
                      </TableCell>
                      <TableCell className="truncate max-w-[200px]">{enrolment.programs?.name}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(enrolment.status)}>
                          {enrolment.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {enrolment.tier ? (
                          <Badge variant="outline" className="capitalize">{enrolment.tier}</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {enrolment.program_plans ? (
                          <Badge variant="secondary">{enrolment.program_plans.name}</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {enrolment.start_date 
                          ? format(new Date(enrolment.start_date), 'dd MMM yyyy')
                          : <span className="text-muted-foreground">—</span>
                        }
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(enrolment.created_at), 'dd MMM yyyy')}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/admin/clients/${enrolment.client_user_id}`)}
                        >
                          <ExternalLink className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
