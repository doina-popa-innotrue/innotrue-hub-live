import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useCircleSSO() {
  const [isLoading, setIsLoading] = useState(false);

  const loginToCircle = async () => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error('Please log in to access InnoTrue Community');
        return;
      }

      const response = await supabase.functions.invoke('circle-sso', {
        body: {},
      });

      if (response.error) {
        throw response.error;
      }

      if (response.data?.error) {
        toast.error(response.data.error);
        return;
      }

      if (response.data?.loginUrl) {
        // Open Circle in a new window with the magic login URL
        window.open(response.data.loginUrl, '_blank');
        toast.success('Opening InnoTrue Community...');
      }
    } catch (error) {
      console.error('Circle SSO error:', error);
      toast.error('Failed to connect to InnoTrue Community');
    } finally {
      setIsLoading(false);
    }
  };

  return { loginToCircle, isLoading };
}
