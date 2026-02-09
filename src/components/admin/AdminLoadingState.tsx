import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

interface AdminLoadingStateProps {
  message?: string;
}

/**
 * Standardized loading state for admin pages.
 */
export function AdminLoadingState({ message }: AdminLoadingStateProps) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        {message && (
          <p className="text-muted-foreground mt-4">{message}</p>
        )}
      </CardContent>
    </Card>
  );
}
