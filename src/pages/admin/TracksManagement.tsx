import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2, Gauge, Layers, ChevronDown, ChevronRight, FolderOpen, Lock, Copy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Track {
  id: string;
  name: string;
  key: string;
  description: string | null;
  icon: string | null;
  is_active: boolean;
  display_order: number;
}

interface FeatureCategory {
  id: string;
  name: string;
  display_order: number;
}

interface Feature {
  id: string;
  key: string;
  name: string;
  is_consumable: boolean;
  is_system: boolean;
  category_id: string | null;
}

interface TrackFeature {
  id: string;
  track_id: string;
  feature_id: string;
  is_enabled: boolean;
  limit_value: number | null;
}

export default function TracksManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isTrackDialogOpen, setIsTrackDialogOpen] = useState(false);
  const [editingTrack, setEditingTrack] = useState<Track | null>(null);
  const [trackForm, setTrackForm] = useState({
    name: '',
    key: '',
    display_name: '',
    description: '',
    icon: '',
    is_active: true,
    display_order: 0,
  });

  const { data: tracks } = useQuery({
    queryKey: ['tracks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tracks')
        .select('*')
        .order('display_order');
      if (error) throw error;
      return data as Track[];
    },
  });

  const { data: categories } = useQuery({
    queryKey: ['feature-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('feature_categories')
        .select('*')
        .order('display_order');
      if (error) throw error;
      return data as FeatureCategory[];
    },
  });

  const { data: features } = useQuery({
    queryKey: ['features'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('features')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as Feature[];
    },
  });

  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['uncategorized']));

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  // Group features by category
  const groupedFeatures = features?.reduce((acc, feature) => {
    const categoryId = feature.category_id || 'uncategorized';
    if (!acc[categoryId]) {
      acc[categoryId] = [];
    }
    acc[categoryId].push(feature);
    return acc;
  }, {} as Record<string, Feature[]>);

  // Get sorted category IDs (uncategorized last)
  const sortedCategoryIds = [
    ...(categories?.map(c => c.id) || []),
    ...(groupedFeatures && groupedFeatures['uncategorized'] ? ['uncategorized'] : []),
  ].filter(id => groupedFeatures?.[id]?.length);

  const { data: trackFeatures } = useQuery({
    queryKey: ['track-features'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('track_features')
        .select('*');
      if (error) throw error;
      return data as TrackFeature[];
    },
  });

  const createTrackMutation = useMutation({
    mutationFn: async (data: typeof trackForm) => {
      const { error } = await supabase.from('tracks').insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tracks'] });
      setIsTrackDialogOpen(false);
      resetForm();
      toast({ title: 'Track created successfully' });
    },
  });

  const updateTrackMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof trackForm }) => {
      const { error } = await supabase.from('tracks').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tracks'] });
      setIsTrackDialogOpen(false);
      setEditingTrack(null);
      resetForm();
      toast({ title: 'Track updated successfully' });
    },
  });

  const deleteTrackMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tracks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tracks'] });
      toast({ title: 'Track deleted successfully' });
    },
  });

  const cloneTrackMutation = useMutation({
    mutationFn: async (sourceTrack: Track) => {
      // Generate a unique key suffix
      const timestamp = Date.now().toString(36);
      const newKey = `${sourceTrack.key}_copy_${timestamp}`;
      const newName = `${sourceTrack.name} (Copy)`;

      // Create the new track
      const { data: newTrack, error: trackError } = await supabase
        .from('tracks')
        .insert({
          name: newName,
          key: newKey,
          description: sourceTrack.description,
          icon: sourceTrack.icon,
          is_active: false, // Start as inactive so admin can review
          display_order: (sourceTrack.display_order || 0) + 1,
        })
        .select()
        .single();

      if (trackError) throw trackError;

      // Fetch feature assignments from source track
      const { data: sourceFeatures, error: featuresError } = await supabase
        .from('track_features')
        .select('*')
        .eq('track_id', sourceTrack.id);

      if (featuresError) throw featuresError;

      // Clone feature assignments to the new track
      if (sourceFeatures && sourceFeatures.length > 0) {
        const newFeatures = sourceFeatures.map((tf) => ({
          track_id: newTrack.id,
          feature_id: tf.feature_id,
          is_enabled: tf.is_enabled,
          limit_value: tf.limit_value,
        }));

        const { error: insertError } = await supabase
          .from('track_features')
          .insert(newFeatures);

        if (insertError) throw insertError;
      }

      return { newTrack, featureCount: sourceFeatures?.length || 0 };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['tracks'] });
      queryClient.invalidateQueries({ queryKey: ['track-features'] });
      toast({
        title: 'Track cloned successfully',
        description: `Created "${result.newTrack.name}" with ${result.featureCount} feature assignment(s). Track is inactive - activate when ready.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to clone track',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const toggleTrackFeatureMutation = useMutation({
    mutationFn: async ({
      trackId,
      featureId,
      isEnabled,
      limitValue,
    }: {
      trackId: string;
      featureId: string;
      isEnabled: boolean;
      limitValue?: number | null;
    }) => {
      const { data: existing } = await supabase
        .from('track_features')
        .select('id')
        .eq('track_id', trackId)
        .eq('feature_id', featureId)
        .single();

      if (existing) {
        const { error } = await supabase
          .from('track_features')
          .update({ is_enabled: isEnabled, limit_value: limitValue })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('track_features').insert({
          track_id: trackId,
          feature_id: featureId,
          is_enabled: isEnabled,
          limit_value: limitValue,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['track-features'] });
      toast({ title: 'Feature configuration updated' });
    },
  });


  const resetForm = () => {
    setTrackForm({
      name: '',
      key: '',
      display_name: '',
      description: '',
      icon: '',
      is_active: true,
      display_order: 0,
    });
  };

  const handleOpenDialog = (track?: Track) => {
    if (track) {
      setEditingTrack(track);
      setTrackForm({
        name: track.name,
        key: track.key,
        display_name: (track as any).display_name || '',
        description: track.description || '',
        icon: track.icon || '',
        is_active: track.is_active,
        display_order: track.display_order,
      });
    } else {
      setEditingTrack(null);
      resetForm();
    }
    setIsTrackDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingTrack) {
      updateTrackMutation.mutate({ id: editingTrack.id, data: trackForm });
    } else {
      createTrackMutation.mutate(trackForm);
    }
  };

  const getTrackFeatureStatus = (trackId: string, featureId: string) => {
    return trackFeatures?.find(
      (tf) => tf.track_id === trackId && tf.feature_id === featureId
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Tracks Management</h1>
          <p className="text-muted-foreground">
            Manage tracks and their feature entitlements
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()} className="w-fit">
          <Plus className="mr-2 h-4 w-4" />
          Add Track
        </Button>
      </div>

      <Tabs defaultValue="tracks" className="space-y-6">
        <TabsList>
          <TabsTrigger value="tracks">Tracks</TabsTrigger>
          <TabsTrigger value="features">Feature Configuration</TabsTrigger>
        </TabsList>

        <TabsContent value="tracks">
          <Card>
            <CardHeader>
              <CardTitle>Available Tracks</CardTitle>
              <CardDescription>
                Tracks layer on top of plans to provide specialized feature access
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Key</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tracks?.map((track) => (
                    <TableRow key={track.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Layers className="h-4 w-4 text-muted-foreground" />
                          {track.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="rounded bg-muted px-2 py-1 text-sm">
                          {track.key}
                        </code>
                      </TableCell>
                      <TableCell className="max-w-md text-sm text-muted-foreground">
                        {track.description || '—'}
                      </TableCell>
                      <TableCell>
                        {track.is_active ? (
                          <Badge variant="default">Active</Badge>
                        ) : (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDialog(track)}
                          title="Edit track"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => cloneTrackMutation.mutate(track)}
                          disabled={cloneTrackMutation.isPending}
                          title="Clone track with feature assignments"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteTrackMutation.mutate(track.id)}
                          title="Delete track"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="features">
          <Card>
            <CardHeader>
              <CardTitle>Track Feature Configuration</CardTitle>
              <CardDescription>
                Configure which features and limits each track provides. When users have multiple tracks, highest limit wins.
                <span className="block mt-1 text-xs">
                  <Lock className="h-3 w-3 inline mr-1" />
                  <strong>System</strong> features are required for core functionality or menu visibility.
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {sortedCategoryIds.map((categoryId) => {
                const category = categories?.find(c => c.id === categoryId);
                const categoryFeatures = groupedFeatures?.[categoryId] || [];
                const isExpanded = expandedCategories.has(categoryId);

                return (
                  <div key={categoryId} className="border rounded-lg">
                    <button
                      onClick={() => toggleCategory(categoryId)}
                      className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        <FolderOpen className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {categoryId === 'uncategorized' ? 'Uncategorized' : category?.name}
                        </span>
                        <Badge variant="outline" className="ml-2">
                          {categoryFeatures.length}
                        </Badge>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t max-h-[400px] overflow-auto">
                        <table className="w-full caption-bottom text-sm">
                          <thead className="sticky top-0 z-10 [&_tr]:border-b">
                            <tr className="border-b">
                              <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground bg-muted/50">Feature</th>
                              {tracks?.filter(t => t.is_active).map((track) => (
                                <th key={track.id} className="h-10 px-4 text-center align-middle font-medium text-muted-foreground bg-muted/50 min-w-[120px]">
                                  {track.name}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="[&_tr:last-child]:border-0">
                            {categoryFeatures.map((feature) => (
                              <tr key={feature.id} className="border-b transition-colors hover:bg-muted/50">
                                <td className="p-3 align-middle font-medium">
                                  <div>
                                    <div className="flex items-center gap-2">
                                      {feature.name}
                                      {feature.is_system && (
                                        <Badge variant="outline" className="text-xs border-amber-500 text-amber-600">
                                          <Lock className="h-3 w-3 mr-1" />
                                          System
                                        </Badge>
                                      )}
                                      {feature.is_consumable && (
                                        <Badge variant="secondary" className="text-xs">
                                          <Gauge className="h-3 w-3 mr-1" />
                                          Uses
                                        </Badge>
                                      )}
                                    </div>
                                    <code className="text-xs text-muted-foreground">
                                      {feature.key}
                                    </code>
                                  </div>
                                </td>
                                {tracks?.filter(t => t.is_active).map((track) => {
                                  const status = getTrackFeatureStatus(track.id, feature.id);
                                  const isEnabled = status?.is_enabled ?? false;
                                  return (
                                    <td key={track.id} className="p-3 align-middle text-center">
                                      <Switch
                                        checked={isEnabled}
                                        onCheckedChange={(enabled) =>
                                          toggleTrackFeatureMutation.mutate({
                                            trackId: track.id,
                                            featureId: feature.id,
                                            isEnabled: enabled,
                                          })
                                        }
                                      />
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>

      <Dialog open={isTrackDialogOpen} onOpenChange={setIsTrackDialogOpen}>
        <DialogContent>
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>
                {editingTrack ? 'Edit Track' : 'Create New Track'}
              </DialogTitle>
              <DialogDescription>
                {editingTrack
                  ? 'Update track details'
                  : 'Add a new track to the system'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="tname">Track Name</Label>
                <Input
                  id="tname"
                  value={trackForm.name}
                  onChange={(e) =>
                    setTrackForm({ ...trackForm, name: e.target.value })
                  }
                  placeholder="CTA Track"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tkey">Track Key</Label>
                <Input
                  id="tkey"
                  value={trackForm.key}
                  onChange={(e) =>
                    setTrackForm({ ...trackForm, key: e.target.value })
                  }
                  placeholder="cta"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tdisplay">Display Name (for upsell messages)</Label>
                <Input
                  id="tdisplay"
                  value={trackForm.display_name}
                  onChange={(e) =>
                    setTrackForm({ ...trackForm, display_name: e.target.value })
                  }
                  placeholder="e.g. learning track"
                />
                <p className="text-xs text-muted-foreground">
                  How this track type is described in upgrade prompts
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tdesc">Description</Label>
                <Textarea
                  id="tdesc"
                  value={trackForm.description}
                  onChange={(e) =>
                    setTrackForm({ ...trackForm, description: e.target.value })
                  }
                  placeholder="For Certified Transaction Advisor training..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="torder">Display Order</Label>
                <Input
                  id="torder"
                  type="number"
                  value={trackForm.display_order}
                  onChange={(e) =>
                    setTrackForm({ ...trackForm, display_order: parseInt(e.target.value) || 0 })
                  }
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="tactive"
                  checked={trackForm.is_active}
                  onCheckedChange={(checked) =>
                    setTrackForm({ ...trackForm, is_active: checked })
                  }
                />
                <Label htmlFor="tactive">Active</Label>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsTrackDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">
                {editingTrack ? 'Update' : 'Create'} Track
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
