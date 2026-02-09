import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, ExternalLink, Copy, Eye, Link2 } from 'lucide-react';
import { Json } from '@/integrations/supabase/types';

interface Feature {
  icon: string;
  title: string;
  description: string;
}

interface AuthContext {
  id: string;
  slug: string;
  public_code: string | null;
  context_type: string;
  headline: string;
  subheadline: string | null;
  description: string | null;
  features: Feature[] | null;
  logo_url: string | null;
  primary_color: string | null;
  program_id: string | null;
  track_id: string | null;
  organization_id: string | null;
  default_to_signup: boolean | null;
  auto_enroll_program: boolean | null;
  auto_assign_track: boolean | null;
  allow_slug_access: boolean;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

const CONTEXT_TYPES = ['program', 'track', 'organization', 'custom'] as const;

const AVAILABLE_ICONS = [
  'Target', 'Users', 'TrendingUp', 'Sparkles', 'BookOpen', 'Award', 
  'Briefcase', 'Heart', 'Star', 'Zap', 'Shield', 'Compass',
  'GraduationCap', 'Lightbulb', 'Rocket', 'Brain'
];

export default function AuthContexts() {
  const queryClient = useQueryClient();
  const [editingContext, setEditingContext] = useState<AuthContext | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Fetch all contexts
  const { data: contexts, isLoading } = useQuery({
    queryKey: ['auth-contexts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('auth_contexts')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Transform features from Json to Feature[]
      return (data || []).map(ctx => ({
        ...ctx,
        features: Array.isArray(ctx.features) ? (ctx.features as unknown as Feature[]) : null
      })) as AuthContext[];
    }
  });

  // Fetch programs for dropdown
  const { data: programs } = useQuery({
    queryKey: ['programs-for-auth-contexts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('programs')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    }
  });

  // Fetch tracks for dropdown
  const { data: tracks } = useQuery({
    queryKey: ['tracks-for-auth-contexts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tracks')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    }
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (context: Partial<AuthContext> & { id?: string }) => {
      const featuresJson = context.features as unknown as Json;
      
      if (context.id && !isCreating) {
        const { error } = await supabase
          .from('auth_contexts')
          .update({
            ...context,
            features: featuresJson,
            updated_at: new Date().toISOString()
          })
          .eq('id', context.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('auth_contexts')
          .insert({
            slug: context.slug!,
            context_type: context.context_type!,
            headline: context.headline!,
            subheadline: context.subheadline,
            description: context.description,
            features: featuresJson,
            logo_url: context.logo_url,
            primary_color: context.primary_color,
            program_id: context.program_id,
            track_id: context.track_id,
            default_to_signup: context.default_to_signup,
            auto_enroll_program: context.auto_enroll_program,
            auto_assign_track: context.auto_assign_track,
            allow_slug_access: context.allow_slug_access ?? false,
            is_active: context.is_active ?? true
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth-contexts'] });
      toast.success(isCreating ? 'Context created' : 'Context updated');
      setIsDialogOpen(false);
      setEditingContext(null);
      setIsCreating(false);
    },
    onError: (error) => {
      toast.error(`Failed to save: ${error.message}`);
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('auth_contexts')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth-contexts'] });
      toast.success('Context deleted');
    },
    onError: (error) => {
      toast.error(`Failed to delete: ${error.message}`);
    }
  });

  const handleEdit = (context: AuthContext) => {
    setEditingContext({ ...context });
    setIsCreating(false);
    setIsDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingContext({
      id: '',
      slug: '',
      public_code: null,
      context_type: 'custom',
      headline: '',
      subheadline: null,
      description: null,
      features: [
        { icon: 'Target', title: '', description: '' },
        { icon: 'Users', title: '', description: '' },
        { icon: 'TrendingUp', title: '', description: '' },
        { icon: 'Sparkles', title: '', description: '' }
      ],
      logo_url: null,
      primary_color: null,
      program_id: null,
      track_id: null,
      organization_id: null,
      default_to_signup: false,
      auto_enroll_program: false,
      auto_assign_track: false,
      allow_slug_access: false,
      is_active: true,
      created_at: null,
      updated_at: null
    });
    setIsCreating(true);
    setIsDialogOpen(true);
  };

  const copyUrl = (context: AuthContext) => {
    // Use public_code by default, fall back to slug if allow_slug_access is enabled
    const ref = context.public_code || context.slug;
    const url = `${window.location.origin}/auth?ref=${ref}`;
    navigator.clipboard.writeText(url);
    toast.success('URL copied to clipboard');
  };

  const previewContext = (context: AuthContext) => {
    const ref = context.public_code || context.slug;
    window.open(`/auth?ref=${ref}`, '_blank');
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Link2 className="h-6 w-6" />
            Auth Context Pages
          </h1>
          <p className="text-muted-foreground">
            Manage personalized landing pages for different audiences
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          New Context
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Contexts</CardTitle>
          <CardDescription>
            Each context creates a unique URL like <code>/auth?ref=your-slug</code>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : contexts?.length === 0 ? (
            <p className="text-muted-foreground">No contexts yet. Create your first one!</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Slug</TableHead>
                  <TableHead>Headline</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contexts?.map((ctx) => (
                  <TableRow key={ctx.id}>
                    <TableCell className="font-mono text-sm">{ctx.slug}</TableCell>
                    <TableCell className="max-w-xs truncate">{ctx.headline}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{ctx.context_type}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={ctx.is_active ? 'default' : 'secondary'}>
                        {ctx.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" onClick={() => previewContext(ctx)} title="Preview">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => copyUrl(ctx)} title="Copy URL">
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(ctx)} title="Edit">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => {
                          if (confirm('Delete this context?')) {
                            deleteMutation.mutate(ctx.id);
                          }
                        }}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isCreating ? 'Create Context' : 'Edit Context'}</DialogTitle>
            <DialogDescription>
              Customize the content shown on the auth page for this context
            </DialogDescription>
          </DialogHeader>

          {editingContext && (
            <Tabs defaultValue="content" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="content">Content</TabsTrigger>
                <TabsTrigger value="features">Feature Cards</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
              </TabsList>

              <TabsContent value="content" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="slug">Slug (URL identifier)</Label>
                    <Input
                      id="slug"
                      value={editingContext.slug}
                      onChange={(e) => setEditingContext({ ...editingContext, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
                      placeholder="my-program"
                      disabled={!isCreating}
                    />
                    <p className="text-xs text-muted-foreground">
                      URL: /auth?ref={editingContext.slug || 'your-slug'}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="context_type">Context Type</Label>
                    <Select
                      value={editingContext.context_type}
                      onValueChange={(v) => setEditingContext({ ...editingContext, context_type: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CONTEXT_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="headline">Headline</Label>
                  <Input
                    id="headline"
                    value={editingContext.headline}
                    onChange={(e) => setEditingContext({ ...editingContext, headline: e.target.value })}
                    placeholder="Your journey starts here"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subheadline">Subheadline</Label>
                  <Input
                    id="subheadline"
                    value={editingContext.subheadline || ''}
                    onChange={(e) => setEditingContext({ ...editingContext, subheadline: e.target.value || null })}
                    placeholder="A short tagline"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={editingContext.description || ''}
                    onChange={(e) => setEditingContext({ ...editingContext, description: e.target.value || null })}
                    placeholder="Longer description text..."
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="logo_url">Logo URL (optional)</Label>
                    <Input
                      id="logo_url"
                      value={editingContext.logo_url || ''}
                      onChange={(e) => setEditingContext({ ...editingContext, logo_url: e.target.value || null })}
                      placeholder="https://..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="primary_color">Primary Color (optional)</Label>
                    <Input
                      id="primary_color"
                      value={editingContext.primary_color || ''}
                      onChange={(e) => setEditingContext({ ...editingContext, primary_color: e.target.value || null })}
                      placeholder="#3B82F6"
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="features" className="space-y-4 mt-4">
                <p className="text-sm text-muted-foreground">
                  Configure the 4 feature cards shown on the landing page
                </p>
                
                {editingContext.features?.map((feature, index) => (
                  <Card key={index} className="p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] gap-4">
                      <div className="space-y-2">
                        <Label>Icon</Label>
                        <Select
                          value={feature.icon}
                          onValueChange={(v) => {
                            const newFeatures = [...(editingContext.features || [])];
                            newFeatures[index] = { ...newFeatures[index], icon: v };
                            setEditingContext({ ...editingContext, features: newFeatures });
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {AVAILABLE_ICONS.map((icon) => (
                              <SelectItem key={icon} value={icon}>{icon}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <Label>Title</Label>
                          <Input
                            value={feature.title}
                            onChange={(e) => {
                              const newFeatures = [...(editingContext.features || [])];
                              newFeatures[index] = { ...newFeatures[index], title: e.target.value };
                              setEditingContext({ ...editingContext, features: newFeatures });
                            }}
                            placeholder="Feature title"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Description</Label>
                          <Input
                            value={feature.description}
                            onChange={(e) => {
                              const newFeatures = [...(editingContext.features || [])];
                              newFeatures[index] = { ...newFeatures[index], description: e.target.value };
                              setEditingContext({ ...editingContext, features: newFeatures });
                            }}
                            placeholder="Brief description"
                          />
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </TabsContent>

              <TabsContent value="settings" className="space-y-4 mt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Active</Label>
                    <p className="text-sm text-muted-foreground">Enable this context</p>
                  </div>
                  <Switch
                    checked={editingContext.is_active ?? true}
                    onCheckedChange={(v) => setEditingContext({ ...editingContext, is_active: v })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Default to Signup</Label>
                    <p className="text-sm text-muted-foreground">Show signup tab instead of login by default</p>
                  </div>
                  <Switch
                    checked={editingContext.default_to_signup ?? false}
                    onCheckedChange={(v) => setEditingContext({ ...editingContext, default_to_signup: v })}
                  />
                </div>

                {/* Warning about incomplete functionality */}
                <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
                  <p className="text-sm text-destructive font-medium">⚠️ Functionality Not Yet Implemented</p>
                  <p className="text-xs text-destructive/80 mt-1">
                    Auto-enrollment and auto-track assignment are not currently active. These settings are saved but the backend logic to process them during signup has not been implemented yet.
                  </p>
                </div>

                {/* Program Selection and Auto-enroll */}
                <div className="space-y-3 p-4 border rounded-lg opacity-70">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Auto-enroll in Program</Label>
                      <p className="text-sm text-muted-foreground">Automatically enroll users in the selected program after signup</p>
                    </div>
                    <Switch
                      checked={editingContext.auto_enroll_program ?? false}
                      onCheckedChange={(v) => setEditingContext({ ...editingContext, auto_enroll_program: v })}
                      disabled={!editingContext.program_id}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Program</Label>
                    <Select 
                      value={editingContext.program_id || 'none'} 
                      onValueChange={(v) => setEditingContext({ 
                        ...editingContext, 
                        program_id: v === 'none' ? null : v,
                        auto_enroll_program: v === 'none' ? false : editingContext.auto_enroll_program
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a program" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No program</SelectItem>
                        {programs?.map((program) => (
                          <SelectItem key={program.id} value={program.id}>{program.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!editingContext.program_id && editingContext.auto_enroll_program && (
                      <p className="text-xs text-destructive">Select a program to enable auto-enrollment</p>
                    )}
                  </div>
                </div>

                {/* Track Selection and Auto-assign */}
                <div className="space-y-3 p-4 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Auto-assign Track</Label>
                      <p className="text-sm text-muted-foreground">Automatically assign users to the selected track after signup</p>
                    </div>
                    <Switch
                      checked={editingContext.auto_assign_track ?? false}
                      onCheckedChange={(v) => setEditingContext({ ...editingContext, auto_assign_track: v })}
                      disabled={!editingContext.track_id}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Track</Label>
                    <Select 
                      value={editingContext.track_id || 'none'} 
                      onValueChange={(v) => setEditingContext({ 
                        ...editingContext, 
                        track_id: v === 'none' ? null : v,
                        auto_assign_track: v === 'none' ? false : editingContext.auto_assign_track
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a track" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No track</SelectItem>
                        {tracks?.map((track) => (
                          <SelectItem key={track.id} value={track.id}>{track.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!editingContext.track_id && editingContext.auto_assign_track && (
                      <p className="text-xs text-destructive">Select a track to enable auto-assignment</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t">
                  <div>
                    <Label>Allow Slug Access</Label>
                    <p className="text-sm text-muted-foreground">
                      Allow using the human-readable slug in URLs (e.g., ?ref={editingContext.slug || 'your-slug'})
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      By default, only the secure public code is used. Enable this for non-sensitive contexts.
                    </p>
                  </div>
                  <Switch
                    checked={editingContext.allow_slug_access ?? false}
                    onCheckedChange={(v) => setEditingContext({ ...editingContext, allow_slug_access: v })}
                  />
                </div>

                {editingContext.public_code && (
                  <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-md space-y-1">
                    <p><strong>Public Code:</strong> <code>{editingContext.public_code}</code></p>
                    <p><strong>Primary URL:</strong> <code>/auth?ref={editingContext.public_code}</code></p>
                    {editingContext.allow_slug_access && (
                      <p><strong>Slug URL:</strong> <code>/auth?ref={editingContext.slug}</code> (enabled)</p>
                    )}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => editingContext && saveMutation.mutate(editingContext)}
              disabled={saveMutation.isPending || !editingContext?.slug || !editingContext?.headline}
            >
              {saveMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
