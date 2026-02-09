import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Settings, Pencil, Trash2, UserX, UserCheck, Copy, Check, Mail, Bell, BellOff, EyeOff, Eye, ArrowRightLeft } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

function UserIdCell({ userId }: { userId: string }) {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = async () => {
    await navigator.clipboard.writeText(userId);
    setCopied(true);
    toast.success('User ID copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground transition-colors max-w-[120px]"
          >
            <span className="truncate">{userId.slice(0, 8)}...</span>
            {copied ? (
              <Check className="h-3 w-3 text-green-500 shrink-0" />
            ) : (
              <Copy className="h-3 w-3 shrink-0" />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="font-mono text-xs">
          <p>{userId}</p>
          <p className="text-muted-foreground mt-1">Click to copy</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface User {
  id: string;
  name: string;
  email: string;
  realEmail?: string | null;
  isPlaceholder?: boolean;
  isHidden?: boolean;
  roles: string[];
  qualifications: string[];
  isDisabled?: boolean;
  notificationsEnabled?: boolean;
}

interface ModuleType {
  id: string;
  name: string;
  description: string | null;
}

export default function UsersManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [moduleTypes, setModuleTypes] = useState<ModuleType[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [qualificationsOpen, setQualificationsOpen] = useState(false);
  const [disableDialogOpen, setDisableDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedQualifications, setSelectedQualifications] = useState<string[]>([]);
  const [createAsInactive, setCreateAsInactive] = useState(false);
  const [createAsPlaceholder, setCreateAsPlaceholder] = useState(false);
  const [realEmail, setRealEmail] = useState('');
  const [initialPassword, setInitialPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [sendingWelcome, setSendingWelcome] = useState<string | null>(null);
  const [togglingNotifications, setTogglingNotifications] = useState<string | null>(null);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [transferTargetId, setTransferTargetId] = useState('');
  const [deleteAfterTransfer, setDeleteAfterTransfer] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [togglingHidden, setTogglingHidden] = useState<string | null>(null);

  const availableRoles = ['admin', 'instructor', 'coach', 'client'];

  async function fetchUsers() {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, username, real_email, is_hidden');

    if (profiles) {
      const enrichedUsers = await Promise.all(
        profiles.map(async (profile) => {
          // Fetch roles, qualifications, email in parallel
          const [rolesResult, qualificationsResult, notifPrefsResult, emailResult] = await Promise.all([
            supabase
              .from('user_roles')
              .select('role')
              .eq('user_id', profile.id),
            supabase
              .from('user_qualifications')
              .select('module_type_id, module_types(name)')
              .eq('user_id', profile.id),
            supabase
              .from('notification_preferences')
              .select('program_assignments, session_scheduled, session_requests')
              .eq('user_id', profile.id)
              .single(),
            // Fetch email from auth.users via edge function
            supabase.functions.invoke('get-user-email', {
              body: { userId: profile.id }
            }).catch(() => ({ data: null }))
          ]);

          const roles = rolesResult.data;
          const qualifications = qualificationsResult.data;
          const notifPrefs = notifPrefsResult.data;
          const authEmail = emailResult?.data?.email || profile.username || 'N/A';
          const isDisabled = emailResult?.data?.isDisabled === true;
          
          // Detect if this is a placeholder user (system email format)
          const isPlaceholder = authEmail.includes('@system.internal') || authEmail.includes('placeholder_');

          // Consider notifications enabled if key preferences are on
          const notificationsEnabled = notifPrefs 
            ? (notifPrefs.program_assignments || notifPrefs.session_scheduled || notifPrefs.session_requests)
            : true; // Default to true if no prefs exist

          return {
            id: profile.id,
            name: profile.name,
            email: authEmail,
            realEmail: profile.real_email,
            isPlaceholder,
            isHidden: profile.is_hidden || false,
            isDisabled,
            roles: roles?.map(r => r.role) || [],
            qualifications: qualifications?.map(q => (q.module_types as any)?.name).filter(Boolean) || [],
            notificationsEnabled,
          };
        })
      );

      setUsers(enrichedUsers as User[]);
    }

    const { data: types } = await supabase
      .from('module_types')
      .select('*')
      .order('name');
    
    if (types) setModuleTypes(types);

    setLoading(false);
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  async function sendWelcomeEmail(user: User) {
    if (user.email === 'N/A') {
      toast.error('User has no email address');
      return;
    }

    setSendingWelcome(user.id);
    try {
      const { data, error } = await supabase.functions.invoke('send-welcome-email', {
        body: { userId: user.id }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`Welcome email sent to ${user.email}`);
    } catch (error: any) {
      toast.error(`Failed to send welcome email: ${error.message}`);
    } finally {
      setSendingWelcome(null);
    }
  }

  async function toggleNotifications(user: User) {
    setTogglingNotifications(user.id);
    const newValue = !user.notificationsEnabled;

    try {
      const { error } = await supabase
        .from('notification_preferences')
        .upsert({
          user_id: user.id,
          program_assignments: newValue,
          session_scheduled: newValue,
          session_requests: newValue,
          profile_updates: newValue,
          password_changes: newValue,
          email_changes: newValue,
          program_completions: newValue,
          instructor_program_assignments: newValue,
          instructor_module_assignments: newValue,
          coach_program_assignments: newValue,
          coach_module_assignments: newValue,
        }, { onConflict: 'user_id' });

      if (error) throw error;

      // Update local state
      setUsers(users.map(u => 
        u.id === user.id ? { ...u, notificationsEnabled: newValue } : u
      ));

      toast.success(`Notifications ${newValue ? 'enabled' : 'disabled'} for ${user.name}`);
    } catch (error: any) {
      toast.error(`Failed to update notifications: ${error.message}`);
    } finally {
      setTogglingNotifications(null);
    }
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);

    try {
      // Use admin-provided password or generate random one
      const password = initialPassword || Math.random().toString(36).slice(-8);
      
      // Generate a system email for placeholder users
      const finalEmail = createAsPlaceholder 
        ? `placeholder_${crypto.randomUUID()}@system.internal`
        : email;
      
      // Use edge function to create user via admin API (doesn't affect current session)
      const { data, error: fnError } = await supabase.functions.invoke('create-admin-user', {
        body: { 
          email: finalEmail, 
          password, 
          name,
          roles: selectedRoles,
          isPlaceholder: createAsPlaceholder,
          realEmail: createAsPlaceholder ? realEmail : undefined
        }
      });

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      if (!data?.user) throw new Error('User creation failed');

      const newUserId = data.user.id;

      // If client role is selected, create client profile
      if (selectedRoles.includes('client')) {
        const { error: profileError } = await supabase
          .from('client_profiles')
          .insert({ user_id: newUserId, status: createAsInactive || createAsPlaceholder ? 'inactive' : 'active' });

        if (profileError) throw profileError;
      }

      // If created as inactive or placeholder, disable the user via edge function
      if (createAsInactive || createAsPlaceholder) {
        const { error: disableError } = await supabase.functions.invoke('delete-user', {
          body: { userId: newUserId, action: 'disable' }
        });
        if (disableError) {
          console.error('Failed to disable user:', disableError);
          toast.error('User created but failed to disable. Please manually disable the user.');
        }
      }

      const message = createAsPlaceholder 
        ? `Placeholder user "${name}" created successfully!`
        : initialPassword 
          ? 'User created with the password you provided!'
          : `User created! Generated password: ${password}`;
      toast.success(message);
      
      setOpen(false);
      setName('');
      setEmail('');
      setRealEmail('');
      setInitialPassword('');
      setSelectedRoles([]);
      setCreateAsInactive(false);
      setCreateAsPlaceholder(false);
      fetchUsers();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleUpdateQualifications() {
    if (!selectedUser) return;

    try {
      // Delete existing qualifications
      await supabase
        .from('user_qualifications')
        .delete()
        .eq('user_id', selectedUser.id);

      // Insert new qualifications
      if (selectedQualifications.length > 0) {
        const { error } = await supabase
          .from('user_qualifications')
          .insert(
            selectedQualifications.map(typeId => ({
              user_id: selectedUser.id,
              module_type_id: typeId,
            }))
          );

        if (error) throw error;
      }

      toast.success('Qualifications updated successfully');
      setQualificationsOpen(false);
      fetchUsers();
    } catch (error: any) {
      toast.error(error.message);
    }
  }

  function openQualificationsDialog(user: User) {
    setSelectedUser(user);
    const userTypeIds = moduleTypes
      .filter(type => user.qualifications.includes(type.name))
      .map(type => type.id);
    setSelectedQualifications(userTypeIds);
    setQualificationsOpen(true);
  }

  function openEditDialog(user: User) {
    setSelectedUser(user);
    setName(user.name);
    setEmail(user.email);
    setSelectedRoles(user.roles);
    setNewPassword('');
    setEditOpen(true);
  }

  async function handleUpdateUser(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUser) return;
    setUpdating(true);

    try {
      // Update email and/or password via edge function
      if (email !== selectedUser.email || newPassword) {
        const { data, error: updateError } = await supabase.functions.invoke('update-user-email', {
          body: { 
            targetUserId: selectedUser.id,
            newEmail: email !== selectedUser.email ? email : undefined,
            newPassword: newPassword || undefined
          }
        });
        
        // Handle edge function errors - check both the function error and the response data
        if (updateError) throw updateError;
        if (data?.error) throw new Error(data.error);
      }

      // Update name in profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ name })
        .eq('id', selectedUser.id);
      
      if (profileError) throw profileError;

      // Update roles - only delete roles that are being removed and add new ones
      // This prevents the admin from losing their own admin role during the update
      const existingRoles = selectedUser.roles || [];
      const rolesToRemove = existingRoles.filter(role => !selectedRoles.includes(role));
      const rolesToAdd = selectedRoles.filter(role => !existingRoles.includes(role));
      
      // Delete roles that are being removed
      if (rolesToRemove.length > 0) {
        const { error: deleteError } = await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', selectedUser.id)
          .in('role', rolesToRemove as ('admin' | 'client' | 'coach' | 'instructor')[]);
        
        if (deleteError) throw deleteError;
      }

      // Insert new roles
      if (rolesToAdd.length > 0) {
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert(rolesToAdd.map(role => ({ 
            user_id: selectedUser.id, 
            role: role as 'admin' | 'client' | 'coach' | 'instructor'
          })));

        if (roleError) throw roleError;
      }

      // Update client profile if needed
      const hasClientRole = selectedRoles.includes('client');
      const hadClientRole = selectedUser.roles.includes('client');

      if (hasClientRole && !hadClientRole) {
        // Create client profile
        await supabase
          .from('client_profiles')
          .insert({ user_id: selectedUser.id, status: 'active' });
      } else if (!hasClientRole && hadClientRole) {
        // Delete client profile
        await supabase
          .from('client_profiles')
          .delete()
          .eq('user_id', selectedUser.id);
      }

      toast.success('User updated successfully');
      setEditOpen(false);
      fetchUsers();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setUpdating(false);
    }
  }

  function openDeleteDialog(user: User) {
    setSelectedUser(user);
    setDeleteOpen(true);
  }

  async function handleDeleteUser() {
    if (!selectedUser) return;
    setDeleting(true);

    try {
      const { error } = await supabase.functions.invoke('delete-user', {
        body: { userId: selectedUser.id }
      });

      if (error) throw error;

      toast.success('User deleted successfully');
      setDeleteOpen(false);
      fetchUsers();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setDeleting(false);
    }
  }

  async function toggleUserStatus(user: User) {
    setSelectedUser(user);
    setTogglingStatus(true);

    try {
      const action = user.isDisabled ? 'enable' : 'disable';
      const { error } = await supabase.functions.invoke('delete-user', {
        body: { userId: user.id, action }
      });

      if (error) throw error;

      toast.success(`User ${action}d successfully`);
      fetchUsers();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setTogglingStatus(false);
      setSelectedUser(null);
    }
  }

  async function toggleHidden(user: User) {
    setTogglingHidden(user.id);
    const newValue = !user.isHidden;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_hidden: newValue })
        .eq('id', user.id);

      if (error) throw error;

      // Update local state
      setUsers(users.map(u => 
        u.id === user.id ? { ...u, isHidden: newValue } : u
      ));

      toast.success(`User ${newValue ? 'hidden from' : 'visible to'} auto-transfer`);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setTogglingHidden(null);
    }
  }

  function openTransferDialog(user: User) {
    setSelectedUser(user);
    setTransferTargetId('');
    setDeleteAfterTransfer(false);
    setTransferDialogOpen(true);
  }

  async function handleTransfer() {
    if (!selectedUser || !transferTargetId) return;
    setTransferring(true);

    try {
      const { data, error } = await supabase.functions.invoke('transfer-placeholder-data', {
        body: {
          placeholderUserId: selectedUser.id,
          targetUserId: transferTargetId,
          deleteAfterTransfer
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const transferred = data?.transferred || {};
      const summary = Object.entries(transferred)
        .filter(([, count]) => (count as number) > 0)
        .map(([key, count]) => `${key}: ${count}`)
        .join(', ');

      toast.success(`Data transferred successfully! ${summary || 'No data to transfer'}`);
      setTransferDialogOpen(false);
      fetchUsers();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setTransferring(false);
    }
  }

  // Get potential transfer targets (non-placeholder users whose email matches a placeholder's realEmail)
  function getMatchingTargets(placeholderUser: User): User[] {
    if (!placeholderUser.realEmail) return [];
    return users.filter(u => 
      u.id !== placeholderUser.id && 
      !u.isPlaceholder && 
      u.email.toLowerCase() === placeholderUser.realEmail?.toLowerCase()
    );
  }

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Users Management</h1>
        <Dialog open={open} onOpenChange={(isOpen) => {
          setOpen(isOpen);
          // Reset form when dialog opens to prevent stale data from previous views
          if (isOpen) {
            setName('');
            setEmail('');
            setRealEmail('');
            setInitialPassword('');
            setSelectedRoles([]);
            setCreateAsInactive(false);
            setCreateAsPlaceholder(false);
          }
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New User</DialogTitle>
              <DialogDescription>
                Add a new user to the system. A random password will be generated.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="flex items-center space-x-2 pb-2 border-b">
                <Checkbox
                  id="createAsPlaceholder"
                  checked={createAsPlaceholder}
                  onCheckedChange={(checked) => {
                    setCreateAsPlaceholder(checked === true);
                    if (checked) {
                      setEmail(''); // Clear email when switching to placeholder mode
                    }
                  }}
                />
                <Label htmlFor="createAsPlaceholder" className="cursor-pointer font-medium">
                  Create as placeholder (no real email yet)
                </Label>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              
              {createAsPlaceholder ? (
                <div className="space-y-2">
                  <Label htmlFor="realEmail">Real Email (for your tracking, optional)</Label>
                  <Input
                    id="realEmail"
                    type="email"
                    value={realEmail}
                    onChange={(e) => setRealEmail(e.target.value)}
                    placeholder="client@example.com"
                  />
                  <p className="text-xs text-muted-foreground">
                    A system email will be generated. Store the real email here for reference.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              )}
              
              {!createAsPlaceholder && (
                <div className="space-y-2">
                  <Label htmlFor="initialPassword">Initial Password (optional)</Label>
                  <Input
                    id="initialPassword"
                    type="password"
                    value={initialPassword}
                    onChange={(e) => setInitialPassword(e.target.value)}
                    placeholder="Leave empty to auto-generate"
                    minLength={6}
                  />
                  <p className="text-xs text-muted-foreground">
                    Set a password for the user. They can change it later.
                  </p>
                </div>
              )}
              
              <div className="space-y-2">
                <Label>Roles</Label>
                <div className="space-y-2">
                  {availableRoles.map((role) => (
                    <div key={role} className="flex items-center space-x-2">
                      <Checkbox
                        id={role}
                        checked={selectedRoles.includes(role)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedRoles([...selectedRoles, role]);
                          } else {
                            setSelectedRoles(selectedRoles.filter(r => r !== role));
                          }
                        }}
                      />
                      <Label htmlFor={role} className="capitalize cursor-pointer">
                        {role}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
              
              {!createAsPlaceholder && (
                <div className="flex items-center space-x-2 pt-2">
                  <Checkbox
                    id="createAsInactive"
                    checked={createAsInactive}
                    onCheckedChange={(checked) => setCreateAsInactive(checked === true)}
                  />
                  <Label htmlFor="createAsInactive" className="cursor-pointer text-muted-foreground">
                    Create as inactive (user will be disabled)
                  </Label>
                </div>
              )}
              
              <Button type="submit" disabled={creating} className="w-full">
                {creating ? 'Creating...' : createAsPlaceholder ? 'Create Placeholder' : 'Create User'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>Manage users and their roles</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Notifications</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Qualifications</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id} className={user.isDisabled ? 'opacity-60' : ''}>
                  <TableCell>
                    <UserIdCell userId={user.id} />
                  </TableCell>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>
                    {user.isPlaceholder ? (
                      <div className="space-y-1">
                        <Badge variant="secondary" className="text-xs">Placeholder</Badge>
                        {user.realEmail && (
                          <div className="text-sm">{user.realEmail}</div>
                        )}
                        {!user.realEmail && (
                          <span className="text-muted-foreground text-xs">No email tracked</span>
                        )}
                      </div>
                    ) : (
                      user.email
                    )}
                  </TableCell>
                  <TableCell>
                    {user.isDisabled ? (
                      <Badge variant="destructive">Disabled</Badge>
                    ) : (
                      <Badge variant="default" className="bg-green-600">Active</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {user.notificationsEnabled ? (
                      <Badge variant="outline" className="text-green-600 border-green-600">Enabled</Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">Disabled</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {user.roles.map(role => (
                        <Badge key={role} variant="outline" className="capitalize">
                          {role}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {user.qualifications.length > 0 ? (
                        user.qualifications.map(qual => (
                          <Badge key={qual} variant="outline">
                            {qual}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-muted-foreground text-sm">None</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2 flex-wrap">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => sendWelcomeEmail(user)}
                              disabled={sendingWelcome === user.id || user.email === 'N/A'}
                              className="text-blue-600 border-blue-600 hover:bg-blue-50"
                            >
                              <Mail className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Send Welcome Email</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => toggleNotifications(user)}
                              disabled={togglingNotifications === user.id}
                              className={user.notificationsEnabled 
                                ? "text-amber-600 border-amber-600 hover:bg-amber-50" 
                                : "text-gray-600 border-gray-600 hover:bg-gray-50"}
                            >
                              {user.notificationsEnabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {user.notificationsEnabled ? 'Disable Notifications' : 'Enable Notifications'}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      {user.isDisabled ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleUserStatus(user)}
                          disabled={togglingStatus && selectedUser?.id === user.id}
                          className="text-green-600 border-green-600 hover:bg-green-50"
                        >
                          <UserCheck className="mr-2 h-4 w-4" />
                          Enable
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleUserStatus(user)}
                          disabled={togglingStatus && selectedUser?.id === user.id}
                          className="text-orange-600 border-orange-600 hover:bg-orange-50"
                        >
                          <UserX className="mr-2 h-4 w-4" />
                          Disable
                        </Button>
                      )}
                      {user.isPlaceholder && (
                        <>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => toggleHidden(user)}
                                  disabled={togglingHidden === user.id}
                                  className={user.isHidden 
                                    ? "text-muted-foreground border-muted" 
                                    : "text-primary border-primary"}
                                >
                                  {user.isHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                {user.isHidden ? 'Hidden from auto-transfer (click to show)' : 'Visible to auto-transfer (click to hide)'}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openTransferDialog(user)}
                                  disabled={!user.realEmail}
                                  className="text-primary border-primary"
                                >
                                  <ArrowRightLeft className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                {user.realEmail ? 'Transfer data to matching user' : 'Set real email first to enable transfer'}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(user)}
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openQualificationsDialog(user)}
                      >
                        <Settings className="mr-2 h-4 w-4" />
                        Qualifications
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => openDeleteDialog(user)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent key={selectedUser?.id} className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user information, roles, and password
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateUser} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-password">New Password (leave blank to keep current)</Label>
              <Input
                id="edit-password"
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password or leave blank"
              />
            </div>
            <div className="space-y-2">
              <Label>Roles</Label>
              <div className="space-y-2">
                {availableRoles.map((role) => (
                  <div key={role} className="flex items-center space-x-2">
                    <Checkbox
                      id={`edit-${role}`}
                      checked={selectedRoles.includes(role)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedRoles([...selectedRoles, role]);
                        } else {
                          setSelectedRoles(selectedRoles.filter(r => r !== role));
                        }
                      }}
                    />
                    <Label htmlFor={`edit-${role}`} className="capitalize cursor-pointer">
                      {role}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
            <Button type="submit" disabled={updating} className="w-full">
              {updating ? 'Updating...' : 'Update User'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={qualificationsOpen} onOpenChange={setQualificationsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Qualifications for {selectedUser?.name}</DialogTitle>
            <DialogDescription>
              Select which module types this user can be assigned to
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[400px] pr-4">
            <div className="space-y-4">
              {moduleTypes.map((type) => (
                <div key={type.id} className="flex items-start space-x-2">
                  <Checkbox
                    id={type.id}
                    checked={selectedQualifications.includes(type.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedQualifications([...selectedQualifications, type.id]);
                      } else {
                        setSelectedQualifications(selectedQualifications.filter(id => id !== type.id));
                      }
                    }}
                  />
                  <div className="grid gap-1.5 leading-none">
                    <Label htmlFor={type.id} className="capitalize cursor-pointer font-medium">
                      {type.name}
                    </Label>
                    {type.description && (
                      <p className="text-sm text-muted-foreground">{type.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
          <Button onClick={handleUpdateQualifications} className="w-full">
            Save Qualifications
          </Button>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedUser?.name}? This action cannot be undone and will remove all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Deleting...' : 'Delete User'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Transfer Placeholder Data Dialog */}
      <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer Placeholder Data</DialogTitle>
            <DialogDescription>
              Transfer all data from placeholder user "{selectedUser?.name}" to an active user account.
              {selectedUser?.realEmail && (
                <span className="block mt-1 text-sm">
                  Looking for users matching: <strong>{selectedUser.realEmail}</strong>
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="transfer-target">Transfer to</Label>
              {selectedUser && getMatchingTargets(selectedUser).length > 0 ? (
                <Select value={transferTargetId} onValueChange={setTransferTargetId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a user to transfer data to" />
                  </SelectTrigger>
                  <SelectContent>
                    {getMatchingTargets(selectedUser).map(target => (
                      <SelectItem key={target.id} value={target.id}>
                        {target.name} ({target.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    No matching users found with email "{selectedUser?.realEmail}". 
                    You can manually enter a user ID:
                  </p>
                  <Input
                    id="transfer-target"
                    value={transferTargetId}
                    onChange={(e) => setTransferTargetId(e.target.value)}
                    placeholder="Enter target user ID"
                  />
                </div>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="delete-after-transfer"
                checked={deleteAfterTransfer}
                onCheckedChange={(checked) => setDeleteAfterTransfer(checked === true)}
              />
              <Label htmlFor="delete-after-transfer" className="cursor-pointer">
                Delete placeholder user after transfer
              </Label>
            </div>
            <div className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
              <strong>Data to transfer:</strong>
              <ul className="list-disc list-inside mt-1 space-y-0.5">
                <li>Program enrollments & progress</li>
                <li>Capability assessments</li>
                <li>Badges & credentials</li>
                <li>Coach/instructor relationships</li>
                <li>Client profile notes</li>
              </ul>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setTransferDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleTransfer} 
                disabled={transferring || !transferTargetId}
              >
                {transferring ? 'Transferring...' : 'Transfer Data'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
