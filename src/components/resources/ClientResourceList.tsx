import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, FileText, Download, ExternalLink, Eye, Lock, Link as LinkIcon, Image, Video, FolderOpen } from 'lucide-react';
import { toast } from 'sonner';
import { ResourceViewer } from './ResourceViewer';

interface Resource {
  id: string;
  canonical_id: string;
  title: string;
  description: string | null;
  resource_type: string;
  url: string | null;
  file_path: string | null;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  downloadable: boolean;
  program_ids?: string[];
}

interface ResourceAssignment {
  id: string;
  module_id: string;
  resource_id: string;
  order_index: number;
  is_required: boolean;
  notes: string | null;
  resource: Resource;
  fromCollection?: string;
}

interface ClientResourceListProps {
  moduleId: string;
  programId?: string;
}

export function ClientResourceList({ moduleId, programId }: ClientResourceListProps) {
  const { user } = useAuth();
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);

  // Get user's enrolled programs
  const { data: enrolledProgramIds } = useQuery({
    queryKey: ['user-enrolled-programs', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('client_enrollments')
        .select('program_id')
        .eq('client_user_id', user.id)
        .eq('status', 'active');
      
      if (error) throw error;
      return data.map(e => e.program_id);
    },
    enabled: !!user,
  });

  // Fetch assigned resources for this module (direct assignments + from collections)
  const { data: assignments, isLoading } = useQuery({
    queryKey: ['client-module-resources', moduleId],
    queryFn: async () => {
      const allAssignments: ResourceAssignment[] = [];
      const seenResourceIds = new Set<string>();

      // Fetch direct resource assignments
      const { data: directData, error: directError } = await supabase
        .from('module_resource_assignments')
        .select(`
          *,
          resource:resource_id(
            id,
            canonical_id,
            title,
            description,
            resource_type,
            url,
            file_path,
            file_name,
            file_size,
            mime_type,
            downloadable
          )
        `)
        .eq('module_id', moduleId)
        .order('order_index', { ascending: true });

      if (directError) throw directError;

      // Fetch program assignments for direct resources
      const directResourceIds = directData.map(a => a.resource_id);
      const { data: directProgramLinks } = await supabase
        .from('resource_library_programs')
        .select('resource_id, program_id')
        .in('resource_id', directResourceIds);

      // Add direct assignments
      directData.forEach(assignment => {
        seenResourceIds.add(assignment.resource_id);
        allAssignments.push({
          ...assignment,
          resource: {
            ...assignment.resource,
            program_ids: directProgramLinks?.filter(pl => pl.resource_id === assignment.resource_id).map(pl => pl.program_id) || [],
          }
        });
      });

      // Fetch collection links and their resources
      const { data: collectionLinks } = await (supabase as any)
        .from('module_collection_links')
        .select(`
          collection_id,
          resource_collections(
            id,
            name,
            resource_collection_items(
              resource_id,
              resource_library(
                id,
                canonical_id,
                title,
                description,
                resource_type,
                url,
                file_path,
                file_name,
                file_size,
                mime_type,
                downloadable
              )
            )
          )
        `)
        .eq('module_id', moduleId)
        .order('order_index', { ascending: true });

      // Add collection resources (avoiding duplicates)
      if (collectionLinks) {
        const collectionResourceIds: string[] = [];
        
        collectionLinks.forEach((link: any) => {
          if (link.resource_collections?.resource_collection_items) {
            link.resource_collections.resource_collection_items.forEach((item: any) => {
              if (item.resource_library && !seenResourceIds.has(item.resource_id)) {
                seenResourceIds.add(item.resource_id);
                collectionResourceIds.push(item.resource_id);
                allAssignments.push({
                  id: `collection-${item.resource_id}`,
                  module_id: moduleId,
                  resource_id: item.resource_id,
                  order_index: 1000 + allAssignments.length,
                  is_required: false,
                  notes: null,
                  resource: item.resource_library,
                  fromCollection: link.resource_collections.name,
                });
              }
            });
          }
        });

        // Fetch program assignments for collection resources
        if (collectionResourceIds.length > 0) {
          const { data: collectionProgramLinks } = await supabase
            .from('resource_library_programs')
            .select('resource_id, program_id')
            .in('resource_id', collectionResourceIds);

          // Update program_ids for collection resources
          allAssignments.forEach(assignment => {
            if (assignment.fromCollection) {
              assignment.resource.program_ids = collectionProgramLinks?.filter(pl => pl.resource_id === assignment.resource_id).map(pl => pl.program_id) || [];
            }
          });
        }
      }

      return allAssignments as ResourceAssignment[];
    },
  });

  // Filter resources based on program enrollment
  const accessibleAssignments = assignments?.filter(assignment => {
    const programIds = assignment.resource.program_ids || [];
    
    // If resource is public (no program restrictions), allow access
    if (programIds.length === 0) return true;
    
    // Check if user is enrolled in any of the required programs
    return programIds.some(pid => enrolledProgramIds?.includes(pid));
  });

  const handleDownload = async (resource: Resource) => {
    if (!resource.file_path || !resource.downloadable) return;

    const { data, error } = await supabase.storage
      .from('resource-library')
      .download(resource.file_path);

    if (error) {
      toast.error('Failed to download file');
      return;
    }

    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = resource.file_name || 'download';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleView = (resource: Resource) => {
    setSelectedResource(resource);
    setViewerOpen(true);
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'link': return <LinkIcon className="h-4 w-4" />;
      case 'image': return <Image className="h-4 w-4" />;
      case 'video': return <Video className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const canViewInBrowser = (mimeType: string | null): boolean => {
    if (!mimeType) return false;
    return (
      mimeType === 'application/pdf' ||
      mimeType.startsWith('image/') ||
      mimeType.startsWith('video/') ||
      mimeType.startsWith('text/')
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!accessibleAssignments?.length) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        <FileText className="h-10 w-10 mx-auto mb-3 opacity-50" />
        <p className="text-sm">No resources available for this module.</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {accessibleAssignments.map((assignment) => (
          <Card key={assignment.id}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-md bg-muted">
                  {getTypeIcon(assignment.resource.resource_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{assignment.resource.title}</span>
                    <Badge variant="outline" className="capitalize text-xs">
                      {assignment.resource.resource_type}
                    </Badge>
                    {assignment.is_required && (
                      <Badge variant="default" className="text-xs">Required</Badge>
                    )}
                    {!assignment.resource.downloadable && assignment.resource.file_path && (
                      <Badge variant="secondary" className="text-xs gap-1">
                        <Lock className="h-3 w-3" />
                        View Only
                      </Badge>
                    )}
                  </div>
                  {assignment.resource.description && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {assignment.resource.description}
                    </p>
                  )}
                  {assignment.fromCollection && (
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <FolderOpen className="h-3 w-3" />
                      From: {assignment.fromCollection}
                    </p>
                  )}
                  {assignment.notes && (
                    <p className="text-sm text-muted-foreground mt-1 italic">
                      {assignment.notes}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    {assignment.resource.file_path && (
                      <>
                        {canViewInBrowser(assignment.resource.mime_type) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleView(assignment.resource)}
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            View
                          </Button>
                        )}
                        {assignment.resource.downloadable && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownload(assignment.resource)}
                          >
                            <Download className="h-3 w-3 mr-1" />
                            Download
                            {assignment.resource.file_size && (
                              <span className="ml-1 text-muted-foreground">
                                ({formatFileSize(assignment.resource.file_size)})
                              </span>
                            )}
                          </Button>
                        )}
                      </>
                    )}
                    {assignment.resource.url && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={assignment.resource.url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Open Link
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedResource && (
        <ResourceViewer
          open={viewerOpen}
          onOpenChange={setViewerOpen}
          resource={selectedResource}
        />
      )}
    </>
  );
}
