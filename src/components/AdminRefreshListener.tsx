import { ReactNode } from 'react';
import { useAdminRefreshSignal } from '@/hooks/useAdminRefreshSignal';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Wrapper component that listens for admin-triggered refresh signals.
 * Should be placed inside both AuthProvider and QueryClientProvider.
 */
export function AdminRefreshListener({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  
  // Always call the hook, but pass whether user is authenticated
  // The hook will handle conditional logic internally
  useAdminRefreshSignal(!!user);
  
  return <>{children}</>;
}
