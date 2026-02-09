import { useState, useMemo, ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  HelpCircle, 
  Users, 
  CreditCard, 
  Building2, 
  GraduationCap, 
  BarChart3, 
  Shield, 
  Settings,
  UserPlus,
  Mail,
  Clock,
  AlertTriangle,
  CheckCircle,
  LucideIcon,
  FileText
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { FAQSearch } from '@/components/faq/FAQSearch';

interface FAQSection {
  title: string;
  description: string;
  icon: LucideIcon;
  items: { question: string; answer: ReactNode; value: string }[];
}

export default function OrgAdminFAQ() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");

  const faqSections: FAQSection[] = [
    {
      title: "Getting Started",
      description: "Understanding your role as an Organization Admin",
      icon: Building2,
      items: [
        { question: "What is an Organization Admin?", value: "what-is-org-admin", answer: (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              As an Organization Admin, you manage your organization's presence on InnoTrue Hub. 
              Your responsibilities include:
            </p>
            <ul className="text-sm list-disc list-inside text-muted-foreground">
              <li>Managing member seats and invitations</li>
              <li>Overseeing program enrollments for your organization</li>
              <li>Managing billing, credits, and payment</li>
              <li>Setting organization-specific terms and policies</li>
              <li>Viewing analytics and usage reports</li>
            </ul>
          </div>
        )},
        { question: "How is Organization Admin different from Platform Admin?", value: "org-vs-platform-admin", answer: (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Organization Admins manage their own organization, while Platform Admins manage the entire platform.
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Capability</TableHead>
                  <TableHead>Org Admin</TableHead>
                  <TableHead>Platform Admin</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">Manage Members</TableCell>
                  <TableCell>Own organization only</TableCell>
                  <TableCell>All organizations</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Program Access</TableCell>
                  <TableCell>Assigned programs</TableCell>
                  <TableCell>All programs</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Billing</TableCell>
                  <TableCell>Own organization</TableCell>
                  <TableCell>All organizations</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Create Programs</TableCell>
                  <TableCell>No</TableCell>
                  <TableCell>Yes</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">System Settings</TableCell>
                  <TableCell>No</TableCell>
                  <TableCell>Yes</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )},
        { question: "What can I see on my dashboard?", value: "dashboard-overview", answer: (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Your dashboard provides a quick overview of your organization including:
            </p>
            <ul className="text-sm list-disc list-inside text-muted-foreground">
              <li>Total members and seat usage</li>
              <li>Active program enrollments</li>
              <li>Credit balance and recent transactions</li>
              <li>Pending invitations</li>
              <li>Quick links to common actions</li>
            </ul>
          </div>
        )},
        { question: "How do I navigate between my organization and personal views?", value: "navigation", answer: (
          <p className="text-sm text-muted-foreground">
            Use the role switcher in the sidebar to toggle between your Organization Admin view and your 
            personal client view (if you have one). Organization-specific pages are under the "Org Admin" 
            section in the sidebar.
          </p>
        )}
      ]
    },
    {
      title: "Member Management",
      description: "Inviting members and managing seats",
      icon: Users,
      items: [
        { question: "How do I invite a new member?", value: "invite-member", answer: (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Go to <strong>Members → Invite Member</strong>. Enter the email address of the person 
              you want to invite. They will receive an email with instructions to join your organization.
            </p>
            <div className="rounded-lg border p-4 bg-muted/30">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="secondary">Note</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Invitations expire after 7 days. You can resend invitations from the pending invites list.
              </p>
            </div>
          </div>
        )},
        { question: "What happens when I reach my seat limit?", value: "seat-limits", answer: (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              When you reach your seat limit, you won't be able to invite new members until you:
            </p>
            <ul className="text-sm list-disc list-inside text-muted-foreground">
              <li>Remove existing members to free up seats</li>
              <li>Purchase additional seats from Billing & Credits</li>
            </ul>
            <p className="text-sm text-muted-foreground">
              Contact your account manager or InnoTrue Hub support to discuss seat upgrades.
            </p>
          </div>
        )},
        { question: "How do I remove a member from my organization?", value: "remove-member", answer: (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Go to <strong>Members</strong>, find the member you want to remove, and click the
              <strong> Remove</strong> action. This will:
            </p>
            <ul className="text-sm list-disc list-inside text-muted-foreground">
              <li>Remove their access to organization programs</li>
              <li>Free up their seat for a new member</li>
              <li>Keep their personal account active (if they had one before joining)</li>
            </ul>
            <div className="rounded-lg border p-4 bg-destructive/10 mt-2">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <Badge variant="destructive">Important</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                This action cannot be undone. The member's progress data will be retained but they 
                will lose access until re-invited.
              </p>
            </div>
          </div>
        )},
        { question: "What member roles are available?", value: "member-roles", answer: (
          <div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role</TableHead>
                  <TableHead>Capabilities</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">Member</TableCell>
                  <TableCell>Access enrolled programs, complete modules, track progress</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Org Admin</TableCell>
                  <TableCell>Full organization management including members, billing, and settings</TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <p className="text-xs text-muted-foreground mt-3">
              Organization admins can promote members to admin status or demote admins to regular members.
            </p>
          </div>
        )},
        { question: "Can I invite multiple members at once?", value: "bulk-invite", answer: (
          <p className="text-sm text-muted-foreground">
            Yes! Use the bulk invite feature in <strong>Members → Bulk Invite</strong>. 
            You can paste a list of email addresses (one per line or comma-separated) to send 
            invitations to multiple people at once.
          </p>
        )}
      ]
    },
    {
      title: "Program Enrollments",
      description: "Managing program access for your organization",
      icon: GraduationCap,
      items: [
        { question: "How do I see which programs my organization has access to?", value: "view-programs", answer: (
          <div>
            <p className="text-sm text-muted-foreground">
              Go to <strong>Programs</strong> to see all programs assigned to your organization. 
              This includes information about:
            </p>
            <ul className="text-sm list-disc list-inside text-muted-foreground mt-2">
              <li>Program name and description</li>
              <li>Number of enrolled members</li>
              <li>Available seats (if seat-limited)</li>
              <li>Enrollment period and deadlines</li>
            </ul>
          </div>
        )},
        { question: "How do I enroll a member in a program?", value: "enroll-member", answer: (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Go to <strong>Enrollments → Add Enrollment</strong>. Select the member and the program 
              you want to enroll them in.
            </p>
            <div className="rounded-lg border p-4 bg-muted/30">
              <p className="text-sm font-medium mb-1">Requirements:</p>
              <ul className="text-sm list-disc list-inside text-muted-foreground">
                <li>The member must be an active member of your organization</li>
                <li>The program must be assigned to your organization</li>
                <li>There must be available seats (if seat-limited)</li>
              </ul>
            </div>
          </div>
        )},
        { question: "How can I track member progress?", value: "track-progress", answer: (
          <div>
            <p className="text-sm text-muted-foreground">
              The <strong>Enrollments</strong> page shows progress for all enrolled members. 
              You can see:
            </p>
            <ul className="text-sm list-disc list-inside text-muted-foreground mt-2">
              <li>Overall completion percentage</li>
              <li>Last activity date</li>
              <li>Enrollment status (active, completed, paused)</li>
            </ul>
            <p className="text-sm text-muted-foreground mt-2">
              For more detailed analytics, visit the <strong>Analytics</strong> section.
            </p>
          </div>
        )},
        { question: "What are cohorts and how do they work?", value: "cohort-enrollment", answer: (
          <div>
            <p className="text-sm text-muted-foreground">
              Some programs are organized into cohorts—groups of participants who go through 
              the program together. When enrolling in a cohort-based program, you'll select 
              which cohort to join.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Cohorts typically have:
            </p>
            <ul className="text-sm list-disc list-inside text-muted-foreground">
              <li>Fixed start and end dates</li>
              <li>Scheduled live sessions</li>
              <li>Group activities with other cohort members</li>
            </ul>
          </div>
        )},
        { question: "Can I unenroll a member from a program?", value: "unenroll-member", answer: (
          <p className="text-sm text-muted-foreground">
            Yes, go to <strong>Enrollments</strong>, find the enrollment, and use the actions menu 
            to withdraw or pause the enrollment. Note that progress data is retained even after 
            withdrawal.
          </p>
        )}
      ]
    },
    {
      title: "Billing & Credits",
      description: "Managing payments, credits, and invoices",
      icon: CreditCard,
      items: [
        { question: "How does the credit system work?", value: "credit-system", answer: (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Credits are the currency used for certain platform services. Your organization 
              has a credit balance that can be used for:
            </p>
            <ul className="text-sm list-disc list-inside text-muted-foreground">
              <li>Enrolling members in programs (if credit-based)</li>
              <li>Purchasing additional coaching sessions</li>
              <li>Accessing premium features and assessments</li>
              <li>Adding extra member seats</li>
            </ul>
          </div>
        )},
        { question: "How do I purchase more credits?", value: "purchase-credits", answer: (
          <p className="text-sm text-muted-foreground">
            Go to <strong>Billing & Credits → Purchase Credits</strong>. Select your desired 
            credit package and complete the payment. Credits are added to your balance immediately.
          </p>
        )},
        { question: "How do I view invoices and payment history?", value: "invoices", answer: (
          <p className="text-sm text-muted-foreground">
            Navigate to <strong>Billing & Credits → Invoices</strong> to view your complete 
            payment history. You can download PDF invoices for your records.
          </p>
        )},
        { question: "Can I set up automatic payments?", value: "auto-payments", answer: (
          <p className="text-sm text-muted-foreground">
            Yes, you can add a payment method and enable automatic credit top-ups when your 
            balance falls below a threshold. Configure this in <strong>Billing & Credits → Payment Methods</strong>.
          </p>
        )},
        { question: "How are credits allocated to members?", value: "credit-allocation", answer: (
          <p className="text-sm text-muted-foreground">
            Organization credits are pooled. When members use credit-consuming services, credits 
            are drawn from the organization balance. You can view usage by member in the Analytics section.
          </p>
        )}
      ]
    },
    {
      title: "Analytics",
      description: "Tracking engagement and progress",
      icon: BarChart3,
      items: [
        { question: "What analytics are available?", value: "analytics-overview", answer: (
          <div>
            <p className="text-sm text-muted-foreground">
              The Analytics section provides insights into your organization's usage:
            </p>
            <ul className="text-sm list-disc list-inside text-muted-foreground mt-2">
              <li>Member engagement metrics (logins, activity)</li>
              <li>Program completion rates by member and program</li>
              <li>Credit usage over time</li>
              <li>Active vs. inactive members</li>
              <li>Module-level progress breakdown</li>
            </ul>
          </div>
        )},
        { question: "Can I export analytics reports?", value: "export-analytics", answer: (
          <p className="text-sm text-muted-foreground">
            Yes, most analytics views include an export button. You can download reports 
            as CSV files for further analysis or reporting to stakeholders.
          </p>
        )},
        { question: "How often is analytics data updated?", value: "analytics-refresh", answer: (
          <p className="text-sm text-muted-foreground">
            Analytics data is updated in near real-time. Progress and engagement metrics 
            are refreshed whenever members complete activities.
          </p>
        )},
        { question: "Can I see individual member progress?", value: "member-analytics", answer: (
          <p className="text-sm text-muted-foreground">
            Yes, click on any member in the Members list to see their detailed progress 
            including program completions, recent activity, and time spent on the platform.
          </p>
        )}
      ]
    },
    {
      title: "Terms & Conditions",
      description: "Managing organization-specific agreements",
      icon: Shield,
      items: [
        { question: "Can I create organization-specific terms?", value: "org-terms", answer: (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Yes! Go to <strong>Settings → Terms & Conditions</strong> to create custom terms 
              that members must accept when joining your organization.
            </p>
            <p className="text-sm text-muted-foreground">
              These are in addition to the platform's general terms of service.
            </p>
          </div>
        )},
        { question: "How do I track who has accepted terms?", value: "terms-tracking", answer: (
          <p className="text-sm text-muted-foreground">
            The Terms & Conditions page shows acceptance status for all members. You can 
            see when each member accepted the current version of your terms.
          </p>
        )},
        { question: "What happens when I update terms?", value: "terms-update", answer: (
          <p className="text-sm text-muted-foreground">
            When you publish updated terms, members will be prompted to review and accept 
            the new version on their next login. You can make acceptance mandatory before 
            they can access programs.
          </p>
        )}
      ]
    },
    {
      title: "Organization Settings",
      description: "Configuring your organization",
      icon: Settings,
      items: [
        { question: "How do I update my organization profile?", value: "org-profile", answer: (
          <p className="text-sm text-muted-foreground">
            Go to <strong>Settings → Organization Profile</strong> to update your organization's 
            name, logo, description, and contact information. These details appear to your members.
          </p>
        )},
        { question: "Can I customize notification settings?", value: "notifications", answer: (
          <div>
            <p className="text-sm text-muted-foreground">
              Yes, in <strong>Settings → Notifications</strong> you can configure:
            </p>
            <ul className="text-sm list-disc list-inside text-muted-foreground mt-2">
              <li>Admin notification preferences</li>
              <li>Default notification settings for new members</li>
              <li>Email digest frequency</li>
            </ul>
          </div>
        )},
        { question: "Can I have multiple Organization Admins?", value: "multiple-admins", answer: (
          <p className="text-sm text-muted-foreground">
            Yes, you can promote any member to Organization Admin status from the Members page. 
            Having multiple admins ensures continuity and shared responsibility for managing 
            your organization.
          </p>
        )},
        { question: "How do I transfer ownership of the organization?", value: "transfer-ownership", answer: (
          <p className="text-sm text-muted-foreground">
            Contact InnoTrue Hub support to transfer primary organization ownership. You can 
            assign additional admins yourself, but primary ownership transfer requires support assistance.
          </p>
        )}
      ]
    },
    {
      title: "Reports & Documentation",
      description: "Accessing reports and documentation",
      icon: FileText,
      items: [
        { question: "What reports can I generate?", value: "reports", answer: (
          <div>
            <p className="text-sm text-muted-foreground">
              You can generate several types of reports:
            </p>
            <ul className="text-sm list-disc list-inside text-muted-foreground mt-2">
              <li>Member activity reports</li>
              <li>Program completion reports</li>
              <li>Credit usage reports</li>
              <li>Enrollment status reports</li>
            </ul>
            <p className="text-sm text-muted-foreground mt-2">
              Access these from the Analytics section using the export buttons.
            </p>
          </div>
        )},
        { question: "Can I schedule automatic reports?", value: "scheduled-reports", answer: (
          <p className="text-sm text-muted-foreground">
            Contact your account manager to set up scheduled reports delivered via email. 
            Weekly or monthly summaries can be configured based on your needs.
          </p>
        )}
      ]
    },
    {
      title: "Getting Help",
      description: "Support resources and contact information",
      icon: HelpCircle,
      items: [
        { question: "How do I contact support?", value: "contact-support", answer: (
          <div>
            <p className="text-sm text-muted-foreground">
              For assistance, you can:
            </p>
            <ul className="text-sm list-disc list-inside text-muted-foreground mt-2">
              <li>Email: <strong>support@innotrue.com</strong></li>
              <li>Contact your account manager directly</li>
              <li>Use the in-app 'Contact Support' link in the sidebar</li>
            </ul>
          </div>
        )},
        { question: "Do I have a dedicated account manager?", value: "account-manager", answer: (
          <p className="text-sm text-muted-foreground">
            Enterprise and large organization accounts typically have a dedicated account manager. 
            Your account manager's contact information is available in <strong>Settings → Support</strong>.
          </p>
        )},
        { question: "Where do my members go for help?", value: "member-help", answer: (
          <p className="text-sm text-muted-foreground">
            Members can access the client FAQ from their dashboard. For organization-specific 
            questions, they can contact you as their Organization Admin or reach out to 
            InnoTrue Hub support.
          </p>
        )},
        { question: "Is there training available for Organization Admins?", value: "training", answer: (
          <p className="text-sm text-muted-foreground">
            Yes, we offer onboarding sessions for new Organization Admins. Contact your account 
            manager or support to schedule a training session.
          </p>
        )}
      ]
    }
  ];

  // Filter sections based on search query
  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return faqSections;
    
    const query = searchQuery.toLowerCase();
    return faqSections
      .map(section => ({
        ...section,
        items: section.items.filter(item => 
          item.question.toLowerCase().includes(query)
        )
      }))
      .filter(section => section.items.length > 0);
  }, [searchQuery, faqSections]);

  // Count totals
  const totalQuestions = faqSections.reduce((acc, section) => acc + section.items.length, 0);
  const filteredQuestions = filteredSections.reduce((acc, section) => acc + section.items.length, 0);
  
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <HelpCircle className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Organization Admin FAQ</h1>
            <p className="text-muted-foreground">
              Guide for managing your organization on InnoTrue Hub
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={() => navigate('/org-admin')}>
          Back to Dashboard
        </Button>
      </div>

      <FAQSearch
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="Search FAQ..."
        resultCount={filteredQuestions}
        totalCount={totalQuestions}
      />

      <div className="grid gap-6">
        {filteredSections.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No questions found matching "{searchQuery}"
            </CardContent>
          </Card>
        ) : (
          filteredSections.map((section) => (
            <Card key={section.title}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <section.icon className="h-5 w-5" />
                  {section.title}
                </CardTitle>
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  {section.items.map((item) => (
                    <AccordionItem key={item.value} value={item.value}>
                      <AccordionTrigger>{item.question}</AccordionTrigger>
                      <AccordionContent>{item.answer}</AccordionContent>
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
