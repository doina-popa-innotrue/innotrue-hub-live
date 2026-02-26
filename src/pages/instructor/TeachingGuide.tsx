import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BookOpen,
  Users,
  ClipboardCheck,
  GraduationCap,
  Calendar,
  MessageSquare,
  Target,
  Award,
  Lightbulb,
  ArrowRight,
  Star,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface QuickActionProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  path: string;
}

function QuickAction({ icon, title, description, path }: QuickActionProps) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(path)}
      className="flex items-start gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors text-left w-full"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
    </button>
  );
}

export default function TeachingGuide() {
  const { userRoles } = useAuth();
  const isCoach = userRoles.includes("coach");
  const isInstructor = userRoles.includes("instructor");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Teaching Guide</h1>
        <p className="text-muted-foreground mt-1">
          Quick reference for coaches and instructors — workflows, tools, and best practices.
        </p>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Star className="h-5 w-5 text-amber-500" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 md:grid-cols-2">
            <QuickAction
              icon={<Users className="h-4 w-4" />}
              title="View My Clients"
              description="See all enrolled clients and their progress"
              path="/teaching/students"
            />
            <QuickAction
              icon={<ClipboardCheck className="h-4 w-4" />}
              title="Pending Assignments"
              description="Review and grade submitted work"
              path="/teaching/assignments"
            />
            <QuickAction
              icon={<Calendar className="h-4 w-4" />}
              title="My Cohorts"
              description="Manage cohort sessions and attendance"
              path="/teaching/cohorts"
            />
            <QuickAction
              icon={<Award className="h-4 w-4" />}
              title="Badge Approvals"
              description="Review and approve client badges"
              path="/teaching/badges"
            />
            <QuickAction
              icon={<Target className="h-4 w-4" />}
              title="Readiness Dashboard"
              description="Check client readiness across milestones"
              path="/teaching/readiness"
            />
            <QuickAction
              icon={<GraduationCap className="h-4 w-4" />}
              title="Assigned Programs"
              description="View programs you're teaching"
              path="/teaching"
            />
          </div>
        </CardContent>
      </Card>

      {/* Getting Started */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-primary" />
            Getting Started Checklist
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              {
                step: "1",
                title: "Complete your profile",
                desc: "Add your bio, specializations, and scheduling URL in Account Settings.",
              },
              {
                step: "2",
                title: "Review your program assignments",
                desc: "Check which programs you're assigned to as coach or instructor on the Teaching Dashboard.",
              },
              {
                step: "3",
                title: "Explore client progress",
                desc: "Visit Client Progress to see enrolled clients and their module completion.",
              },
              {
                step: "4",
                title: "Set up your calendar",
                desc: "If you use Cal.com for scheduling, ensure your booking URL is set in your profile.",
              },
              {
                step: "5",
                title: "Check pending assignments",
                desc: "Review any submitted assignments waiting for your grading on the Assignments page.",
              },
            ].map((item) => (
              <div key={item.step} className="flex items-start gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-semibold">
                  {item.step}
                </div>
                <div>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* FAQ */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Frequently Asked Questions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="grading">
              <AccordionTrigger className="text-sm">
                How do I grade an assignment?
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                Go to <strong>Assignments</strong> in the sidebar. You'll see pending submissions
                in the "Pending" tab. Click on a submission to view the student's work, then use
                the rubric-based scoring form to provide a grade and feedback. The student will be
                notified when you submit the grade.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="development-items">
              <AccordionTrigger className="text-sm">
                How do I create a development item for a client?
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                Navigate to a client's detail page via <strong>Client Progress → click on a
                student</strong>. In the "Development Items" section, click "Create Development
                Item." You can set the title, description, category, priority, and optionally link
                it to an assessment domain. The client will see this on their Development Profile.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="attendance">
              <AccordionTrigger className="text-sm">
                How do I mark attendance for a cohort session?
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                Go to <strong>Cohorts → select a cohort → click on a session</strong>. You'll see
                the attendance tracker with all enrolled participants. Mark each as attended,
                no-show, or excused. You can also add recap notes and a recording URL for the
                session.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="staff-notes">
              <AccordionTrigger className="text-sm">
                Where can I add private notes about a client?
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                On any client's detail page (<strong>Client Progress → click on a student</strong>),
                scroll to the "Staff Notes" section at the bottom. Notes are private and only
                visible to coaches and instructors — clients cannot see them.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="transfer">
              <AccordionTrigger className="text-sm">
                Can I transfer an assignment to another coach or instructor?
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                Yes. On the Assignments page, click the transfer icon next to any assignment.
                You'll see a dialog where you can select another coach or instructor to transfer the
                assignment to. They will be notified of the transfer.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="milestone-gates">
              <AccordionTrigger className="text-sm">
                What are milestone gates and how do I waive them?
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                Milestone gates are assessment-linked checkpoints on guided paths. They show as
                traffic-light indicators (🟢 met, 🟡 close, 🔴 not met, ⚪ no data). If a client
                hasn't met the threshold but you believe they should progress, go to their{" "}
                <strong>Development Profile → Guided Paths</strong> and click the gate indicator to
                open the waive dialog. Provide a reason for the waiver.
              </AccordionContent>
            </AccordionItem>

            {isCoach && (
              <AccordionItem value="invite-clients">
                <AccordionTrigger className="text-sm">
                  Can I invite my own clients to the platform?
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">
                  Yes! On the Teaching Dashboard, click the "Invite Client" button. Enter their
                  email address and an optional personal message. If they already have an account,
                  they'll be auto-linked to you. If not, they'll receive an invitation email to
                  sign up. Once they register, they'll be automatically connected to you as their
                  coach.
                </AccordionContent>
              </AccordionItem>
            )}

            <AccordionItem value="badges">
              <AccordionTrigger className="text-sm">
                How does badge approval work?
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                When a client completes a program that has a badge configured, a badge with
                "pending_approval" status is automatically created. Go to{" "}
                <strong>Badge Approvals</strong> to see pending badges. Review the client's
                completion data and approve or decline. Approved badges can be shared on LinkedIn
                and verified via a public URL.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="scheduling">
              <AccordionTrigger className="text-sm">
                How does session scheduling work?
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                Session scheduling uses your Cal.com booking URL (set in your profile). When
                clients view a module that has scheduling enabled, they see a booking button linked
                to your calendar. The system uses a 3-tier resolution: personal assignment
                (enrollment level) → module-level assignment → program-level assignment. This means
                the most specific assignment takes priority for booking.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      {/* Roles explanation */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Your Role{isCoach && isInstructor ? "s" : ""}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {isInstructor && (
              <div className="p-4 rounded-lg border">
                <div className="flex items-center gap-2 mb-2">
                  <Badge>Instructor</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  As an instructor, you deliver program content, grade assignments, manage cohort
                  sessions, and track student progress through modules. You can create development
                  items and provide structured feedback.
                </p>
              </div>
            )}
            {isCoach && (
              <div className="p-4 rounded-lg border">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="secondary">Coach</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  As a coach, you guide clients through their development journey, share goals and
                  decisions, manage coaching relationships, and support clients across programs. You
                  can invite your own clients and create personalized development items.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
