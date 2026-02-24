import {
  Users,
  BookOpen,
  LayoutDashboard,
  Shield,
  Link2,
  Layers,
  UserCog,
  GraduationCap,
  Target,
  Brain,
  CheckSquare,
  BarChart3,
  Sparkles,
  DollarSign,
  Zap,
  Calendar,
  CalendarDays,
  ClipboardList,
  ClipboardCheck,
  FileText,
  ExternalLink,
  UsersRound,
  ScrollText,
  Package,
  ChevronDown,
  Award,
  MessageSquare,
  Mail,
  HelpCircle,
  Settings,
  UserX,
  CircleDot,
  UserCheck,
  Search,
  GitBranch,
  Lightbulb,
  ListChecks,
  FolderOpen,
  Building2,
  Coins,
  Tag,
  Map,
  Bell,
  Image,
  Send,
  Lock,
  Megaphone,
  Gauge,
  Ticket,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import innoTrueHubLogo from "@/assets/innotrue-hub-logo.png";
import { RoleSwitcher } from "@/components/sidebar/RoleSwitcher";
import { RoleBadges } from "@/components/sidebar/RoleBadges";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useCircleSSO } from "@/hooks/useCircleSSO";
import { useTalentLmsSSO } from "@/hooks/useTalentLmsSSO";
import { useLucidSSO } from "@/hooks/useLucidSSO";
import { useGoogleDriveSSO } from "@/hooks/useGoogleDriveSSO";
import { useSupportEmail } from "@/hooks/useSupportEmail";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import {
  useMultipleFeatureVisibility,
  FeatureVisibilityResult,
} from "@/hooks/useFeatureVisibility";
import { cn } from "@/lib/utils";

interface NavItemWithFeature {
  title: string;
  url: string;
  icon: any;
  tourId?: string;
  featureKey?: string | null;
  end?: boolean;
}

export function AppSidebar() {
  const { open } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const { userRole, userRoles, signOut, user } = useAuth();
  const currentPath = location.pathname;
  const isActive = (path: string) => currentPath === path || currentPath.startsWith(path + "/");
  const { loginToCircle, isLoading: circleLoading } = useCircleSSO();
  const { loginToTalentLms, isLoading: talentLmsLoading } = useTalentLmsSSO();
  const { loginToLucid, isLoading: lucidLoading } = useLucidSSO();
  const { openGoogleDrive, isLoading: driveLoading, driveUser } = useGoogleDriveSSO();

  const { supportEmail } = useSupportEmail();

  // Check if user has Circle connection
  const { data: circleUser } = useQuery({
    queryKey: ["circle-user", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("circle_users")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled:
      !!user?.id &&
      (userRoles.includes("client") ||
        userRoles.includes("instructor") ||
        userRoles.includes("coach")),
  });

  // Check if user has TalentLMS connection
  const { data: talentLmsUser } = useQuery({
    queryKey: ["talentlms-user", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("talentlms_users")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled:
      !!user?.id &&
      (userRoles.includes("client") ||
        userRoles.includes("instructor") ||
        userRoles.includes("coach")),
  });

  // Check if user has Lucid connection
  const { data: lucidUser } = useQuery({
    queryKey: ["lucid-user", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("lucid_users")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled:
      !!user?.id &&
      (userRoles.includes("client") ||
        userRoles.includes("instructor") ||
        userRoles.includes("coach")),
  });

  // Check if user has Miro connection
  const { data: miroUser } = useQuery({
    queryKey: ["miro-user", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("miro_users")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled:
      !!user?.id &&
      (userRoles.includes("client") ||
        userRoles.includes("instructor") ||
        userRoles.includes("coach")),
  });

  // Check if user has Mural connection
  const { data: muralUser } = useQuery({
    queryKey: ["mural-user", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("mural_users")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled:
      !!user?.id &&
      (userRoles.includes("client") ||
        userRoles.includes("instructor") ||
        userRoles.includes("coach")),
  });
  // Client standalone items - now includes all items, locked ones shown with indicator
  const allClientItems: NavItemWithFeature[] = [
    {
      title: "My Dashboard",
      url: "/dashboard",
      icon: LayoutDashboard,
      tourId: "client-dashboard",
      featureKey: null, // Always visible
    },
    {
      title: "My Feedback",
      url: "/feedback",
      icon: MessageSquare,
      tourId: "client-feedback",
      featureKey: "feedback_reviews",
    },
    {
      title: "Guided Paths",
      url: "/guided-paths",
      icon: Map,
      tourId: "client-guided-paths",
      featureKey: "guided_paths",
    },
    {
      title: "My Calendar",
      url: "/calendar",
      icon: Calendar,
      tourId: "client-calendar",
      featureKey: null, // Always visible
    },
    {
      title: "Assignments",
      url: "/assignments",
      icon: ClipboardList,
      tourId: "client-assignments",
      featureKey: null, // Always visible
    },
    {
      title: "Skills Map",
      url: "/skills",
      icon: Award,
      tourId: "client-skills",
      featureKey: "skills_map",
    },
    {
      title: "Groups",
      url: "/groups",
      icon: UsersRound,
      tourId: "client-groups",
      featureKey: "groups",
    },
    {
      title: "Services",
      url: "/services",
      icon: Zap,
      tourId: "client-services",
      featureKey: "services",
    },
    {
      title: "Credits",
      url: "/credits",
      icon: Coins,
      tourId: "client-credits",
      featureKey: "credits",
    },
    {
      title: "Usage",
      url: "/usage",
      icon: BarChart3,
      tourId: "client-usage",
      featureKey: "usage",
    },
  ];

  // Keep all client items visible (no longer filtered)
  const clientItems = allClientItems;

  // Client Assessments submenu items
  const clientAssessmentItems: NavItemWithFeature[] = [
    {
      title: "My Results",
      url: "/assessments",
      icon: FileText,
      tourId: "client-my-assessments",
      end: true,
    },
    {
      title: "Capability",
      url: "/capabilities",
      icon: Target,
      tourId: "client-capability-assessments",
    },
    {
      title: "Psychometric",
      url: "/assessments/explore",
      icon: Search,
      tourId: "client-explore-assessments",
    },
  ];

  // Client Learning submenu items
  const clientLearningItems: NavItemWithFeature[] = [
    {
      title: "My Programs",
      url: "/programs",
      icon: BookOpen,
      tourId: "client-programs",
    },
    {
      title: "Analytics",
      url: "/learning/analytics",
      icon: BarChart3,
      tourId: "client-analytics",
    },
    {
      title: "Recommendations",
      url: "/learning/recommendations",
      icon: Sparkles,
      tourId: "client-recommendations",
    },
  ];

  // Client Planning submenu items - Awareness → Direction → Choice → Action → Reflection → Review
  const clientPlanningItems: NavItemWithFeature[] = [
    {
      title: "Wheel of Life",
      url: "/wheel-of-life",
      icon: CircleDot,
      tourId: "client-wheel-of-life",
    },
    {
      title: "Goals",
      url: "/goals",
      icon: Target,
      tourId: "client-goals",
    },
    {
      title: "Decisions",
      url: "/decisions",
      icon: Brain,
      tourId: "client-decisions",
      featureKey: "decision_toolkit_basic",
    },
    {
      title: "Tasks",
      url: "/tasks",
      icon: CheckSquare,
      tourId: "client-tasks",
      featureKey: "decision_toolkit_basic",
    },
    {
      title: "Development Profile",
      url: "/development-profile",
      icon: BarChart3,
      tourId: "client-development-profile",
      featureKey: "development_profile",
    },
    {
      title: "Development Items",
      url: "/development-items",
      icon: Lightbulb,
      tourId: "client-development-items",
    },
    {
      title: "My Resources",
      url: "/my-resources",
      icon: FolderOpen,
      tourId: "client-my-resources",
      featureKey: "resource_library",
    },
    {
      title: "Timeline",
      url: "/development-timeline",
      icon: GitBranch,
      tourId: "client-development-timeline",
    },
  ];

  // Collect all feature keys used in the sidebar for batch visibility check
  const allFeatureKeys = [
    ...allClientItems.filter((i) => i.featureKey).map((i) => i.featureKey!),
    ...clientPlanningItems.filter((i) => i.featureKey).map((i) => i.featureKey!),
    "community", // For InnoTrue Community in External Platforms
  ];
  const { getVisibility } = useMultipleFeatureVisibility(allFeatureKeys);

  // Get visibility for community feature
  const communityVisibility = getVisibility("community");

  // Helper to get visibility state for an item
  const getItemVisibility = (item: NavItemWithFeature): FeatureVisibilityResult => {
    return getVisibility(item.featureKey);
  };

  // Handle click on locked items - uses database-driven display names
  const handleLockedItemClick = (
    item: NavItemWithFeature,
    visibility: FeatureVisibilityResult,
    e: React.MouseEvent,
  ) => {
    e.preventDefault();
    const sourceLabel = visibility.sourceDisplayName || "plan";
    const planMessage = visibility.requiredPlan
      ? `Available with the ${visibility.requiredPlan} ${sourceLabel}.`
      : "Upgrade your plan or enroll in a program to unlock this.";
    toast.info(`${item.title} is a premium feature`, {
      description: planMessage,
      action: {
        label: "View Options",
        onClick: () => navigate("/subscription"),
      },
    });
  };
  const adminItems = [
    {
      title: "Admin Dashboard",
      url: "/admin",
      icon: Shield,
      tourId: "admin-dashboard",
    },
    {
      title: "Organizations",
      url: "/admin/organizations",
      icon: Building2,
      tourId: "admin-organizations",
    },
    {
      title: "Platform Terms",
      url: "/admin/platform-terms",
      icon: ScrollText,
      tourId: "admin-platform-terms",
    },
    {
      title: "Auth Contexts",
      url: "/admin/auth-contexts",
      icon: Link2,
      tourId: "admin-auth-contexts",
    },
    {
      title: "System Settings",
      url: "/admin/settings",
      icon: Settings,
      tourId: "admin-settings",
    },
  ];

  // Resources submenu items
  const adminResourceItems = [
    {
      title: "Content Library",
      url: "/admin/content-library",
      icon: Package,
      tourId: "admin-content-library",
    },
    {
      title: "Resource Library",
      url: "/admin/resource-library",
      icon: FileText,
      tourId: "admin-resource-library",
    },
    {
      title: "Resource Categories",
      url: "/admin/resource-categories",
      icon: FolderOpen,
      tourId: "admin-resource-categories",
    },
    {
      title: "Resource Collections",
      url: "/admin/resource-collections",
      icon: Layers,
      tourId: "admin-resource-collections",
    },
    {
      title: "Scenario Templates",
      url: "/admin/scenario-templates",
      icon: FileText,
      tourId: "admin-scenario-templates",
    },
    {
      title: "Scenario Categories",
      url: "/admin/scenario-categories",
      icon: FolderOpen,
      tourId: "admin-scenario-categories",
    },
  ];

  // Communications submenu items
  const adminCommunicationsItems = [
    {
      title: "Email Templates",
      url: "/admin/email-templates",
      icon: Mail,
      tourId: "admin-email-templates",
    },
    {
      title: "Email Assets",
      url: "/admin/email-assets",
      icon: Image,
      tourId: "admin-email-assets",
    },
    {
      title: "Email Queue",
      url: "/admin/email-queue",
      icon: Send,
      tourId: "admin-email-queue",
    },
    {
      title: "Notifications",
      url: "/admin/notifications",
      icon: Bell,
      tourId: "admin-notifications",
    },
    {
      title: "Notification Types",
      url: "/admin/notification-types",
      icon: ListChecks,
      tourId: "admin-notification-types",
    },
    {
      title: "Announcements",
      url: "/admin/announcements",
      icon: Megaphone,
      tourId: "admin-announcements",
    },
  ];

  // Assessments submenu items
  const adminAssessmentItems = [
    {
      title: "Assessments",
      url: "/admin/assessments",
      icon: FileText,
      tourId: "admin-assessments",
    },
    {
      title: "Capability Assessments",
      url: "/admin/capability-assessments",
      icon: Target,
      tourId: "admin-capability-assessments",
    },
    {
      title: "Assessment Builder",
      url: "/admin/assessment-builder",
      icon: FileText,
      tourId: "admin-assessment-builder",
    },
    {
      title: "Assessment Families",
      url: "/admin/assessment-families",
      icon: Layers,
      tourId: "admin-assessment-families",
    },
    {
      title: "Assessment Categories",
      url: "/admin/assessment-categories",
      icon: Layers,
      tourId: "admin-assessment-categories",
    },
    {
      title: "Wheel Categories",
      url: "/admin/wheel-categories",
      icon: CircleDot,
      tourId: "admin-wheel-categories",
    },
    {
      title: "Assessment Interests",
      url: "/admin/assessment-interests",
      icon: ClipboardList,
      tourId: "admin-assessment-interests",
    },
  ];

  // Programs submenu items
  const adminProgramItems = [
    {
      title: "Programs",
      url: "/admin/programs",
      icon: BookOpen,
      tourId: "admin-programs",
    },
    {
      title: "Partner Programs",
      url: "/admin/partner-programs",
      icon: Users,
      tourId: "admin-partner-programs",
    },
    {
      title: "Schedule Calendar",
      url: "/admin/program-calendar",
      icon: Calendar,
      tourId: "admin-calendar",
    },
    {
      title: "Module Types",
      url: "/admin/module-types",
      icon: Layers,
      tourId: "admin-module-types",
    },
    {
      title: "Assignment Types",
      url: "/admin/assignment-types",
      icon: ClipboardList,
      tourId: "admin-assignment-types",
    },
    {
      title: "Skills",
      url: "/admin/skills",
      icon: Sparkles,
      tourId: "admin-skills",
    },
    {
      title: "Skill Categories",
      url: "/admin/skill-categories",
      icon: FolderOpen,
      tourId: "admin-skill-categories",
    },
    {
      title: "Feedback Templates",
      url: "/admin/feedback-templates",
      icon: MessageSquare,
      tourId: "admin-feedback-templates",
    },
    {
      title: "Canonical Codes",
      url: "/admin/canonical-codes",
      icon: Link2,
      tourId: "admin-canonical-codes",
    },
    {
      title: "Enrollment Codes",
      url: "/admin/enrollment-codes",
      icon: Ticket,
      tourId: "admin-enrollment-codes",
    },
    {
      title: "Partner Codes",
      url: "/admin/partner-codes",
      icon: Users,
      tourId: "admin-partner-codes",
    },
    {
      title: "Guided Path Templates",
      url: "/admin/guided-path-templates",
      icon: Map,
      tourId: "admin-guided-path-templates",
    },
    {
      title: "Guided Path Families",
      url: "/admin/guided-path-families",
      icon: Layers,
      tourId: "admin-guided-path-families",
    },
  ];

  // Users & Clients submenu items
  const adminPeopleItems = [
    {
      title: "Users",
      url: "/admin/users",
      icon: UserCog,
      tourId: "admin-users",
    },
    {
      title: "Clients",
      url: "/admin/clients",
      icon: Users,
      tourId: "admin-clients",
    },
    {
      title: "Enrolments",
      url: "/admin/enrolments",
      icon: ListChecks,
      tourId: "admin-enrolments",
    },
    {
      title: "Instructors",
      url: "/admin/instructors",
      icon: GraduationCap,
      tourId: "admin-instructors",
    },
    {
      title: "Coaches",
      url: "/admin/coaches",
      icon: UserCheck,
      tourId: "admin-coaches",
    },
    {
      title: "Coach/Instructor Requests",
      url: "/admin/coach-instructor-requests",
      icon: ClipboardList,
      tourId: "admin-coach-instructor-requests",
    },
    {
      title: "Staff Assignments",
      url: "/admin/staff-assignments",
      icon: UserCheck,
      tourId: "admin-staff-assignments",
    },
    {
      title: "Interest Registrations",
      url: "/admin/interest-registrations",
      icon: ClipboardList,
      tourId: "admin-interest-registrations",
    },
    {
      title: "Groups",
      url: "/admin/groups",
      icon: UsersRound,
      tourId: "admin-groups",
    },
    {
      title: "Deletion Requests",
      url: "/admin/deletion-requests",
      icon: UserX,
      tourId: "admin-deletion-requests",
    },
    {
      title: "Program Completions",
      url: "/admin/program-completions",
      icon: Award,
      tourId: "admin-program-completions",
    },
    {
      title: "Status Markers",
      url: "/admin/status-markers",
      icon: CircleDot,
      tourId: "admin-status-markers",
    },
    {
      title: "User Behavior",
      url: "/admin/user-behavior",
      icon: BarChart3,
      tourId: "admin-user-behavior",
    },
    {
      title: "Cohort Analytics",
      url: "/admin/cohort-analytics",
      icon: CalendarDays,
      tourId: "admin-cohort-analytics",
    },
  ];

  // Plans & Monetization submenu items
  const adminMonetizationItems = [
    {
      title: "Subscription Plans",
      url: "/admin/plans",
      icon: DollarSign,
      tourId: "admin-plans",
    },
    {
      title: "Program Plans",
      url: "/admin/program-plans",
      icon: Package,
      tourId: "admin-program-plans",
    },
    {
      title: "Tracks",
      url: "/admin/tracks",
      icon: Layers,
      tourId: "admin-tracks",
    },
    {
      title: "Features",
      url: "/admin/features",
      icon: Zap,
      tourId: "admin-features",
    },
    {
      title: "Add-ons",
      url: "/admin/add-ons",
      icon: Package,
      tourId: "admin-add-ons",
    },
    {
      title: "User Add-ons",
      url: "/admin/user-add-ons",
      icon: Package,
      tourId: "admin-user-add-ons",
    },
    {
      title: "Credit Packages",
      url: "/admin/credit-topup-packages",
      icon: Coins,
      tourId: "admin-credit-packages",
    },
    {
      title: "Credit Services",
      url: "/admin/credit-services",
      icon: Coins,
      tourId: "admin-credit-services",
    },
    {
      title: "Discount Codes",
      url: "/admin/discount-codes",
      icon: Tag,
      tourId: "admin-discount-codes",
    },
    {
      title: "Consumption",
      url: "/admin/consumption",
      icon: Coins,
      tourId: "admin-consumption",
    },
    {
      title: "Org Billing",
      url: "/admin/org-billing",
      icon: Coins,
      tourId: "admin-org-billing",
    },
    {
      title: "Payment Schedules",
      url: "/admin/payment-schedules",
      icon: Coins,
      tourId: "admin-payment-schedules",
    },
  ];

  // Admin integration items - separated for cleaner UI
  const adminIntegrationItems = [
    {
      title: "InnoTrue Academy",
      url: "/admin/talentlms",
      icon: Link2,
    },
    {
      title: "InnoTrue Community",
      url: "/admin/circle",
      icon: Link2,
    },
    {
      title: "Calendar Mappings",
      url: "/admin/calcom-mappings",
      icon: Calendar,
    },
    {
      title: "Lucid",
      url: "/admin/lucid",
      icon: Link2,
    },
    {
      title: "Google Drive",
      url: "/admin/google-drive",
      icon: Link2,
    },
  ];

  // Instructor/Coach items
  const teachingItems = [
    {
      title: "Assigned Programs",
      url: "/teaching",
      icon: GraduationCap,
      tourId: "teaching-dashboard",
    },
    {
      title: "Client Progress",
      url: "/teaching/students",
      icon: Users,
      tourId: "teaching-students",
    },
    {
      title: "Readiness",
      url: "/teaching/readiness",
      icon: Gauge,
      tourId: "teaching-readiness",
    },
    {
      title: "Assignments",
      url: "/teaching/assignments",
      icon: ClipboardList,
      tourId: "teaching-assignments",
    },
    {
      title: "Groups",
      url: "/teaching/groups",
      icon: UsersRound,
      tourId: "teaching-groups",
    },
    {
      title: "Cohorts",
      url: "/teaching/cohorts",
      icon: CalendarDays,
      tourId: "teaching-cohorts",
    },
    {
      title: "Shared Goals",
      url: "/teaching/shared-goals",
      icon: Target,
      tourId: "teaching-shared-goals",
    },
    {
      title: "Shared Decisions",
      url: "/coaching/decisions",
      icon: Brain,
      tourId: "coaching-decisions",
    },
    {
      title: "Shared Tasks",
      url: "/coaching/tasks",
      icon: CheckSquare,
      tourId: "coaching-tasks",
    },
    {
      title: "Assessments",
      url: "/teaching/assessments",
      icon: ClipboardCheck,
      tourId: "teaching-assessments",
    },
    {
      title: "Scenarios",
      url: "/teaching/scenarios",
      icon: Lightbulb,
      tourId: "teaching-scenarios",
    },
    {
      title: "Badge Approvals",
      url: "/teaching/badges",
      icon: Award,
      tourId: "badge-approvals",
    },
  ];

  // Get navigation items based on the SELECTED role (not all roles)
  const getItemsForRole = (): Array<{
    title: string;
    url: string;
    icon: any;
  }> => {
    switch (userRole) {
      case "admin":
        return adminItems;
      case "instructor":
      case "coach":
        return teachingItems;
      case "client":
      default:
        return clientItems;
    }
  };
  const items = getItemsForRole();
  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        {open && (
          <>
            <div className="pt-4 pb-2">
              <RoleBadges />
            </div>

            <div className="px-3 pt-1 pb-4 text-muted-foreground">
              <RoleSwitcher />
            </div>
          </>
        )}

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const visibility = getItemVisibility(item);

                // Hidden items are not rendered at all
                if (visibility.visibility === "hidden") {
                  return null;
                }

                // Locked items show with lock indicator
                if (visibility.visibility === "locked") {
                  return (
                    <SidebarMenuItem key={item.title}>
                      <TooltipProvider delayDuration={300}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <SidebarMenuButton
                              onClick={(e) => handleLockedItemClick(item, visibility, e)}
                              className="hover:bg-muted text-sidebar-foreground/60 rounded-md cursor-pointer"
                              data-tour={(item as any).tourId}
                            >
                              <div className="relative">
                                <item.icon className="mr-2 h-4 w-4" />
                                <Lock className="absolute -top-1 -right-1 h-2.5 w-2.5 text-muted-foreground" />
                              </div>
                              {open && <span>{item.title}</span>}
                              {open && <Lock className="ml-auto h-3 w-3 text-muted-foreground" />}
                            </SidebarMenuButton>
                          </TooltipTrigger>
                          <TooltipContent side="right">
                            <p className="text-xs">
                              {visibility.requiredPlan
                                ? `Available with ${visibility.requiredPlan} ${visibility.sourceDisplayName || "plan"}`
                                : "Premium feature — upgrade to unlock"}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </SidebarMenuItem>
                  );
                }

                // Accessible items render normally
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end={
                          item.url === "/dashboard" ||
                          item.url === "/admin" ||
                          item.url === "/teaching"
                        }
                        className="hover:bg-primary hover:text-primary-foreground text-sidebar-foreground rounded-md"
                        activeClassName="bg-primary text-primary-foreground font-medium rounded-md"
                        data-tour={(item as any).tourId}
                      >
                        <item.icon className="mr-2 h-4 w-4" />
                        {open && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {(userRole === "instructor" || userRole === "coach") && (
          <>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  <Collapsible className="group/teaching-platforms">
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton className="hover:bg-primary hover:text-primary-foreground text-sidebar-foreground">
                          <Link2 className="mr-2 h-4 w-4" />
                          {open && <span className="flex-1">External Platforms</span>}
                          {open && (
                            <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]/teaching-platforms:rotate-180" />
                          )}
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          <SidebarMenuSubItem>
                            {talentLmsUser ? (
                              <button
                                onClick={() => loginToTalentLms("")}
                                disabled={talentLmsLoading}
                                className="flex w-full items-start gap-2 rounded-md px-2 py-2 text-sm hover:bg-primary hover:text-primary-foreground text-sidebar-foreground disabled:opacity-50"
                              >
                                <GraduationCap className="h-4 w-4 shrink-0 mt-0.5" />
                                {open && (
                                  <span className="flex-1 text-left leading-tight">
                                    InnoTrue Academy
                                  </span>
                                )}
                                {open && (
                                  <ExternalLink className="h-3 w-3 opacity-50 shrink-0 mt-0.5" />
                                )}
                              </button>
                            ) : (
                              <span className="flex w-full items-start gap-2 rounded-md px-2 py-2 text-sm text-sidebar-foreground opacity-50 cursor-not-allowed">
                                <GraduationCap className="h-4 w-4 shrink-0 mt-0.5" />
                                {open && (
                                  <span className="flex-1 text-left leading-tight">
                                    InnoTrue Academy
                                  </span>
                                )}
                                {open && (
                                  <ExternalLink className="h-3 w-3 opacity-50 shrink-0 mt-0.5" />
                                )}
                              </span>
                            )}
                          </SidebarMenuSubItem>
                          <SidebarMenuSubItem>
                            {lucidUser ? (
                              <button
                                onClick={() => loginToLucid()}
                                disabled={lucidLoading}
                                className="flex w-full items-start gap-2 rounded-md px-2 py-2 text-sm hover:bg-primary hover:text-primary-foreground text-sidebar-foreground disabled:opacity-50"
                              >
                                <Link2 className="h-4 w-4 shrink-0 mt-0.5" />
                                {open && (
                                  <span className="flex-1 text-left leading-tight">Lucid</span>
                                )}
                                {open && (
                                  <ExternalLink className="h-3 w-3 opacity-50 shrink-0 mt-0.5" />
                                )}
                              </button>
                            ) : (
                              <span className="flex w-full items-start gap-2 rounded-md px-2 py-2 text-sm text-sidebar-foreground opacity-50 cursor-not-allowed">
                                <Link2 className="h-4 w-4 shrink-0 mt-0.5" />
                                {open && (
                                  <span className="flex-1 text-left leading-tight">Lucid</span>
                                )}
                                {open && (
                                  <ExternalLink className="h-3 w-3 opacity-50 shrink-0 mt-0.5" />
                                )}
                              </span>
                            )}
                          </SidebarMenuSubItem>
                          <SidebarMenuSubItem>
                            {driveUser ? (
                              <button
                                onClick={openGoogleDrive}
                                disabled={driveLoading}
                                className="flex w-full items-start gap-2 rounded-md px-2 py-2 text-sm hover:bg-primary hover:text-primary-foreground text-sidebar-foreground disabled:opacity-50"
                              >
                                <Link2 className="h-4 w-4 shrink-0 mt-0.5" />
                                {open && (
                                  <span className="flex-1 text-left leading-tight">
                                    Google Drive
                                  </span>
                                )}
                                {open && (
                                  <ExternalLink className="h-3 w-3 opacity-50 shrink-0 mt-0.5" />
                                )}
                              </button>
                            ) : (
                              <span className="flex w-full items-start gap-2 rounded-md px-2 py-2 text-sm text-sidebar-foreground opacity-50 cursor-not-allowed">
                                <Link2 className="h-4 w-4 shrink-0 mt-0.5" />
                                {open && (
                                  <span className="flex-1 text-left leading-tight">
                                    Google Drive
                                  </span>
                                )}
                                {open && (
                                  <ExternalLink className="h-3 w-3 opacity-50 shrink-0 mt-0.5" />
                                )}
                              </span>
                            )}
                          </SidebarMenuSubItem>
                          <SidebarMenuSubItem>
                            {miroUser ? (
                              <a
                                href={miroUser.miro_url || "https://miro.com"}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex w-full items-start gap-2 rounded-md px-2 py-2 text-sm hover:bg-primary hover:text-primary-foreground text-sidebar-foreground"
                              >
                                <Link2 className="h-4 w-4 shrink-0 mt-0.5" />
                                {open && (
                                  <span className="flex-1 text-left leading-tight">Miro</span>
                                )}
                                {open && (
                                  <ExternalLink className="h-3 w-3 opacity-50 shrink-0 mt-0.5" />
                                )}
                              </a>
                            ) : (
                              <span className="flex w-full items-start gap-2 rounded-md px-2 py-2 text-sm text-sidebar-foreground opacity-50 cursor-not-allowed">
                                <Link2 className="h-4 w-4 shrink-0 mt-0.5" />
                                {open && (
                                  <span className="flex-1 text-left leading-tight">Miro</span>
                                )}
                                {open && (
                                  <ExternalLink className="h-3 w-3 opacity-50 shrink-0 mt-0.5" />
                                )}
                              </span>
                            )}
                          </SidebarMenuSubItem>
                          <SidebarMenuSubItem>
                            {muralUser ? (
                              <a
                                href={muralUser.mural_url || "https://mural.co"}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex w-full items-start gap-2 rounded-md px-2 py-2 text-sm hover:bg-primary hover:text-primary-foreground text-sidebar-foreground"
                              >
                                <Link2 className="h-4 w-4 shrink-0 mt-0.5" />
                                {open && (
                                  <span className="flex-1 text-left leading-tight">Mural</span>
                                )}
                                {open && (
                                  <ExternalLink className="h-3 w-3 opacity-50 shrink-0 mt-0.5" />
                                )}
                              </a>
                            ) : (
                              <span className="flex w-full items-start gap-2 rounded-md px-2 py-2 text-sm text-sidebar-foreground opacity-50 cursor-not-allowed">
                                <Link2 className="h-4 w-4 shrink-0 mt-0.5" />
                                {open && (
                                  <span className="flex-1 text-left leading-tight">Mural</span>
                                )}
                                {open && (
                                  <ExternalLink className="h-3 w-3 opacity-50 shrink-0 mt-0.5" />
                                )}
                              </span>
                            )}
                          </SidebarMenuSubItem>
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}

        {userRole === "client" && (
          <>
            {/* My Journey group - before Programs */}
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  <Collapsible className="group/client-planning">
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton className="hover:bg-primary hover:text-primary-foreground text-sidebar-foreground">
                          <Target className="mr-2 h-4 w-4" />
                          {open && <span className="flex-1">My Journey</span>}
                          {open && (
                            <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]/client-planning:rotate-180" />
                          )}
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {clientPlanningItems.map((item) => {
                            const visibility = getItemVisibility(item);

                            // Hidden items are not rendered at all
                            if (visibility.visibility === "hidden") {
                              return null;
                            }

                            // Locked items show with lock indicator
                            if (visibility.visibility === "locked") {
                              return (
                                <SidebarMenuSubItem key={item.title}>
                                  <TooltipProvider delayDuration={300}>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <button
                                          onClick={(e) =>
                                            handleLockedItemClick(item, visibility, e)
                                          }
                                          className={cn(
                                            "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                                            "text-sidebar-foreground/60 hover:bg-muted cursor-pointer",
                                          )}
                                          data-tour={item.tourId}
                                        >
                                          <div className="relative">
                                            <item.icon className="h-4 w-4" />
                                            <Lock className="absolute -top-1 -right-1 h-2 w-2 text-muted-foreground" />
                                          </div>
                                          {open && <span>{item.title}</span>}
                                          {open && (
                                            <Lock className="ml-auto h-3 w-3 text-muted-foreground" />
                                          )}
                                        </button>
                                      </TooltipTrigger>
                                      <TooltipContent side="right">
                                        <p className="text-xs">
                                          {visibility.requiredPlan
                                            ? `Available with ${visibility.requiredPlan} ${visibility.sourceDisplayName || "plan"}`
                                            : "Premium feature — upgrade to unlock"}
                                        </p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </SidebarMenuSubItem>
                              );
                            }

                            // Accessible items render normally
                            return (
                              <SidebarMenuSubItem key={item.title}>
                                <SidebarMenuSubButton asChild>
                                  <NavLink
                                    to={item.url}
                                    className="hover:bg-primary hover:text-primary-foreground text-sidebar-foreground"
                                    activeClassName="bg-secondary text-secondary-foreground font-medium"
                                    data-tour={item.tourId}
                                  >
                                    <item.icon className="mr-2 h-4 w-4" />
                                    {open && <span>{item.title}</span>}
                                  </NavLink>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            );
                          })}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Programs group */}
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  <Collapsible className="group/client-learning">
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton className="hover:bg-primary hover:text-primary-foreground text-sidebar-foreground">
                          <BookOpen className="mr-2 h-4 w-4" />
                          {open && <span className="flex-1">Programs</span>}
                          {open && (
                            <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]/client-learning:rotate-180" />
                          )}
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {clientLearningItems.map((item) => (
                            <SidebarMenuSubItem key={item.title}>
                              <SidebarMenuSubButton asChild>
                                <NavLink
                                  to={item.url}
                                  className="hover:bg-primary hover:text-primary-foreground text-sidebar-foreground"
                                  activeClassName="bg-secondary text-secondary-foreground font-medium"
                                  data-tour={item.tourId}
                                >
                                  <item.icon className="mr-2 h-4 w-4" />
                                  {open && <span>{item.title}</span>}
                                </NavLink>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Assessments group */}
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  <Collapsible className="group/client-assessments">
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton className="hover:bg-primary hover:text-primary-foreground text-sidebar-foreground">
                          <FileText className="mr-2 h-4 w-4" />
                          {open && <span className="flex-1">Assessments</span>}
                          {open && (
                            <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]/client-assessments:rotate-180" />
                          )}
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {clientAssessmentItems.map((item) => (
                            <SidebarMenuSubItem key={item.title}>
                              <SidebarMenuSubButton asChild>
                                <NavLink
                                  to={item.url}
                                  end={item.end}
                                  className="hover:bg-primary hover:text-primary-foreground text-sidebar-foreground"
                                  activeClassName="bg-secondary text-secondary-foreground font-medium"
                                  data-tour={item.tourId}
                                >
                                  <item.icon className="mr-2 h-4 w-4" />
                                  {open && <span>{item.title}</span>}
                                </NavLink>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}

        {userRole === "admin" && (
          <>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  <Collapsible className="group/collapsible">
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton className="hover:bg-primary hover:text-primary-foreground text-sidebar-foreground">
                          <BookOpen className="mr-2 h-4 w-4" />
                          {open && <span className="flex-1">Programs</span>}
                          {open && (
                            <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                          )}
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {adminProgramItems.map((item) => (
                            <SidebarMenuSubItem key={item.title}>
                              <SidebarMenuSubButton asChild>
                                <NavLink
                                  to={item.url}
                                  className="hover:bg-primary hover:text-primary-foreground text-sidebar-foreground"
                                  activeClassName="bg-secondary text-secondary-foreground font-medium"
                                  data-tour={item.tourId}
                                >
                                  <item.icon className="mr-2 h-4 w-4" />
                                  {open && <span>{item.title}</span>}
                                </NavLink>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  <Collapsible className="group/admin-resources">
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton className="hover:bg-primary hover:text-primary-foreground text-sidebar-foreground">
                          <FolderOpen className="mr-2 h-4 w-4" />
                          {open && <span className="flex-1">Resources</span>}
                          {open && (
                            <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]/admin-resources:rotate-180" />
                          )}
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {adminResourceItems.map((item) => (
                            <SidebarMenuSubItem key={item.title}>
                              <SidebarMenuSubButton asChild>
                                <NavLink
                                  to={item.url}
                                  className="hover:bg-primary hover:text-primary-foreground text-sidebar-foreground"
                                  activeClassName="bg-secondary text-secondary-foreground font-medium"
                                  data-tour={item.tourId}
                                >
                                  <item.icon className="mr-2 h-4 w-4" />
                                  {open && <span>{item.title}</span>}
                                </NavLink>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  <Collapsible className="group/collapsible2">
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton className="hover:bg-primary hover:text-primary-foreground text-sidebar-foreground">
                          <Users className="mr-2 h-4 w-4" />
                          {open && <span className="flex-1">Users & Groups</span>}
                          {open && (
                            <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]/collapsible2:rotate-180" />
                          )}
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {adminPeopleItems.map((item) => (
                            <SidebarMenuSubItem key={item.title}>
                              <SidebarMenuSubButton asChild>
                                <NavLink
                                  to={item.url}
                                  className="hover:bg-primary hover:text-primary-foreground text-sidebar-foreground"
                                  activeClassName="bg-secondary text-secondary-foreground font-medium"
                                  data-tour={item.tourId}
                                >
                                  <item.icon className="mr-2 h-4 w-4" />
                                  {open && <span>{item.title}</span>}
                                </NavLink>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  <Collapsible className="group/collapsible3">
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton className="hover:bg-primary hover:text-primary-foreground text-sidebar-foreground">
                          <DollarSign className="mr-2 h-4 w-4" />
                          {open && <span className="flex-1">Plans & Add-ons</span>}
                          {open && (
                            <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]/collapsible3:rotate-180" />
                          )}
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {adminMonetizationItems.map((item) => (
                            <SidebarMenuSubItem key={item.title}>
                              <SidebarMenuSubButton asChild>
                                <NavLink
                                  to={item.url}
                                  className="hover:bg-primary hover:text-primary-foreground text-sidebar-foreground"
                                  activeClassName="bg-secondary text-secondary-foreground font-medium"
                                  data-tour={item.tourId}
                                >
                                  <item.icon className="mr-2 h-4 w-4" />
                                  {open && <span>{item.title}</span>}
                                </NavLink>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  <Collapsible className="group/collapsible4">
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton className="hover:bg-primary hover:text-primary-foreground text-sidebar-foreground">
                          <FileText className="mr-2 h-4 w-4" />
                          {open && <span className="flex-1">Assessments</span>}
                          {open && (
                            <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]/collapsible4:rotate-180" />
                          )}
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {adminAssessmentItems.map((item) => (
                            <SidebarMenuSubItem key={item.title}>
                              <SidebarMenuSubButton asChild>
                                <NavLink
                                  to={item.url}
                                  className="hover:bg-primary hover:text-primary-foreground text-sidebar-foreground"
                                  activeClassName="bg-secondary text-secondary-foreground font-medium"
                                  data-tour={item.tourId}
                                >
                                  <item.icon className="mr-2 h-4 w-4" />
                                  {open && <span>{item.title}</span>}
                                </NavLink>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  <Collapsible className="group/collapsible5">
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton className="hover:bg-primary hover:text-primary-foreground text-sidebar-foreground">
                          <Link2 className="mr-2 h-4 w-4" />
                          {open && <span className="flex-1">Integrations</span>}
                          {open && (
                            <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]/collapsible5:rotate-180" />
                          )}
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {adminIntegrationItems.map((item) => (
                            <SidebarMenuSubItem key={item.title}>
                              <SidebarMenuSubButton asChild>
                                <NavLink
                                  to={item.url}
                                  className="hover:bg-primary hover:text-primary-foreground text-sidebar-foreground"
                                  activeClassName="bg-secondary text-secondary-foreground font-medium"
                                >
                                  <item.icon className="mr-2 h-4 w-4" />
                                  {open && <span>{item.title}</span>}
                                </NavLink>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  <Collapsible className="group/collapsible6">
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton className="hover:bg-primary hover:text-primary-foreground text-sidebar-foreground">
                          <Mail className="mr-2 h-4 w-4" />
                          {open && <span className="flex-1">Communications</span>}
                          {open && (
                            <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]/collapsible6:rotate-180" />
                          )}
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {adminCommunicationsItems.map((item) => (
                            <SidebarMenuSubItem key={item.title}>
                              <SidebarMenuSubButton asChild>
                                <NavLink
                                  to={item.url}
                                  className="hover:bg-primary hover:text-primary-foreground text-sidebar-foreground"
                                  activeClassName="bg-secondary text-secondary-foreground font-medium"
                                  data-tour={item.tourId}
                                >
                                  <item.icon className="mr-2 h-4 w-4" />
                                  {open && <span>{item.title}</span>}
                                </NavLink>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
        {userRole === "client" && (
          <>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  <Collapsible className="group/client-external">
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton className="hover:bg-primary hover:text-primary-foreground text-sidebar-foreground !h-auto py-2 items-start">
                          <ExternalLink className="mr-2 h-4 w-4 shrink-0 mt-0.5" />
                          {open && <span className="flex-1 leading-tight">External Platforms</span>}
                          {open && (
                            <ChevronDown className="h-4 w-4 shrink-0 mt-0.5 transition-transform group-data-[state=open]/client-external:rotate-180" />
                          )}
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {communityVisibility.visibility === "accessible" && (
                            <SidebarMenuSubItem>
                              {circleUser ? (
                                <button
                                  onClick={loginToCircle}
                                  disabled={circleLoading}
                                  className="flex w-full items-start gap-2 rounded-md px-2 py-2 text-sm hover:bg-primary hover:text-primary-foreground text-sidebar-foreground disabled:opacity-50"
                                >
                                  <Users className="h-4 w-4 shrink-0 mt-0.5" />
                                  {open && (
                                    <span className="flex-1 text-left leading-tight">
                                      InnoTrue Community
                                    </span>
                                  )}
                                  {open && (
                                    <ExternalLink className="h-3 w-3 opacity-50 shrink-0 mt-0.5" />
                                  )}
                                </button>
                              ) : (
                                <SidebarMenuSubButton
                                  asChild
                                  className="hover:bg-primary hover:text-primary-foreground text-sidebar-foreground !h-auto py-2"
                                >
                                  <NavLink to="/community" className="items-start">
                                    <Users className="mr-2 h-4 w-4 shrink-0 mt-0.5" />
                                    {open && (
                                      <span className="flex-1 leading-tight">
                                        InnoTrue Community
                                      </span>
                                    )}
                                    {open && (
                                      <ExternalLink className="h-3 w-3 opacity-50 shrink-0 mt-0.5" />
                                    )}
                                  </NavLink>
                                </SidebarMenuSubButton>
                              )}
                            </SidebarMenuSubItem>
                          )}
                          <SidebarMenuSubItem>
                            {talentLmsUser ? (
                              <button
                                onClick={() => loginToTalentLms("")}
                                disabled={talentLmsLoading}
                                className="flex w-full items-start gap-2 rounded-md px-2 py-2 text-sm hover:bg-primary hover:text-primary-foreground text-sidebar-foreground disabled:opacity-50"
                              >
                                <GraduationCap className="h-4 w-4 shrink-0 mt-0.5" />
                                {open && (
                                  <span className="flex-1 text-left leading-tight">
                                    InnoTrue Academy
                                  </span>
                                )}
                                {open && (
                                  <ExternalLink className="h-3 w-3 opacity-50 shrink-0 mt-0.5" />
                                )}
                              </button>
                            ) : (
                              <SidebarMenuSubButton
                                asChild
                                className="hover:bg-primary hover:text-primary-foreground text-sidebar-foreground !h-auto py-2"
                              >
                                <NavLink to="/academy" className="items-start">
                                  <GraduationCap className="mr-2 h-4 w-4 shrink-0 mt-0.5" />
                                  {open && (
                                    <span className="flex-1 leading-tight">InnoTrue Academy</span>
                                  )}
                                  {open && (
                                    <ExternalLink className="h-3 w-3 opacity-50 shrink-0 mt-0.5" />
                                  )}
                                </NavLink>
                              </SidebarMenuSubButton>
                            )}
                          </SidebarMenuSubItem>
                          <SidebarMenuSubItem>
                            {lucidUser ? (
                              <button
                                onClick={() => loginToLucid()}
                                disabled={lucidLoading}
                                className="flex w-full items-start gap-2 rounded-md px-2 py-2 text-sm hover:bg-primary hover:text-primary-foreground text-sidebar-foreground disabled:opacity-50"
                              >
                                <Link2 className="h-4 w-4 shrink-0 mt-0.5" />
                                {open && (
                                  <span className="flex-1 text-left leading-tight">Lucid</span>
                                )}
                                {open && (
                                  <ExternalLink className="h-3 w-3 opacity-50 shrink-0 mt-0.5" />
                                )}
                              </button>
                            ) : (
                              <span className="flex w-full items-start gap-2 rounded-md px-2 py-2 text-sm text-sidebar-foreground opacity-50 cursor-not-allowed">
                                <Link2 className="h-4 w-4 shrink-0 mt-0.5" />
                                {open && (
                                  <span className="flex-1 text-left leading-tight">Lucid</span>
                                )}
                                {open && (
                                  <ExternalLink className="h-3 w-3 opacity-50 shrink-0 mt-0.5" />
                                )}
                              </span>
                            )}
                          </SidebarMenuSubItem>
                          <SidebarMenuSubItem>
                            {driveUser ? (
                              <button
                                onClick={openGoogleDrive}
                                disabled={driveLoading}
                                className="flex w-full items-start gap-2 rounded-md px-2 py-2 text-sm hover:bg-primary hover:text-primary-foreground text-sidebar-foreground disabled:opacity-50"
                              >
                                <Link2 className="h-4 w-4 shrink-0 mt-0.5" />
                                {open && (
                                  <span className="flex-1 text-left leading-tight">
                                    Google Drive
                                  </span>
                                )}
                                {open && (
                                  <ExternalLink className="h-3 w-3 opacity-50 shrink-0 mt-0.5" />
                                )}
                              </button>
                            ) : (
                              <span className="flex w-full items-start gap-2 rounded-md px-2 py-2 text-sm text-sidebar-foreground opacity-50 cursor-not-allowed">
                                <Link2 className="h-4 w-4 shrink-0 mt-0.5" />
                                {open && (
                                  <span className="flex-1 text-left leading-tight">
                                    Google Drive
                                  </span>
                                )}
                                {open && (
                                  <ExternalLink className="h-3 w-3 opacity-50 shrink-0 mt-0.5" />
                                )}
                              </span>
                            )}
                          </SidebarMenuSubItem>
                          <SidebarMenuSubItem>
                            {miroUser ? (
                              <a
                                href={miroUser.miro_url || "https://miro.com"}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex w-full items-start gap-2 rounded-md px-2 py-2 text-sm hover:bg-primary hover:text-primary-foreground text-sidebar-foreground"
                              >
                                <Link2 className="h-4 w-4 shrink-0 mt-0.5" />
                                {open && (
                                  <span className="flex-1 text-left leading-tight">Miro</span>
                                )}
                                {open && (
                                  <ExternalLink className="h-3 w-3 opacity-50 shrink-0 mt-0.5" />
                                )}
                              </a>
                            ) : (
                              <span className="flex w-full items-start gap-2 rounded-md px-2 py-2 text-sm text-sidebar-foreground opacity-50 cursor-not-allowed">
                                <Link2 className="h-4 w-4 shrink-0 mt-0.5" />
                                {open && (
                                  <span className="flex-1 text-left leading-tight">Miro</span>
                                )}
                                {open && (
                                  <ExternalLink className="h-3 w-3 opacity-50 shrink-0 mt-0.5" />
                                )}
                              </span>
                            )}
                          </SidebarMenuSubItem>
                          <SidebarMenuSubItem>
                            {muralUser ? (
                              <a
                                href={muralUser.mural_url || "https://mural.co"}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex w-full items-start gap-2 rounded-md px-2 py-2 text-sm hover:bg-primary hover:text-primary-foreground text-sidebar-foreground"
                              >
                                <Link2 className="h-4 w-4 shrink-0 mt-0.5" />
                                {open && (
                                  <span className="flex-1 text-left leading-tight">Mural</span>
                                )}
                                {open && (
                                  <ExternalLink className="h-3 w-3 opacity-50 shrink-0 mt-0.5" />
                                )}
                              </a>
                            ) : (
                              <span className="flex w-full items-start gap-2 rounded-md px-2 py-2 text-sm text-sidebar-foreground opacity-50 cursor-not-allowed">
                                <Link2 className="h-4 w-4 shrink-0 mt-0.5" />
                                {open && (
                                  <span className="flex-1 text-left leading-tight">Mural</span>
                                )}
                                {open && (
                                  <ExternalLink className="h-3 w-3 opacity-50 shrink-0 mt-0.5" />
                                )}
                              </span>
                            )}
                          </SidebarMenuSubItem>
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}

        {/* Support & FAQ - Always visible at bottom */}
        <SidebarGroup className="mt-auto border-t">
          <SidebarGroupContent>
            <SidebarMenu>
              {userRole === "admin" && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to="/admin/faq"
                      className="hover:bg-primary hover:text-primary-foreground text-sidebar-foreground rounded-md"
                      activeClassName="bg-primary text-primary-foreground"
                    >
                      <HelpCircle className="mr-2 h-4 w-4" />
                      {open && <span>Admin FAQ</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink
                    to="/faq"
                    className="hover:bg-primary hover:text-primary-foreground text-sidebar-foreground rounded-md"
                    activeClassName="bg-primary text-primary-foreground"
                  >
                    <HelpCircle className="mr-2 h-4 w-4" />
                    {open && <span>FAQ</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <a
                    href={`mailto:${supportEmail}?subject=Support Request from InnoTrue Hub`}
                    className="hover:bg-primary hover:text-primary-foreground text-sidebar-foreground rounded-md"
                  >
                    <Mail className="mr-2 h-4 w-4" />
                    {open && <span>Contact Support</span>}
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
