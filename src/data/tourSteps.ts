import { TourStep } from '@/hooks/useOnboardingTour';

/**
 * Tour steps for different user roles.
 * 
 * IMPORTANT: When adding new steps, consider adding a feature key mapping
 * in src/hooks/useDynamicTourSteps.ts to control visibility based on entitlements.
 * 
 * Steps without a feature mapping are always visible.
 * Steps with a mapping are only shown if the user has access to that feature.
 */

export const adminTourSteps: TourStep[] = [
  {
    target: '[data-tour="admin-dashboard"]',
    title: 'Welcome to Admin Dashboard',
    content: 'This is your command center for managing the entire platform. View key metrics, pending items, and quick actions at a glance.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="admin-platform-terms"]',
    title: 'Platform Terms',
    content: 'Manage platform-wide terms of service that all users must accept. Version and track acceptance status.',
    placement: 'right',
  },
  {
    target: '[data-tour="admin-programs"]',
    title: 'Program Management',
    content: 'Create programs with modules, versions, cohorts, and badges. Configure prerequisites, tier-based access, and assign instructors/coaches.',
    placement: 'right',
  },
  {
    target: '[data-tour="admin-calendar"]',
    title: 'Schedule Calendar',
    content: 'View all scheduled sessions, program dates, and module deadlines across the platform in a unified calendar.',
    placement: 'right',
  },
  {
    // Feature key: guided_paths
    target: '[data-tour="admin-guided-paths"]',
    title: 'Guided Paths',
    content: 'Create personalized learning journeys with survey-based recommendations. Build path families with conditional logic to guide users to relevant programs.',
    placement: 'right',
  },
  {
    target: '[data-tour="admin-module-types"]',
    title: 'Module Types',
    content: 'Define module categories (Content, Session, Assignment, Academy) that determine how modules behave and are displayed.',
    placement: 'right',
  },
  {
    target: '[data-tour="admin-feedback-templates"]',
    title: 'Feedback Templates',
    content: 'Create structured rubrics and templates for consistent instructor feedback on assignments and reflections.',
    placement: 'right',
  },
  {
    target: '[data-tour="admin-users"]',
    title: 'User Management',
    content: 'Create users, assign multiple roles (admin, instructor, coach, client, org_admin), and manage authentication.',
    placement: 'right',
  },
  {
    target: '[data-tour="admin-clients"]',
    title: 'Client Management',
    content: 'Access client profiles, manage enrollments, assign plans/tracks/add-ons, grant credits, and monitor progress.',
    placement: 'right',
  },
  {
    target: '[data-tour="admin-interest-registrations"]',
    title: 'Interest Registrations',
    content: 'Review and process waitlist registrations from users interested in programs or assessments.',
    placement: 'right',
  },
  {
    // Feature key: groups
    target: '[data-tour="admin-groups"]',
    title: 'Groups Management',
    content: 'Create cohort groups with members, leaders, sessions, check-ins, notes, and shared tasks. Link groups to programs.',
    placement: 'right',
  },
  {
    target: '[data-tour="admin-organizations"]',
    title: 'Organizations',
    content: 'Manage B2B organizations with seat-based membership, sponsored plans, custom terms, and billing.',
    placement: 'right',
  },
  {
    target: '[data-tour="admin-plans"]',
    title: 'Subscription Plans',
    content: 'Configure tiered subscription plans with feature access, credit allocations, and usage limits. Plans use tier levels for content access.',
    placement: 'right',
  },
  {
    // Feature key: credits
    target: '[data-tour="admin-credit-services"]',
    title: 'Credit Services',
    content: 'Define credit-consumable services with costs and categories. Credits come from plans, programs, or bonus grants.',
    placement: 'right',
  },
  {
    target: '[data-tour="admin-features"]',
    title: 'Feature Management',
    content: 'Control feature flags, visibility, and monetization. Assign features to plans, tracks, program plans, or add-ons. Toggle is_active to globally hide features.',
    placement: 'right',
  },
  {
    target: '[data-tour="admin-add-ons"]',
    title: 'Add-ons',
    content: 'Create purchasable bundles that grant features or credits independently of subscription plans. Set quantities and expiration dates.',
    placement: 'right',
  },
  {
    target: '[data-tour="admin-assessments"]',
    title: 'Assessments',
    content: 'Manage capability assessments (self/peer evaluations with domains and rating scales) and psychometric assessments organized by families.',
    placement: 'right',
  },
  {
    target: '[data-tour="admin-assessment-interests"]',
    title: 'Assessment Interests',
    content: 'Review and process client requests for psychometric assessments before granting access.',
    placement: 'right',
  },
  {
    target: '[data-tour="admin-resource-library"]',
    title: 'Resource Library',
    content: 'Manage centralized resources (documents, videos, templates) with skill tags. Assign to modules or share directly.',
    placement: 'right',
  },
  {
    target: '[data-tour="admin-skills"]',
    title: 'Skills Management',
    content: 'Define skills with categories that can be tagged to resources and modules for tracking client development.',
    placement: 'right',
  },
];

export const instructorTourSteps: TourStep[] = [
  {
    target: '[data-tour="teaching-dashboard"]',
    title: 'Welcome to Your Teaching Hub',
    content: 'View programs and modules assigned to you. Track client progress, review assignments, and provide feedback.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="teaching-students"]',
    title: 'Client Progress',
    content: 'Monitor all clients in your assigned programs. View completion rates, engagement metrics, and individual progress.',
    placement: 'right',
  },
  {
    target: '[data-tour="teaching-pending-assignments"]',
    title: 'Pending Assignments',
    content: 'Review and grade submitted assignments. Use feedback templates for consistent, structured evaluations.',
    placement: 'right',
  },
  {
    target: '[data-tour="teaching-session-management"]',
    title: 'Session Scheduling',
    content: 'Schedule and manage module sessions. For personalised modules, sessions are linked to specific client enrollments. For group modules, schedule cohort sessions with multiple participants.',
    placement: 'right',
  },
  {
    // Feature key: groups
    target: '[data-tour="teaching-groups"]',
    title: 'Groups',
    content: 'Lead group sessions, manage check-ins, add notes, and track member progress in groups you facilitate.',
    placement: 'right',
  },
  {
    // Feature key: goals
    target: '[data-tour="teaching-shared-goals"]',
    title: 'Shared Goals',
    content: 'View goals clients have shared with you. Add comments, track milestones, and provide guidance.',
    placement: 'right',
  },
  {
    // Feature key: decision_toolkit_basic
    target: '[data-tour="coaching-decisions"]',
    title: 'Shared Decisions',
    content: 'Review decisions clients are working through. Help them analyze options and use decision frameworks.',
    placement: 'right',
  },
  {
    // Feature key: tasks
    target: '[data-tour="coaching-tasks"]',
    title: 'Shared Tasks',
    content: 'Track tasks clients have shared for accountability. Monitor progress and provide support.',
    placement: 'right',
  },
  {
    target: '[data-tour="badge-approvals"]',
    title: 'Badge Approvals',
    content: 'Review and approve badge requests from clients who have met program completion criteria.',
    placement: 'right',
  },
  {
    target: '[data-tour="teaching-external-platforms"]',
    title: 'External Platforms',
    content: 'Quick access to integrated platforms: InnoTrue Academy (TalentLMS), Lucid, Google Drive, Miro, and Mural.',
    placement: 'right',
  },
];

export const clientTourSteps: TourStep[] = [
  {
    target: '[data-tour="client-dashboard"]',
    title: 'Welcome to Your Dashboard',
    content: 'Your personal hub showing journey progress, active programs, upcoming sessions, and quick stats for your development activities.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="client-programs"]',
    title: 'My Programs',
    content: 'View all enrolled programs, track progress, complete modules, and access resources. Click any program to dive into its content.',
    placement: 'right',
  },
  {
    // Feature key: wheel_of_life
    target: '[data-tour="client-wheel-of-life"]',
    title: 'Wheel of Life',
    content: 'Assess satisfaction across life domains, track changes over time, and set improvement goals. Export results as PDF.',
    placement: 'right',
  },
  {
    // Feature key: assessments
    target: '[data-tour="client-assessments"]',
    title: 'Assessments',
    content: 'Take capability self-assessments, view peer evaluations, and explore available psychometric assessments.',
    placement: 'right',
  },
  {
    // Feature key: groups
    target: '[data-tour="client-groups"]',
    title: 'Groups',
    content: 'Participate in cohort groups, attend sessions, share check-ins, and collaborate with peers on shared goals.',
    placement: 'right',
  },
  {
    // Feature key: guided_paths
    target: '[data-tour="client-guided-paths"]',
    title: 'Guided Paths',
    content: 'Discover personalized learning journeys through guided surveys that recommend programs based on your goals.',
    placement: 'right',
  },
  {
    // Feature key: goals
    target: '[data-tour="client-goals"]',
    title: 'Goals',
    content: 'Set personal goals with milestones across life domains. Track progress, add reflections, and optionally share with coaches.',
    placement: 'right',
  },
  {
    // Feature key: decision_toolkit_basic
    target: '[data-tour="client-decisions"]',
    title: 'Decisions',
    content: 'Document and analyze important decisions using frameworks like 10-10-10, Buyer\'s Model, and more. Get AI insights and track outcomes.',
    placement: 'right',
  },
  {
    // Feature key: tasks
    target: '[data-tour="client-tasks"]',
    title: 'Tasks',
    content: 'Manage personal tasks with priorities and due dates. Link to decisions or goals and share with coaches for accountability.',
    placement: 'right',
  },
  {
    // Feature key: development_items
    target: '[data-tour="client-development-items"]',
    title: 'Development Items',
    content: 'Track specific growth areas identified during coaching, assessments, or self-reflection with action steps.',
    placement: 'right',
  },
  {
    // Feature key: development_timeline
    target: '[data-tour="client-timeline"]',
    title: 'Development Timeline',
    content: 'View your complete journey as a chronological timeline of achievements, completions, and milestones.',
    placement: 'right',
  },
  {
    // Feature key: credits
    target: '[data-tour="client-credits"]',
    title: 'Credits & Services',
    content: 'View your credit balance from plans, programs, and grants. Consume credits for premium services like AI coaching.',
    placement: 'right',
  },
  {
    // Feature key: usage
    target: '[data-tour="client-analytics"]',
    title: 'Usage Overview',
    content: 'Track your AI credit usage and feature consumption. See monthly usage patterns and plan limits.',
    placement: 'right',
  },
  {
    // Feature key: ai_recommendations
    target: '[data-tour="client-recommendations"]',
    title: 'Recommendations',
    content: 'Get AI-powered course suggestions based on your values, interests, goals, future vision, and constraints.',
    placement: 'right',
  },
  {
    // Feature key: external_courses
    target: '[data-tour="client-external-courses"]',
    title: 'External Courses',
    content: 'Track learning from other platforms. Add courses, certifications, and optionally display on your public profile.',
    placement: 'right',
  },
  {
    target: '[data-tour="client-calendar"]',
    title: 'Calendar',
    content: 'View all scheduled sessions, program dates, and deadlines. Sync with Google Calendar or Outlook.',
    placement: 'right',
  },
  {
    target: '[data-tour="client-profile"]',
    title: 'Your Profile',
    content: 'Update your personal info, values, interests, future vision, and constraints. Complete profiles get better AI recommendations.',
    placement: 'right',
  },
];

export const orgAdminTourSteps: TourStep[] = [
  {
    target: '[data-tour="org-admin-dashboard"]',
    title: 'Welcome to Organization Admin',
    content: 'Your hub for managing organization members, program enrollments, credits, and settings.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="org-admin-members"]',
    title: 'Members',
    content: 'View and manage organization members. Invite new members, manage seats, and assign admin roles.',
    placement: 'right',
  },
  {
    target: '[data-tour="org-admin-enrollments"]',
    title: 'Enrollments',
    content: 'Manage program enrollments for your members. Track progress, completion rates, and enrollment status.',
    placement: 'right',
  },
  {
    target: '[data-tour="org-admin-programs"]',
    title: 'Programs',
    content: 'View programs assigned to your organization. See available seats and enrollment options.',
    placement: 'right',
  },
  {
    // Feature key: org_analytics
    target: '[data-tour="org-admin-analytics"]',
    title: 'Analytics',
    content: 'View organization-wide metrics: member engagement, program completion, credit usage, and activity trends.',
    placement: 'right',
  },
  {
    target: '[data-tour="org-admin-billing"]',
    title: 'Billing & Credits',
    content: 'Manage organization billing, purchase credits, view balance and transactions, and download invoices.',
    placement: 'right',
  },
  {
    target: '[data-tour="org-admin-terms"]',
    title: 'Terms',
    content: 'Create organization-specific terms that members must accept. Track acceptance status.',
    placement: 'right',
  },
  {
    target: '[data-tour="org-admin-settings"]',
    title: 'Settings',
    content: 'Configure organization name, logo, notifications, and preferences.',
    placement: 'right',
  },
  {
    target: '[data-tour="org-admin-faq"]',
    title: 'FAQ & Help',
    content: 'Access documentation and frequently asked questions specific to organization administration.',
    placement: 'right',
  },
];
