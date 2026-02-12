import { useState, useMemo } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BookOpen,
  Target,
  Brain,
  Users,
  Award,
  Calendar,
  FileText,
  MessageSquare,
  CircleDot,
  BarChart3,
  CheckSquare,
  Sparkles,
  UsersRound,
  Shield,
  Settings,
  Route,
  Coins,
  TrendingUp,
  Lightbulb,
  LayoutDashboard,
} from "lucide-react";
import { useSupportEmail } from "@/hooks/useSupportEmail";
import { FAQSearch } from "@/components/faq/FAQSearch";

const faqItems = [
  {
    category: "Getting Started",
    icon: LayoutDashboard,
    questions: [
      {
        q: "What is the Dashboard?",
        a: "Your Dashboard is your personal home page showing journey progress, active programs, upcoming sessions, and quick stats for goals, decisions, and tasks. It's organized to help you see what needs attention first.",
      },
      {
        q: "How do I navigate the platform?",
        a: "Use the sidebar on the left to access all features. The sidebar is organized by sections: Learning (programs, analytics), Planning (goals, decisions, tasks, assessments), and Development (groups, timeline). Click any item to navigate.",
      },
      {
        q: "What is the onboarding tour?",
        a: "When you first log in, you'll see a guided tour highlighting key features. You can restart the tour anytime using the 'Restart Tour' button in the header.",
      },
      {
        q: "How do I get help?",
        a: "Check this FAQ first, then contact your coach or instructor through the platform. For technical issues, use the 'Contact Support' link at the bottom of the sidebar.",
      },
    ],
  },
  {
    category: "Programs & Modules",
    icon: BookOpen,
    questions: [
      {
        q: "How do I view my enrolled programs?",
        a: "Go to 'My Programs' under Learning in your sidebar. You'll see all programs you're enrolled in with progress indicators. Click any program to access its modules.",
      },
      {
        q: "How do I explore available programs?",
        a: "Navigate to 'Explore Programs' from your dashboard to browse programs open for enrollment. Click on a program to view details, requirements, and express your interest.",
      },
      {
        q: "What are modules?",
        a: "Modules are individual learning units within a program. Types include Content (reading/videos), Sessions (live workshops), Assignments (work submissions), and Academy (self-paced courses). Complete modules to progress through your program.",
      },
      {
        q: "How do I track my progress?",
        a: "Your Dashboard shows enrolled programs with progress bars. Within each program, see completed, in-progress, and locked modules. The Journey Progress widget shows your overall development path.",
      },
      {
        q: "What are module reflections?",
        a: "Reflections are prompts where you document learnings and how you'll apply them. They help deepen understanding and are sometimes required for module completion.",
      },
      {
        q: "What if I complete a module in multiple programs?",
        a: "If the same content appears in multiple programs (via TalentLMS or canonical code), completing it once shows 'Completed elsewhere' in other programs. No need to redo content.",
      },
      {
        q: "How do I contact my program instructor?",
        a: "Within each program or module, you'll see assigned instructors and coaches. Click the contact button next to their name to send an email directly.",
      },
    ],
  },
  {
    category: "Guided Paths",
    icon: Route,
    questions: [
      {
        q: "What are Guided Paths?",
        a: "Guided Paths are personalized learning journeys. Complete a survey, and the system recommends programs and modules tailored to your goals, values, and circumstances.",
      },
      {
        q: "How do I start a Guided Path?",
        a: "Go to 'Guided Paths' under Learning. Select a path family (e.g., Leadership Development) and answer the survey questions to receive personalized recommendations.",
      },
      {
        q: "Can I retake a Guided Path survey?",
        a: "Yes, retake surveys anytime as your goals evolve. Each completion generates fresh recommendations based on your current answers.",
      },
    ],
  },
  {
    category: "Wheel of Life",
    icon: CircleDot,
    questions: [
      {
        q: "What is the Wheel of Life?",
        a: "A self-assessment tool that helps you evaluate satisfaction across life domains (career, relationships, health, personal growth). It creates a visual wheel showing your life balance.",
      },
      {
        q: "How do I complete a Wheel of Life assessment?",
        a: "Go to 'Wheel of Life' under Planning. Rate your satisfaction in each domain on a scale. Your responses create a radar chart visualization.",
      },
      {
        q: "Can I track changes over time?",
        a: "Yes! Complete multiple assessments to see how your life balance evolves. View history and compare snapshots to track your development progress.",
      },
      {
        q: "What can I do with my results?",
        a: "Use results to set goals in improvement areas, share with your coach for discussion, create action plans, and export as PDF for offline reference.",
      },
      {
        q: "Can I share my Wheel of Life with my coach?",
        a: "Yes, choose to share assessments with your assigned coach. They can view results and help you develop improvement strategies.",
      },
    ],
  },
  {
    category: "Capability Assessments",
    icon: Target,
    questions: [
      {
        q: "What are capability assessments?",
        a: "Structured evaluations of your skills and competencies in specific areas. They include domains (competency areas) with questions rated on a scale (e.g., 1-5).",
      },
      {
        q: "How do I take a capability assessment?",
        a: "Go to 'Capabilities' under Planning or 'Assessments' in your sidebar. Select an assessment, rate yourself on each question, and save your snapshot.",
      },
      {
        q: "Can others evaluate me?",
        a: "Depending on configuration, instructors or coaches can provide evaluations of your capabilities, giving external feedback to compare with your self-assessment.",
      },
      {
        q: "What are snapshots?",
        a: "Snapshots are completed assessments at a point in time. Take multiple snapshots to track how your capabilities evolve. Compare snapshots to see growth.",
      },
      {
        q: "What are Development Resources in assessments?",
        a: "Assessment domains and questions can link to learning resources (programs, modules, library items). Access these in the 'Development Resources' section of your snapshot.",
      },
    ],
  },
  {
    category: "Goals & Milestones",
    icon: Target,
    questions: [
      {
        q: "How do I create a goal?",
        a: "Go to 'Goals' under Planning and click 'Add Goal'. Enter title, description, category, timeframe, and target date. Add milestones to break down your goal into achievable steps.",
      },
      {
        q: "Can I share my goals with my coach?",
        a: "Yes! When creating or editing a goal, toggle 'Share with Coach'. They can view your goal, track progress, and add comments.",
      },
      {
        q: "What are milestones?",
        a: "Milestones are smaller steps toward your goal with their own due dates and status. They help you track incremental progress and stay motivated.",
      },
      {
        q: "How do I link goals to my programs?",
        a: "When creating a goal, associate it with a specific program enrollment. This connects personal objectives with your formal learning journey.",
      },
      {
        q: "Can I add reflections to my goals?",
        a: "Yes, add periodic reflections to document progress, challenges, insights, and learnings as you work toward your goals.",
      },
    ],
  },
  {
    category: "Decisions",
    icon: Brain,
    questions: [
      {
        q: "What is the Decision Toolkit?",
        a: "A comprehensive system for documenting and analyzing important decisions. Add options, pros/cons, use frameworks, get AI insights, and track outcomes over time.",
      },
      {
        q: "How do I create a new decision?",
        a: "Go to 'Decisions' under Planning and click 'New Decision'. Enter the decision context, add options you're considering, and use analysis frameworks to evaluate.",
      },
      {
        q: "What are decision frameworks?",
        a: "Structured approaches to evaluate options: Buyer's Model (desire/need/afford), 10-10-10 Rule (impact over time), Internal Check (gut feeling), Stop Rule (when to stop searching), Yes/No Rule (binary choice), and Crossroads Model (life direction).",
      },
      {
        q: "How do I share decisions with my coach?",
        a: "Toggle 'Share with Coach' on any decision. Your coach can view the decision, add comments, and help you analyze options.",
      },
      {
        q: "How do I track decision outcomes?",
        a: "After implementing a decision, record the outcome. Complete the reflection section: what went well, what didn't, unexpected results, and learnings.",
      },
      {
        q: "What are decision templates?",
        a: "Pre-built starting points for common decisions: career, relocation, investment, education, relationships, home purchase, health, and business.",
      },
      {
        q: "Can I get AI insights on my decisions?",
        a: "With the advanced decision toolkit tier, receive AI-powered analysis and suggestions to inform your decision-making process.",
      },
      {
        q: "What is the Decision Journal?",
        a: "A timeline of dated observations and thoughts as you work through a decision. Captures your evolving thinking process.",
      },
    ],
  },
  {
    category: "Tasks",
    icon: CheckSquare,
    questions: [
      {
        q: "How do I manage my tasks?",
        a: "Go to 'Tasks' under Planning to view all tasks. Create tasks with titles, due dates, and priorities. Mark complete as you finish them.",
      },
      {
        q: "Can I share tasks with my coach?",
        a: "Yes, share specific tasks for accountability. Your coach can view progress and help you stay on track.",
      },
      {
        q: "How are tasks different from milestones?",
        a: "Tasks are standalone action items. Milestones are specifically tied to goals as steps toward achievement. Use tasks for general to-dos.",
      },
      {
        q: "Can I link tasks to decisions?",
        a: "Yes, create tasks linked to decision options. This builds action plans for different choices you're considering.",
      },
    ],
  },
  {
    category: "Development Hub",
    icon: Lightbulb,
    questions: [
      {
        q: "What is the Development Hub on my Dashboard?",
        a: "A consolidated view showing quick stats for Goals, Decisions, and Tasks. See counts and priorities at a glance, with links to full views for each.",
      },
      {
        q: "What are Development Items?",
        a: "Specific areas for growth identified during coaching, assessments, or self-reflection. Track what you're working on improving with action steps.",
      },
      {
        q: "How do I add a Development Item?",
        a: "Go to 'Development Items' under Development. Click 'Add Item' and describe the area, actions needed, and target dates.",
      },
      {
        q: "What is the Development Timeline?",
        a: "A chronological view of your complete learning and growth journey. See achievements, completions, milestones, and key events over time.",
      },
    ],
  },
  {
    category: "Groups & Community",
    icon: UsersRound,
    questions: [
      {
        q: "How do I view my groups?",
        a: "Go to 'Groups' in your sidebar or check the 'My Groups' section on your Dashboard. Click any group to access its full details.",
      },
      {
        q: "What can I do in a group?",
        a: "Participate in group sessions, share check-ins, access shared resources, notes, and tasks. Connect with other members working on similar goals.",
      },
      {
        q: "How do group sessions work?",
        a: "Scheduled meetings for your group. View upcoming sessions, join via the provided link, and access session notes and materials afterward.",
      },
      {
        q: "What are check-ins?",
        a: "Periodic updates you share with your group about progress, challenges, and wins. Builds accountability and connection within your cohort.",
      },
      {
        q: "Can I add sessions to a group?",
        a: "Yes, all members can add sessions. Group leaders have additional management capabilities for editing and organizing.",
      },
      {
        q: "What's the difference between Leader and Member roles?",
        a: "Leaders have full management capabilities (editing settings, managing content). Members can view everything and add their own check-ins, notes, and tasks.",
      },
    ],
  },
  {
    category: "Credits & Services",
    icon: Coins,
    questions: [
      {
        q: "What are credits?",
        a: "A unified currency for consuming premium services. You receive credits from your subscription plan, program enrollments, or bonus grants.",
      },
      {
        q: "How do I view my credit balance?",
        a: "Go to 'Credits' under Planning to see total available credits, broken down by source (plan, program, bonus).",
      },
      {
        q: "What can I use credits for?",
        a: "AI coaching sessions, special assessments, premium features, and other services. View the Service Catalog for all available options.",
      },
      {
        q: "In what order are credits consumed?",
        a: "Plan credits first (renewable monthly), then Program entitlements, then Bonus/purchased credits. This preserves your one-time purchases.",
      },
      {
        q: "How do I get more credits?",
        a: "Credits renew with your subscription billing cycle. You may also receive bonus credits through programs or admin grants.",
      },
    ],
  },
  {
    category: "Badges & Certificates",
    icon: Award,
    questions: [
      {
        q: "How do I earn badges?",
        a: "Badges are awarded upon program completion or specific achievements. Your instructor or coach approves badges based on completion criteria.",
      },
      {
        q: "Where can I see my badges?",
        a: "View earned badges in your profile or on program pages. Pending approvals show their current status.",
      },
      {
        q: "Can I display my badges publicly?",
        a: "Yes! Configure badge visibility in your profile settings. Public badges appear on your public profile page.",
      },
      {
        q: "What are digital credentials?",
        a: "Some badges include shareable digital credentials for LinkedIn or other platforms. Check badge details for acceptance links.",
      },
    ],
  },
  {
    category: "Resources & Materials",
    icon: FileText,
    questions: [
      {
        q: "Where can I find learning resources?",
        a: "Resources are attached to programs and modules. Look for the Resources section within each module. Also check 'My Resources' for all accessible materials.",
      },
      {
        q: "How do I view resources?",
        a: "Click any resource to open the built-in viewer. PDFs, images, and videos preview directly. Use 'Open in New Tab' if your browser blocks the preview.",
      },
      {
        q: "Can I download resources?",
        a: "Yes, most resources include a download button for offline access. Look for the download icon when viewing.",
      },
      {
        q: "Are resources linked to skills?",
        a: "Yes, resources may be tagged with skills they help develop. This aids discovery and tracks skill development through consumption.",
      },
    ],
  },
  {
    category: "Skills & Learning Analytics",
    icon: Sparkles,
    questions: [
      {
        q: "What is the Skills Map?",
        a: "A visual overview of all skills you've acquired or are developing. Filter by category and view skill cards showing your competency levels.",
      },
      {
        q: "How are skills tracked?",
        a: "Skills are automatically tracked as you complete modules and consume resources tagged with specific competencies.",
      },
      {
        q: "What are Learning Analytics?",
        a: "Insights into your learning patterns: completion rates, time spent, and progress across all programs. Access under Learning in your sidebar.",
      },
      {
        q: "What are Course Recommendations?",
        a: "AI-powered suggestions based on your values, interests, goals, future vision, and constraints. More complete profiles yield better recommendations.",
      },
    ],
  },
  {
    category: "External Courses",
    icon: BookOpen,
    questions: [
      {
        q: "What are External Courses?",
        a: "Track learning from other platforms: online courses, certifications, workshops, or bootcamps from external providers.",
      },
      {
        q: "How do I add an External Course?",
        a: "Go to 'External Courses' under Learning. Click 'Add Course' and enter name, provider, status, and completion details.",
      },
      {
        q: "Can I show External Courses on my public profile?",
        a: "Yes, choose to display completed or in-progress courses on your public profile to showcase your broader learning journey.",
      },
    ],
  },
  {
    category: "Calendar & Sessions",
    icon: Calendar,
    questions: [
      {
        q: "How do I view my calendar?",
        a: "Go to 'My Calendar' in your sidebar. See all scheduled sessions, module dates, group meetings, and deadlines in one place.",
      },
      {
        q: "What appears on my calendar?",
        a: "Module scheduled dates, group sessions, program milestones, and booked sessions. Filter by program or event type.",
      },
      {
        q: "How do I join a session?",
        a: "Click a session in your calendar or program to see details including the meeting link. Join at the scheduled time.",
      },
      {
        q: "How do I book a 1:1 session with my instructor or coach?",
        a: "Within personalised modules (like coaching sessions), click the 'Book Session' button. You'll be directed to your assigned instructor's or coach's booking calendar. Select an available time slot that works for you.",
      },
      {
        q: "Why am I seeing a specific instructor's calendar?",
        a: "For personalised modules, you're assigned a dedicated instructor or coach. The booking link automatically directs you to their specific calendar to ensure continuity in your learning journey.",
      },
      {
        q: "What if my instructor changes?",
        a: "If your assigned instructor is substituted (e.g., due to scheduling conflicts), the booking link will automatically update to show the new instructor's availability. Your admin will notify you of any changes.",
      },
      {
        q: "How do I reschedule a session?",
        a: "For sessions booked through the platform, click 'Reschedule' on your scheduled session card to open the rescheduling calendar. Select a new time slot and confirm. Your instructor will be notified automatically.",
      },
      {
        q: "What's the difference between Reschedule and Rebook?",
        a: "'Reschedule' appears for sessions booked through the booking system and takes you directly to modify that booking. 'Rebook' appears for manually-created sessions and lets you book a new time through the booking calendar, automatically updating your existing session.",
      },
      {
        q: "Can I request a session with my coach?",
        a: "Depending on your program plan, you may request additional coaching sessions. Look for 'Book Session' within your program modules or contact your coach directly.",
      },
      {
        q: "Can I sync with external calendars?",
        a: "Yes, sync with Google Calendar or Outlook. Configure in your notification settings under Calendar Sync.",
      },
      {
        q: "What are the different session types?",
        a: "Sessions vary by module type: Coaching (1:1 personal development), Workshop (group learning), Mentoring, and Assessment sessions. Each has different durations and formats.",
      },
      {
        q: "Where do I find my meeting link?",
        a: "Meeting links appear on scheduled session cards within your program modules and in your calendar. Click the session to see all details including the meeting link to join.",
      },
    ],
  },
  {
    category: "Assignments & Feedback",
    icon: FileText,
    questions: [
      {
        q: "How do I submit an assignment?",
        a: "Within a module, find the assignment section. Fill in required fields, attach files if needed, and submit for review.",
      },
      {
        q: "How do I receive feedback?",
        a: "Instructors provide feedback on assignments and reflections. View feedback within the module detail page with any attached resources or comments.",
      },
      {
        q: "Can I revise my submissions?",
        a: "Depending on configuration, you may update submissions before final approval. Check with your instructor about revision policies.",
      },
      {
        q: "What is structured feedback?",
        a: "Feedback using predefined templates with specific criteria and rubrics. Provides consistent, comprehensive evaluation of your work.",
      },
    ],
  },
  {
    category: "Usage & Subscription",
    icon: BarChart3,
    questions: [
      {
        q: "How do I check my usage?",
        a: "Go to 'Usage' under Planning to see your current plan, AI credit usage, and any consumable limits. View monthly patterns and remaining allowances.",
      },
      {
        q: "What are consumable features?",
        a: "Features with usage limits that reset monthly: AI recommendations, AI decision insights, or session credits. Track remaining usage in the Usage section.",
      },
      {
        q: "How do I upgrade my plan?",
        a: "Go to 'Subscription' in your sidebar or contact the admin team. Different plans unlock additional features, content access, and credit allocations.",
      },
      {
        q: "What if I'm part of an organization?",
        a: "Organization members may have sponsored access to plans or features. Check with your organization admin about your entitlements.",
      },
    ],
  },
  {
    category: "Profile & Settings",
    icon: Settings,
    questions: [
      {
        q: "How do I update my profile?",
        a: "Click your avatar in the top right and select 'Profile' or 'Account Settings'. Update personal information, photo, timezone, and preferences.",
      },
      {
        q: "What is 'Vision for My Future Self'?",
        a: "A personal reflection describing who you want to become and your desired impact. AI features use this for more relevant, personalized guidance.",
      },
      {
        q: "What are 'Constraints' in my profile?",
        a: "Personal circumstances affecting availability or decisions: family responsibilities, health, location, time limitations. AI recommendations consider these for realistic suggestions.",
      },
      {
        q: "How do I add external credential profiles?",
        a: "In Personal Profile, link platforms like Credly, Trailhead, or Accredible. These appear on your public profile showcasing verified credentials.",
      },
      {
        q: "Can I make my profile public?",
        a: "Yes, configure visibility in profile settings. Share selected achievements, badges, and credentials with others via your public profile URL.",
      },
      {
        q: "How do I set my timezone?",
        a: "In account settings, select your timezone. All dates and times will display correctly for your location.",
      },
      {
        q: "How do I manage AI preferences?",
        a: "Go to account settings → AI section. Enable/disable AI insights and recommendations. Complete more profile fields for better AI personalization.",
      },
    ],
  },
  {
    category: "Privacy & Data",
    icon: Shield,
    questions: [
      {
        q: "How is my data protected?",
        a: "Data is stored securely with encryption at rest and in transit. Access is controlled through role-based permissions. You control what you share.",
      },
      {
        q: "Can I export my data?",
        a: "Yes, request a data export from account settings. Includes your profile, assessments, goals, decisions, and other personal data.",
      },
      {
        q: "Who can see my information?",
        a: "By default, your data is private. You control sharing with coaches, instructors, and via your public profile. Admins have access for platform management.",
      },
      {
        q: "How do I request account deletion?",
        a: "Request deletion from account settings. Your request will be reviewed and processed according to data retention policies.",
      },
    ],
  },
  {
    category: "For Instructors & Coaches",
    icon: Users,
    questions: [
      {
        q: "How do I see my assigned clients?",
        a: "Go to your Dashboard to see clients assigned to you. You can view their enrollment progress, upcoming sessions, and provide feedback on their submissions.",
      },
      {
        q: "How are clients assigned to me for sessions?",
        a: "Admins assign you to clients at three levels: program-wide (all clients in a program), module-specific (all clients for a specific module), or enrollment-specific (individual client assignments for personalised modules).",
      },
      {
        q: "What are personalised modules?",
        a: "Personalised modules are 1:1 learning experiences where each client has a dedicated instructor or coach. When clients book sessions in these modules, they're directed to your personal booking calendar.",
      },
      {
        q: "How do clients book sessions with me?",
        a: "For modules you're assigned to, clients see a 'Book Session' button that opens your Cal.com booking calendar. Your admin configures which calendar/event type is shown for each module type you teach.",
      },
      {
        q: "What if I need to be substituted for a client?",
        a: "Contact your admin to reassign the client to another instructor. The system will automatically update the booking link to direct the client to the new instructor's calendar.",
      },
      {
        q: "How do I ensure my booking calendar is correct?",
        a: "Your admin manages your Cal.com event type mappings. If clients are seeing the wrong booking page, contact your admin to verify your Instructor Event Type configuration.",
      },
      {
        q: "Can I teach different session durations?",
        a: "Yes, your admin can configure you for multiple session types (e.g., 30-min coaching, 60-min coaching). Each type has its own booking calendar configured in the system.",
      },
      {
        q: "How do I view upcoming sessions with my clients?",
        a: "Your Dashboard shows upcoming sessions. You can also view the schedule calendar to see all booked sessions across your assigned programs and clients.",
      },
    ],
  },
  {
    category: "Support & Contact",
    icon: MessageSquare,
    questions: [
      {
        q: "How do I contact my coach or instructor?",
        a: "Within programs or modules, click the contact button next to assigned coaches/instructors. Also check the 'My Coaches & Instructors' section on your Dashboard.",
      },
      {
        q: "How do I get technical support?",
        a: "Use the 'Contact Support' link at the bottom of the sidebar to email the admin team for technical issues or general questions.",
      },
      {
        q: "Where can I find help documentation?",
        a: "This FAQ covers common questions. For program-specific questions, contact your instructor. For platform issues, contact support.",
      },
      {
        q: "How do I request a new feature?",
        a: "Contact support with feature requests. User feedback is regularly reviewed to improve the platform.",
      },
    ],
  },
];

export default function FAQ() {
  const { supportEmail } = useSupportEmail();
  const [searchQuery, setSearchQuery] = useState("");

  // Create dynamic FAQ items with the support email
  const dynamicFaqItems = faqItems.map((section) => {
    if (section.category === "Support & Contact") {
      return {
        ...section,
        questions: section.questions.map((q) => {
          if (q.q === "How do I get technical support?") {
            return {
              ...q,
              a: `Use the 'Contact Support' link at the bottom of the sidebar to email the admin team at ${supportEmail} for technical issues or general questions.`,
            };
          }
          return q;
        }),
      };
    }
    return section;
  });

  // Filter FAQ items based on search query
  const filteredFaqItems = useMemo(() => {
    if (!searchQuery.trim()) return dynamicFaqItems;

    const query = searchQuery.toLowerCase();
    return dynamicFaqItems
      .map((section) => ({
        ...section,
        questions: section.questions.filter(
          (q) => q.q.toLowerCase().includes(query) || q.a.toLowerCase().includes(query),
        ),
      }))
      .filter((section) => section.questions.length > 0);
  }, [dynamicFaqItems, searchQuery]);

  // Count total questions
  const totalQuestions = dynamicFaqItems.reduce(
    (acc, section) => acc + section.questions.length,
    0,
  );
  const filteredQuestions = filteredFaqItems.reduce(
    (acc, section) => acc + section.questions.length,
    0,
  );

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Frequently Asked Questions</h1>
        <p className="text-muted-foreground">
          Find answers to common questions about using the InnoTrue Hub platform.
        </p>
      </div>

      <div className="mb-6">
        <FAQSearch
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          placeholder="Search questions..."
          resultCount={filteredQuestions}
          totalCount={totalQuestions}
        />
      </div>

      <div className="space-y-6">
        {filteredFaqItems.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No questions found matching "{searchQuery}"
            </CardContent>
          </Card>
        ) : (
          filteredFaqItems.map((section, index) => (
            <Card key={index}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <section.icon className="h-5 w-5 text-primary" />
                  {section.category}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  {section.questions.map((item, qIndex) => (
                    <AccordionItem key={qIndex} value={`${index}-${qIndex}`}>
                      <AccordionTrigger className="text-left">{item.q}</AccordionTrigger>
                      <AccordionContent className="text-muted-foreground">
                        {item.a}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
