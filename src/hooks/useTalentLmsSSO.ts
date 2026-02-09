import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useTalentLmsSSO() {
  const [isLoading, setIsLoading] = useState(false);

  const loginToTalentLms = async (redirectUrl: string) => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error('Please log in to access TalentLMS');
        return;
      }

      const response = await supabase.functions.invoke('talentlms-sso', {
        body: { redirectUrl },
      });

      if (response.error) {
        throw response.error;
      }

      if (response.data?.error) {
        toast.error(response.data.message || response.data.error);
        return;
      }

      if (response.data?.loginUrl) {
        // Open TalentLMS with the SSO login URL
        // Use window.location.href for better mobile/Capacitor compatibility
        // window.open may be blocked or fail on mobile apps
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        
        if (isMobile) {
          // On mobile, redirect directly for better compatibility
          window.location.href = response.data.loginUrl;
        } else {
          // On desktop, open in new tab
          window.open(response.data.loginUrl, '_blank');
          toast.success('Opening TalentLMS...');
        }
      }
    } catch (error) {
      console.error('TalentLMS SSO error:', error);
      toast.error('Failed to connect to TalentLMS');
    } finally {
      setIsLoading(false);
    }
  };

  return { loginToTalentLms, isLoading };
}