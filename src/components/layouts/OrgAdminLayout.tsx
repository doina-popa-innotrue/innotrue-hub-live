import { ReactNode, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSessionTimeout } from '@/hooks/useSessionTimeout';
import { supabase } from '@/integrations/supabase/client';
import { SidebarProvider, Sidebar, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarHeader, SidebarFooter } from '@/components/ui/sidebar';
import { SkipLink } from '@/components/accessibility';
import { UserDropdown } from '@/components/UserDropdown';
import { RoleSwitcher } from '@/components/sidebar/RoleSwitcher';
import { RoleBadges } from '@/components/sidebar/RoleBadges';
import { OnboardingTour } from '@/components/onboarding/OnboardingTour';
import { NavLink } from '@/components/NavLink';
import { 
  LayoutDashboard, 
  Users, 
  BookOpen, 
  Settings, 
  Building2,
  GraduationCap,
  BarChart3,
  HelpCircle,
  CreditCard,
  Shield
} from 'lucide-react';

interface OrgAdminLayoutProps {
  children: ReactNode;
}

export function OrgAdminLayout({ children }: OrgAdminLayoutProps) {
  const { user, organizationMembership } = useAuth();
  const [profileName, setProfileName] = useState<string>('');
  const [avatarUrl, setAvatarUrl] = useState<string>('');

  useSessionTimeout();

  useEffect(() => {
    if (user) {
      loadUserProfile();
    }
  }, [user]);

  useEffect(() => {
    const handleProfileUpdate = () => {
      loadUserProfile();
    };
    
    window.addEventListener('profile-updated', handleProfileUpdate);
    return () => {
      window.removeEventListener('profile-updated', handleProfileUpdate);
    };
  }, []);

  const loadUserProfile = async () => {
    if (!user) return;
    
    try {
      const { data } = await supabase
        .from('profiles')
        .select('name, avatar_url')
        .eq('id', user.id)
        .single();
      
      if (data) {
        setProfileName(data.name || '');
        setAvatarUrl(data.avatar_url || '');
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const orgName = organizationMembership?.organization_name || 'Organization';

  const navigationItems = [
    { to: '/org-admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
    { to: '/org-admin/members', icon: Users, label: 'Members', end: false },
    { to: '/org-admin/programs', icon: BookOpen, label: 'Programs', end: false },
    { to: '/org-admin/enrollments', icon: GraduationCap, label: 'Enrollments', end: false },
    { to: '/org-admin/billing', icon: CreditCard, label: 'Billing & Credits', end: false },
    { to: '/org-admin/analytics', icon: BarChart3, label: 'Analytics', end: false },
    { to: '/org-admin/terms', icon: Shield, label: 'Terms & Conditions', end: false },
    { to: '/org-admin/settings', icon: Settings, label: 'Settings', end: false },
  ];

  return (
    <SidebarProvider>
      <SkipLink targetId="main-content">Skip to main content</SkipLink>
      <SkipLink targetId="sidebar">Skip to sidebar</SkipLink>
      
      <div className="flex min-h-screen w-full bg-background">
        <Sidebar id="sidebar" className="border-r border-border">
          <SidebarHeader className="p-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-semibold text-foreground truncate">{orgName}</span>
                <span className="text-xs text-muted-foreground">Organization Admin</span>
              </div>
            </div>
          </SidebarHeader>

          <SidebarContent className="px-2 py-4">
            <div className="mb-4 px-2">
              <RoleSwitcher />
              <RoleBadges />
            </div>

            <SidebarMenu>
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.to} end={item.end}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-4 border-t border-border">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink to="/org-admin/faq">
                    <HelpCircle className="h-4 w-4" />
                    <span>Help & FAQ</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>

        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-border bg-background px-6">
            <div className="flex items-center gap-3">
              <img 
                src="/assets/bef0efe8-8bee-45e0-a7b2-9067b165d1e8.png" 
                alt="InnoTrue Hub" 
                className="h-8 w-auto"
              />
              <span className="font-semibold text-foreground hidden sm:inline">InnoTrue Hub</span>
            </div>
            
            <div className="flex items-center gap-4">
              <UserDropdown 
                profileName={profileName}
                avatarUrl={avatarUrl}
                email={user?.email}
              />
            </div>
          </header>
          
          <main id="main-content" className="flex-1 overflow-y-auto p-6">
            {children}
          </main>
        </div>
      </div>
      
      <OnboardingTour />
    </SidebarProvider>
  );
}