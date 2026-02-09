import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, User, Calendar, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { RichTextDisplay } from '@/components/ui/rich-text-display';

interface NoteWithProfile {
  id: string;
  group_id: string;
  title: string;
  content: string | null;
  note_type: string;
  created_by: string;
  created_at: string;
  profile?: { id: string; name: string | null; avatar_url: string | null } | null;
}

export default function GroupNoteDetail() {
  const { groupId, noteId } = useParams<{ groupId: string; noteId: string }>();

  const { data: note, isLoading } = useQuery<NoteWithProfile | null>({
    queryKey: ['group-note', noteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('group_notes')
        .select('*')
        .eq('id', noteId)
        .single();
      if (error) throw error;

      // Fetch author profile
      if (data.created_by) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, name, avatar_url')
          .eq('id', data.created_by)
          .single();
        return { ...data, profile } as NoteWithProfile;
      }
      return data as NoteWithProfile;
    },
    enabled: !!noteId,
  });

  const { data: group } = useQuery({
    queryKey: ['group-basic', groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('groups')
        .select('id, name')
        .eq('id', groupId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!groupId,
  });

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!note) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Note not found</p>
            <Button asChild className="mt-4">
              <Link to={`/groups/${groupId}`}>Back to Group</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild><Link to="/groups">Groups</Link></BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild><Link to={`/groups/${groupId}`}>{group?.name || 'Group'}</Link></BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{note.title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <Button variant="ghost" size="sm" asChild>
        <Link to={`/groups/${groupId}`}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Group
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <CardTitle>{note.title}</CardTitle>
              </div>
              <Badge variant="outline">{note.note_type || 'note'}</Badge>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-4">
            {note.profile && (
              <div className="flex items-center gap-1">
                <User className="h-4 w-4" />
                <span>{note.profile.name}</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              <span>{format(new Date(note.created_at), 'PPP p')}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {note.content ? (
            <RichTextDisplay content={note.content} />
          ) : (
            <p className="text-muted-foreground italic">No content</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
