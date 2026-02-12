import { ReactNode, useState, useEffect } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { OnboardingTour } from "@/components/onboarding/OnboardingTour";
import { Button } from "@/components/ui/button";
import { PlayCircle } from "lucide-react";
import { resetTour } from "@/hooks/useOnboardingTour";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { UserDropdown } from "@/components/UserDropdown";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { PlatformTermsAcceptanceGate } from "@/components/terms/PlatformTermsAcceptanceGate";
import { useSessionTimeout } from "@/hooks/useSessionTimeout";
import { SkipLink } from "@/components/accessibility/SkipLink";
import { BackButton } from "@/components/navigation/BackButton";

interface DashboardLayoutProps {
  children: ReactNode;
}
export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, userRole } = useAuth();
  const { toast } = useToast();
  const [profileName, setProfileName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Initialize session timeout for security
  useSessionTimeout();

  useEffect(() => {
    if (user) {
      loadUserProfile();
    }
  }, [user]);

  // Listen for profile updates from other components
  useEffect(() => {
    const handleProfileUpdate = () => {
      if (user) {
        loadUserProfile();
      }
    };
    window.addEventListener("profile-updated", handleProfileUpdate);
    return () => window.removeEventListener("profile-updated", handleProfileUpdate);
  }, [user]);
  const loadUserProfile = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("name, avatar_url")
        .eq("id", user.id)
        .single();
      if (error) throw error;
      setProfileName(data.name || "");
      setAvatarUrl(data.avatar_url || null);
    } catch (error: any) {
      console.error("Error loading profile:", error);
    }
  };
  const handleRestartTour = () => {
    const tourId =
      userRole === "admin"
        ? "admin-tour"
        : userRole === "instructor" || userRole === "coach"
          ? "instructor-tour"
          : "client-tour";
    resetTour(tourId);
    toast({
      title: "Tour restarted",
      description: "Navigate to your dashboard to begin the onboarding tour.",
      duration: 5000,
    });
  };
  return (
    <PlatformTermsAcceptanceGate>
      <SidebarProvider>
        <SkipLink targetId="main-content">Skip to main content</SkipLink>
        <SkipLink targetId="sidebar-nav" className="focus:top-12">
          Skip to navigation
        </SkipLink>
        <div className="flex h-screen w-full flex-col overflow-hidden">
          <header
            className="flex h-20 shrink-0 items-center gap-5 border-b bg-[#000040] px-6 text-white z-20"
            role="banner"
          >
            <SidebarTrigger
              className="-ml-2 text-white hover:bg-white/10 hover:text-white"
              aria-label="Toggle navigation menu"
            />
            <img
              alt="InnoTrue Hub logo"
              className="h-10 w-auto"
              src="/assets/bef0efe8-8bee-45e0-a7b2-9067b165d1e8.png"
            />
            <div className="h-8 w-px bg-white/30 hidden lg:block" aria-hidden="true" />
            <span className="text-lg font-bold mt-1 hidden lg:block">
              The platform for lifelong development
            </span>
            <div className="flex-1" />
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRestartTour}
                className="flex items-center gap-2 text-white hover:bg-white/10 hover:text-white"
                aria-label="Restart onboarding tour"
              >
                <PlayCircle className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Restart Tour</span>
              </Button>
              <NotificationBell />
              <UserDropdown profileName={profileName} avatarUrl={avatarUrl} email={user?.email} />
            </div>
          </header>
          <div className="flex flex-1 min-h-0">
            <AppSidebar />
            <main
              id="main-content"
              className="flex-1 min-w-0 overflow-y-auto p-6"
              role="main"
              tabIndex={-1}
            >
              <BackButton />
              {children}
            </main>
          </div>
        </div>
        <OnboardingTour />
      </SidebarProvider>
    </PlatformTermsAcceptanceGate>
  );
}
