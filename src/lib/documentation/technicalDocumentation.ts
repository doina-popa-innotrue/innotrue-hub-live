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

const createCodeBlock = (code: string) => {
  return new Paragraph({
    children: [
      new TextRun({
        text: code,
        font: "Courier New",
        size: 20,
      }),
    ],
    shading: { fill: "F5F5F5" },
    spacing: { before: 100, after: 100 },
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

export const generateTechnicalDocumentation = (): Document => {
  return new Document({
    title: "InnoTrue Hub - Technical Documentation",
    description:
      "Full stack technical documentation including database schema, APIs, and architecture",
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
                text: "Technical Documentation",
                size: 48,
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "Full Stack Architecture and Implementation Guide",
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
          createParagraph("1. Technology Stack"),
          createParagraph("2. Project Structure"),
          createParagraph("3. Database Schema"),
          createParagraph("4. Database Triggers and Functions"),
          createParagraph("5. Authentication & Authorization"),
          createParagraph("6. Edge Functions (API)"),
          createParagraph("7. Frontend Architecture"),
          createParagraph("8. State Management"),
          createParagraph("9. Routing Configuration"),
          createParagraph("10. Custom Hooks"),
          createParagraph("11. Component Library"),
          createParagraph("12. Feature Gating System"),
          createParagraph("13. Credit System Architecture"),
          createParagraph("14. Email Notification System"),
          createParagraph("15. External Integrations"),
          createParagraph("16. Security Considerations"),
          createParagraph("17. Authentication Context System"),
          createParagraph("18. File Storage Architecture"),
          new Paragraph({ children: [new PageBreak()] }),

          // Section 1: Technology Stack
          createHeading("1. Technology Stack", HeadingLevel.HEADING_1),
          createHeading("Frontend", HeadingLevel.HEADING_2),
          createTable(
            ["Technology", "Version", "Purpose"],
            [
              ["React", "18.3.x", "UI framework"],
              ["TypeScript", "5.x", "Type-safe JavaScript"],
              ["Vite", "5.x", "Build tool and dev server"],
              ["Tailwind CSS", "3.x", "Utility-first CSS framework"],
              ["shadcn/ui", "Latest", "Component library"],
              ["React Router", "6.x", "Client-side routing"],
              ["TanStack Query", "5.x", "Server state management"],
              ["React Hook Form", "7.x", "Form handling"],
              ["Zod", "3.x", "Schema validation"],
              ["docx", "9.x", "Document generation"],
              ["Recharts", "2.x", "Chart visualizations"],
              ["TipTap", "3.x", "Rich text editing"],
              ["date-fns / date-fns-tz", "4.x / 3.x", "Date manipulation with timezone support"],
            ],
          ),
          createParagraph(""),
          createHeading("Backend", HeadingLevel.HEADING_2),
          createTable(
            ["Technology", "Purpose"],
            [
              ["Supabase", "Backend as a Service (PostgreSQL, Auth, Storage, Edge Functions)"],
              ["PostgreSQL", "Primary database with RLS"],
              ["Deno", "Edge function runtime"],
              ["Row Level Security (RLS)", "Data access control at database level"],
              ["Resend", "Transactional email delivery"],
              ["pg_net", "HTTP requests from database triggers"],
            ],
          ),
          new Paragraph({ children: [new PageBreak()] }),

          // Section 2: Project Structure
          createHeading("2. Project Structure", HeadingLevel.HEADING_1),
          createCodeBlock("src/"),
          createCodeBlock("├── components/        # React components"),
          createCodeBlock("│   ├── ui/           # shadcn/ui base components"),
          createCodeBlock("│   ├── admin/        # Admin-specific components"),
          createCodeBlock("│   ├── modules/      # Module-related components"),
          createCodeBlock("│   ├── goals/        # Goal tracking components"),
          createCodeBlock("│   ├── decisions/    # Decision toolkit components"),
          createCodeBlock("│   ├── gdpr/         # Privacy and consent components"),
          createCodeBlock("│   ├── onboarding/   # Tour and onboarding components"),
          createCodeBlock("│   └── ..."),
          createCodeBlock("├── pages/            # Page components"),
          createCodeBlock("│   ├── admin/        # Admin pages"),
          createCodeBlock("│   ├── org-admin/    # Organization admin pages"),
          createCodeBlock("│   ├── instructor/   # Instructor/Coach pages"),
          createCodeBlock("│   ├── client/       # Client pages"),
          createCodeBlock("│   ├── legal/        # Legal pages (Privacy, Cookie Policy)"),
          createCodeBlock("│   └── public/       # Public pages"),
          createCodeBlock("├── hooks/            # Custom React hooks"),
          createCodeBlock("├── contexts/         # React contexts"),
          createCodeBlock("├── lib/              # Utility functions"),
          createCodeBlock("│   └── documentation/# DOCX generation"),
          createCodeBlock("├── integrations/     # External service integrations"),
          createCodeBlock("└── data/             # Static data and configurations"),
          createParagraph(""),
          createCodeBlock("supabase/"),
          createCodeBlock("├── functions/        # Edge functions (60+ functions)"),
          createCodeBlock("│   ├── _shared/      # Shared utilities"),
          createCodeBlock("│   ├── send-notification-email/"),
          createCodeBlock("│   ├── calcom-webhook/"),
          createCodeBlock("│   └── ..."),
          createCodeBlock("├── migrations/       # Database migrations"),
          createCodeBlock("└── config.toml       # Supabase configuration"),
          new Paragraph({ children: [new PageBreak()] }),

          // Section 3: Database Schema
          createHeading("3. Database Schema", HeadingLevel.HEADING_1),
          createHeading("Core Tables", HeadingLevel.HEADING_2),

          createHeading("User Management", HeadingLevel.HEADING_3),
          createTable(
            ["Table", "Description", "Key Columns"],
            [
              ["profiles", "User profile data", "id, name, email, timezone, avatar_url, plan_id"],
              [
                "user_roles",
                "Role assignments",
                "user_id, role (admin/instructor/coach/client/org_admin)",
              ],
              [
                "client_profiles",
                "Additional client data",
                "user_id, status, status_marker, notes, tags",
              ],
              ["client_coaches", "Coach-client relationships", "client_id, coach_id"],
              [
                "billing_info",
                "Billing details (protected)",
                "user_id, company, vat, address fields",
              ],
              [
                "ai_preferences",
                "User AI consent and preferences",
                "user_id, ai_insights_enabled, consent_given_at",
              ],
            ],
          ),
          createParagraph(""),

          createHeading("Programs & Modules", HeadingLevel.HEADING_3),
          createTable(
            ["Table", "Description", "Key Columns"],
            [
              [
                "programs",
                "Learning programs",
                "id, name, slug, description, category, min_plan_tier",
              ],
              [
                "program_modules",
                "Program modules",
                "id, program_id, title, type, order_index, content",
              ],
              [
                "client_enrollments",
                "User enrollments",
                "id, client_user_id, program_id, status, tier, credit_cost",
              ],
              [
                "module_progress",
                "Completion tracking",
                "id, enrollment_id, module_id, status, completed_at",
              ],
              [
                "module_sessions",
                "Session scheduling",
                "id, module_progress_id, session_date, status, instructor_id, coach_id",
              ],
              [
                "program_versions",
                "Version history",
                "id, program_id, version_number, module_snapshot",
              ],
              ["program_plans", "Program tiers", "id, program_id, name, credit_allowance"],
              [
                "enrollment_module_staff",
                "Per-client staff assignments to modules (many-to-many)",
                "enrollment_id, module_id, staff_user_id, role",
              ],
            ],
          ),
          createParagraph(""),

          createHeading("Feature & Access Control", HeadingLevel.HEADING_3),
          createTable(
            ["Table", "Description", "Key Columns"],
            [
              [
                "features",
                "Feature definitions",
                "id, key, name, is_consumable, is_system, is_active",
              ],
              ["plans", "Subscription plans", "id, key, name, tier_level, credit_allowance"],
              [
                "plan_features",
                "Plan-feature mapping",
                "plan_id, feature_id, enabled, limit_value",
              ],
              ["tracks", "Learning tracks", "id, key, name, display_name"],
              [
                "track_features",
                "Track-feature mapping",
                "track_id, feature_id, is_enabled, limit_value",
              ],
              ["add_ons", "Add-on products", "id, key, name, is_consumable, initial_quantity"],
              ["add_on_features", "Add-on-feature mapping", "add_on_id, feature_id"],
              [
                "user_add_ons",
                "User add-on assignments",
                "user_id, add_on_id, remaining_quantity, expires_at",
              ],
            ],
          ),
          createParagraph(""),

          createHeading("Credits System", HeadingLevel.HEADING_3),
          createTable(
            ["Table", "Description", "Key Columns"],
            [
              [
                "credit_batches",
                "Credit allocations",
                "owner_id, source_type, original_amount, remaining_amount, expires_at",
              ],
              ["credit_source_types", "Credit sources", "key, display_name, default_expiry_months"],
              ["credit_services", "Consumable services", "name, category, credit_cost, feature_id"],
              [
                "credit_usage_periods",
                "Usage tracking",
                "owner_id, period_start, period_end, credits_used",
              ],
            ],
          ),
          createParagraph(""),

          createHeading("Assessments", HeadingLevel.HEADING_3),
          createTable(
            ["Table", "Description", "Key Columns"],
            [
              [
                "wheel_snapshots",
                "Wheel of Life assessments",
                "id, user_id, snapshot_date, ratings (by category)",
              ],
              [
                "wheel_categories",
                "Configurable wheel domains",
                "id, key, name, color, icon, order_index, is_active",
              ],
              [
                "capability_assessments",
                "Assessment definitions",
                "id, name, slug, rating_scale, family_id",
              ],
              ["capability_domains", "Assessment domains", "id, assessment_id, name, order_index"],
              [
                "capability_domain_questions",
                "Domain questions",
                "id, domain_id, question_text, input_type",
              ],
              [
                "capability_snapshots",
                "Assessment results",
                "id, assessment_id, user_id, status, completed_at, shared_with_coach, shared_with_instructor",
              ],
              [
                "capability_snapshot_ratings",
                "Question ratings",
                "id, snapshot_id, question_id, rating",
              ],
              [
                "capability_domain_notes",
                "Domain-level notes",
                "id, snapshot_id, domain_id, content",
              ],
              [
                "capability_question_notes",
                "Question-level notes",
                "id, snapshot_id, question_id, content",
              ],
              ["assessment_families", "Assessment groupings", "id, name, slug"],
            ],
          ),
          createParagraph(""),

          createHeading("Scenario-Based Assessments", HeadingLevel.HEADING_3),
          createTable(
            ["Table", "Description", "Key Columns"],
            [
              [
                "scenario_templates",
                "Scenario definitions",
                "id, title, description, capability_assessment_id, is_protected, is_locked",
              ],
              [
                "scenario_sections",
                "Template sections/pages",
                "id, template_id, title, instructions, order_index",
              ],
              [
                "section_paragraphs",
                "Paragraph content",
                "id, section_id, content, order_index, requires_response",
              ],
              [
                "paragraph_question_links",
                "Links paragraphs to capability questions",
                "id, paragraph_id, question_id, weight",
              ],
              [
                "module_scenarios",
                "Links scenarios to modules",
                "id, module_id, template_id, is_required_for_certification, order_index",
              ],
              [
                "scenario_assignments",
                "Client assignments",
                "id, template_id, user_id, enrollment_id, module_id, status",
              ],
              [
                "paragraph_responses",
                "Client responses",
                "id, assignment_id, paragraph_id, response_text",
              ],
              [
                "paragraph_evaluations",
                "Evaluator feedback",
                "id, assignment_id, paragraph_id, evaluator_id, feedback",
              ],
              [
                "paragraph_question_scores",
                "Question scores",
                "id, assignment_id, paragraph_id, question_id, score, evaluator_id",
              ],
            ],
          ),
          createParagraph(""),

          createHeading("Goals, Tasks & Decisions", HeadingLevel.HEADING_3),
          createTable(
            ["Table", "Description", "Key Columns"],
            [
              [
                "goals",
                "User goals",
                "id, user_id, title, category, status, progress, target_date",
              ],
              [
                "goal_milestones",
                "Goal milestones",
                "id, goal_id, title, target_date, completed_at",
              ],
              ["tasks", "Action items", "id, user_id, goal_id, title, status, due_date, priority"],
              [
                "decisions",
                "Decision records",
                "id, user_id, title, context, status, chosen_option",
              ],
              ["decision_options", "Decision options", "id, decision_id, title, description"],
              ["decision_pros", "Option pros", "id, option_id, text, weight"],
              ["decision_cons", "Option cons", "id, option_id, text, weight"],
              ["decision_reminders", "Follow-up reminders", "id, decision_id, remind_at, sent_at"],
            ],
          ),
          createParagraph(""),

          createHeading("Groups", HeadingLevel.HEADING_3),
          createTable(
            ["Table", "Description", "Key Columns"],
            [
              [
                "groups",
                "Learning groups",
                "id, name, description, program_id, is_active, access_type",
              ],
              ["group_members", "Group membership", "id, group_id, user_id, role (leader/member)"],
              [
                "group_sessions",
                "Scheduled sessions",
                "id, group_id, title, scheduled_at, meeting_link",
              ],
              ["group_check_ins", "Member check-ins", "id, group_id, user_id, content, created_at"],
              ["group_notes", "Shared notes", "id, group_id, title, content, created_by"],
            ],
          ),
          createParagraph(""),

          createHeading("Email System", HeadingLevel.HEADING_3),
          createTable(
            ["Table", "Description", "Key Columns"],
            [
              [
                "email_templates",
                "Email template definitions",
                "id, name, subject, body_html, body_text",
              ],
              [
                "email_queue",
                "Pending/sent emails",
                "id, to_email, template_id, status, sent_at, error_message",
              ],
              ["email_assets", "Email images/assets", "id, name, file_path, public_url"],
            ],
          ),
          createParagraph(""),

          createHeading("Scheduling Integration", HeadingLevel.HEADING_3),
          createTable(
            ["Table", "Description", "Key Columns"],
            [
              [
                "calcom_event_type_mappings",
                "Cal.com event type configs",
                "id, calcom_event_type_id, session_target, default_program_id, default_module_id",
              ],
              [
                "calcom_webhook_logs",
                "Webhook processing logs",
                "id, event_type, payload, processed, error_message",
              ],
              [
                "instructor_calcom_event_types",
                "Instructor-specific Cal.com mappings",
                "id, instructor_id, calcom_event_type_id, scheduling_url",
              ],
            ],
          ),
          new Paragraph({ children: [new PageBreak()] }),

          // Section 4: Database Triggers
          createHeading("4. Database Triggers and Functions", HeadingLevel.HEADING_1),
          createHeading("Key Triggers", HeadingLevel.HEADING_2),
          createTable(
            ["Trigger", "Table", "Purpose"],
            [
              [
                "trigger_notify_session_scheduled",
                "module_sessions",
                "Sends email when session status changes to scheduled with a date",
              ],
              [
                "trigger_notify_assignment_submitted",
                "module_progress",
                "Notifies staff when assignment is submitted",
              ],
              [
                "update_*_updated_at",
                "Various",
                "Auto-updates updated_at timestamp on row changes",
              ],
              ["on_auth_user_created", "auth.users", "Creates profile record for new users"],
            ],
          ),

          createHeading("notify_session_scheduled Function", HeadingLevel.HEADING_2),
          createParagraph(
            'Triggers when module_sessions status changes to "scheduled" with a valid session_date:',
          ),
          createParagraph("Resolves client information (name, email) from enrollment", {
            bullet: true,
          }),
          createParagraph("Resolves staff name from instructor_id OR coach_id", { bullet: true }),
          createParagraph("Sends notification via send-notification-email edge function", {
            bullet: true,
          }),
          createParagraph("Includes scheduledDate, staff name, meeting link, and program context", {
            bullet: true,
          }),
          createParagraph("Uses custom domain (app.innotrue.com) for links", { bullet: true }),

          createHeading("Key Database Functions", HeadingLevel.HEADING_2),
          createTable(
            ["Function", "Purpose"],
            [
              ["has_role(user_id, role)", "Check if user has specific role"],
              [
                "staff_has_client_relationship(staff_id, client_id)",
                "Check coach/instructor assignment",
              ],
              ["get_user_credit_summary_v2(user_id)", "Get credit balance and details"],
              ["grant_credit_batch(...)", "Admin credit allocation"],
              ["consume_credits(...)", "Deduct credits for service usage"],
              ["cleanup_old_notifications()", "Remove old notification records"],
            ],
          ),
          new Paragraph({ children: [new PageBreak()] }),

          // Section 5: Auth
          createHeading("5. Authentication & Authorization", HeadingLevel.HEADING_1),
          createHeading("Authentication Flow", HeadingLevel.HEADING_2),
          createParagraph("The platform uses Supabase Auth with the following features:"),
          createParagraph("Email/password authentication", { bullet: true }),
          createParagraph("Email verification required (configurable)", { bullet: true }),
          createParagraph("Password reset flow with secure tokens", { bullet: true }),
          createParagraph("Session management with automatic refresh", { bullet: true }),
          createParagraph("Session timeout after 30 minutes of inactivity", { bullet: true }),

          createHeading("AuthContext", HeadingLevel.HEADING_2),
          createParagraph("Central authentication context providing:"),
          createCodeBlock("interface AuthContextType {"),
          createCodeBlock("  user: User | null;"),
          createCodeBlock("  session: Session | null;"),
          createCodeBlock(
            '  userRole: "admin" | "coach" | "client" | "instructor" | "org_admin" | null;',
          ),
          createCodeBlock("  userRoles: string[];  // All roles user has"),
          createCodeBlock("  loading: boolean;"),
          createCodeBlock("  signIn: (email, password) => Promise;"),
          createCodeBlock("  signUp: (email, password, name) => Promise;"),
          createCodeBlock("  signOut: () => Promise;"),
          createCodeBlock("  switchRole: (role) => void;  // For multi-role users"),
          createCodeBlock("}"),

          createHeading("Role-Based Access Control", HeadingLevel.HEADING_2),
          createParagraph(
            "Roles are stored in user_roles table (separate from profiles for security).",
          ),
          createParagraph("Frontend: ProtectedRoute component wraps authenticated pages", {
            bullet: true,
          }),
          createParagraph("Backend: RLS policies check auth.uid() against user_id columns", {
            bullet: true,
          }),
          createParagraph(
            "Admin check: has_role(auth.uid(), 'admin') function verifies admin role",
            { bullet: true },
          ),
          createParagraph(
            "Staff check: staff_has_client_relationship() for coach/instructor access",
            { bullet: true },
          ),

          createHeading("Row Level Security Patterns", HeadingLevel.HEADING_2),
          createCodeBlock("-- User can access own data"),
          createCodeBlock('CREATE POLICY "Users can view own data"'),
          createCodeBlock("ON table_name FOR SELECT"),
          createCodeBlock("USING (auth.uid() = user_id);"),
          createParagraph(""),
          createCodeBlock("-- Admin can access all data"),
          createCodeBlock('CREATE POLICY "Admins can view all"'),
          createCodeBlock("ON table_name FOR SELECT"),
          createCodeBlock("USING (public.has_role(auth.uid(), 'admin'));"),
          createParagraph(""),
          createCodeBlock("-- Staff can access assigned clients only"),
          createCodeBlock('CREATE POLICY "Staff can view assigned clients"'),
          createCodeBlock("ON profiles FOR SELECT"),
          createCodeBlock("USING (staff_has_client_relationship(auth.uid(), id));"),
          new Paragraph({ children: [new PageBreak()] }),

          // Section 6: Edge Functions
          createHeading("6. Edge Functions (API)", HeadingLevel.HEADING_1),
          createParagraph(
            "Serverless functions deployed to Supabase Edge Functions (Deno runtime). 60+ functions available.",
          ),

          createHeading("Email & Notifications", HeadingLevel.HEADING_2),
          createTable(
            ["Function", "Method", "Purpose"],
            [
              [
                "send-notification-email",
                "POST",
                "Send system notifications (sessions, reminders, etc.)",
              ],
              ["send-auth-email", "POST", "Send authentication emails (signup, reset)"],
              ["send-welcome-email", "POST", "Send welcome email to new users"],
              ["send-wheel-pdf", "POST", "Send Wheel of Life PDF export"],
              ["send-org-invite", "POST", "Send organization membership invites"],
              ["send-schedule-reminders", "POST", "Send upcoming session reminders"],
              ["process-email-queue", "POST", "Process queued emails"],
              ["notify-assignment-graded", "POST", "Notify client of graded assignment"],
              ["notify-assignment-submitted", "POST", "Notify staff of submitted assignment"],
              ["notify-waitlist", "POST", "Notify waitlisted users"],
              ["decision-reminders", "POST", "Send decision follow-up reminders"],
              ["subscription-reminders", "POST", "Send subscription-related reminders"],
              ["registration-follow-ups", "POST", "Follow up on registrations"],
            ],
          ),

          createHeading("Authentication & User Management", HeadingLevel.HEADING_2),
          createTable(
            ["Function", "Method", "Purpose"],
            [
              ["signup-user", "POST", "Create new user with context metadata"],
              ["verify-signup", "POST", "Validate email verification token"],
              ["create-admin-user", "POST", "Admin user creation endpoint"],
              ["delete-user", "POST", "Admin user deletion endpoint"],
              ["get-user-email", "POST", "Get user email (admin only)"],
              ["update-user-email", "POST", "Update user email address"],
              ["verify-email-change", "POST", "Verify email change token"],
              ["request-account-deletion", "POST", "Submit account deletion request"],
            ],
          ),

          createHeading("Integrations", HeadingLevel.HEADING_2),
          createTable(
            ["Function", "Method", "Purpose"],
            [
              ["calcom-webhook", "POST", "Handle Cal.com booking webhooks"],
              ["calcom-create-booking", "POST", "Create Cal.com booking"],
              ["calcom-get-booking-url", "POST", "Get Cal.com scheduling URL"],
              ["talentlms-sso", "POST", "Generate TalentLMS SSO login URL"],
              ["talentlms-webhook", "POST", "Handle TalentLMS webhooks"],
              ["sync-talentlms-progress", "POST", "Sync course progress from TalentLMS"],
              ["circle-sso", "POST", "Generate Circle community SSO token"],
              ["ac-webhook (via ac-webhook)", "POST", "ActiveCampaign webhook handler"],
            ],
          ),

          createHeading("OAuth & Calendar", HeadingLevel.HEADING_2),
          createTable(
            ["Function", "Method", "Purpose"],
            [
              ["oauth-authorize", "GET", "Initiate OAuth flow"],
              ["oauth-callback", "GET", "Handle OAuth callback"],
              ["oauth-status", "GET", "Check OAuth connection status"],
              ["oauth-disconnect", "POST", "Disconnect OAuth integration"],
              ["oauth-create-meeting", "POST", "Create meeting via OAuth"],
              ["google-calendar-create-event", "POST", "Create Google Calendar event"],
              ["calendar-feed", "GET", "Generate iCal feed"],
              ["generate-calendar-url", "POST", "Generate calendar subscription URL"],
              ["fetch-ical-feed", "POST", "Fetch external iCal feed"],
            ],
          ),

          createHeading("Payments & Credits", HeadingLevel.HEADING_2),
          createTable(
            ["Function", "Method", "Purpose"],
            [
              ["create-checkout", "POST", "Create Stripe checkout session"],
              ["customer-portal", "POST", "Generate Stripe customer portal URL"],
              ["purchase-credit-topup", "POST", "Purchase additional credits"],
              ["confirm-credit-topup", "POST", "Confirm credit purchase"],
              ["credit-maintenance", "POST", "Credit rollover and expiration"],
              ["org-purchase-credits", "POST", "Organization credit purchase"],
              ["org-confirm-credit-purchase", "POST", "Confirm org credit purchase"],
              ["org-platform-subscription", "POST", "Manage org subscriptions"],
            ],
          ),

          createHeading("AI & Analytics", HeadingLevel.HEADING_2),
          createTable(
            ["Function", "Method", "Purpose"],
            [
              ["decision-insights", "POST", "Generate AI insights for decisions"],
              ["course-recommendations", "POST", "Generate AI course recommendations"],
              ["generate-reflection-prompt", "POST", "Generate AI reflection prompts"],
              ["analytics-ai-insights", "POST", "Generate analytics insights"],
              ["check-ai-usage", "POST", "Check AI usage limits"],
              ["track-analytics", "POST", "Track analytics events"],
            ],
          ),

          createHeading("Other", HeadingLevel.HEADING_2),
          createTable(
            ["Function", "Method", "Purpose"],
            [
              ["export-feature-config", "POST", "Export feature/credit configuration"],
              ["generate-public-profile", "POST", "Generate shareable profile"],
              ["create-client-development-item", "POST", "Create development item for client"],
              ["cleanup-notifications", "POST", "Clean up old notifications"],
              ["check-org-seat-limits", "POST", "Verify organization seat availability"],
              ["accept-org-invite", "POST", "Accept organization membership invite"],
              ["transfer-placeholder-data", "POST", "Transfer placeholder user data"],
              ["seed-demo-data", "POST", "Seed demo data (dev only)"],
            ],
          ),

          createHeading("Function Security Pattern", HeadingLevel.HEADING_2),
          createCodeBlock("// Admin-only function pattern"),
          createCodeBlock('const authHeader = req.headers.get("Authorization");'),
          createCodeBlock("const supabase = createClient(url, anonKey, {"),
          createCodeBlock("  global: { headers: { Authorization: authHeader } }"),
          createCodeBlock("});"),
          createCodeBlock(""),
          createCodeBlock("// Verify admin role server-side"),
          createCodeBlock("const { data: userRoles } = await supabase"),
          createCodeBlock('  .from("user_roles")'),
          createCodeBlock('  .select("role")'),
          createCodeBlock('  .eq("user_id", user.id);'),
          createCodeBlock(""),
          createCodeBlock('const isAdmin = userRoles?.some(r => r.role === "admin");'),
          createCodeBlock("if (!isAdmin) {"),
          createCodeBlock('  return new Response("Forbidden", { status: 403 });'),
          createCodeBlock("}"),
          new Paragraph({ children: [new PageBreak()] }),

          // Section 7: Frontend Architecture
          createHeading("7. Frontend Architecture", HeadingLevel.HEADING_1),
          createHeading("Component Organization", HeadingLevel.HEADING_2),
          createParagraph(
            "UI Components (src/components/ui/): shadcn/ui components with custom variants",
            { bullet: true },
          ),
          createParagraph(
            "Feature Components: Organized by feature domain (admin, modules, goals, etc.)",
            { bullet: true },
          ),
          createParagraph("Layout Components: DashboardLayout, OrgAdminLayout, AppSidebar", {
            bullet: true,
          }),
          createParagraph(
            "Page Components (src/pages/): Route-level components organized by role",
            { bullet: true },
          ),

          createHeading("Key Layout Components", HeadingLevel.HEADING_2),
          createTable(
            ["Component", "Purpose"],
            [
              ["DashboardLayout", "Main layout wrapper with sidebar and content area"],
              ["OrgAdminLayout", "Layout for organization admin pages"],
              ["AppSidebar", "Navigation sidebar with role-based menu items and feature gating"],
              ["ProtectedRoute", "Route guard for authenticated pages with role check"],
              ["FeatureGate", "Conditional rendering based on feature access"],
              ["PlatformTermsAcceptanceGate", "Blocks access until terms accepted"],
            ],
          ),

          createHeading("Design System", HeadingLevel.HEADING_2),
          createParagraph("Tailwind CSS with custom design tokens defined in:"),
          createParagraph("index.css: CSS custom properties for colors, spacing, etc.", {
            bullet: true,
          }),
          createParagraph("tailwind.config.ts: Extended theme configuration", { bullet: true }),
          createParagraph(
            "All colors use HSL format with semantic naming (primary, secondary, muted, etc.)",
            { bullet: true },
          ),
          createParagraph(
            "NEVER use hardcoded colors (bg-white, text-black) - always use design tokens",
            { bullet: true },
          ),
          new Paragraph({ children: [new PageBreak()] }),

          // Section 8: State Management
          createHeading("8. State Management", HeadingLevel.HEADING_1),
          createHeading("TanStack Query (React Query)", HeadingLevel.HEADING_2),
          createParagraph("Primary state management for server data:"),
          createCodeBlock("const { data, isLoading, error } = useQuery({"),
          createCodeBlock('  queryKey: ["programs", userId],'),
          createCodeBlock("  queryFn: async () => {"),
          createCodeBlock("    const { data, error } = await supabase"),
          createCodeBlock('      .from("programs").select("*");'),
          createCodeBlock("    if (error) throw error;"),
          createCodeBlock("    return data;"),
          createCodeBlock("  },"),
          createCodeBlock("});"),

          createHeading("React Context", HeadingLevel.HEADING_2),
          createParagraph("Used for global UI state:"),
          createParagraph("AuthContext: User authentication and role state", { bullet: true }),
          createParagraph("SidebarContext: Sidebar open/close state", { bullet: true }),

          createHeading("Local State", HeadingLevel.HEADING_2),
          createParagraph("useState for component-level state"),
          createParagraph("useReducer for complex local state logic"),
          createParagraph("React Hook Form for form state management"),
          createParagraph(
            "localStorage for persistent preferences (e.g., cookie consent, completed tours)",
          ),
          new Paragraph({ children: [new PageBreak()] }),

          // Section 9: Routing
          createHeading("9. Routing Configuration", HeadingLevel.HEADING_1),
          createHeading("Route Structure", HeadingLevel.HEADING_2),
          createTable(
            ["Path Pattern", "Role", "Description"],
            [
              ["/auth", "Public", "Authentication pages"],
              ["/admin/*", "Admin", "Admin management pages"],
              ["/org-admin/*", "Org Admin", "Organization admin pages"],
              ["/teaching/*", "Instructor/Coach", "Teaching dashboard and tools"],
              ["/dashboard, /programs/*", "Client", "Client dashboard and features"],
              ["/profile, /account", "Authenticated", "User settings"],
              ["/public/*", "Public", "Public assessments and pages"],
              ["/privacy-policy, /cookie-policy", "Public", "Legal pages"],
            ],
          ),
          new Paragraph({ children: [new PageBreak()] }),

          // Section 10: Custom Hooks
          createHeading("10. Custom Hooks", HeadingLevel.HEADING_1),
          createTable(
            ["Hook", "Purpose"],
            [
              ["useAuth", "Access authentication context"],
              ["useEntitlements", "Check all user entitlements (unified access)"],
              ["useFeatureVisibility", "Get visibility state (hidden/locked/accessible)"],
              ["useFeatureAccess", "Check feature availability by key"],
              ["usePlanAccess", "Check plan tier access"],
              ["useUnifiedCredits", "Manage credit-based features"],
              ["useDecisionFeatureAccess", "Check decision toolkit capabilities"],
              ["useCircleSSO", "Handle Circle community SSO"],
              ["useTalentLmsSSO", "Handle TalentLMS SSO"],
              ["useTalentLmsProgress", "Fetch/sync TalentLMS progress"],
              ["useLucidSSO", "Handle Lucid SSO"],
              ["useSessionTimeout", "Manage session inactivity timeout"],
              ["useOnboardingTour", "Control onboarding tour flow"],
              ["useSupportEmail", "Get support email configuration"],
              ["useAIPreferences", "Manage AI feature preferences"],
              ["useUserTimezone", "Get user timezone with fallbacks"],
              ["useRecurrenceSettings", "Get max recurrence occurrences setting"],
              ["useWheelCategories", "Fetch Wheel of Life categories"],
              ["useUserAddOns", "Check user add-on feature access"],
              ["useAuditLog", "Log admin actions"],
              ["useSkillsAcquisition", "Award skills on module completion"],
            ],
          ),

          createHeading("Scenario Hooks (src/hooks/scenarios/)", HeadingLevel.HEADING_2),
          createTable(
            ["Hook", "Purpose"],
            [
              ["useScenarioTemplates", "CRUD operations for scenario templates"],
              ["useScenarioAssignments", "Manage scenario assignments to clients"],
              ["useScenarioResponses", "Handle client responses and auto-save"],
              ["useScenarioProgress", "Calculate scenario completion percentage"],
              ["useModuleScenarios", "Manage module-scenario linking"],
              ["useModuleScenarioMutations", "Add/remove/reorder scenarios in modules"],
              ["useScenariosForModule", "Fetch linked scenarios for client module view"],
            ],
          ),
          new Paragraph({ children: [new PageBreak()] }),

          // Section 11: Component Library
          createHeading("11. Component Library", HeadingLevel.HEADING_1),
          createParagraph("Built on shadcn/ui with Radix UI primitives."),

          createHeading("Core UI Components", HeadingLevel.HEADING_2),
          createParagraph("Button, Card, Dialog, Sheet, Tabs, Accordion, Table", { bullet: true }),
          createParagraph("Form components: Input, Select, Checkbox, Radio, Switch, Textarea", {
            bullet: true,
          }),
          createParagraph("Feedback: Toast, Alert, Badge, Progress, Skeleton", { bullet: true }),
          createParagraph("Navigation: Breadcrumb, Sidebar, Navigation Menu, Dropdown Menu", {
            bullet: true,
          }),
          createParagraph("Data display: Table, Calendar, Chart (Recharts)", { bullet: true }),

          createHeading("Custom Components", HeadingLevel.HEADING_2),
          createParagraph("RichTextEditor: TipTap-based rich text editing", { bullet: true }),
          createParagraph("RichTextDisplay: Safe HTML rendering with DOMPurify", { bullet: true }),
          createParagraph("ResourceViewer: Multi-format resource display", { bullet: true }),
          createParagraph("TimezoneSelect: Timezone picker with search", { bullet: true }),
          createParagraph("IconPicker: Icon selection for announcements", { bullet: true }),
          createParagraph("CookieConsentBanner: GDPR-compliant cookie consent", { bullet: true }),

          createHeading("Admin Components", HeadingLevel.HEADING_2),
          createParagraph("AdminPageHeader: Consistent admin page headers", { bullet: true }),
          createParagraph("AdminTable: Data table with sorting and filtering", { bullet: true }),
          createParagraph("AdminFilters: Reusable filter components", { bullet: true }),
          createParagraph("AdminBreadcrumb: Navigation breadcrumbs", { bullet: true }),
          createParagraph("AdminEmptyState: Empty state displays", { bullet: true }),
          createParagraph("AdminLoadingState: Loading indicators", { bullet: true }),
          createParagraph("InstructorCalcomEventTypes: Instructor Cal.com mapping UI", {
            bullet: true,
          }),
          createParagraph("EnrollmentModuleStaffManager: Staff assignment UI", { bullet: true }),
          createParagraph("PlatformTermsManager: Terms versioning UI", { bullet: true }),
          new Paragraph({ children: [new PageBreak()] }),

          // Section 12: Feature Gating
          createHeading("12. Feature Gating System", HeadingLevel.HEADING_1),
          createHeading("Architecture", HeadingLevel.HEADING_2),
          createParagraph(
            "Features are defined in the features table with keys used for access checks.",
          ),
          createParagraph(
            "Features can be assigned via: plans, tracks, add-ons, or program plans.",
          ),
          createParagraph("User entitlements are the UNION of all sources."),

          createHeading("Visibility States", HeadingLevel.HEADING_2),
          createCodeBlock('type VisibilityState = "hidden" | "locked" | "accessible";'),
          createCodeBlock(""),
          createCodeBlock("// hidden: is_active=false OR not monetized"),
          createCodeBlock("// locked: monetized but user lacks access"),
          createCodeBlock("// accessible: user has access from any source"),

          createHeading("System Features", HeadingLevel.HEADING_2),
          createParagraph("Features marked is_system=true control core functionality."),
          createParagraph("Cannot be deleted via UI."),
          createParagraph("Shown with lock icon and tooltip explaining their purpose."),

          createHeading("Export Configuration", HeadingLevel.HEADING_2),
          createParagraph("Admins can export feature configuration via edge function."),
          createParagraph("Requires admin role verification server-side."),
          createParagraph("Exports include all plan, track, add-on, and program plan mappings."),
          new Paragraph({ children: [new PageBreak()] }),

          // Section 13: Credit System
          createHeading("13. Credit System Architecture", HeadingLevel.HEADING_1),
          createHeading("Credit Sources", HeadingLevel.HEADING_2),
          createTable(
            ["Source", "Table", "Description"],
            [
              ["Subscription", "plans.credit_allowance", "Monthly credits from plan"],
              ["Program Plan", "program_plans.credit_allowance", "Credits from enrollment"],
              ["Admin Grant", "credit_batches", "Manual admin allocation"],
              ["Purchase", "credit_batches", "Credit top-up purchase"],
              ["Organization", "credit_batches", "Org-allocated credits"],
            ],
          ),

          createHeading("Credit Batches", HeadingLevel.HEADING_2),
          createParagraph("Credits tracked in batches with:"),
          createParagraph("original_amount: Initial credit grant", { bullet: true }),
          createParagraph("remaining_amount: Current balance", { bullet: true }),
          createParagraph("expires_at: Expiration timestamp", { bullet: true }),
          createParagraph("source_type: FK to credit_source_types", { bullet: true }),
          createParagraph("is_expired: Flag for expired batches", { bullet: true }),

          createHeading("Credit Services", HeadingLevel.HEADING_2),
          createParagraph("Services organized by category in credit_services table."),
          createParagraph("Each service has a credit_cost."),
          createParagraph("Can link to a feature_id for gated access."),
          createParagraph("Track-specific discounts via track_discounted_cost."),

          createHeading("RPC Functions", HeadingLevel.HEADING_2),
          createCodeBlock("get_user_credit_summary_v2(p_user_id) -- Get credit balance"),
          createCodeBlock("grant_credit_batch(p_owner_id, p_amount, ...) -- Admin grant"),
          createCodeBlock("consume_credits(...) -- Deduct credits for service"),
          new Paragraph({ children: [new PageBreak()] }),

          // Section 14: Email Notification System
          createHeading("14. Email Notification System", HeadingLevel.HEADING_1),
          createHeading("Architecture", HeadingLevel.HEADING_2),
          createParagraph("Emails can be triggered via:"),
          createParagraph("Database triggers using pg_net to call edge functions", {
            bullet: true,
          }),
          createParagraph("Direct edge function invocation from frontend", { bullet: true }),
          createParagraph("Scheduled functions (cron) for reminders", { bullet: true }),

          createHeading("send-notification-email Function", HeadingLevel.HEADING_2),
          createParagraph("Central notification delivery function that handles:"),
          createParagraph("Session scheduled notifications", { bullet: true }),
          createParagraph("Reminder emails", { bullet: true }),
          createParagraph("Assignment notifications", { bullet: true }),
          createParagraph("Decision reminders", { bullet: true }),

          createHeading("Key Parameters", HeadingLevel.HEADING_2),
          createCodeBlock("interface NotificationPayload {"),
          createCodeBlock("  recipientEmail: string;"),
          createCodeBlock("  recipientName?: string;"),
          createCodeBlock("  notificationType: string;"),
          createCodeBlock("  scheduledDate?: string;  // For session notifications"),
          createCodeBlock("  sessionDate?: string;"),
          createCodeBlock("  staffName?: string;"),
          createCodeBlock("  meetingLink?: string;"),
          createCodeBlock("  entityName?: string;"),
          createCodeBlock("  entityLink?: string;"),
          createCodeBlock('  // schedulingUrl omitted = no "Schedule" button'),
          createCodeBlock("}"),

          createHeading("Database Trigger Pattern", HeadingLevel.HEADING_2),
          createCodeBlock("-- Trigger only fires when status changes TO scheduled"),
          createCodeBlock("IF NEW.status = 'scheduled' AND NEW.session_date IS NOT NULL"),
          createCodeBlock("   AND (OLD IS NULL OR OLD.status != 'scheduled') THEN"),
          createCodeBlock("  -- Call edge function via pg_net"),
          createCodeBlock("  PERFORM net.http_post("),
          createCodeBlock(
            "    url := get_secret('SUPABASE_URL') || '/functions/v1/send-notification-email',",
          ),
          createCodeBlock('    headers := \'{"Authorization": "Bearer " || service_role_key}\','),
          createCodeBlock("    body := jsonb_build_object(...)"),
          createCodeBlock("  );"),
          createCodeBlock("END IF;"),
          new Paragraph({ children: [new PageBreak()] }),

          // Section 15: Integrations
          createHeading("15. External Integrations", HeadingLevel.HEADING_1),
          createHeading("TalentLMS", HeadingLevel.HEADING_2),
          createParagraph("Configuration: talentlms_settings table stores API credentials"),
          createParagraph("SSO: talentlms-sso edge function generates login URL"),
          createParagraph("Progress Sync: Webhook + scheduled sync for completion tracking"),
          createParagraph(
            "User Mapping: talentlms_users table links platform users to LMS accounts",
          ),
          createParagraph("Course Mapping: canonical_id for external course reference"),

          createHeading("Cal.com", HeadingLevel.HEADING_2),
          createParagraph("Webhook handling: calcom-webhook edge function"),
          createParagraph("Event type mappings: calcom_event_type_mappings table"),
          createParagraph("Instructor-specific URLs: instructor_calcom_event_types table"),
          createParagraph("Booking creation: calcom-create-booking edge function"),
          createParagraph("Automatic session creation on booking.created webhook"),

          createHeading("Circle", HeadingLevel.HEADING_2),
          createParagraph("Configuration: circle_config table for API credentials"),
          createParagraph("SSO: circle-sso edge function generates JWT token"),
          createParagraph("User Mapping: circle_users table for account linking"),

          createHeading("ActiveCampaign", HeadingLevel.HEADING_2),
          createParagraph("Webhook handler: ac-webhook edge function"),
          createParagraph("Assessment ingestion: ac_assessment_results table"),
          createParagraph("Interest registrations: ac_interest_registrations table"),
          createParagraph("Sync configurations: activecampaign_sync_configs table"),

          createHeading("Stripe", HeadingLevel.HEADING_2),
          createParagraph("Checkout: create-checkout edge function for payment sessions"),
          createParagraph("Portal: customer-portal edge function for subscription management"),
          createParagraph("Credit purchases: purchase-credit-topup, confirm-credit-topup"),
          createParagraph("Organization: org-purchase-credits, org-confirm-credit-purchase"),

          createHeading("Google Calendar", HeadingLevel.HEADING_2),
          createParagraph("OAuth flow: oauth-authorize, oauth-callback, oauth-status"),
          createParagraph("Event creation: google-calendar-create-event"),
          createParagraph("iCal feed: calendar-feed edge function"),

          createHeading("Email (Resend)", HeadingLevel.HEADING_2),
          createParagraph("Transactional emails via edge functions"),
          createParagraph("Templates stored in email_templates table"),
          createParagraph("Assets managed in email_assets table"),
          createParagraph("Queue tracking in email_queue table"),
          new Paragraph({ children: [new PageBreak()] }),

          // Section 16: Security
          createHeading("16. Security Considerations", HeadingLevel.HEADING_1),
          createHeading("Data Protection", HeadingLevel.HEADING_2),
          createParagraph("All tables have Row Level Security (RLS) policies enabled", {
            bullet: true,
          }),
          createParagraph(
            "Roles stored in separate user_roles table (not profiles) to prevent escalation",
            { bullet: true },
          ),
          createParagraph(
            "Staff access restricted to assigned clients via staff_has_client_relationship()",
            { bullet: true },
          ),
          createParagraph("Billing info protected with strict owner-only RLS", { bullet: true }),
          createParagraph("User input sanitized with DOMPurify for HTML content", { bullet: true }),

          createHeading("Authentication Security", HeadingLevel.HEADING_2),
          createParagraph("JWT tokens with automatic refresh", { bullet: true }),
          createParagraph("Session timeout for inactive users (30 minutes)", { bullet: true }),
          createParagraph("Email verification for new accounts", { bullet: true }),
          createParagraph("Password reset with secure SHA-256 hashed tokens", { bullet: true }),
          createParagraph("Email change requires token verification", { bullet: true }),

          createHeading("API Security", HeadingLevel.HEADING_2),
          createParagraph("Edge functions validate authorization headers", { bullet: true }),
          createParagraph("Admin-only endpoints verify role server-side", { bullet: true }),
          createParagraph("CORS headers configured for allowed origins", { bullet: true }),
          createParagraph("Rate limiting at Supabase infrastructure level", { bullet: true }),
          createParagraph("Input validation with Zod schemas", { bullet: true }),

          createHeading("GDPR Compliance", HeadingLevel.HEADING_2),
          createParagraph("Cookie consent tracking with granular preferences", { bullet: true }),
          createParagraph("Data export functionality for users", { bullet: true }),
          createParagraph("Account deletion requests with admin review", { bullet: true }),
          createParagraph("Privacy policy with international transfer disclosures", {
            bullet: true,
          }),
          createParagraph("Terms acceptance tracking with content hash", { bullet: true }),
          new Paragraph({ children: [new PageBreak()] }),

          // Section 17: Authentication Context System
          createHeading("17. Authentication Context System", HeadingLevel.HEADING_1),
          createParagraph(
            "NOTE: Authentication context management UI is planned for future development. Current configuration is database-driven.",
          ),
          createParagraph(""),

          createHeading("Auth Edge Functions", HeadingLevel.HEADING_2),
          createTable(
            ["Function", "Method", "Purpose"],
            [
              [
                "signup-user",
                "POST",
                "Create new user with context metadata (program, track, org, UTM params)",
              ],
              [
                "verify-signup",
                "POST",
                "Validate email verification token and create profile/roles",
              ],
              [
                "send-auth-email",
                "POST",
                "Send templated auth emails (signup confirm, password reset, etc.)",
              ],
            ],
          ),

          createHeading("Auth Context Tables", HeadingLevel.HEADING_2),
          createTable(
            ["Table", "Purpose", "Key Fields"],
            [
              [
                "auth_contexts",
                "Store landing page configurations",
                "slug, headline, features (JSONB), program_id, track_id, organization_id",
              ],
              [
                "signup_contexts",
                "Track user signup attribution",
                "user_id, context_slug, utm_source/medium/campaign, program_enrolled, organization_joined",
              ],
            ],
          ),

          createHeading("Frontend Hook", HeadingLevel.HEADING_2),
          createCodeBlock("// src/hooks/useAuthContext.ts"),
          createCodeBlock("const { context, isLoading } = useAuthContext(contextSlug);"),
          createCodeBlock(""),
          createCodeBlock("// Reads from auth_contexts table by slug"),
          createCodeBlock("// Returns default values if no context found"),
          createCodeBlock("// Context includes: headline, features, logo_url, primary_color"),

          createHeading("URL Parameter Handling", HeadingLevel.HEADING_2),
          createCodeBlock("// Supported URL parameters in Auth.tsx"),
          createCodeBlock(
            'const contextSlug = searchParams.get("ref") || searchParams.get("context");',
          ),
          createCodeBlock('const orgSlug = searchParams.get("org");'),
          createCodeBlock('const trackParam = searchParams.get("track");'),
          createCodeBlock('const utmSource = searchParams.get("utm_source");'),
          createCodeBlock('const utmMedium = searchParams.get("utm_medium");'),
          createCodeBlock('const utmCampaign = searchParams.get("utm_campaign");'),

          createHeading("Security Considerations", HeadingLevel.HEADING_2),
          createParagraph(
            "RLS on auth_contexts: Public read for active contexts, admin-only write",
            { bullet: true },
          ),
          createParagraph("RLS on signup_contexts: Users can only read/insert their own records", {
            bullet: true,
          }),
          createParagraph("Signup tokens are SHA-256 hashed before storage", { bullet: true }),
          createParagraph("Rate limiting on signup endpoint (per IP)", { bullet: true }),
          new Paragraph({ children: [new PageBreak()] }),

          // Section 18: File Storage Architecture
          createHeading("18. File Storage Architecture", HeadingLevel.HEADING_1),
          createParagraph(
            "The platform uses Supabase Storage (S3-compatible) for all file uploads. Files are never stored in the database — only URLs/references are saved.",
          ),
          createParagraph(""),

          createHeading("Storage Buckets", HeadingLevel.HEADING_2),
          createTable(
            ["Bucket", "Purpose", "Public", "Access Pattern"],
            [
              ["avatars", "User profile images", "Yes", "Public read, user upload own"],
              [
                "program-logos",
                "Program branding and badge images",
                "Yes",
                "Public read, admin/instructor manage",
              ],
              [
                "email-assets",
                "Email template images (logo, graphics)",
                "Yes",
                "Public read, admin manage",
              ],
              [
                "resource-library",
                "Admin-managed downloadable resources",
                "No",
                "Authenticated read, admin manage",
              ],
              [
                "goal-resources",
                "Goal and milestone attachments",
                "No",
                "Owner read/write, staff view",
              ],
              [
                "module-client-content",
                "Client module submissions",
                "No",
                "Owner + assigned staff access",
              ],
              [
                "module-assignment-attachments",
                "Assignment file uploads",
                "No",
                "Owner + assigned staff access",
              ],
              [
                "module-reflection-resources",
                "Reflection attachments",
                "No",
                "Owner + assigned staff access",
              ],
              ["task-note-resources", "Task note file attachments", "No", "Owner + staff access"],
              ["coach-feedback-attachments", "Coach feedback files", "No", "Coach + client access"],
              [
                "client-badges",
                "Issued badge images for clients",
                "No",
                "Owner read, admin/instructor issue",
              ],
              [
                "group-notes",
                "Group session notes and files",
                "No",
                "Group members + leaders access",
              ],
              [
                "psychometric-assessments",
                "Assessment-related files",
                "No",
                "Owner + staff access",
              ],
              [
                "external-course-certificates",
                "External course completion certificates",
                "No",
                "Owner read/write, admin view",
              ],
            ],
          ),
          createParagraph(""),

          createHeading("Storage URL Format", HeadingLevel.HEADING_2),
          createCodeBlock("// Public bucket URL format"),
          createCodeBlock(
            "https://{project-id}.supabase.co/storage/v1/object/public/{bucket}/{path}",
          ),
          createCodeBlock(""),
          createCodeBlock("// Private bucket - requires signed URL"),
          createCodeBlock(
            'const { data } = await supabase.storage.from("bucket").createSignedUrl(path, 3600);',
          ),
          createParagraph(""),

          createHeading("Storage Access Patterns", HeadingLevel.HEADING_2),
          createCodeBlock("// Upload file"),
          createCodeBlock("const { data, error } = await supabase.storage"),
          createCodeBlock('  .from("bucket-name")'),
          createCodeBlock("  .upload(filePath, file);"),
          createCodeBlock(""),
          createCodeBlock("// Get public URL (public buckets only)"),
          createCodeBlock('const { data } = supabase.storage.from("bucket").getPublicUrl(path);'),
          createCodeBlock(""),
          createCodeBlock("// Download file"),
          createCodeBlock("const { data, error } = await supabase.storage"),
          createCodeBlock('  .from("bucket-name")'),
          createCodeBlock("  .download(path);"),
          createCodeBlock(""),
          createCodeBlock("// Delete file"),
          createCodeBlock('await supabase.storage.from("bucket").remove([path]);'),
          createParagraph(""),

          createHeading("Security Model", HeadingLevel.HEADING_2),
          createParagraph(
            "Public buckets: Allow anyone to read via direct URL, but only authorized users can upload/delete",
            { bullet: true },
          ),
          createParagraph(
            "Private buckets: Require authentication for all operations, use signed URLs for temporary access",
            { bullet: true },
          ),
          createParagraph(
            "RLS policies on storage.objects control access based on bucket_id and user context",
            { bullet: true },
          ),
          createParagraph(
            "File paths typically include user ID or entity ID for scoping (e.g., avatars/{user_id}/photo.jpg)",
            { bullet: true },
          ),
          createParagraph(
            "Maximum file sizes are enforced per bucket via RLS or application logic",
            { bullet: true },
          ),

          // Footer
          new Paragraph({ children: [new PageBreak()] }),
          new Paragraph({
            children: [
              new TextRun({
                text: "— End of Technical Documentation —",
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
