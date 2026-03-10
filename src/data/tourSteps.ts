import { TourStep } from "@/hooks/useOnboardingTour";

/**
 * Tour steps for different user roles.
 *
 * IMPORTANT: When adding new steps, consider adding a feature key mapping
 * in src/hooks/useDynamicTourSteps.ts to control visibility based on entitlements.
 *
 * Steps without a feature mapping are always visible.
 * Steps with a mapping are only shown if the user has access to that feature.
 *
 * Tour targets must match `data-tour` attributes in the sidebar (AppSidebar.tsx).
 * Run `grep -r 'data-tour=' src/components/AppSidebar.tsx` to verify targets exist.
 */

export const clientTourSteps: TourStep[] = [
  {
    target: '[data-tour="client-dashboard"]',
    title: "Welcome to Your Dashboard",
    content:
      "Your personal hub showing journey progress, active programs, upcoming sessions, and quick stats for your development activities.",
    placement: "bottom",
  },
  {
    target: '[data-tour="client-programs"]',
    title: "My Programs",
    content:
      "View all enrolled programs, track module progress, access content, and complete assignments. Click any program to dive into its modules.",
    placement: "right",
  },
  {
    target: '[data-tour="client-assignments"]',
    title: "Assignments",
    content:
      "View all your assignments across programs in one place. Submit work, track status, and see instructor feedback and scores.",
    placement: "right",
  },
  {
    // Feature key: feedback_reviews
    target: '[data-tour="client-feedback"]',
    title: "My Feedback",
    content:
      "View all feedback and reviews from your instructors and coaches across assignments, sessions, and assessments.",
    placement: "right",
  },
  {
    target: '[data-tour="client-calendar"]',
    title: "Calendar",
    content:
      "View all scheduled sessions, program dates, and deadlines. Sync with Google Calendar or Outlook.",
    placement: "right",
  },
  {
    // Feature key: guided_paths
    target: '[data-tour="client-guided-paths"]',
    title: "Guided Paths",
    content:
      "Discover personalized learning journeys through guided surveys that recommend programs based on your goals.",
    placement: "right",
  },
  {
    // Feature key: groups
    target: '[data-tour="client-groups"]',
    title: "Groups",
    content:
      "Participate in peer groups, attend group sessions, volunteer as an assessor for peer presentations, and collaborate on shared goals.",
    placement: "right",
  },
  {
    // Feature key: skills_map
    target: '[data-tour="client-skills"]',
    title: "Skills Map",
    content:
      "Visualize your skill development across categories. See which skills you're building through programs, resources, and assessments.",
    placement: "right",
  },
  {
    // Feature key: services
    target: '[data-tour="client-services"]',
    title: "Services",
    content:
      "Browse and consume premium services like AI coaching sessions using your credit balance.",
    placement: "right",
  },
  {
    // Feature key: credits
    target: '[data-tour="client-credits"]',
    title: "Credits",
    content:
      "View your credit balance from plans, programs, and grants. Use credits to access premium services and AI features.",
    placement: "right",
  },
  {
    // Feature key: usage
    target: '[data-tour="client-usage"]',
    title: "Usage",
    content:
      "Track your AI credit usage, feature consumption, and monthly usage patterns against your plan limits.",
    placement: "right",
  },
  {
    // Feature key: wheel_of_life
    target: '[data-tour="client-wheel-of-life"]',
    title: "Wheel of Life",
    content:
      "Assess satisfaction across 10 life domains, track changes over time, and set improvement goals. Export results as PDF.",
    placement: "right",
  },
  {
    // Feature key: goals
    target: '[data-tour="client-goals"]',
    title: "Goals",
    content:
      "Set personal goals with milestones across life domains. Track progress, add reflections, and optionally share with coaches.",
    placement: "right",
  },
  {
    // Feature key: decision_toolkit_basic
    target: '[data-tour="client-decisions"]',
    title: "Decisions",
    content:
      "Document and analyze important decisions using frameworks like 10-10-10, Buyer's Model, and more. Get AI insights and track outcomes.",
    placement: "right",
  },
  {
    // Feature key: decision_toolkit_basic
    target: '[data-tour="client-tasks"]',
    title: "Tasks",
    content:
      "Manage personal tasks with priorities and due dates. Link to decisions or goals and share with coaches for accountability.",
    placement: "right",
  },
  {
    // Feature key: development_items
    target: '[data-tour="client-development-items"]',
    title: "Development Items",
    content:
      "Track specific growth areas identified during coaching, assessments, or self-reflection with action steps and linked resources.",
    placement: "right",
  },
  {
    // Feature key: development_timeline
    target: '[data-tour="client-development-timeline"]',
    title: "Development Timeline",
    content:
      "View your complete journey as a chronological timeline of achievements, completions, and milestones.",
    placement: "right",
  },
  {
    // Feature key: assessments
    target: '[data-tour="client-my-assessments"]',
    title: "Assessment Results",
    content:
      "View results from all your assessments in one place — self-evaluations, evaluator grades, and peer reviews with score breakdowns.",
    placement: "right",
  },
  {
    // Feature key: assessments
    target: '[data-tour="client-capability-assessments"]',
    title: "Capability Assessments",
    content:
      "Take capability self-assessments across scored domains, view evaluator and peer results, and track your evolution over time.",
    placement: "right",
  },
  {
    // Feature key: ai_recommendations
    target: '[data-tour="client-recommendations"]',
    title: "Recommendations",
    content:
      "Get AI-powered course suggestions based on your values, interests, goals, future vision, and constraints.",
    placement: "right",
  },
];

export const instructorTourSteps: TourStep[] = [
  {
    target: '[data-tour="teaching-dashboard"]',
    title: "Welcome to Your Teaching Hub",
    content:
      "View programs and modules assigned to you. Track client progress, review assignments, and provide feedback.",
    placement: "bottom",
  },
  {
    target: '[data-tour="teaching-students"]',
    title: "Client Progress",
    content:
      "Monitor all clients in your assigned programs. View completion rates, engagement metrics, and drill into individual student details.",
    placement: "right",
  },
  {
    target: '[data-tour="teaching-readiness"]',
    title: "Readiness",
    content:
      "Check client readiness indicators across your programs. See who needs attention before upcoming sessions or deadlines.",
    placement: "right",
  },
  {
    target: '[data-tour="teaching-assignments"]',
    title: "Assignments",
    content:
      "Review and grade submitted assignments. Use feedback templates for consistent evaluations. View linked scenarios directly from assignment reviews.",
    placement: "right",
  },
  {
    // Feature key: groups
    target: '[data-tour="teaching-groups"]',
    title: "Groups",
    content:
      "Lead group sessions, manage check-ins, add notes, and track member progress. Facilitate peer presentations and evaluations.",
    placement: "right",
  },
  {
    target: '[data-tour="teaching-cohorts"]',
    title: "Cohorts",
    content:
      "Manage program cohorts with scheduled sessions. Track cohort-level progress and attendance across your assigned programs.",
    placement: "right",
  },
  {
    // Feature key: goals
    target: '[data-tour="teaching-shared-goals"]',
    title: "Shared Goals",
    content:
      "View goals clients have shared with you. Add comments, track milestones, and provide guidance.",
    placement: "right",
  },
  {
    // Feature key: decision_toolkit_basic
    target: '[data-tour="coaching-decisions"]',
    title: "Shared Decisions",
    content:
      "Review decisions clients are working through. Help them analyze options and use decision frameworks.",
    placement: "right",
  },
  {
    // Feature key: tasks
    target: '[data-tour="coaching-tasks"]',
    title: "Shared Tasks",
    content:
      "Track tasks clients have shared for accountability. Monitor progress and provide support.",
    placement: "right",
  },
  {
    target: '[data-tour="teaching-assessments"]',
    title: "Assessments",
    content:
      "Evaluate clients on capability assessments. Grade domain scores, add notes, and track assessment completion across your programs.",
    placement: "right",
  },
  {
    target: '[data-tour="teaching-scenarios"]',
    title: "Scenarios",
    content:
      "Review and evaluate client scenario assignments. Score paragraph responses across domains and provide detailed feedback.",
    placement: "right",
  },
  {
    target: '[data-tour="badge-approvals"]',
    title: "Badge Approvals",
    content:
      "Review and approve badge requests from clients who have met program completion criteria.",
    placement: "right",
  },
  {
    target: '[data-tour="teaching-guide"]',
    title: "Teaching Guide",
    content:
      "Access documentation and best practices for instructors and coaches. Find tips for effective client support.",
    placement: "right",
  },
];

export const adminTourSteps: TourStep[] = [
  {
    target: '[data-tour="admin-dashboard"]',
    title: "Welcome to Admin Dashboard",
    content:
      "This is your command center for managing the entire platform. View key metrics, pending items, and quick actions at a glance.",
    placement: "bottom",
  },
  {
    target: '[data-tour="admin-organizations"]',
    title: "Organizations",
    content:
      "Manage B2B organizations with seat-based membership, sponsored plans, custom terms, and billing.",
    placement: "right",
  },
  {
    target: '[data-tour="admin-platform-terms"]',
    title: "Platform Terms",
    content:
      "Manage platform-wide terms of service that all users must accept. Version and track acceptance status.",
    placement: "right",
  },
  {
    target: '[data-tour="admin-settings"]',
    title: "System Settings",
    content:
      "Configure platform-wide settings including signup toggle, authentication contexts, and system defaults.",
    placement: "right",
  },
  {
    target: '[data-tour="admin-programs"]',
    title: "Program Management",
    content:
      "Create programs with modules, versions, cohorts, and badges. Configure prerequisites, tier-based access, and assign instructors/coaches.",
    placement: "right",
  },
  {
    target: '[data-tour="admin-calendar"]',
    title: "Schedule Calendar",
    content:
      "View all scheduled sessions, program dates, and module deadlines across the platform in a unified calendar.",
    placement: "right",
  },
  {
    target: '[data-tour="admin-module-types"]',
    title: "Module Types",
    content:
      "Define module categories (Content, Session, Assignment, Academy) that determine how modules behave and are displayed.",
    placement: "right",
  },
  {
    target: '[data-tour="admin-feedback-templates"]',
    title: "Feedback Templates",
    content:
      "Create structured rubrics and templates for consistent instructor feedback on assignments and reflections.",
    placement: "right",
  },
  {
    // Feature key: guided_paths
    target: '[data-tour="admin-guided-path-templates"]',
    title: "Guided Paths",
    content:
      "Create personalized learning journeys with survey-based recommendations. Build path families with conditional logic to guide users to relevant programs.",
    placement: "right",
  },
  {
    target: '[data-tour="admin-content-library"]',
    title: "Content Library",
    content:
      "Upload and manage content packages (xAPI, web) that power module content delivery. Track package types and usage.",
    placement: "right",
  },
  {
    target: '[data-tour="admin-resource-library"]',
    title: "Resource Library",
    content:
      "Manage centralized resources (documents, videos, templates) with skill tags and visibility controls. Assign to modules or share directly.",
    placement: "right",
  },
  {
    target: '[data-tour="admin-scenario-templates"]',
    title: "Scenario Templates",
    content:
      "Build scenario-based assessments with sections, paragraphs, and domain-linked questions. Assign to modules for client completion and instructor evaluation.",
    placement: "right",
  },
  {
    target: '[data-tour="admin-users"]',
    title: "User Management",
    content:
      "Create users, assign multiple roles (admin, instructor, coach, client, org_admin), and manage authentication.",
    placement: "right",
  },
  {
    target: '[data-tour="admin-clients"]',
    title: "Client Management",
    content:
      "Access client profiles, manage enrollments, assign plans/tracks/add-ons, grant credits, and monitor progress.",
    placement: "right",
  },
  {
    target: '[data-tour="admin-staff-assignments"]',
    title: "Staff Assignments",
    content:
      "Assign instructors and coaches to programs, modules, or individual client enrollments. Manage the 3-tier staff assignment hierarchy.",
    placement: "right",
  },
  {
    target: '[data-tour="admin-interest-registrations"]',
    title: "Interest Registrations",
    content:
      "Review and process waitlist registrations from users interested in programs or assessments.",
    placement: "right",
  },
  {
    // Feature key: groups
    target: '[data-tour="admin-groups"]',
    title: "Groups Management",
    content:
      "Create cohort groups with members, leaders, sessions, peer presentations, check-ins, notes, and shared tasks. Link groups to programs.",
    placement: "right",
  },
  {
    target: '[data-tour="admin-plans"]',
    title: "Subscription Plans",
    content:
      "Configure tiered subscription plans with feature access, credit allocations, and usage limits. Plans use tier levels for content access.",
    placement: "right",
  },
  {
    target: '[data-tour="admin-features"]',
    title: "Feature Management",
    content:
      "Control feature flags, visibility, and monetization. Assign features to plans, tracks, program plans, or add-ons. Toggle is_active to globally hide features.",
    placement: "right",
  },
  {
    // Feature key: credits
    target: '[data-tour="admin-credit-services"]',
    title: "Credit Services",
    content:
      "Define credit-consumable services with costs and categories. Credits come from plans, programs, or bonus grants.",
    placement: "right",
  },
  {
    target: '[data-tour="admin-assessments"]',
    title: "Assessments",
    content:
      "Manage psychometric assessments organized by families and categories. Configure access and track client interest.",
    placement: "right",
  },
  {
    target: '[data-tour="admin-capability-assessments"]',
    title: "Capability Assessments",
    content:
      "Build capability assessments with scored domains and questions. Used for self-evaluation, instructor grading, and peer reviews.",
    placement: "right",
  },
  {
    target: '[data-tour="admin-skills"]',
    title: "Skills Management",
    content:
      "Define skills with categories that can be tagged to resources and modules for tracking client development.",
    placement: "right",
  },
  {
    target: '[data-tour="admin-email-templates"]',
    title: "Email & Notifications",
    content:
      "Manage email templates, notification types, and announcements. Monitor the email queue and delivery status.",
    placement: "right",
  },
];

export const orgAdminTourSteps: TourStep[] = [
  {
    target: '[data-tour="org-admin-dashboard"]',
    title: "Welcome to Organization Admin",
    content:
      "Your hub for managing organization members, program enrollments, credits, and settings.",
    placement: "bottom",
  },
  {
    target: '[data-tour="org-admin-members"]',
    title: "Members",
    content:
      "View and manage organization members. Invite new members, manage seats, and assign admin roles.",
    placement: "right",
  },
  {
    target: '[data-tour="org-admin-enrollments"]',
    title: "Enrollments",
    content:
      "Manage program enrollments for your members. Track progress, completion rates, and enrollment status.",
    placement: "right",
  },
  {
    target: '[data-tour="org-admin-programs"]',
    title: "Programs",
    content:
      "View programs assigned to your organization. See available seats and enrollment options.",
    placement: "right",
  },
  {
    // Feature key: org_analytics
    target: '[data-tour="org-admin-analytics"]',
    title: "Analytics",
    content:
      "View organization-wide metrics: member engagement, program completion, credit usage, and activity trends.",
    placement: "right",
  },
  {
    target: '[data-tour="org-admin-billing"]',
    title: "Billing & Credits",
    content:
      "Manage organization billing, purchase credits, view balance and transactions, and download invoices.",
    placement: "right",
  },
  {
    target: '[data-tour="org-admin-terms"]',
    title: "Terms",
    content:
      "Create organization-specific terms that members must accept. Track acceptance status.",
    placement: "right",
  },
  {
    target: '[data-tour="org-admin-settings"]',
    title: "Settings",
    content: "Configure organization name, logo, notifications, and preferences.",
    placement: "right",
  },
  {
    target: '[data-tour="org-admin-faq"]',
    title: "FAQ & Help",
    content:
      "Access documentation and frequently asked questions specific to organization administration.",
    placement: "right",
  },
];
