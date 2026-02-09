import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Calendar, Mail, CheckCircle, XCircle, Clock, Percent } from 'lucide-react';
import { format } from 'date-fns';

interface Registration {
  id: string;
  user_id: string;
  program_id: string;
  enrollment_timeframe: string;
  scheduled_date_id: string | null;
  status: 'pending' | 'contacted' | 'enrolled' | 'declined';
  notes: string | null;
  created_at: string;
  preferred_tier: string | null;
  completed_modules_elsewhere: any[] | null;
  suggested_discount_percent: number | null;
  profiles: { name: string; is_disabled?: boolean } | null;
  auth_users: { email: string; } | null;
  programs: { name: string; scheduled_dates: any[] } | null;
}

export default function InterestRegistrations() {
  const { toast } = useToast();
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchRegistrations();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('interest-registrations')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'program_interest_registrations'
        },
        () => {
          fetchRegistrations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchRegistrations() {
    const { data, error } = await supabase
      .from('program_interest_registrations')
      .select(`
        *,
        programs (name, scheduled_dates)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching registrations:', error);
      toast({ title: 'Error loading registrations', variant: 'destructive' });
    } else {
      // Get user details from profiles and auth.users
      const registrationsWithDetails = await Promise.all(
        (data || []).map(async (reg: any) => {
          // Use any type for the query response since is_disabled exists but isn't in generated types
          const { data: profileData } = await supabase
            .from('profiles')
            .select('name, username, is_disabled')
            .eq('id', reg.user_id)
            .single() as { data: { name: string; username: string | null; is_disabled: boolean } | null };
          
          return {
            ...reg,
            profiles: profileData ? { name: profileData.name, is_disabled: profileData.is_disabled } : null,
            auth_users: profileData ? { email: profileData.username || '' } : null
          };
        })
      );
      setRegistrations(registrationsWithDetails as Registration[]);
    }
    setLoading(false);
  }

  async function updateStatus(id: string, newStatus: string) {
    const { error } = await supabase
      .from('program_interest_registrations')
      .update({ status: newStatus })
      .eq('id', id);

    if (error) {
      toast({ title: 'Error updating status', variant: 'destructive' });
    } else {
      toast({ title: 'Status updated successfully' });
      fetchRegistrations();
    }
  }

  async function bulkUpdateStatus(newStatus: string) {
    const ids = Array.from(selectedIds);
    const { error } = await supabase
      .from('program_interest_registrations')
      .update({ status: newStatus })
      .in('id', ids);

    if (error) {
      toast({ title: 'Error updating statuses', variant: 'destructive' });
    } else {
      toast({ title: `Updated ${ids.length} registration(s)` });
      setSelectedIds(new Set());
      fetchRegistrations();
    }
  }

  async function bulkEnroll() {
    const ids = Array.from(selectedIds);
    const selectedRegs = registrations.filter(r => selectedIds.has(r.id));

    if (selectedRegs.length === 0) return;

    try {
      // Process each registration
      for (const reg of selectedRegs) {
        // Create client enrollment
        const { error: enrollError } = await supabase
          .from('client_enrollments')
          .insert({
            client_user_id: reg.user_id,
            program_id: reg.program_id,
            status: 'active',
            start_date: new Date().toISOString().split('T')[0],
          });

        if (enrollError) {
          console.error('Error enrolling user:', enrollError);
          toast({ 
            title: `Error enrolling ${reg.profiles?.name || 'user'}`, 
            variant: 'destructive' 
          });
          continue;
        }

        // Update registration status
        await supabase
          .from('program_interest_registrations')
          .update({ status: 'enrolled' })
          .eq('id', reg.id);

        // Update enrolled count if scheduled date exists
        if (reg.enrollment_timeframe === 'scheduled' && reg.scheduled_date_id && reg.programs?.scheduled_dates) {
          const schedules = reg.programs.scheduled_dates as any[];
          const updatedSchedules = schedules.map((s: any) => {
            if (s.id === reg.scheduled_date_id) {
              return {
                ...s,
                enrolled_count: (s.enrolled_count || 0) + 1,
              };
            }
            return s;
          });

          await supabase
            .from('programs')
            .update({ scheduled_dates: updatedSchedules })
            .eq('id', reg.program_id);
        }

        // Send enrollment notification email only if user is not disabled
        const userName = reg.profiles?.name || 'User';
        const userEmail = reg.auth_users?.email;
        const userDisabled = reg.profiles?.is_disabled;
        const programName = reg.programs?.name || 'Unknown Program';

        if (userEmail && !userDisabled) {
          await supabase.functions.invoke('send-notification-email', {
            body: {
              email: userEmail,
              name: userName,
              type: 'program_assignment',
              timestamp: new Date().toISOString(),
              programName,
              programDescription: '',
            },
          });
        }
      }

      toast({ 
        title: `Successfully enrolled ${selectedRegs.length} user(s)`,
        description: 'Enrollment notifications have been sent',
      });
      setSelectedIds(new Set());
      fetchRegistrations();
    } catch (error) {
      console.error('Error in bulk enrollment:', error);
      toast({ title: 'Error processing bulk enrollment', variant: 'destructive' });
    }
  }

  function toggleSelection(id: string) {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedIds(newSelection);
  }

  function toggleSelectAll() {
    if (selectedIds.size === filteredRegistrations.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredRegistrations.map(r => r.id)));
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'contacted': return <Mail className="h-4 w-4" />;
      case 'enrolled': return <CheckCircle className="h-4 w-4" />;
      case 'declined': return <XCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'contacted': return 'bg-primary/10 text-primary';
      case 'enrolled': return 'bg-success/10 text-success';
      case 'declined': return 'bg-destructive/10 text-destructive';
      default: return 'bg-warning/10 text-warning';
    }
  };

  const getTimeframeDisplay = (reg: Registration) => {
    if (reg.enrollment_timeframe === 'scheduled' && reg.scheduled_date_id && reg.programs?.scheduled_dates) {
      const schedule = reg.programs.scheduled_dates.find((s: any) => s.id === reg.scheduled_date_id);
      if (schedule) {
        return `${schedule.title || 'Scheduled'} - ${format(new Date(schedule.date), 'MMM dd, yyyy')}`;
      }
    }
    switch (reg.enrollment_timeframe) {
      case 'asap': return 'As Soon As Possible';
      case '1-3_months': return '1-3 Months';
      default: return reg.enrollment_timeframe;
    }
  };

  const filteredRegistrations = registrations.filter(reg => 
    statusFilter === 'all' || reg.status === statusFilter
  );

  if (loading) return <div className="flex items-center justify-center h-96">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Program Interest Registrations</h1>
          <p className="text-muted-foreground">Manage user interest in programs</p>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="contacted">Contacted</SelectItem>
            <SelectItem value="enrolled">Enrolled</SelectItem>
            <SelectItem value="declined">Declined</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {selectedIds.size > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium">{selectedIds.size} selected</span>
              <div className="flex gap-2">
                <Button size="sm" onClick={bulkEnroll}>
                  Enroll Selected
                </Button>
                <Button size="sm" variant="outline" onClick={() => bulkUpdateStatus('contacted')}>
                  Mark Contacted
                </Button>
                <Button size="sm" variant="outline" onClick={() => bulkUpdateStatus('declined')}>
                  Mark Declined
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Registrations</CardTitle>
          <CardDescription>
            {filteredRegistrations.length} registration{filteredRegistrations.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedIds.size === filteredRegistrations.length && filteredRegistrations.length > 0}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Program</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Timeframe</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Registered</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRegistrations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                    No registrations found
                  </TableCell>
                </TableRow>
              ) : (
                filteredRegistrations.map((reg) => (
                  <TableRow key={reg.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(reg.id)}
                        onCheckedChange={() => toggleSelection(reg.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      {reg.profiles?.name || 'Unknown'}
                    </TableCell>
                    <TableCell>{reg.auth_users?.email || 'N/A'}</TableCell>
                    <TableCell>{reg.programs?.name || 'Unknown Program'}</TableCell>
                    <TableCell>
                      {reg.preferred_tier ? (
                        <Badge variant="outline">{reg.preferred_tier}</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <TooltipProvider>
                        {reg.suggested_discount_percent && reg.suggested_discount_percent > 0 ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="secondary" className="bg-green-500/10 text-green-600 border-green-500/20">
                                <Percent className="h-3 w-3 mr-1" />
                                {reg.suggested_discount_percent}%
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="font-medium mb-1">
                                {(reg.completed_modules_elsewhere as any[])?.length || 0} modules completed elsewhere
                              </p>
                              <ul className="text-xs space-y-0.5">
                                {(reg.completed_modules_elsewhere as any[])?.slice(0, 5).map((m: any, i: number) => (
                                  <li key={i}>• {m.moduleTitle} ({m.completedInProgram})</li>
                                ))}
                                {((reg.completed_modules_elsewhere as any[])?.length || 0) > 5 && (
                                  <li>...and {(reg.completed_modules_elsewhere as any[]).length - 5} more</li>
                                )}
                              </ul>
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TooltipProvider>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{getTimeframeDisplay(reg)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getStatusColor(reg.status)}>
                        <span className="flex items-center gap-1">
                          {getStatusIcon(reg.status)}
                          {reg.status}
                        </span>
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(reg.created_at), 'MMM dd, yyyy')}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={reg.status}
                        onValueChange={(value) => updateStatus(reg.id, value)}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="contacted">Contacted</SelectItem>
                          <SelectItem value="enrolled">Enrolled</SelectItem>
                          <SelectItem value="declined">Declined</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}