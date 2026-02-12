import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  PageBreak,
} from "docx";
const createHeading = (text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel]) => {
  return new Paragraph({
    text,
    heading: level,
    spacing: { before: 400, after: 200 },
  });
};

const createParagraph = (
  text: string,
  options?: { bold?: boolean; italic?: boolean; bullet?: boolean },
) => {
  return new Paragraph({
    children: [
      new TextRun({
        text,
        bold: options?.bold,
        italics: options?.italic,
      }),
    ],
    bullet: options?.bullet ? { level: 0 } : undefined,
    spacing: { after: 120 },
  });
};

const createTable = (headers: string[], rows: string[][]) => {
  const headerCells = headers.map(
    (header) =>
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: header, bold: true })] })],
        shading: { fill: "E8E8E8" },
      }),
  );

  const dataRows = rows.map(
    (row) =>
      new TableRow({
        children: row.map(
          (cell) =>
            new TableCell({
              children: [new Paragraph({ text: cell })],
            }),
        ),
      }),
  );

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({ children: headerCells }), ...dataRows],
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1 },
      bottom: { style: BorderStyle.SINGLE, size: 1 },
      left: { style: BorderStyle.SINGLE, size: 1 },
      right: { style: BorderStyle.SINGLE, size: 1 },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
      insideVertical: { style: BorderStyle.SINGLE, size: 1 },
    },
  });
};

export const generatePlatformDocumentation = (): Document => {
  return new Document({
    title: "InnoTrue Hub - Platform Documentation",
    description: "Comprehensive platform capabilities and functionality guide",
    creator: "InnoTrue Hub",
    sections: [
      {
        properties: {},
        children: [
          // Title Page
          new Paragraph({
            children: [
              new TextRun({
                text: "InnoTrue Hub",
                bold: true,
                size: 72,
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { before: 2000, after: 400 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "Platform Documentation",
                size: 48,
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "Comprehensive Guide to Capabilities and Functionality",
                italics: true,
                size: 28,
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 800 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `Generated: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`,
                size: 24,
              }),
            ],
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({ children: [new PageBreak()] }),

          // Table of Contents
          createHeading("Table of Contents", HeadingLevel.HEADING_1),
          createParagraph("1. Platform Overview"),
          createParagraph("2. User Roles and Permissions"),
          createParagraph("3. Admin Features"),
          createParagraph("4. Organization Admin Features"),
          createParagraph("5. Instructor/Coach Features"),
          createParagraph("6. Client Features"),
          createParagraph("7. Programs and Modules"),
          createParagraph("8. Session Scheduling and Management"),
          createParagraph("9. Guided Paths"),
          createParagraph("10. Assessments"),
          createParagraph("11. Scenario-Based Assessments"),
          createParagraph("12. Goals, Tasks, and Development"),
          createParagraph("13. Decision Toolkit"),
          createParagraph("14. Credits and Services"),
          createParagraph("15. Groups and Collaboration"),
          createParagraph("16. Feature Gating and Access Control"),
          createParagraph("17. Integrations"),
          createParagraph("18. Subscription Plans and Monetization"),
          createParagraph("19. Email Notifications"),
          createParagraph("20. Privacy and Compliance"),
          createParagraph("21. Authentication Contexts"),
          new Paragraph({ children: [new PageBreak()] }),

          // Section 1: Platform Overview
          createHeading("1. Platform Overview", HeadingLevel.HEADING_1),
          createParagraph(
            "InnoTrue Hub is a comprehensive learning and development platform designed to facilitate professional growth through structured programs, personalized coaching, goal tracking, and decision-making support.",
          ),
          createHeading("Key Capabilities", HeadingLevel.HEADING_2),
          createParagraph(
            "Program Management: Create and deliver structured learning programs with modules, sessions, and assessments",
            { bullet: true },
          ),
          createParagraph(
            "Guided Paths: Personalized learning journeys through conditional survey-based recommendations",
            { bullet: true },
          ),
          createParagraph(
            "Coaching Support: Connect clients with coaches for personalized guidance",
            { bullet: true },
          ),
          createParagraph(
            "Goal Tracking: Set, track, and achieve personal and professional goals",
            { bullet: true },
          ),
          createParagraph(
            "Decision Support: Structured frameworks for making important decisions with AI insights",
            { bullet: true },
          ),
          createParagraph(
            "Assessments: Wheel of Life, capability assessments, scenario-based assessments, and psychometric tools",
            { bullet: true },
          ),
          createParagraph(
            "Group Learning: Collaborative learning through managed groups with sessions and check-ins",
            { bullet: true },
          ),
          createParagraph("Skills Tracking: Monitor skill development across programs", {
            bullet: true,
          }),
          createParagraph("Credit System: Unified credits for consuming premium services", {
            bullet: true,
          }),
          createParagraph(
            "Organization Management: B2B support with sponsored plans and org-specific features",
            { bullet: true },
          ),
          createParagraph(
            "Session Scheduling: Cal.com and Google Calendar integration for seamless scheduling",
            { bullet: true },
          ),
          createParagraph(
            "Email Notifications: Automated emails for sessions, assignments, reminders, and more",
            { bullet: true },
          ),
          createParagraph(
            "External Integrations: TalentLMS, Circle, Google Drive, Lucid, ActiveCampaign, and more",
            { bullet: true },
          ),
          createParagraph("Announcements: Admin-managed news and updates displayed to clients", {
            bullet: true,
          }),
          createParagraph("Public Profiles: Shareable professional profiles for clients", {
            bullet: true,
          }),
          new Paragraph({ children: [new PageBreak()] }),

          // Section 2: User Roles
          createHeading("2. User Roles and Permissions", HeadingLevel.HEADING_1),
          createHeading("Available Roles", HeadingLevel.HEADING_2),
          createTable(
            ["Role", "Description", "Key Permissions"],
            [
              [
                "Admin",
                "Platform administrators with full access",
                "Manage all users, programs, settings, configurations, and exports",
              ],
              [
                "Org Admin",
                "Organization administrators for B2B clients",
                "Manage organization members, enrollments, billing, and org-specific terms",
              ],
              [
                "Instructor",
                "Program instructors who deliver content",
                "Manage assigned programs, provide feedback, view student progress",
              ],
              [
                "Coach",
                "Personal coaches for 1:1 support",
                "View assigned clients, provide feedback, track goals and decisions",
              ],
              [
                "Client",
                "End users enrolled in programs",
                "Access enrolled programs, track goals, use assessment tools",
              ],
            ],
          ),
          createParagraph(""),
          createParagraph(
            "Note: Users can have multiple roles simultaneously. Role switching is available in the sidebar for multi-role users.",
          ),
          createHeading("Multi-Role Architecture", HeadingLevel.HEADING_2),
          createParagraph(
            "A single user can hold multiple roles (e.g., admin + client, instructor + coach).",
          ),
          createParagraph(
            "Users have access to all capabilities of all their assigned roles combined.",
          ),
          createParagraph(
            "Staff members (coaches/instructors) who are also clients get both staff capabilities and a plan assignment.",
          ),
          new Paragraph({ children: [new PageBreak()] }),

          // Section 3: Admin Features
          createHeading("3. Admin Features", HeadingLevel.HEADING_1),
          createHeading("User Management", HeadingLevel.HEADING_2),
          createParagraph("Create, edit, and manage user accounts"),
          createParagraph("Assign roles and permissions (multi-role support)"),
          createParagraph("View and manage client profiles with status markers and tags"),
          createParagraph("Assign coaches and instructors to clients"),
          createParagraph("Manage enrollment status and program access"),
          createParagraph("Grant credits and manage add-ons per user"),
          createParagraph("Staff notes for internal team communication"),

          createHeading("Program Management", HeadingLevel.HEADING_2),
          createParagraph("Create and configure learning programs"),
          createParagraph(
            "Add modules with various types (content, sessions, assignments, academy)",
          ),
          createParagraph("Set program tiers and access levels"),
          createParagraph("Configure prerequisites between modules"),
          createParagraph("Manage program versions and deployments"),
          createParagraph("Set scheduled dates for cohort-based programs"),
          createParagraph("Configure program plans with credit allowances"),
          createParagraph("Manage program badges and credentials"),
          createParagraph("Assign staff to modules for notifications"),

          createHeading("System Configuration", HeadingLevel.HEADING_2),
          createParagraph(
            "Subscription Plans: Configure tier levels, features, and credit allowances",
          ),
          createParagraph(
            "Features Management: Define features, mark as system-protected, assign to plans/tracks/add-ons",
          ),
          createParagraph(
            "Export Configuration: Download feature assignments and credit configuration as JSON",
          ),
          createParagraph("Module Types: Configure available module types"),
          createParagraph("Assignment Types: Define assignment templates with custom fields"),
          createParagraph("Session Types: Configure session types and scheduling"),
          createParagraph("Status Markers: Create custom status labels for clients"),
          createParagraph("Email Templates: Configure automated email communications"),
          createParagraph(
            "Platform Terms: Manage terms of service with versioning and acceptance tracking",
          ),
          createParagraph("Announcements: Create news items with categories for client dashboard"),
          createParagraph(
            "System Settings: Configure support email, recurrence limits, and other platform settings",
          ),

          createHeading("Content Management", HeadingLevel.HEADING_2),
          createParagraph(
            "Resource Library: Manage shared resources with canonical IDs for external mapping",
          ),
          createParagraph("Skills Management: Define and track skills across the platform"),
          createParagraph(
            "Assessment Management: Configure capability and psychometric assessments",
          ),
          createParagraph("Feedback Templates: Create structured feedback forms"),
          createParagraph("Wheel Categories: Configure Wheel of Life assessment categories"),

          createHeading("Credit Services", HeadingLevel.HEADING_2),
          createParagraph(
            "Define credit-based services with categories (AI, Goals, Programs, Sessions, etc.)",
          ),
          createParagraph("Set credit costs per service"),
          createParagraph("Link services to features for gated access"),
          createParagraph("Configure track-specific discounted costs"),

          createHeading("Analytics and Monitoring", HeadingLevel.HEADING_2),
          createParagraph("Platform analytics dashboard"),
          createParagraph("Email queue monitoring"),
          createParagraph("Webhook logs for external integrations"),
          createParagraph("Admin audit logs"),
          createParagraph("Account deletion request management"),
          new Paragraph({ children: [new PageBreak()] }),

          // Section 4: Org Admin Features
          createHeading("4. Organization Admin Features", HeadingLevel.HEADING_1),
          createHeading("Member Management", HeadingLevel.HEADING_2),
          createParagraph("Invite members via email with role assignment"),
          createParagraph("Manage member seats and allocations"),
          createParagraph("View member progress and engagement"),
          createParagraph("Bulk enrollment in programs"),

          createHeading("Organization Settings", HeadingLevel.HEADING_2),
          createParagraph("Configure organization name and logo"),
          createParagraph("Manage organization-specific terms"),
          createParagraph("Set up sponsored plans for members"),

          createHeading("Billing and Credits", HeadingLevel.HEADING_2),
          createParagraph("View organization billing information"),
          createParagraph("Manage credit allocations to members"),
          createParagraph("Purchase additional credits"),
          createParagraph("Track organization-wide usage"),

          createHeading("Analytics", HeadingLevel.HEADING_2),
          createParagraph("Organization-wide progress metrics"),
          createParagraph("Member engagement analytics"),
          createParagraph("Program completion rates"),
          new Paragraph({ children: [new PageBreak()] }),

          // Section 5: Instructor/Coach Features
          createHeading("5. Instructor/Coach Features", HeadingLevel.HEADING_1),
          createHeading("Dashboard", HeadingLevel.HEADING_2),
          createParagraph("View assigned programs and modules"),
          createParagraph("Track pending assignments requiring review"),
          createParagraph("Monitor upcoming sessions and deadlines"),
          createParagraph("Access shared goals, tasks, and decisions from clients"),

          createHeading("Student Progress Tracking", HeadingLevel.HEADING_2),
          createParagraph("View detailed progress for each assigned client"),
          createParagraph("Track module completion and engagement"),
          createParagraph("Review and score assignments"),
          createParagraph("Provide structured and freeform feedback with attachments"),
          createParagraph("Add staff notes to client records"),

          createHeading("Session Management", HeadingLevel.HEADING_2),
          createParagraph("Schedule individual and group sessions"),
          createParagraph("Manage session requests from clients"),
          createParagraph("Track session attendance and notes"),
          createParagraph("Create recurring sessions"),
          createParagraph("Automatic email notifications for scheduled sessions"),

          createHeading("Assessments Dashboard", HeadingLevel.HEADING_2),
          createParagraph("View assessments shared by clients (Shared with me tab)"),
          createParagraph("Filter by specific clients"),
          createParagraph("Access full assessment details beyond preview"),
          createParagraph("Track evaluations given to clients (Evaluations I gave tab)"),
          createParagraph("Issue capability assessments to clients"),

          createHeading("Coaching Tools", HeadingLevel.HEADING_2),
          createParagraph("View and comment on shared decisions"),
          createParagraph("Track shared goals and provide feedback"),
          createParagraph("Monitor shared tasks and development items"),
          createParagraph("Create development items for clients"),

          createHeading("Badge Management", HeadingLevel.HEADING_2),
          createParagraph("Review and approve badge requests"),
          createParagraph("Issue badges upon program or module completion"),
          new Paragraph({ children: [new PageBreak()] }),

          // Section 6: Client Features
          createHeading("6. Client Features", HeadingLevel.HEADING_1),
          createHeading("Dashboard", HeadingLevel.HEADING_2),
          createParagraph("Personal overview of enrolled programs and progress"),
          createParagraph("Quick access to current modules and upcoming sessions"),
          createParagraph("Notifications and reminders"),
          createParagraph("Continuation banner for returning users"),
          createParagraph("Announcements widget for platform news"),
          createParagraph("Journey progress widget with feature gating"),

          createHeading("My Programs", HeadingLevel.HEADING_2),
          createParagraph("View all enrolled programs with progress indicators"),
          createParagraph("Access program content, modules, and resources"),
          createParagraph("Track completion status and certificates"),
          createParagraph("View program-specific assessments"),

          createHeading("Learning Tools", HeadingLevel.HEADING_2),
          createParagraph("Academy: Access linked TalentLMS courses"),
          createParagraph("Resources: Browse available learning materials"),
          createParagraph("Skills Map: Track skill development across programs"),
          createParagraph("Learning Analytics: View learning metrics and trends"),
          createParagraph("External Courses: Track courses taken outside the platform"),

          createHeading("Personal Development", HeadingLevel.HEADING_2),
          createParagraph(
            "Wheel of Life: Self-assessment across life domains with historical tracking",
          ),
          createParagraph("Goals: Set and track personal and professional goals with milestones"),
          createParagraph("Tasks: Manage action items with Eisenhower matrix prioritization"),
          createParagraph("Development Items: Track development areas identified during coaching"),
          createParagraph("Timeline: View complete development journey chronologically"),
          createParagraph("Decisions: Use structured frameworks for decision-making"),

          createHeading("Community Features", HeadingLevel.HEADING_2),
          createParagraph("Groups: Participate in learning groups with sessions and check-ins"),
          createParagraph("Community: Access Circle community (if enabled)"),
          createParagraph("Calendar: View scheduled sessions and events"),

          createHeading("Credits and Services", HeadingLevel.HEADING_2),
          createParagraph("View available credits and balance"),
          createParagraph("Consume credit-based services"),
          createParagraph("Track credit usage history"),

          createHeading("Profile and Settings", HeadingLevel.HEADING_2),
          createParagraph("Manage personal profile information"),
          createParagraph("Generate public profile for sharing"),
          createParagraph("Configure timezone preferences"),
          createParagraph("Manage AI preferences and consent"),
          createParagraph("View and manage notification settings"),
          new Paragraph({ children: [new PageBreak()] }),

          // Section 7: Programs and Modules
          createHeading("7. Programs and Modules", HeadingLevel.HEADING_1),
          createHeading("Program Structure", HeadingLevel.HEADING_2),
          createParagraph(
            "Programs are the primary container for learning content. Each program can contain multiple modules organized in a specific order.",
          ),

          createHeading("Module Types", HeadingLevel.HEADING_2),
          createTable(
            ["Type", "Description", "Client Actions"],
            [
              [
                "Content",
                "Text-based learning material with rich content",
                "Read content, view resources, mark complete",
              ],
              [
                "Session",
                "Live or scheduled sessions with instructors/coaches",
                "Request sessions, join meetings, view recordings",
              ],
              [
                "Assignment",
                "Work submissions requiring instructor review",
                "Submit work, receive feedback and scores",
              ],
              ["Academy", "Linked TalentLMS courses", "Access external course, track progress"],
              [
                "Self-Paced",
                "Modules completed at client discretion",
                "Work through content independently",
              ],
            ],
          ),

          createHeading("Program Plans", HeadingLevel.HEADING_2),
          createParagraph("Programs can have multiple plans (tiers) that determine:"),
          createParagraph("Which modules are accessible", { bullet: true }),
          createParagraph("Which resources are available", { bullet: true }),
          createParagraph("Session allocation and limits", { bullet: true }),
          createParagraph("Badge availability", { bullet: true }),
          createParagraph("Credit allowance included with enrollment", { bullet: true }),

          createHeading("Module Prerequisites", HeadingLevel.HEADING_2),
          createParagraph(
            "Modules can have prerequisites that must be completed before access is granted.",
          ),
          createParagraph(
            "Prerequisites are configured in the module edit dialog under the Prerequisites tab.",
          ),

          createHeading("Module Staff Assignment", HeadingLevel.HEADING_2),
          createParagraph("Staff members can be assigned to specific modules."),
          createParagraph("Assigned staff receive notifications for module-related activities."),
          createParagraph("Staff assignments affect session scheduling and assignment reviews."),

          createHeading("Progress Tracking", HeadingLevel.HEADING_2),
          createParagraph("Module status: not_started, in_progress, completed, skipped"),
          createParagraph("Assignment status: pending, submitted, reviewed, needs_revision"),
          createParagraph("Overall program progress calculated as percentage of completed modules"),
          new Paragraph({ children: [new PageBreak()] }),

          // Section 8: Session Scheduling
          createHeading("8. Session Scheduling and Management", HeadingLevel.HEADING_1),
          createHeading("Scheduling Methods", HeadingLevel.HEADING_2),
          createParagraph(
            "Cal.com Integration: Primary scheduling system for individual and group sessions",
            { bullet: true },
          ),
          createParagraph("Google Calendar: Create calendar events directly for sessions", {
            bullet: true,
          }),
          createParagraph(
            "Manual Scheduling: Staff can manually create sessions with custom dates",
            { bullet: true },
          ),

          createHeading("Session Types", HeadingLevel.HEADING_2),
          createParagraph("Individual Sessions: One-on-one meetings between staff and clients"),
          createParagraph("Group Sessions: Sessions with multiple participants"),
          createParagraph("Recurring Sessions: Automatically created repeat sessions"),

          createHeading("Cal.com Event Type Mappings", HeadingLevel.HEADING_2),
          createParagraph(
            "Cal.com event types can be mapped to specific programs, modules, or session targets.",
          ),
          createParagraph(
            "Mappings support: Individual sessions, group sessions, or default program module sessions.",
          ),
          createParagraph("Automatic session creation when bookings are made through Cal.com."),

          createHeading("Session Notifications", HeadingLevel.HEADING_2),
          createParagraph("Automatic email notifications when sessions are scheduled"),
          createParagraph(
            "Emails include: Date/time, staff name, meeting link, and program context",
          ),
          createParagraph("Session reminders sent before scheduled sessions"),
          createParagraph("Notification triggers handle both instructor and coach sessions"),

          createHeading("Recurring Sessions", HeadingLevel.HEADING_2),
          createParagraph("Staff can create recurring sessions with configurable frequency"),
          createParagraph("Recurrence patterns: Daily, Weekly (specific days), Monthly"),
          createParagraph("Maximum occurrences configurable via system settings"),
          createParagraph(
            "Individual sessions in a recurring series can be modified independently",
          ),
          new Paragraph({ children: [new PageBreak()] }),

          // Section 9: Guided Paths
          createHeading("9. Guided Paths", HeadingLevel.HEADING_1),
          createParagraph(
            "Guided Paths help clients discover personalized learning journeys through structured surveys.",
          ),

          createHeading("Path Families", HeadingLevel.HEADING_2),
          createParagraph(
            'Paths are organized into families (e.g., "Career Development", "Leadership").',
          ),
          createParagraph("Each family contains survey questions with conditional logic."),

          createHeading("Survey Questions", HeadingLevel.HEADING_2),
          createParagraph("Questions can be multiple choice, scale, or open-ended."),
          createParagraph("Conditional branching based on previous answers."),
          createParagraph("Final recommendations based on response patterns."),

          createHeading("Path Templates", HeadingLevel.HEADING_2),
          createParagraph("Templates define the programs, resources, or actions recommended."),
          createParagraph("Conditions determine which template applies based on survey responses."),
          new Paragraph({ children: [new PageBreak()] }),

          // Section 10: Assessments
          createHeading("10. Assessments", HeadingLevel.HEADING_1),
          createHeading("Wheel of Life", HeadingLevel.HEADING_2),
          createParagraph(
            "A self-assessment tool for evaluating satisfaction across configurable life domains:",
          ),
          createParagraph(
            "Default domains include: Career/Work, Finance/Wealth, Health/Wellness, Family/Friends, Romance/Partnership, Personal Growth, Fun/Recreation, Physical Environment, Community/Social, Purpose/Spirituality",
            { italic: true },
          ),
          createParagraph("Features include:"),
          createParagraph("Visual radar chart representation", { bullet: true }),
          createParagraph("Historical tracking and comparison", { bullet: true }),
          createParagraph("Domain-specific reflections and notes", { bullet: true }),
          createParagraph("PDF export for sharing", { bullet: true }),
          createParagraph("Configurable categories via wheel_categories table", { bullet: true }),

          createHeading("Capability Assessments", HeadingLevel.HEADING_2),
          createParagraph(
            "Structured assessments for evaluating specific capabilities or competencies.",
          ),
          createParagraph("Features include:"),
          createParagraph("Multiple domains with custom questions", { bullet: true }),
          createParagraph("Self-assessment and instructor/coach evaluation options", {
            bullet: true,
          }),
          createParagraph("Rating scales (configurable)", { bullet: true }),
          createParagraph("Pass/fail thresholds (optional)", { bullet: true }),
          createParagraph("Progress tracking over time", { bullet: true }),
          createParagraph("Assessment families for organization", { bullet: true }),
          createParagraph("Sharing controls for coach and instructor visibility", { bullet: true }),
          createParagraph("Domain and question-level notes", { bullet: true }),

          createHeading("Psychometric Assessments", HeadingLevel.HEADING_2),
          createParagraph("Standardized assessments with structured questions and scoring:"),
          createParagraph("Multiple choice and Likert scale questions", { bullet: true }),
          createParagraph("Dimension-based scoring", { bullet: true }),
          createParagraph("Automated interpretation based on score thresholds", { bullet: true }),
          createParagraph("Public assessment links for lead generation", { bullet: true }),

          createHeading("Assessment Sharing", HeadingLevel.HEADING_2),
          createParagraph("Clients can choose to share assessments with their coach or instructor"),
          createParagraph(
            "Staff can view shared assessments in their dedicated Assessments dashboard",
          ),
          createParagraph("Staff can filter shared assessments by client"),
          new Paragraph({ children: [new PageBreak()] }),

          // Section 11: Scenario-Based Assessments
          createHeading("11. Scenario-Based Assessments", HeadingLevel.HEADING_1),
          createParagraph(
            "Scenario-based assessments enable evaluation of client competencies through realistic, multi-page hypothetical situations.",
          ),

          createHeading("Template Structure", HeadingLevel.HEADING_2),
          createParagraph(
            "Templates are organized into sections (pages) containing paragraphs of content.",
          ),
          createParagraph("Each section includes instructional text and scenario context."),
          createParagraph("Paragraphs can be marked as requiring responses for evaluation."),
          createParagraph("Templates link to capability assessments for scoring criteria."),

          createHeading("Content Features", HeadingLevel.HEADING_2),
          createParagraph("Rich text editing with formatting options", { bullet: true }),
          createParagraph("Paginated display with progress tracking", { bullet: true }),
          createParagraph("Auto-save for client responses", { bullet: true }),
          createParagraph("IP protection with watermarking and copy prevention", { bullet: true }),
          createParagraph("Template locking to ensure evaluation integrity", { bullet: true }),

          createHeading("Module Integration", HeadingLevel.HEADING_2),
          createParagraph("Scenarios can be linked to program modules."),
          createParagraph("Drag-and-drop reordering for linked scenarios."),
          createParagraph('Scenarios can be marked as "Required for Certification".'),
          createParagraph("Required scenarios must be evaluated before badge approval."),

          createHeading("Assignment Workflow", HeadingLevel.HEADING_2),
          createParagraph(
            "Staff manually assign scenarios to individual clients or bulk-assign to module enrollments.",
          ),
          createParagraph(
            "Assignments track enrollment and module context for independent progress.",
          ),
          createParagraph("Status progression: Draft → Submitted → In Review → Evaluated."),

          createHeading("Evaluation Process", HeadingLevel.HEADING_2),
          createParagraph("Evaluators review client responses paragraph by paragraph."),
          createParagraph("Score linked capability questions using the assessment rating scale."),
          createParagraph("Provide inline feedback per paragraph."),
          createParagraph("Add overall evaluation notes."),
          createParagraph("Finalization creates an immutable capability snapshot."),

          createHeading("Results and Feedback", HeadingLevel.HEADING_2),
          createParagraph("Clients view aggregated domain scores after evaluation."),
          createParagraph("Visual progress bars show performance by domain."),
          createParagraph("Access to instructor feedback and overall notes."),
          new Paragraph({ children: [new PageBreak()] }),

          // Section 12: Goals and Tasks
          createHeading("12. Goals, Tasks, and Development", HeadingLevel.HEADING_1),
          createHeading("Goal Management", HeadingLevel.HEADING_2),
          createParagraph("Clients can create and track goals with the following features:"),
          createParagraph("Goal categories and priorities", { bullet: true }),
          createParagraph("Start and target dates", { bullet: true }),
          createParagraph("Milestone tracking with completion dates", { bullet: true }),
          createParagraph("Progress updates and reflections", { bullet: true }),
          createParagraph("Resource attachments", { bullet: true }),
          createParagraph("Coach sharing for accountability", { bullet: true }),
          createParagraph("Comments and collaboration", { bullet: true }),

          createHeading("Task Management", HeadingLevel.HEADING_2),
          createParagraph("Action items that can be:"),
          createParagraph("Linked to goals for milestone tracking", { bullet: true }),
          createParagraph("Assigned due dates and priorities (Eisenhower matrix)", {
            bullet: true,
          }),
          createParagraph("Marked with status (pending, in_progress, completed)", { bullet: true }),
          createParagraph("Shared with coaches for visibility", { bullet: true }),
          createParagraph("Linked to decisions for action planning", { bullet: true }),

          createHeading("Development Items", HeadingLevel.HEADING_2),
          createParagraph("Track development areas identified during coaching or self-reflection."),
          createParagraph("Link to programs, goals, or assessments."),
          createParagraph("Staff can create development items for their clients."),

          createHeading("Development Timeline", HeadingLevel.HEADING_2),
          createParagraph("Chronological view of all development activities and achievements."),
          new Paragraph({ children: [new PageBreak()] }),

          // Section 13: Decision Toolkit
          createHeading("13. Decision Toolkit", HeadingLevel.HEADING_1),
          createParagraph(
            "A structured approach to making important decisions with multiple frameworks and tools.",
          ),

          createHeading("Core Features", HeadingLevel.HEADING_2),
          createParagraph("Decision tracking with context, stakes, and stakeholders"),
          createParagraph("Multiple options with pros/cons analysis"),
          createParagraph("Values alignment scoring"),
          createParagraph("Decision timeline visualization"),
          createParagraph("Outcome tracking and reflection"),
          createParagraph("Coach sharing and comments"),

          createHeading("Decision Frameworks", HeadingLevel.HEADING_2),
          createParagraph(
            "Buyers Model, 10-10-10 Rule, Internal Check, Stop Rule, Yes/No Rule, Crossroads Model",
          ),

          createHeading("Advanced Features", HeadingLevel.HEADING_2),
          createParagraph("AI-powered insights and recommendations"),
          createParagraph("Decision journal for dated observations"),
          createParagraph("Reminders and follow-ups with email notifications"),
          createParagraph("Analytics dashboard showing patterns and confidence trends"),
          createParagraph("Outcome accuracy tracking"),

          createHeading("Decision Templates", HeadingLevel.HEADING_2),
          createParagraph("Pre-built templates for common decision types:"),
          createParagraph(
            "Career, Financial, Relationship, Business, Education, Health, Home, Relocation",
            { bullet: true },
          ),
          new Paragraph({ children: [new PageBreak()] }),

          // Section 14: Credits and Services
          createHeading("14. Credits and Services", HeadingLevel.HEADING_1),
          createHeading("Credit System", HeadingLevel.HEADING_2),
          createParagraph("Unified credit system for consuming premium services."),
          createParagraph("Credits can come from multiple sources:"),
          createParagraph("Subscription plans (monthly allowance)", { bullet: true }),
          createParagraph("Program plans (enrollment-based)", { bullet: true }),
          createParagraph("Admin grants (manual allocation)", { bullet: true }),
          createParagraph("Top-up purchases", { bullet: true }),
          createParagraph("Organization purchases (for org members)", { bullet: true }),

          createHeading("Credit Batches", HeadingLevel.HEADING_2),
          createParagraph("Credits are tracked in batches with:"),
          createParagraph("Expiration dates", { bullet: true }),
          createParagraph("Source tracking (subscription, grant, purchase)", { bullet: true }),
          createParagraph("Feature-specific restrictions (optional)", { bullet: true }),
          createParagraph("Automatic rollover handling via credit-maintenance edge function", {
            bullet: true,
          }),

          createHeading("Credit Services", HeadingLevel.HEADING_2),
          createParagraph("Services are organized by category:"),
          createParagraph("AI (coaching, insights, recommendations)", { bullet: true }),
          createParagraph("Goals and Tasks", { bullet: true }),
          createParagraph("Programs and Sessions", { bullet: true }),
          createParagraph("Assessments and Specialty services", { bullet: true }),

          createHeading("Credit Configuration Export", HeadingLevel.HEADING_2),
          createParagraph("Admins can export credit configuration as JSON including:"),
          createParagraph("Plan credit allowances", { bullet: true }),
          createParagraph("Program plan credits", { bullet: true }),
          createParagraph("Service costs and categories", { bullet: true }),
          createParagraph("Consumable feature limits", { bullet: true }),
          new Paragraph({ children: [new PageBreak()] }),

          // Section 15: Groups
          createHeading("15. Groups and Collaboration", HeadingLevel.HEADING_1),
          createHeading("Group Features", HeadingLevel.HEADING_2),
          createParagraph("Groups provide a collaborative learning environment with:"),
          createParagraph("Scheduled group sessions with video conferencing links", {
            bullet: true,
          }),
          createParagraph("Member check-ins for progress tracking", { bullet: true }),
          createParagraph("Shared notes and documentation", { bullet: true }),
          createParagraph("Group tasks and action items", { bullet: true }),
          createParagraph("Leader and member roles", { bullet: true }),
          createParagraph("Member links and resources", { bullet: true }),

          createHeading("Group Roles", HeadingLevel.HEADING_2),
          createParagraph("Leader: Can manage group content, schedule sessions, add notes"),
          createParagraph("Member: Can view content, add check-ins, create personal tasks"),

          createHeading("Group Types", HeadingLevel.HEADING_2),
          createParagraph("Cohort groups: Tied to specific program enrollments"),
          createParagraph("Open groups: Members can request to join"),
          createParagraph("Invitation-only groups: Admin-managed membership"),
          new Paragraph({ children: [new PageBreak()] }),

          // Section 16: Feature Gating
          createHeading("16. Feature Gating and Access Control", HeadingLevel.HEADING_1),
          createHeading("Feature Sources", HeadingLevel.HEADING_2),
          createParagraph("Features can be granted through multiple sources:"),
          createTable(
            ["Source", "Assignment", "Duration", "Use Case"],
            [
              ["Subscription Plans", "Profile plan_id", "While subscribed", "Base platform access"],
              ["Program Plans", "Enrollment tier", "While enrolled", "Program-specific features"],
              ["Learning Tracks", "User assignment", "Ongoing", "Specialized learning paths"],
              ["Add-Ons", "Manual grant", "Until expiry", "Individual feature unlocks"],
            ],
          ),

          createHeading("Visibility States", HeadingLevel.HEADING_2),
          createParagraph("Hidden: Feature is inactive or not monetized (not shown to clients)"),
          createParagraph(
            "Locked: Feature is monetized but user lacks access (shown with lock icon)",
          ),
          createParagraph("Accessible: User has access through any source"),

          createHeading("System Features", HeadingLevel.HEADING_2),
          createParagraph('Features marked as "System" control core platform functionality.'),
          createParagraph("System features cannot be deleted."),
          createParagraph("Removing them may break navigation or essential functionality."),
          createParagraph("Alternative: Set is_active = false to globally hide a feature."),

          createHeading("Feature Export", HeadingLevel.HEADING_2),
          createParagraph(
            "Admins can export feature assignments as JSON for backup or documentation.",
          ),
          createParagraph("Exports include plan, track, add-on, and program plan mappings."),
          new Paragraph({ children: [new PageBreak()] }),

          // Section 17: Integrations
          createHeading("17. Integrations", HeadingLevel.HEADING_1),
          createHeading("TalentLMS", HeadingLevel.HEADING_2),
          createParagraph("Learning management system integration for course delivery:"),
          createParagraph("SSO authentication for seamless access", { bullet: true }),
          createParagraph("Progress synchronization", { bullet: true }),
          createParagraph("Course completion tracking", { bullet: true }),
          createParagraph("Webhook notifications for real-time updates", { bullet: true }),
          createParagraph("Course mapping via canonical codes", { bullet: true }),

          createHeading("Cal.com", HeadingLevel.HEADING_2),
          createParagraph("Scheduling platform integration:"),
          createParagraph("Webhook integration for automatic session creation", { bullet: true }),
          createParagraph("Event type mappings to programs and modules", { bullet: true }),
          createParagraph("Instructor-specific scheduling URLs", { bullet: true }),
          createParagraph("Support for individual and group sessions", { bullet: true }),

          createHeading("Google Calendar", HeadingLevel.HEADING_2),
          createParagraph("Calendar integration for event management:"),
          createParagraph("OAuth authentication", { bullet: true }),
          createParagraph("Create calendar events for sessions", { bullet: true }),
          createParagraph("iCal feed generation for client calendars", { bullet: true }),

          createHeading("Circle", HeadingLevel.HEADING_2),
          createParagraph("Community platform integration:"),
          createParagraph("SSO authentication", { bullet: true }),
          createParagraph("Community access based on plan tier", { bullet: true }),
          createParagraph("Interest registration for non-members", { bullet: true }),

          createHeading("Google Drive", HeadingLevel.HEADING_2),
          createParagraph("Document storage and sharing:"),
          createParagraph("SSO access to shared folders", { bullet: true }),
          createParagraph("Tier-based folder access", { bullet: true }),

          createHeading("Lucid", HeadingLevel.HEADING_2),
          createParagraph("Visual collaboration tools:"),
          createParagraph("SSO access to Lucid workspace", { bullet: true }),
          createParagraph("Embedded visual tools in programs", { bullet: true }),

          createHeading("ActiveCampaign", HeadingLevel.HEADING_2),
          createParagraph("Marketing automation integration:"),
          createParagraph("Contact synchronization", { bullet: true }),
          createParagraph("Assessment result ingestion", { bullet: true }),
          createParagraph("Interest registration syncing", { bullet: true }),
          createParagraph("Automation triggers", { bullet: true }),

          createHeading("Stripe", HeadingLevel.HEADING_2),
          createParagraph("Payment processing:"),
          createParagraph("Subscription management", { bullet: true }),
          createParagraph("Credit top-up purchases", { bullet: true }),
          createParagraph("Customer portal for billing", { bullet: true }),
          createParagraph("Organization credit purchases", { bullet: true }),
          new Paragraph({ children: [new PageBreak()] }),

          // Section 18: Subscription Plans
          createHeading("18. Subscription Plans and Monetization", HeadingLevel.HEADING_1),
          createHeading("Tier System", HeadingLevel.HEADING_2),
          createParagraph(
            "The platform uses a tiered access system where higher tiers inherit access from lower tiers.",
          ),
          createTable(
            ["Tier Level", "Typical Name", "Description"],
            [
              ["0", "Continuation", "Free/limited access for returning users"],
              ["1", "Free", "Basic access to public content"],
              ["2", "Base/Training", "Standard paid subscription"],
              ["3", "Pro/Coaching", "Enhanced features with coaching support"],
              ["4", "Combined", "Training + Coaching combined"],
              ["5", "Elite/Enterprise", "Full access to all platform features"],
            ],
          ),

          createHeading("Plan Configuration", HeadingLevel.HEADING_2),
          createParagraph("Each plan has:"),
          createParagraph("Display name (for upsell messages)", { bullet: true }),
          createParagraph("Credit allowance (monthly credits)", { bullet: true }),
          createParagraph("Feature assignments with optional limits", { bullet: true }),
          createParagraph("Stripe product/price IDs", { bullet: true }),
          createParagraph("Fallback plan for downgrades", { bullet: true }),

          createHeading("Add-Ons", HeadingLevel.HEADING_2),
          createParagraph("Consumable add-ons: Limited quantity items (e.g., coaching sessions)"),
          createParagraph("Feature add-ons: Unlock specific features regardless of plan tier"),
          createParagraph("Expiration dates: Optional expiry for time-limited access"),
          new Paragraph({ children: [new PageBreak()] }),

          // Section 19: Email Notifications
          createHeading("19. Email Notifications", HeadingLevel.HEADING_1),
          createHeading("Notification Types", HeadingLevel.HEADING_2),
          createTable(
            ["Type", "Trigger", "Recipients"],
            [
              [
                "Session Scheduled",
                "Session created with confirmed date/time",
                "Client enrolled in the session",
              ],
              ["Session Reminder", "Scheduled time before session", "All session participants"],
              ["Assignment Submitted", "Client submits assignment", "Assigned staff member"],
              ["Assignment Graded", "Staff grades assignment", "Client who submitted"],
              ["Welcome Email", "New user signup", "New user"],
              ["Password Reset", "Password reset requested", "User requesting reset"],
              ["Decision Reminder", "Scheduled decision follow-up", "Decision owner"],
              ["Waitlist Notification", "User added to waitlist", "Waitlisted user"],
              ["Organization Invite", "Org admin invites member", "Invited member"],
            ],
          ),

          createHeading("Email Queue", HeadingLevel.HEADING_2),
          createParagraph("Emails are queued and processed via edge function"),
          createParagraph("Queue status can be monitored in admin dashboard"),
          createParagraph("Failed emails are logged with error details"),

          createHeading("Email Templates", HeadingLevel.HEADING_2),
          createParagraph("Templates are stored in email_templates table"),
          createParagraph("Support for dynamic variables (e.g., {{name}}, {{sessionDate}})"),
          createParagraph("HTML and plain text versions"),
          createParagraph("Email assets managed separately for images/logos"),
          new Paragraph({ children: [new PageBreak()] }),

          // Section 20: Privacy and Compliance
          createHeading("20. Privacy and Compliance", HeadingLevel.HEADING_1),
          createHeading("GDPR Compliance", HeadingLevel.HEADING_2),
          createParagraph("Cookie consent management with granular preferences"),
          createParagraph("Privacy policy with international data transfer disclosures"),
          createParagraph("Data export functionality for users"),
          createParagraph("Account deletion requests with admin review"),

          createHeading("Data Protection", HeadingLevel.HEADING_2),
          createParagraph("Row-level security on all database tables"),
          createParagraph("Staff access restricted to assigned clients only"),
          createParagraph("Billing information protected with strict RLS policies"),
          createParagraph("Session timeout after 30 minutes of inactivity"),

          createHeading("Terms Management", HeadingLevel.HEADING_2),
          createParagraph("Platform-wide terms with versioning"),
          createParagraph("Blocking acceptance for first-time or major updates"),
          createParagraph("Non-blocking banner for minor updates"),
          createParagraph("Program-specific terms when required"),
          createParagraph("Organization-specific terms for B2B clients"),

          createHeading("Audit Logging", HeadingLevel.HEADING_2),
          createParagraph("Admin actions logged with old/new values"),
          createParagraph("Cookie consent recorded with IP and user agent"),
          createParagraph("Terms acceptance tracked with content hash"),
          new Paragraph({ children: [new PageBreak()] }),

          // Section 21: Authentication Contexts
          createHeading("21. Authentication Contexts", HeadingLevel.HEADING_1),
          createParagraph(
            "NOTE: This feature is currently database-managed. A dedicated admin UI for managing auth contexts is planned for future development.",
          ),
          createParagraph(""),

          createHeading("Overview", HeadingLevel.HEADING_2),
          createParagraph(
            "Authentication Contexts allow creating customized landing pages for different user acquisition channels, organizations, or programs. Each context can have unique branding, messaging, and automatic enrollment behavior.",
          ),

          createHeading("URL Parameters", HeadingLevel.HEADING_2),
          createTable(
            ["Parameter", "Purpose", "Example"],
            [
              [
                "ref",
                "Context slug to load specific branding/messaging",
                "/auth?ref=salesforce-cta",
              ],
              ["context", "Alternative to ref parameter", "/auth?context=coaching-program"],
              ["org", "Organization slug for co-branded pages", "/auth?org=acme-corp"],
              [
                "track",
                "Track parameter for track-specific landing",
                "/auth?track=executive-coaching",
              ],
              ["utm_source", "UTM tracking for analytics", "/auth?utm_source=linkedin"],
              ["utm_medium", "UTM medium tracking", "/auth?utm_medium=social"],
              ["utm_campaign", "UTM campaign tracking", "/auth?utm_campaign=spring-2026"],
            ],
          ),

          createHeading("Context Configuration (auth_contexts table)", HeadingLevel.HEADING_2),
          createParagraph("Each context can customize:"),
          createParagraph("Headline and subheadline text", { bullet: true }),
          createParagraph("Description text", { bullet: true }),
          createParagraph("Feature highlights (icon, title, description)", { bullet: true }),
          createParagraph("Logo URL override", { bullet: true }),
          createParagraph("Primary color override", { bullet: true }),
          createParagraph("Default to signup vs login tab", { bullet: true }),
          createParagraph("Auto-enrollment settings (program_id, track_id, organization_id)", {
            bullet: true,
          }),

          createHeading("Signup Context Tracking (signup_contexts table)", HeadingLevel.HEADING_2),
          createParagraph(
            "When users sign up through a contextual link, their entry context is recorded for:",
          ),
          createParagraph("Attribution and analytics", { bullet: true }),
          createParagraph("Post-signup automation (enrollment, track assignment)", {
            bullet: true,
          }),
          createParagraph("UTM parameter tracking", { bullet: true }),
          createParagraph(
            "This data is additive—existing users accessing new context links can gain additional enrollments without disrupting existing access.",
          ),

          createHeading("Multi-Context Support", HeadingLevel.HEADING_2),
          createParagraph(
            "Users can belong to multiple organizations, tracks, and programs simultaneously. Context-based signups add to existing access rather than replacing it.",
          ),

          // Footer
          new Paragraph({ children: [new PageBreak()] }),
          new Paragraph({
            children: [
              new TextRun({
                text: "— End of Platform Documentation —",
                italics: true,
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { before: 400 },
          }),
        ],
      },
    ],
  });
};
