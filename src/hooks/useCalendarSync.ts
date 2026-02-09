import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

// HMAC-SHA256 signing utilities for secure calendar URLs
async function generateHmacSignature(
  userId: string,
  timestamp: string,
  secret: string
): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const message = `${userId}:${timestamp}`;
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function useCalendarSync() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch calendar settings including the signing secret
  const { data: calendarSettings, isLoading } = useQuery({
    queryKey: ['calendar-settings', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('calendar_token, calendar_sync_enabled')
        .eq('id', user.id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Toggle calendar sync
  const toggleSyncMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      if (!user?.id) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('profiles')
        .update({ calendar_sync_enabled: enabled })
        .eq('id', user.id);
      
      if (error) throw error;
    },
    onSuccess: (_, enabled) => {
      queryClient.invalidateQueries({ queryKey: ['calendar-settings'] });
      toast({
        title: enabled ? 'Calendar sync enabled' : 'Calendar sync disabled',
        description: enabled 
          ? 'Your events will now be available via the calendar feed' 
          : 'Calendar feed has been disabled',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error updating calendar settings',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Regenerate calendar URL (generates new HMAC-signed URL)
  const regenerateTokenMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Not authenticated');

      // Generate new timestamp for fresh expiry
      const { error } = await supabase
        .from('profiles')
        .update({ 
          calendar_token: crypto.randomUUID(),
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-settings'] });
      toast({
        title: 'Calendar URL regenerated',
        description: 'Your old calendar subscription URL will no longer work. Update your calendar app with the new URL.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error regenerating URL',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Query for generating signed calendar URL
  const { data: signedUrl } = useQuery({
    queryKey: ['calendar-signed-url', user?.id, calendarSettings?.calendar_token],
    queryFn: async () => {
      if (!user?.id || !calendarSettings?.calendar_sync_enabled) return null;

      // Call edge function to generate signed URL
      const { data, error } = await supabase.functions.invoke('generate-calendar-url', {
        body: { userId: user.id }
      });

      if (error) {
        console.error('Error generating signed calendar URL:', error);
        // Fallback to legacy token-based URL
        if (calendarSettings?.calendar_token) {
          const baseUrl = import.meta.env.VITE_SUPABASE_URL;
          return `${baseUrl}/functions/v1/calendar-feed?token=${calendarSettings.calendar_token}`;
        }
        return null;
      }

      return data?.url || null;
    },
    enabled: !!user?.id && !!calendarSettings?.calendar_sync_enabled,
  });

  // Fallback to legacy URL if signed URL not available
  const getFallbackUrl = () => {
    if (!calendarSettings?.calendar_token) return null;
    const baseUrl = import.meta.env.VITE_SUPABASE_URL;
    return `${baseUrl}/functions/v1/calendar-feed?token=${calendarSettings.calendar_token}`;
  };

  return {
    isEnabled: calendarSettings?.calendar_sync_enabled ?? false,
    calendarToken: calendarSettings?.calendar_token,
    feedUrl: signedUrl || getFallbackUrl(),
    isLoading,
    toggleSync: toggleSyncMutation.mutate,
    regenerateToken: regenerateTokenMutation.mutate,
    isUpdating: toggleSyncMutation.isPending || regenerateTokenMutation.isPending,
  };
}
