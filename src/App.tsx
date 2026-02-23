import { lazy, Suspense } from "react";
import * as Sentry from "@sentry/react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider, MutationCache, QueryCache } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AdminRefreshListener } from "@/components/AdminRefreshListener";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { CookieConsentBanner } from "@/components/gdpr/CookieConsentBanner";
import { OrgAdminLayout } from "./components/layouts/OrgAdminLayout";

// Eagerly loaded pages (critical path)
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

// Lazy-loaded pages — Admin
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const ClientsList = lazy(() => import("./pages/admin/ClientsList"));
const InstructorsList = lazy(() => import("./pages/admin/InstructorsList"));
const CoachesList = lazy(() => import("./pages/admin/CoachesList"));
const ClientDetail = lazy(() => import("./pages/admin/ClientDetail"));
const ProgramsList = lazy(() => import("./pages/admin/ProgramsList"));
const AdminProgramDetail = lazy(() => import("./pages/admin/ProgramDetail"));
const InterestRegistrations = lazy(() => import("./pages/admin/InterestRegistrations"));
const ProgramCalendar = lazy(() => import("./pages/admin/ProgramCalendar"));
const TalentLmsUsers = lazy(() => import("./pages/admin/TalentLmsUsers"));
const CircleManagement = lazy(() => import("./pages/admin/CircleManagement"));
const LucidManagement = lazy(() => import("./pages/admin/LucidManagement"));
const GoogleDriveManagement = lazy(() => import("./pages/admin/GoogleDriveManagement"));
const UsersManagement = lazy(() => import("./pages/admin/UsersManagement"));
const ModuleTypesManagement = lazy(() => import("./pages/admin/ModuleTypesManagement"));
const PlansManagement = lazy(() => import("./pages/admin/PlansManagement"));
const FeaturesManagement = lazy(() => import("./pages/admin/FeaturesManagement"));
const AssessmentsManagement = lazy(() => import("./pages/admin/AssessmentsManagement"));
const AssignmentTypesManagement = lazy(() => import("./pages/admin/AssignmentTypesManagement"));
const AssessmentFamiliesManagement = lazy(
  () => import("./pages/admin/AssessmentFamiliesManagement"),
);
const AssessmentInterestRegistrations = lazy(
  () => import("./pages/admin/AssessmentInterestRegistrations"),
);
const GroupsManagement = lazy(() => import("./pages/admin/GroupsManagement"));
const AdminGroupDetail = lazy(() => import("./pages/admin/GroupDetail"));
const PlatformTermsManagement = lazy(() => import("./pages/admin/PlatformTermsManagement"));
const DecisionCapabilitiesManagement = lazy(
  () => import("./pages/admin/DecisionCapabilitiesManagement"),
);
const AddOnsManagement = lazy(() => import("./pages/admin/AddOnsManagement"));
const UserAddOnsManagement = lazy(() => import("./pages/admin/UserAddOnsManagement"));
const FeedbackTemplatesManagement = lazy(() => import("./pages/admin/FeedbackTemplatesManagement"));
const SystemSettings = lazy(() => import("./pages/admin/SystemSettings"));
const AccountDeletionRequests = lazy(() => import("./pages/admin/AccountDeletionRequests"));
const StatusMarkersManagement = lazy(() => import("./pages/admin/StatusMarkersManagement"));
const ResourceLibraryManagement = lazy(() => import("./pages/admin/ResourceLibraryManagement"));
const ResourceCategoriesManagement = lazy(
  () => import("./pages/admin/ResourceCategoriesManagement"),
);
const ResourceCollectionsManagement = lazy(
  () => import("./pages/admin/ResourceCollectionsManagement"),
);
const EmailTemplatesManagement = lazy(() => import("./pages/admin/EmailTemplatesManagement"));
const EmailAssetsManagement = lazy(() => import("./pages/admin/EmailAssetsManagement"));
const EmailQueueManagement = lazy(() => import("./pages/admin/EmailQueueManagement"));
const ConsumptionAnalytics = lazy(() => import("./pages/admin/ConsumptionAnalytics"));
const AssessmentBuilder = lazy(() => import("./pages/admin/AssessmentBuilder"));
const AssessmentBuilderDetail = lazy(() => import("./pages/admin/AssessmentBuilderDetail"));
const ProgramCompletions = lazy(() => import("./pages/admin/ProgramCompletions"));
const TracksManagement = lazy(() => import("./pages/admin/TracksManagement"));
const PartnerProgramsManagement = lazy(() => import("./pages/admin/PartnerProgramsManagement"));
const OrgBillingManagement = lazy(() => import("./pages/admin/OrgBillingManagement"));
const PaymentSchedulesManagement = lazy(() => import("./pages/admin/PaymentSchedulesManagement"));
const CreditServicesManagement = lazy(() => import("./pages/admin/CreditServicesManagement"));
const SkillsManagement = lazy(() => import("./pages/admin/SkillsManagement"));
const SkillCategoriesManagement = lazy(() => import("./pages/admin/SkillCategoriesManagement"));
const ProgramPlansManagement = lazy(() => import("./pages/admin/ProgramPlansManagement"));
const AdminFAQ = lazy(() => import("./pages/admin/AdminFAQ"));
const CanonicalCodesManagement = lazy(() => import("./pages/admin/CanonicalCodesManagement"));
const ContentLibrary = lazy(() => import("./pages/admin/ContentLibrary"));
const DiscountCodesManagement = lazy(() => import("./pages/admin/DiscountCodesManagement"));
const EnrollmentCodesManagement = lazy(
  () => import("./pages/admin/EnrollmentCodesManagement"),
);
const PartnerCodesManagement = lazy(
  () => import("./pages/admin/PartnerCodesManagement"),
);
const CapabilityAssessmentsManagement = lazy(
  () => import("./pages/admin/CapabilityAssessmentsManagement"),
);
const AdminCapabilityAssessmentDetail = lazy(
  () => import("./pages/admin/CapabilityAssessmentDetail"),
);
const AssessmentCategoriesManagement = lazy(
  () => import("./pages/admin/AssessmentCategoriesManagement"),
);
const WheelCategoriesManagement = lazy(() => import("./pages/admin/WheelCategoriesManagement"));
const ScenarioTemplatesManagement = lazy(() => import("./pages/admin/ScenarioTemplatesManagement"));
const ScenarioTemplateDetail = lazy(() => import("./pages/admin/ScenarioTemplateDetail"));
const ScenarioCategoriesManagement = lazy(
  () => import("./pages/admin/ScenarioCategoriesManagement"),
);
const SessionTypesManagement = lazy(() => import("./pages/admin/SessionTypesManagement"));
const CalcomMappingsManagement = lazy(() => import("./pages/admin/CalcomMappingsManagement"));
const EnrolmentsManagement = lazy(() => import("./pages/admin/EnrolmentsManagement"));
const GuidedPathTemplates = lazy(() => import("./pages/admin/GuidedPathTemplates"));
const AdminGuidedPathTemplateDetail = lazy(() => import("./pages/admin/GuidedPathTemplateDetail"));
const GuidedPathFamilies = lazy(() => import("./pages/admin/GuidedPathFamilies"));
const GuidedPathFamilyDetail = lazy(() => import("./pages/admin/GuidedPathFamilyDetail"));
const CoachInstructorRequests = lazy(() => import("./pages/admin/CoachInstructorRequests"));
const StaffAssignments = lazy(() => import("./pages/admin/StaffAssignments"));
const OrganizationProgramsManagement = lazy(
  () => import("./pages/admin/OrganizationProgramsManagement"),
);
const OrganizationsManagement = lazy(() => import("./pages/admin/OrganizationsManagement"));
const OrganizationDetail = lazy(() => import("./pages/admin/OrganizationDetail"));
const NotificationsManagement = lazy(() => import("./pages/admin/NotificationsManagement"));
const AnnouncementsManagement = lazy(() => import("./pages/admin/AnnouncementsManagement"));
const AnnouncementCategoriesManagement = lazy(
  () => import("./pages/admin/AnnouncementCategoriesManagement"),
);
const UserBehaviorAnalytics = lazy(() => import("./pages/admin/UserBehaviorAnalytics"));
const CohortAnalytics = lazy(() => import("./pages/admin/CohortAnalytics"));
const AuthContexts = lazy(() => import("./pages/admin/AuthContexts"));

// Lazy-loaded pages — Instructor / Coach
const InstructorCoachDashboard = lazy(() => import("./pages/instructor/InstructorCoachDashboard"));
const InstructorProgramDetail = lazy(() => import("./pages/instructor/ProgramDetail"));
const InstructorModuleDetail = lazy(() => import("./pages/instructor/ModuleDetail"));
const StudentProgress = lazy(() => import("./pages/instructor/StudentProgress"));
const StudentDetail = lazy(() => import("./pages/instructor/StudentDetail"));
const SharedGoals = lazy(() => import("./pages/instructor/SharedGoals"));
const InstructorGroups = lazy(() => import("./pages/instructor/Groups"));
const InstructorCohorts = lazy(() => import("./pages/instructor/Cohorts"));
const TeachingCohortDetail = lazy(() => import("./pages/instructor/CohortDetail"));
const CoachingDecisions = lazy(() => import("./pages/instructor/CoachingDecisions"));
const CoachingDecisionDetail = lazy(() => import("./pages/instructor/CoachingDecisionDetail"));
const CoachingTasks = lazy(() => import("./pages/instructor/CoachingTasks"));
const BadgeApproval = lazy(() => import("./pages/instructor/BadgeApproval"));
const PendingAssignments = lazy(() => import("./pages/instructor/PendingAssignments"));
const SharedAssessments = lazy(() => import("./pages/instructor/SharedAssessments"));
const ScenarioAssignmentsManagement = lazy(
  () => import("./pages/instructor/ScenarioAssignmentsManagement"),
);
const ScenarioEvaluationPage = lazy(() => import("./pages/instructor/ScenarioEvaluationPage"));
const StudentDevelopmentProfile = lazy(() => import("./pages/instructor/StudentDevelopmentProfile"));
const ReadinessDashboard = lazy(() => import("./pages/instructor/ReadinessDashboard"));

// Lazy-loaded pages — Client
const ClientDashboard = lazy(() => import("./pages/client/ClientDashboard"));
const ClientAssignments = lazy(() => import("./pages/client/Assignments"));
const ClientProgramsList = lazy(() => import("./pages/client/ProgramsList"));
const ExplorePrograms = lazy(() => import("./pages/client/ExplorePrograms"));
const ClientProgramDetail = lazy(() => import("./pages/client/ProgramDetail"));
const ModuleDetail = lazy(() => import("./pages/client/ModuleDetail"));
const CohortDashboard = lazy(() => import("./pages/client/CohortDashboard"));
const Goals = lazy(() => import("./pages/client/Goals"));
const GoalDetail = lazy(() => import("./pages/client/GoalDetail"));
const DevelopmentTimeline = lazy(() => import("./pages/client/DevelopmentTimeline"));
const DevelopmentItems = lazy(() => import("./pages/client/DevelopmentItems"));
const MyResources = lazy(() => import("./pages/client/MyResources"));
const WheelOfLife = lazy(() => import("./pages/client/WheelOfLife"));
const Decisions = lazy(() => import("./pages/client/Decisions"));
const DecisionAnalytics = lazy(() => import("./pages/client/DecisionAnalytics"));
const DecisionDetail = lazy(() => import("./pages/client/DecisionDetail"));
const DecisionFollowUps = lazy(() => import("./pages/client/DecisionFollowUps"));
const DecisionInsights = lazy(() => import("./pages/client/DecisionInsights"));
const DecisionOutcomes = lazy(() => import("./pages/client/DecisionOutcomes"));
const LearningAnalytics = lazy(() => import("./pages/client/LearningAnalytics"));
const CourseRecommendations = lazy(() => import("./pages/client/CourseRecommendations"));
const ExternalCourses = lazy(() => import("./pages/client/ExternalCourses"));
const Tasks = lazy(() => import("./pages/client/Tasks"));
const TaskDetail = lazy(() => import("./pages/client/TaskDetail"));
const GuidedPaths = lazy(() => import("./pages/client/GuidedPaths"));
const ClientGuidedPathDetail = lazy(() => import("./pages/client/GuidedPathDetail"));
const ExploreAssessments = lazy(() => import("./pages/client/ExploreAssessments"));
const MyAssessments = lazy(() => import("./pages/client/MyAssessments"));
const Community = lazy(() => import("./pages/client/Community"));
const Academy = lazy(() => import("./pages/client/Academy"));
const Groups = lazy(() => import("./pages/client/Groups"));
const GroupDetail = lazy(() => import("./pages/client/GroupDetail"));
const MyFeedback = lazy(() => import("./pages/client/MyFeedback"));
const GroupNoteDetail = lazy(() => import("./pages/client/GroupNoteDetail"));
const GroupSessionDetail = lazy(() => import("./pages/client/GroupSessionDetail"));
const GroupCheckInDetail = lazy(() => import("./pages/client/GroupCheckInDetail"));
const GroupTaskDetail = lazy(() => import("./pages/client/GroupTaskDetail"));
const SkillsMap = lazy(() => import("./pages/client/SkillsMap"));
const CapabilityAssessments = lazy(() => import("./pages/client/CapabilityAssessments"));
const CapabilityAssessmentDetail = lazy(() => import("./pages/client/CapabilityAssessmentDetail"));
const ClientCalendar = lazy(() => import("./pages/client/Calendar"));
const UsageOverview = lazy(() => import("./pages/client/UsageOverview"));
const Credits = lazy(() => import("./pages/client/Credits"));
const Services = lazy(() => import("./pages/client/Services"));
const TermsHistory = lazy(() => import("./pages/client/TermsHistory"));
const AllNotifications = lazy(() => import("./pages/client/AllNotifications"));
const NotificationSettings = lazy(() => import("./pages/client/NotificationSettings"));
const ClientScenarios = lazy(() => import("./pages/client/Scenarios"));
const ClientScenarioDetail = lazy(() => import("./pages/client/ScenarioDetail"));
const DevelopmentProfile = lazy(() => import("./pages/client/DevelopmentProfile"));

// Lazy-loaded pages — Org Admin
const OrgAdminDashboard = lazy(() => import("./pages/org-admin/OrgAdminDashboard"));
const OrgMembers = lazy(() => import("./pages/org-admin/OrgMembers"));
const OrgPrograms = lazy(() => import("./pages/org-admin/OrgPrograms"));
const OrgEnrollments = lazy(() => import("./pages/org-admin/OrgEnrollments"));
const OrgAnalytics = lazy(() => import("./pages/org-admin/OrgAnalytics"));
const OrgSettings = lazy(() => import("./pages/org-admin/OrgSettings"));
const OrgBilling = lazy(() => import("./pages/org-admin/OrgBilling"));
const OrgTerms = lazy(() => import("./pages/org-admin/OrgTerms"));
const OrgAdminFAQ = lazy(() => import("./pages/org-admin/OrgAdminFAQ"));

// Lazy-loaded pages — Shared / Other
const PrivacyPolicy = lazy(() => import("./pages/legal/PrivacyPolicy"));
const CookiePolicy = lazy(() => import("./pages/legal/CookiePolicy"));
const PersonalProfile = lazy(() => import("./pages/PersonalProfile"));
const AccountSettings = lazy(() => import("./pages/AccountSettings"));
const Subscription = lazy(() => import("./pages/Subscription"));
const VerifyEmailChange = lazy(() => import("./pages/VerifyEmailChange"));
const VerifySignup = lazy(() => import("./pages/VerifySignup"));
const AcceptInvite = lazy(() => import("./pages/AcceptInvite"));
const PublicProfileSettings = lazy(() => import("./pages/PublicProfileSettings"));
const PublicProfile = lazy(() => import("./pages/PublicProfile"));
const FAQ = lazy(() => import("./pages/FAQ"));
const ResourceViewerPage = lazy(() => import("./pages/resources/ResourceViewerPage"));
const WheelAssessment = lazy(() => import("./pages/public/WheelAssessment"));
const PublicAssessment = lazy(() => import("./pages/public/PublicAssessment"));
const EnrollWithCode = lazy(() => import("./pages/public/EnrollWithCode"));
const RedeemPartnerCode = lazy(() => import("./pages/public/RedeemPartnerCode"));
const CompleteRegistration = lazy(() => import("./pages/CompleteRegistration"));

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      // Report failed queries to Sentry (only unexpected errors, not 404s)
      Sentry.captureException(error, {
        tags: { context: "react_query", query_key: JSON.stringify(query.queryKey).slice(0, 200) },
        level: "warning",
      });
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      // Report failed mutations to Sentry
      Sentry.captureException(error, {
        tags: {
          context: "react_mutation",
          mutation_key: mutation.options.mutationKey
            ? JSON.stringify(mutation.options.mutationKey).slice(0, 200)
            : "unnamed",
        },
      });
    },
  }),
});

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <AdminRefreshListener>
              <CookieConsentBanner />
              <Suspense
                fallback={
                  <div className="flex items-center justify-center min-h-screen">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                  </div>
                }
              >
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                  <Route path="/cookie-policy" element={<CookiePolicy />} />
                  <Route path="/wheel-assessment" element={<WheelAssessment />} />
                  <Route path="/assess/:slug" element={<PublicAssessment />} />
                  <Route path="/accept-invite" element={<AcceptInvite />} />
                  <Route path="/enroll" element={<EnrollWithCode />} />
                  <Route path="/partner" element={<RedeemPartnerCode />} />
                  <Route path="/complete-registration" element={<CompleteRegistration />} />

                  {/* Org Admin Routes */}
                  <Route
                    path="/org-admin"
                    element={
                      <ProtectedRoute requireRole="org_admin">
                        <OrgAdminLayout>
                          <OrgAdminDashboard />
                        </OrgAdminLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/org-admin/members"
                    element={
                      <ProtectedRoute requireRole="org_admin">
                        <OrgAdminLayout>
                          <OrgMembers />
                        </OrgAdminLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/org-admin/programs"
                    element={
                      <ProtectedRoute requireRole="org_admin">
                        <OrgAdminLayout>
                          <OrgPrograms />
                        </OrgAdminLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/org-admin/enrollments"
                    element={
                      <ProtectedRoute requireRole="org_admin">
                        <OrgAdminLayout>
                          <OrgEnrollments />
                        </OrgAdminLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/org-admin/analytics"
                    element={
                      <ProtectedRoute requireRole="org_admin">
                        <OrgAdminLayout>
                          <OrgAnalytics />
                        </OrgAdminLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/org-admin/billing"
                    element={
                      <ProtectedRoute requireRole="org_admin">
                        <OrgAdminLayout>
                          <OrgBilling />
                        </OrgAdminLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/org-admin/terms"
                    element={
                      <ProtectedRoute requireRole="org_admin">
                        <OrgAdminLayout>
                          <OrgTerms />
                        </OrgAdminLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/org-admin/settings"
                    element={
                      <ProtectedRoute requireRole="org_admin">
                        <OrgAdminLayout>
                          <OrgSettings />
                        </OrgAdminLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/org-admin/faq"
                    element={
                      <ProtectedRoute requireRole="org_admin">
                        <OrgAdminLayout>
                          <OrgAdminFAQ />
                        </OrgAdminLayout>
                      </ProtectedRoute>
                    }
                  />

                  <Route
                    path="/admin"
                    element={
                      <ProtectedRoute requireRole="admin">
                        <DashboardLayout>
                          <AdminDashboard />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/clients"
                    element={
                      <ProtectedRoute requireRole="admin">
                        <DashboardLayout>
                          <ClientsList />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/clients/:id"
                    element={
                      <ProtectedRoute requireRole="admin">
                        <DashboardLayout>
                          <ClientDetail />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/instructors"
                    element={
                      <ProtectedRoute requireRole="admin">
                        <DashboardLayout>
                          <InstructorsList />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/coaches"
                    element={
                      <ProtectedRoute requireRole="admin">
                        <DashboardLayout>
                          <CoachesList />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/programs"
                    element={
                      <ProtectedRoute requireRole="admin">
                        <DashboardLayout>
                          <ProgramsList />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/programs/:id"
                    element={
                      <ProtectedRoute requireRole="admin">
                        <DashboardLayout>
                          <AdminProgramDetail />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/interest-registrations"
                    element={
                      <ProtectedRoute requireRole="admin">
                        <DashboardLayout>
                          <InterestRegistrations />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/program-calendar"
                    element={
                      <ProtectedRoute requireRole="admin">
                        <DashboardLayout>
                          <ProgramCalendar />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/talentlms"
                    element={
                      <ProtectedRoute requireRole="admin">
                        <DashboardLayout>
                          <TalentLmsUsers />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/circle"
                    element={
                      <ProtectedRoute requireRole="admin">
                        <DashboardLayout>
                          <CircleManagement />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/lucid"
                    element={
                      <ProtectedRoute requireRole="admin">
                        <DashboardLayout>
                          <LucidManagement />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/google-drive"
                    element={
                      <ProtectedRoute requireRole="admin">
                        <DashboardLayout>
                          <GoogleDriveManagement />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/users"
                    element={
                      <ProtectedRoute requireRole="admin">
                        <DashboardLayout>
                          <UsersManagement />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/module-types"
                    element={
                      <ProtectedRoute requireRole="admin">
                        <DashboardLayout>
                          <ModuleTypesManagement />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/plans"
                    element={
                      <ProtectedRoute requireRole="admin">
                        <DashboardLayout>
                          <PlansManagement />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/features"
                    element={
                      <ProtectedRoute requireRole="admin">
                        <DashboardLayout>
                          <FeaturesManagement />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/assessments"
                    element={
                      <ProtectedRoute requireRole="admin">
                        <DashboardLayout>
                          <AssessmentsManagement />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/assignment-types"
                    element={
                      <ProtectedRoute requireRole="admin">
                        <DashboardLayout>
                          <AssignmentTypesManagement />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/assessment-interests"
                    element={
                      <ProtectedRoute requireRole="admin">
                        <DashboardLayout>
                          <AssessmentInterestRegistrations />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/groups"
                    element={
                      <ProtectedRoute requireRole="admin">
                        <DashboardLayout>
                          <GroupsManagement />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/groups/:id"
                    element={
                      <ProtectedRoute requireRole="admin">
                        <DashboardLayout>
                          <AdminGroupDetail />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/groups/:groupId/sessions/:sessionId"
                    element={
                      <ProtectedRoute requireRole="admin">
                        <DashboardLayout>
                          <GroupSessionDetail />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/platform-terms"
                    element={
                      <ProtectedRoute requireRole="admin">
                        <DashboardLayout>
                          <PlatformTermsManagement />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/decision-capabilities"
                    element={
                      <ProtectedRoute requireRole="admin">
                        <DashboardLayout>
                          <DecisionCapabilitiesManagement />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/add-ons"
                    element={
                      <ProtectedRoute requireRole="admin">
                        <DashboardLayout>
                          <AddOnsManagement />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/user-add-ons"
                    element={
                      <ProtectedRoute requireRole="admin">
                        <DashboardLayout>
                          <UserAddOnsManagement />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/feedback-templates"
                    element={
                      <ProtectedRoute requireRole="admin">
                        <DashboardLayout>
                          <FeedbackTemplatesManagement />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/settings"
                    element={
                      <ProtectedRoute requireRole="admin">
                        <DashboardLayout>
                          <SystemSettings />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/deletion-requests"
                    element={
                      <ProtectedRoute requireRole="admin">
                        <DashboardLayout>
                          <AccountDeletionRequests />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/status-markers"
                    element={
                      <ProtectedRoute requireRole="admin">
                        <DashboardLayout>
                          <StatusMarkersManagement />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/resource-library"
                    element={
                      <ProtectedRoute requireRole="admin">
                        <DashboardLayout>
                          <ResourceLibraryManagement />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/resource-categories"
                    element={
                      <ProtectedRoute requireRole="admin">
                        <DashboardLayout>
                          <ResourceCategoriesManagement />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/resource-collections"
                    element={
                      <ProtectedRoute requireRole="admin">
                        <DashboardLayout>
                          <ResourceCollectionsManagement />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/email-templates"
                    element={
                      <ProtectedRoute requireRole="admin">
                        <DashboardLayout>
                          <EmailTemplatesManagement />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/email-assets"
                    element={
                      <ProtectedRoute requireRole="admin">
                        <DashboardLayout>
                          <EmailAssetsManagement />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/email-queue"
                    element={
                      <ProtectedRoute requireRole="admin">
                        <DashboardLayout>
                          <EmailQueueManagement />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/consumption"
                    element={
                      <ProtectedRoute requireRole="admin">
                        <DashboardLayout>
                          <ConsumptionAnalytics />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/discount-codes"
                    element={
                      <ProtectedRoute requireRole="admin">
                        <DashboardLayout>
                          <DiscountCodesManagement />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/enrollment-codes"
                    element={
                      <ProtectedRoute requireRole="admin">
                        <DashboardLayout>
                          <EnrollmentCodesManagement />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/partner-codes"
                    element={
                      <ProtectedRoute requireRole="admin">
                        <DashboardLayout>
                          <PartnerCodesManagement />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/assessment-builder"
                    element={
                      <ProtectedRoute requireRole="admin">
                        <DashboardLayout>
                          <AssessmentBuilder />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/assessment-builder/:id"
                    element={
                      <ProtectedRoute requireRole="admin">
                        <DashboardLayout>
                          <AssessmentBuilderDetail />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/program-completions"
                    element={
                      <ProtectedRoute requireRole="admin">
                        <DashboardLayout>
                          <ProgramCompletions />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/tracks"
                    element={
                      <ProtectedRoute requireRole="admin">
                        <DashboardLayout>
                          <TracksManagement />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/partner-programs"
                    element={
                      <ProtectedRoute requireRole="admin">
                        <DashboardLayout>
                          <PartnerProgramsManagement />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/skills"
                    element={
                      <ProtectedRoute requireRole="admin">
                        <DashboardLayout>
                          <SkillsManagement />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/skill-categories"
                    element={
                      <ProtectedRoute requireRole="admin">
                        <DashboardLayout>
                          <SkillCategoriesManagement />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/program-plans"
                    element={
                      <ProtectedRoute requireRole="admin">
                        <DashboardLayout>
                          <ProgramPlansManagement />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/faq"
                    element={
                      <ProtectedRoute requireRole="admin">
                        <DashboardLayout>
                          <AdminFAQ />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/auth-contexts"
                    element={
                      <ProtectedRoute requireRole="admin">
                        <DashboardLayout>
                          <AuthContexts />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/canonical-codes"
                    element={
                      <ProtectedRoute requireRole="admin">
                        <DashboardLayout>
                          <CanonicalCodesManagement />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/content-library"
                    element={
                      <ProtectedRoute requireRole="admin">
                        <DashboardLayout>
                          <ContentLibrary />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/capability-assessments"
                    element={
                      <ProtectedRoute requireRole="admin">
                        <DashboardLayout>
                          <CapabilityAssessmentsManagement />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/capability-assessments/:id"
                    element={
                      <ProtectedRoute requireRole="admin">
                        <DashboardLayout>
                          <AdminCapabilityAssessmentDetail />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/assessment-categories"
                    element={
                      <ProtectedRoute requireRole="admin">
                        <DashboardLayout>
                          <AssessmentCategoriesManagement />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/wheel-categories"
                    element={
                      <ProtectedRoute requireRole="admin">
                        <DashboardLayout>
                          <WheelCategoriesManagement />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/assessment-families"
                    element={
                      <ProtectedRoute requireRole="admin">
                        <DashboardLayout>
                          <AssessmentFamiliesManagement />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/scenario-templates"
                    element={
                      <ProtectedRoute requireRole="admin">
                        <DashboardLayout>
                          <ScenarioTemplatesManagement />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/scenario-templates/:id"
                    element={
                      <ProtectedRoute requireRole="admin">
                        <DashboardLayout>
                          <ScenarioTemplateDetail />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/scenario-categories"
                    element={
                      <ProtectedRoute requireRole="admin">
                        <DashboardLayout>
                          <ScenarioCategoriesManagement />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/session-types"
                    element={
                      <ProtectedRoute requireRole="admin">
                        <DashboardLayout>
                          <SessionTypesManagement />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/calcom-mappings"
                    element={
                      <ProtectedRoute requireRole="admin">
                        <DashboardLayout>
                          <CalcomMappingsManagement />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/enrolments"
                    element={
                      <ProtectedRoute requireRole="admin">
                        <DashboardLayout>
                          <EnrolmentsManagement />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/coach-instructor-requests"
                    element={
                      <ProtectedRoute requireRole="admin">
                        <DashboardLayout>
                          <CoachInstructorRequests />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/staff-assignments"
                    element={
                      <ProtectedRoute requireRole="admin">
                        <DashboardLayout>
                          <StaffAssignments />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/org-billing"
                    element={
                      <ProtectedRoute requireRole="admin">
                        <OrgBillingManagement />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/payment-schedules"
                    element={
                      <ProtectedRoute requireRole="admin">
                        <PaymentSchedulesManagement />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/organization-programs"
                    element={
                      <ProtectedRoute requireRole="admin">
                        <DashboardLayout>
                          <OrganizationProgramsManagement />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/organizations"
                    element={
                      <ProtectedRoute requireRole="admin">
                        <DashboardLayout>
                          <OrganizationsManagement />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/organizations/:id"
                    element={
                      <ProtectedRoute requireRole="admin">
                        <DashboardLayout>
                          <OrganizationDetail />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/credit-services"
                    element={
                      <ProtectedRoute requireRole="admin">
                        <DashboardLayout>
                          <CreditServicesManagement />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/notifications"
                    element={
                      <ProtectedRoute requireRole="admin">
                        <DashboardLayout>
                          <NotificationsManagement />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/announcements"
                    element={
                      <ProtectedRoute requireRole="admin">
                        <DashboardLayout>
                          <AnnouncementsManagement />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/announcement-categories"
                    element={
                      <ProtectedRoute requireRole="admin">
                        <DashboardLayout>
                          <AnnouncementCategoriesManagement />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/guided-path-templates"
                    element={
                      <ProtectedRoute requireRole="admin">
                        <DashboardLayout>
                          <GuidedPathTemplates />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/guided-path-templates/:id"
                    element={
                      <ProtectedRoute requireRole="admin">
                        <DashboardLayout>
                          <AdminGuidedPathTemplateDetail />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/guided-path-families"
                    element={
                      <ProtectedRoute requireRole="admin">
                        <DashboardLayout>
                          <GuidedPathFamilies />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/guided-path-families/:id"
                    element={
                      <ProtectedRoute requireRole="admin">
                        <DashboardLayout>
                          <GuidedPathFamilyDetail />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/user-behavior"
                    element={
                      <ProtectedRoute requireRole="admin">
                        <DashboardLayout>
                          <UserBehaviorAnalytics />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/cohort-analytics"
                    element={
                      <ProtectedRoute requireRole="admin">
                        <DashboardLayout>
                          <CohortAnalytics />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/teaching"
                    element={
                      <ProtectedRoute>
                        <DashboardLayout>
                          <InstructorCoachDashboard />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/teaching/programs/:slug"
                    element={
                      <ProtectedRoute>
                        <DashboardLayout>
                          <InstructorProgramDetail />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/teaching/programs/:programId/modules/:moduleId"
                    element={
                      <ProtectedRoute>
                        <DashboardLayout>
                          <InstructorModuleDetail />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/teaching/students"
                    element={
                      <ProtectedRoute>
                        <DashboardLayout>
                          <StudentProgress />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/teaching/students/:enrollmentId"
                    element={
                      <ProtectedRoute>
                        <DashboardLayout>
                          <StudentDetail />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/teaching/students/:enrollmentId/development-profile"
                    element={
                      <ProtectedRoute>
                        <DashboardLayout>
                          <StudentDevelopmentProfile />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/teaching/readiness"
                    element={
                      <ProtectedRoute>
                        <DashboardLayout>
                          <ReadinessDashboard />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/teaching/groups"
                    element={
                      <ProtectedRoute>
                        <DashboardLayout>
                          <InstructorGroups />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/teaching/cohorts"
                    element={
                      <ProtectedRoute>
                        <DashboardLayout>
                          <InstructorCohorts />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/teaching/cohorts/:cohortId"
                    element={
                      <ProtectedRoute>
                        <DashboardLayout>
                          <TeachingCohortDetail />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/teaching/shared-goals"
                    element={
                      <ProtectedRoute>
                        <DashboardLayout>
                          <SharedGoals />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/coaching/decisions"
                    element={
                      <ProtectedRoute>
                        <DashboardLayout>
                          <CoachingDecisions />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/coaching/decisions/:id"
                    element={
                      <ProtectedRoute>
                        <DashboardLayout>
                          <CoachingDecisionDetail />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/coaching/tasks"
                    element={
                      <ProtectedRoute>
                        <DashboardLayout>
                          <CoachingTasks />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/teaching/badges"
                    element={
                      <ProtectedRoute>
                        <DashboardLayout>
                          <BadgeApproval />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/teaching/assignments"
                    element={
                      <ProtectedRoute>
                        <DashboardLayout>
                          <PendingAssignments />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/teaching/assessments"
                    element={
                      <ProtectedRoute>
                        <DashboardLayout>
                          <SharedAssessments />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/teaching/scenarios"
                    element={
                      <ProtectedRoute>
                        <DashboardLayout>
                          <ScenarioAssignmentsManagement />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/teaching/scenarios/:id"
                    element={
                      <ProtectedRoute>
                        <DashboardLayout>
                          <ScenarioEvaluationPage />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />

                  <Route
                    path="/dashboard"
                    element={
                      <ProtectedRoute requireRole="client">
                        <DashboardLayout>
                          <ClientDashboard />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/assignments"
                    element={
                      <ProtectedRoute requireRole="client">
                        <DashboardLayout>
                          <ClientAssignments />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/programs"
                    element={
                      <ProtectedRoute requireRole="client">
                        <DashboardLayout>
                          <ClientProgramsList />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/programs/explore"
                    element={
                      <ProtectedRoute requireRole="client">
                        <DashboardLayout>
                          <ExplorePrograms />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/programs/:id"
                    element={
                      <ProtectedRoute requireRole="client">
                        <DashboardLayout>
                          <ClientProgramDetail />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/programs/:programId/modules/:moduleId"
                    element={
                      <ProtectedRoute requireRole="client">
                        <DashboardLayout>
                          <ModuleDetail />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/programs/:programId/cohort"
                    element={
                      <ProtectedRoute requireRole="client">
                        <DashboardLayout>
                          <CohortDashboard />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/goals"
                    element={
                      <ProtectedRoute requireRole="client">
                        <DashboardLayout>
                          <Goals />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/goals/:id"
                    element={
                      <ProtectedRoute requireRole="client">
                        <DashboardLayout>
                          <GoalDetail />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/development-profile"
                    element={
                      <ProtectedRoute requireRole="client">
                        <DashboardLayout>
                          <DevelopmentProfile />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/development-timeline"
                    element={
                      <ProtectedRoute requireRole="client">
                        <DashboardLayout>
                          <DevelopmentTimeline />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/development-items"
                    element={
                      <ProtectedRoute requireRole="client">
                        <DashboardLayout>
                          <DevelopmentItems />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/my-resources"
                    element={
                      <ProtectedRoute requireRole="client">
                        <DashboardLayout>
                          <MyResources />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/wheel-of-life"
                    element={
                      <ProtectedRoute requireRole="client">
                        <DashboardLayout>
                          <WheelOfLife />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/decisions"
                    element={
                      <ProtectedRoute requireRole="client">
                        <DashboardLayout>
                          <Decisions />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/decisions/analytics"
                    element={
                      <ProtectedRoute requireRole="client">
                        <DashboardLayout>
                          <DecisionAnalytics />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/decisions/insights"
                    element={
                      <ProtectedRoute requireRole="client">
                        <DashboardLayout>
                          <DecisionInsights />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/decisions/outcomes"
                    element={
                      <ProtectedRoute requireRole="client">
                        <DashboardLayout>
                          <DecisionOutcomes />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/decisions/follow-ups"
                    element={
                      <ProtectedRoute requireRole="client">
                        <DashboardLayout>
                          <DecisionFollowUps />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/decisions/:id"
                    element={
                      <ProtectedRoute requireRole="client">
                        <DashboardLayout>
                          <DecisionDetail />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/tasks"
                    element={
                      <ProtectedRoute requireRole="client">
                        <DashboardLayout>
                          <Tasks />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/tasks/:id"
                    element={
                      <ProtectedRoute requireRole="client">
                        <DashboardLayout>
                          <TaskDetail />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/guided-paths"
                    element={
                      <ProtectedRoute requireRole="client">
                        <DashboardLayout>
                          <GuidedPaths />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/guided-paths/:id"
                    element={
                      <ProtectedRoute requireRole="client">
                        <DashboardLayout>
                          <ClientGuidedPathDetail />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/learning/analytics"
                    element={
                      <ProtectedRoute requireRole="client">
                        <DashboardLayout>
                          <LearningAnalytics />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/learning/recommendations"
                    element={
                      <ProtectedRoute requireRole="client">
                        <DashboardLayout>
                          <CourseRecommendations />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/learning/external-courses"
                    element={
                      <ProtectedRoute requireRole="client">
                        <DashboardLayout>
                          <ExternalCourses />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/community"
                    element={
                      <ProtectedRoute requireRole="client">
                        <DashboardLayout>
                          <Community />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/academy"
                    element={
                      <ProtectedRoute requireRole="client">
                        <DashboardLayout>
                          <Academy />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/assessments"
                    element={
                      <ProtectedRoute requireRole="client">
                        <DashboardLayout>
                          <MyAssessments />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/assessments/explore"
                    element={
                      <ProtectedRoute requireRole="client">
                        <DashboardLayout>
                          <ExploreAssessments />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/groups"
                    element={
                      <ProtectedRoute requireRole="client">
                        <DashboardLayout>
                          <Groups />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/feedback"
                    element={
                      <ProtectedRoute requireRole="client">
                        <DashboardLayout>
                          <MyFeedback />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/calendar"
                    element={
                      <ProtectedRoute requireRole="client">
                        <DashboardLayout>
                          <ClientCalendar />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/groups/:id"
                    element={
                      <ProtectedRoute requireRole="client">
                        <DashboardLayout>
                          <GroupDetail />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/groups/:groupId/notes/:noteId"
                    element={
                      <ProtectedRoute requireRole="client">
                        <DashboardLayout>
                          <GroupNoteDetail />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/groups/:groupId/sessions/:sessionId"
                    element={
                      <ProtectedRoute requireRole="client">
                        <DashboardLayout>
                          <GroupSessionDetail />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/groups/:groupId/check-ins/:checkInId"
                    element={
                      <ProtectedRoute requireRole="client">
                        <DashboardLayout>
                          <GroupCheckInDetail />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/groups/:groupId/tasks/:taskId"
                    element={
                      <ProtectedRoute requireRole="client">
                        <DashboardLayout>
                          <GroupTaskDetail />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/skills"
                    element={
                      <ProtectedRoute requireRole="client">
                        <DashboardLayout>
                          <SkillsMap />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/capabilities"
                    element={
                      <ProtectedRoute requireRole="client">
                        <DashboardLayout>
                          <CapabilityAssessments />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/capabilities/:id"
                    element={
                      <ProtectedRoute>
                        <DashboardLayout>
                          <CapabilityAssessmentDetail />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/assessments/capabilities"
                    element={
                      <ProtectedRoute requireRole="client">
                        <DashboardLayout>
                          <CapabilityAssessments />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/assessments/capabilities/:id"
                    element={
                      <ProtectedRoute requireRole="client">
                        <DashboardLayout>
                          <CapabilityAssessmentDetail />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/scenarios"
                    element={
                      <ProtectedRoute requireRole="client">
                        <DashboardLayout>
                          <ClientScenarios />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/scenarios/:id"
                    element={
                      <ProtectedRoute requireRole="client">
                        <DashboardLayout>
                          <ClientScenarioDetail />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/usage"
                    element={
                      <ProtectedRoute requireRole="client">
                        <DashboardLayout>
                          <UsageOverview />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/credits"
                    element={
                      <ProtectedRoute requireRole="client">
                        <DashboardLayout>
                          <Credits />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/services"
                    element={
                      <ProtectedRoute requireRole="client">
                        <DashboardLayout>
                          <Services />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/notifications"
                    element={
                      <ProtectedRoute>
                        <DashboardLayout>
                          <AllNotifications />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/settings/notifications"
                    element={
                      <ProtectedRoute>
                        <DashboardLayout>
                          <NotificationSettings />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />

                  <Route
                    path="/subscription"
                    element={
                      <ProtectedRoute>
                        <DashboardLayout>
                          <Subscription />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/profile"
                    element={
                      <ProtectedRoute>
                        <DashboardLayout>
                          <PersonalProfile />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/public-profile"
                    element={
                      <ProtectedRoute>
                        <DashboardLayout>
                          <PublicProfileSettings />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/account"
                    element={
                      <ProtectedRoute>
                        <DashboardLayout>
                          <AccountSettings />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/account/terms-history"
                    element={
                      <ProtectedRoute>
                        <DashboardLayout>
                          <TermsHistory />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route path="/account/verify-email-change" element={<VerifyEmailChange />} />
                  <Route path="/verify-signup" element={<VerifySignup />} />

                  <Route path="/p/:slug" element={<PublicProfile />} />
                  <Route
                    path="/faq"
                    element={
                      <ProtectedRoute>
                        <DashboardLayout>
                          <FAQ />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/resources/:id"
                    element={
                      <ProtectedRoute>
                        <DashboardLayout>
                          <ResourceViewerPage />
                        </DashboardLayout>
                      </ProtectedRoute>
                    }
                  />

                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </AdminRefreshListener>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
