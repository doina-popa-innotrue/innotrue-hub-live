import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { FileText, BookOpen, Target, StickyNote, Plus, Sparkles, ChevronRight } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface DevelopmentItem {
  id: string;
  item_type: "reflection" | "note" | "resource" | "action_item";
  title: string | null;
  content: string | null;
  created_at: string;
}

interface LinkedDevelopmentItemsProps {
  goalId: string;
}

const TYPE_ICONS: Record<string, any> = {
  reflection: FileText,
  note: StickyNote,
  resource: BookOpen,
  action_item: Target,
};

const TYPE_COLORS: Record<string, string> = {
  reflection: "bg-chart-1/15 text-chart-1",
  note: "bg-chart-2/15 text-chart-2",
  resource: "bg-chart-3/15 text-chart-3",
  action_item: "bg-chart-4/15 text-chart-4",
};

const TYPE_LABELS: Record<string, string> = {
  reflection: "Reflection",
  note: "Note",
  resource: "Resource",
  action_item: "Action",
};

export default function LinkedDevelopmentItems({ goalId }: LinkedDevelopmentItemsProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [items, setItems] = useState<DevelopmentItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLinkedItems();
  }, [goalId]);

  const fetchLinkedItems = async () => {
    try {
      // First get the linked item IDs
      const { data: links, error: linksError } = await supabase
        .from('development_item_goal_links')
        .select('development_item_id')
        .eq('goal_id', goalId);

      if (linksError) throw linksError;

      if (!links || links.length === 0) {
        setItems([]);
        setLoading(false);
        return;
      }

      const itemIds = links.map(l => l.development_item_id);

      // Then fetch the development items
      const { data: itemsData, error: itemsError } = await supabase
        .from('development_items')
        .select('id, item_type, title, content, created_at')
        .in('id', itemIds)
        .order('created_at', { ascending: false });

      if (itemsError) throw itemsError;
      setItems((itemsData || []) as DevelopmentItem[]);
    } catch (error: any) {
      console.error('Error fetching linked development items:', error);
      toast({
        title: 'Error',
        description: 'Failed to load development items',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="mt-6">
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 shrink-0" />
            Development Items
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/development-items')}
            className="w-full sm:w-auto"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="text-center py-6">
            <Sparkles className="h-12 w-12 mx-auto mb-3 opacity-50 text-muted-foreground" />
            <p className="text-muted-foreground mb-4">
              No development items linked to this goal yet.
            </p>
            <p className="text-sm text-muted-foreground">
              Link reflections, notes, resources, or action items from the Development Items page.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => {
              const Icon = TYPE_ICONS[item.item_type];
              return (
                <div
                  key={item.id}
                  className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => navigate('/development-items')}
                >
                  <div className={`p-2 rounded-lg shrink-0 ${TYPE_COLORS[item.item_type]}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs">
                        {TYPE_LABELS[item.item_type]}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium line-clamp-1">
                      {item.title || (item.content ? item.content.substring(0, 50) + "..." : "Untitled")}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(parseISO(item.created_at), "MMM d, yyyy")}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-2" />
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
