import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, BookOpen } from 'lucide-react';
import { format } from 'date-fns';
import ReflectionResources from './ReflectionResources';

interface ModuleReflection {
  id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

interface ClientReflectionsViewProps {
  moduleProgressId: string;
}

export default function ClientReflectionsView({ moduleProgressId }: ClientReflectionsViewProps) {
  const [reflections, setReflections] = useState<ModuleReflection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReflections();
  }, [moduleProgressId]);

  async function fetchReflections() {
    try {
      const { data, error } = await supabase
        .from('module_reflections')
        .select('*')
        .eq('module_progress_id', moduleProgressId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReflections(data || []);
    } catch (error) {
      console.error('Error fetching client reflections:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5" />
          Client Reflections
        </CardTitle>
        <CardDescription>
          View the client's reflections for this module
        </CardDescription>
      </CardHeader>
      <CardContent>
        {reflections.length === 0 ? (
          <p className="text-muted-foreground py-4 text-center">
            No reflections from client yet.
          </p>
        ) : (
          <div className="space-y-3">
            {reflections.map((reflection) => (
              <div key={reflection.id} className="border rounded-lg p-4 space-y-2">
                <p className="whitespace-pre-wrap">{reflection.content}</p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(reflection.created_at), 'PPp')}
                  {reflection.updated_at !== reflection.created_at && ' (edited)'}
                </p>
                <ReflectionResources reflectionId={reflection.id} />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
