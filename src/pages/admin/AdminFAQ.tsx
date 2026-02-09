import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { HelpCircle, Layers, Shield, Users, Link2, BookOpen, Target, Settings, FileText, Package, Mail, UsersRound, Award, Sparkles, Calendar, BarChart3, Download, Coins, Route, Building2, ClipboardList } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useState, useMemo, useRef, useEffect } from 'react';
import { downloadPlatformDocumentation, downloadTechnicalDocumentation } from '@/lib/documentation';
import { toast } from 'sonner';
import { FAQSearch } from '@/components/faq/FAQSearch';

export default function AdminFAQ() {
  const navigate = useNavigate();
  const [downloadingPlatform, setDownloadingPlatform] = useState(false);
  const [downloadingTechnical, setDownloadingTechnical] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);
  const handleDownloadPlatform = async () => {
    setDownloadingPlatform(true);
    try {
      await downloadPlatformDocumentation();
      toast.success('Platform documentation downloaded');
    } catch (error) {
      console.error('Error downloading platform documentation:', error);
      toast.error('Failed to download documentation');
    } finally {
      setDownloadingPlatform(false);
    }
  };

  const handleDownloadTechnical = async () => {
    setDownloadingTechnical(true);
    try {
      await downloadTechnicalDocumentation();
      toast.success('Technical documentation downloaded');
    } catch (error) {
      console.error('Error downloading technical documentation:', error);
      toast.error('Failed to download documentation');
    } finally {
      setDownloadingTechnical(false);
    }
  };
  
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <HelpCircle className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Admin FAQ</h1>
            <p className="text-muted-foreground">
              Quick reference for platform configuration and common questions
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleDownloadPlatform} disabled={downloadingPlatform}>
            <Download className="h-4 w-4 mr-2" />
            {downloadingPlatform ? 'Downloading...' : 'Platform Docs'}
          </Button>
          <Button variant="outline" onClick={handleDownloadTechnical} disabled={downloadingTechnical}>
            <Download className="h-4 w-4 mr-2" />
            {downloadingTechnical ? 'Downloading...' : 'Technical Docs'}
          </Button>
        </div>
      </div>

      <FAQSearch
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="Search admin FAQ..."
      />

      <div className="grid gap-6" ref={contentRef}>
        {searchQuery && (
          <SearchableContent query={searchQuery} contentRef={contentRef} />
        )}
        
        {/* Plan Tier System */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              Plan Tier System
            </CardTitle>
            <CardDescription>
              How tier levels affect user access and features
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="tier-basics">
                <AccordionTrigger>What do tier levels mean?</AccordionTrigger>
                <AccordionContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Tier levels determine what features and content users can access. Higher tier plans 
                    inherit access from all lower tiers.
                  </p>
                  <div className="rounded-lg border p-4 bg-muted/30">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="destructive">Important</Badge>
                      <span className="font-medium">Tier 0 vs Tier 1+</span>
                    </div>
                    <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                      <li><strong>Tier 0</strong> = Free/limited plan with restrictions (e.g., Wheel of Life limits)</li>
                      <li><strong>Tier 1+</strong> = Paid plans with progressively more features</li>
                    </ul>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="tier-impact">
                <AccordionTrigger>What does each tier level affect?</AccordionTrigger>
                <AccordionContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Feature</TableHead>
                        <TableHead>Tier 0</TableHead>
                        <TableHead>Tier 1+</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-medium">Wheel of Life</TableCell>
                        <TableCell>Limited: 3 goals, 3 reflections, no history</TableCell>
                        <TableCell>Unlimited access</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Program Access</TableCell>
                        <TableCell>Only programs with min_plan_tier = 0</TableCell>
                        <TableCell>Programs requiring tier ≤ user's tier</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Module Access</TableCell>
                        <TableCell>Only modules with min_plan_tier = 0</TableCell>
                        <TableCell>Modules requiring tier ≤ user's tier</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Decision Features</TableCell>
                        <TableCell>Basic decision tracking</TableCell>
                        <TableCell>Full frameworks, analytics, AI insights</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="current-tiers">
                <AccordionTrigger>What are the current tier levels?</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">Tier 0</Badge>
                      <span className="text-sm">Continuation (free/limited)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">Tier 1</Badge>
                      <span className="text-sm">Free, Programs Base</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">Tier 2</Badge>
                      <span className="text-sm">Base</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">Tier 3</Badge>
                      <span className="text-sm">Pro</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">Tier 4</Badge>
                      <span className="text-sm">Advanced</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">Tier 5</Badge>
                      <span className="text-sm">Elite</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    Manage tiers in Admin → Subscription Plans
                  </p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        {/* Program Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Program Management
            </CardTitle>
            <CardDescription>
              Creating and managing programs, modules, and content
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="create-program">
                <AccordionTrigger>How do I create a new program?</AccordionTrigger>
                <AccordionContent className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Go to <strong>Admin → Programs → Add Program</strong>. Fill in:
                  </p>
                  <ul className="text-sm list-disc list-inside text-muted-foreground">
                    <li>Title, description, and cover image</li>
                    <li>Visibility settings (public listing, enrollment options)</li>
                    <li>Plan access configuration (min tier required)</li>
                    <li>Assigned instructors and coaches</li>
                    <li>Badges to award upon completion</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="add-modules">
                <AccordionTrigger>How do I add modules to a program?</AccordionTrigger>
                <AccordionContent className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Open the program detail page → Modules tab → <strong>Add Module</strong>:
                  </p>
                  <ul className="text-sm list-disc list-inside text-muted-foreground">
                    <li><strong>Content modules:</strong> Learning material, videos, documents</li>
                    <li><strong>Session modules:</strong> Live workshops or coaching sessions</li>
                    <li><strong>Academy modules:</strong> Linked to TalentLMS courses</li>
                    <li><strong>Assignment modules:</strong> Work submissions for review</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="module-types">
                <AccordionTrigger>What are module types?</AccordionTrigger>
                <AccordionContent className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Module types define the category and behavior. Manage them in <strong>Admin → Module Types</strong>.
                    Common types: Content, Workshop, Coaching Session, Assessment, Self-Paced Course.
                  </p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="program-versions">
                <AccordionTrigger>How do program versions work?</AccordionTrigger>
                <AccordionContent className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Programs support versioning to track changes. Each version can have different modules 
                    and configurations while maintaining enrollment history. Deploy new versions from 
                    program detail → Version History tab.
                  </p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="program-plans">
                <AccordionTrigger>What are program plans?</AccordionTrigger>
                <AccordionContent className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Program plans are enrollment tiers within a program (e.g., Base, Premium, VIP). 
                    Each plan can grant different features, module access, and credit allocations. 
                    Enrollments are assigned a specific program plan.
                  </p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="scheduled-dates">
                <AccordionTrigger>How do I set scheduled dates for modules?</AccordionTrigger>
                <AccordionContent className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    For cohort-based programs, add scheduled dates in module edit → Scheduled Dates section.
                    Include date/time and meeting links. These appear on users' calendars.
                  </p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        {/* User Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              User Management
            </CardTitle>
            <CardDescription>
              Managing users, clients, and roles
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="user-roles">
                <AccordionTrigger>What are the different user roles?</AccordionTrigger>
                <AccordionContent className="space-y-2">
                  <ul className="text-sm space-y-2 text-muted-foreground">
                    <li><strong>Client:</strong> Regular users enrolled in programs</li>
                    <li><strong>Instructor:</strong> Program teachers who manage content and provide feedback</li>
                    <li><strong>Coach:</strong> 1:1 support providers who track client progress</li>
                    <li><strong>Org Admin:</strong> Organization-level administrators</li>
                    <li><strong>Admin:</strong> Full platform management access</li>
                  </ul>
                  <p className="text-sm text-muted-foreground">
                    Users can have multiple roles simultaneously.
                  </p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="assign-plan">
                <AccordionTrigger>How do I assign a plan to a user?</AccordionTrigger>
                <AccordionContent>
                  <p className="text-sm text-muted-foreground">
                    Go to <strong>Admin → Clients → select user → Edit Profile</strong>. 
                    Assign their subscription plan from the dropdown. This determines their platform tier.
                  </p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="program-enrollment">
                <AccordionTrigger>How do I enroll a user in a program?</AccordionTrigger>
                <AccordionContent className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Go to <strong>Admin → Clients → select user</strong>. Under "Enrollments", 
                    click <strong>Add Enrollment</strong>. Select program and optionally choose a program plan tier.
                  </p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="assign-coach">
                <AccordionTrigger>How do I assign a coach to a client?</AccordionTrigger>
                <AccordionContent>
                  <p className="text-sm text-muted-foreground">
                    Go to <strong>Admin → Clients → select user → Coaches tab</strong>. 
                    Click Add Coach to assign one or more coaches.
                  </p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="status-markers">
                <AccordionTrigger>What are status markers?</AccordionTrigger>
                <AccordionContent className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Customizable labels for tracking client status (e.g., "Active", "On Hold", "VIP", "At Risk").
                    Manage available markers in <strong>Admin → Status Markers</strong>.
                  </p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        {/* Groups */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UsersRound className="h-5 w-5" />
              Groups Management
            </CardTitle>
            <CardDescription>
              Creating and managing learning groups
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="create-group">
                <AccordionTrigger>How do I create a group?</AccordionTrigger>
                <AccordionContent className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Go to <strong>Admin → Groups → Add Group</strong>. Configure:
                  </p>
                  <ul className="text-sm list-disc list-inside text-muted-foreground">
                    <li>Name and description</li>
                    <li>Assigned facilitators (leaders)</li>
                    <li>Optional program association</li>
                    <li>Member management settings</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="group-features">
                <AccordionTrigger>What features do groups have?</AccordionTrigger>
                <AccordionContent>
                  <ul className="text-sm list-disc list-inside text-muted-foreground">
                    <li><strong>Sessions:</strong> Scheduled group meetings with video links</li>
                    <li><strong>Check-ins:</strong> Member progress updates</li>
                    <li><strong>Notes:</strong> Shared documentation and resources</li>
                    <li><strong>Tasks:</strong> Group action items and assignments</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="group-roles">
                <AccordionTrigger>What are group member roles?</AccordionTrigger>
                <AccordionContent>
                  <ul className="text-sm list-disc list-inside text-muted-foreground">
                    <li><strong>Leader:</strong> Full management (editing, managing content)</li>
                    <li><strong>Member:</strong> Can view everything, add check-ins, notes, tasks</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        {/* Combined Access System */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Access Control & Feature Management
            </CardTitle>
            <CardDescription>
              How plans, tracks, add-ons, and features work together
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border p-4 bg-muted/30">
              <p className="text-sm font-medium mb-2">Key Principle:</p>
              <p className="text-sm text-muted-foreground">
                A user's feature access is the <strong>union</strong> of all their access sources. 
                If ANY source grants access to a feature, the user has access.
              </p>
            </div>
            
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="access-sources">
                <AccordionTrigger>What are the access sources?</AccordionTrigger>
                <AccordionContent className="space-y-3">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Source</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Use Case</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-medium">Subscription Plan</TableCell>
                        <TableCell>Ongoing (monthly/annual)</TableCell>
                        <TableCell>Regular paying customers</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Program Plan</TableCell>
                        <TableCell>Duration of enrollment</TableCell>
                        <TableCell>Program participants</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Tracks</TableCell>
                        <TableCell>While track is active</TableCell>
                        <TableCell>Special cohorts, beta testers</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Add-ons</TableCell>
                        <TableCell>One-time or until expiry</TableCell>
                        <TableCell>Extra credits, premium features</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="feature-flags">
                <AccordionTrigger>How do I manage feature flags?</AccordionTrigger>
                <AccordionContent className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Go to <strong>Admin → Features</strong> to manage feature flags. Features can be:
                  </p>
                  <ul className="text-sm list-disc list-inside text-muted-foreground">
                    <li>Enabled/disabled globally via <code className="bg-muted px-1 rounded">is_active</code></li>
                    <li>Tied to specific plans (subscription or program)</li>
                    <li>Assigned to tracks or add-ons</li>
                    <li>Consumable with usage limits</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="system-features">
                <AccordionTrigger>What are "System" features?</AccordionTrigger>
                <AccordionContent className="space-y-3">
                  <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
                    <p className="text-sm font-medium text-destructive">
                      ⚠️ System features are protected because they control core platform functionality.
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Features marked "System" control navigation visibility, dashboard widgets, and core workflows.
                    Set <code className="bg-muted px-1 rounded">is_active = false</code> to globally hide them instead of deleting.
                  </p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="visibility-system">
                <AccordionTrigger>How does feature visibility work?</AccordionTrigger>
                <AccordionContent className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Features have a unified 3-tier visibility system:
                  </p>
                  <ul className="text-sm list-disc list-inside text-muted-foreground">
                    <li><strong>Hidden:</strong> is_active=false or not monetized → not shown</li>
                    <li><strong>Locked:</strong> Monetized but user lacks entitlement → shows lock icon with upsell</li>
                    <li><strong>Accessible:</strong> User has entitlement → full access</li>
                  </ul>
                  <p className="text-sm text-muted-foreground mt-2">
                    Locked items show tooltips with the plan/track/add-on name needed for access.
                  </p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="tracks">
                <AccordionTrigger>What are tracks?</AccordionTrigger>
                <AccordionContent>
                  <p className="text-sm text-muted-foreground">
                    Tracks are optional groupings that unlock specific features. Assign users to tracks 
                    for special access (beta testers, partners). Manage in <strong>Admin → Tracks</strong>.
                  </p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        {/* Credits & Services */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Coins className="h-5 w-5" />
              Credits & Services
            </CardTitle>
            <CardDescription>
              Managing the credit system and consumable services
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="credit-overview">
                <AccordionTrigger>How does the credit system work?</AccordionTrigger>
                <AccordionContent className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Credits are consumed when clients use premium services. Credits come from:
                  </p>
                  <ul className="text-sm list-disc list-inside text-muted-foreground">
                    <li><strong>Subscription Plans:</strong> Renewable monthly allocations</li>
                    <li><strong>Program Enrollments:</strong> Credits included with enrollment</li>
                    <li><strong>Bonus Grants:</strong> Admin-assigned one-time credits</li>
                    <li><strong>Add-ons:</strong> Purchased credit bundles</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="credit-priority">
                <AccordionTrigger>In what order are credits consumed?</AccordionTrigger>
                <AccordionContent>
                  <ol className="text-sm list-decimal list-inside text-muted-foreground">
                    <li>Plan credits first (renewable monthly)</li>
                    <li>Program entitlements second</li>
                    <li>Bonus/purchased credits last (preserves one-time purchases)</li>
                  </ol>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="credit-services">
                <AccordionTrigger>How do I configure credit services?</AccordionTrigger>
                <AccordionContent className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Go to <strong>Admin → Credit Services</strong> to define services with:
                  </p>
                  <ul className="text-sm list-disc list-inside text-muted-foreground">
                    <li>Credit cost per use</li>
                    <li>Category and description</li>
                    <li>Feature key requirements</li>
                    <li>Track-based discounts</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="grant-credits">
                <AccordionTrigger>How do I grant credits to users?</AccordionTrigger>
                <AccordionContent>
                  <p className="text-sm text-muted-foreground">
                    Go to <strong>Admin → Clients → select user → Credits tab</strong>. 
                    Click "Grant Credits" to add bonus credits with optional notes.
                  </p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        {/* Assessments */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Assessments
            </CardTitle>
            <CardDescription>
              Managing capability and psychometric assessments
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="assessment-types">
                <AccordionTrigger>What types of assessments are available?</AccordionTrigger>
                <AccordionContent className="space-y-2">
                  <ul className="text-sm space-y-2 text-muted-foreground">
                    <li><strong>Capability Assessments:</strong> Self and peer evaluations with domains and rating scales</li>
                    <li><strong>Psychometric Assessments:</strong> Third-party assessments with imported results</li>
                    <li><strong>Custom Assessments:</strong> Built using the Assessment Builder</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="capability-setup">
                <AccordionTrigger>How do I set up a capability assessment?</AccordionTrigger>
                <AccordionContent className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Go to <strong>Admin → Capability Assessments → Add Assessment</strong>:
                  </p>
                  <ul className="text-sm list-disc list-inside text-muted-foreground">
                    <li>Define domains (competency areas)</li>
                    <li>Add questions within each domain</li>
                    <li>Set rating scale (e.g., 1-5)</li>
                    <li>Configure pass/fail thresholds if needed</li>
                    <li>Enable instructor/peer evaluation</li>
                    <li>Link development resources to domains/questions</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="guided-learning">
                <AccordionTrigger>What is Guided Learning in assessments?</AccordionTrigger>
                <AccordionContent className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    You can link programs, modules, and resource library items to assessment domains 
                    and questions. Users see these as "Development Resources" in their snapshots with 
                    access state handling (not enrolled, tier-locked, prerequisite-locked).
                  </p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="assessment-families">
                <AccordionTrigger>What are assessment families?</AccordionTrigger>
                <AccordionContent>
                  <p className="text-sm text-muted-foreground">
                    Families group related assessments (e.g., "Leadership Competencies", "Technical Skills").
                    Manage in <strong>Admin → Assessment Families</strong>. Helps users find related assessments.
                  </p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        {/* Scenario-Based Assessments */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Scenario-Based Assessments
            </CardTitle>
            <CardDescription>
              Managing complex scenario assessments linked to modules
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="scenario-overview">
                <AccordionTrigger>What are scenario-based assessments?</AccordionTrigger>
                <AccordionContent className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Scenarios are multi-page, complex assessments where clients respond to realistic 
                    hypothetical situations. Each scenario contains sections with paragraphs that can 
                    require written responses, which are then evaluated against capability questions.
                  </p>
                  <ul className="text-sm list-disc list-inside text-muted-foreground">
                    <li>Rich text content with paginated sections</li>
                    <li>Client responses with auto-save</li>
                    <li>Linked capability domain questions for scoring</li>
                    <li>IP protection with watermarking and copy prevention</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="create-scenario">
                <AccordionTrigger>How do I create a scenario template?</AccordionTrigger>
                <AccordionContent className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Go to <strong>Admin → Scenario Templates → Add Template</strong>:
                  </p>
                  <ul className="text-sm list-disc list-inside text-muted-foreground">
                    <li>Set title and description</li>
                    <li>Link to a capability assessment for scoring questions</li>
                    <li>Add sections (pages) with instructional content</li>
                    <li>Add paragraphs within sections - mark which require responses</li>
                    <li>Link capability questions to paragraphs for evaluation</li>
                    <li>Enable IP protection if content is proprietary</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="scenario-modules">
                <AccordionTrigger>How do I link scenarios to modules?</AccordionTrigger>
                <AccordionContent className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Open a module in edit mode → <strong>Scenarios tab → Add Scenario</strong>. 
                    For each linked scenario, you can:
                  </p>
                  <ul className="text-sm list-disc list-inside text-muted-foreground">
                    <li>Mark as "Required for Certification" to block badge approval until evaluated</li>
                    <li>Drag to reorder scenarios within the module</li>
                    <li>Remove scenarios if no longer needed</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="scenario-assign">
                <AccordionTrigger>How do I assign scenarios to clients?</AccordionTrigger>
                <AccordionContent className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Scenarios must be manually assigned by staff:
                  </p>
                  <ul className="text-sm list-disc list-inside text-muted-foreground">
                    <li><strong>Individual:</strong> From client's module view or via Assignments dashboard</li>
                    <li><strong>Bulk:</strong> Admins can assign a scenario to all clients enrolled in a module</li>
                  </ul>
                  <p className="text-sm text-muted-foreground mt-2">
                    Assignments track enrollment and module context for independent progress across re-enrollments.
                  </p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="scenario-evaluate">
                <AccordionTrigger>How do I evaluate scenario responses?</AccordionTrigger>
                <AccordionContent className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Go to <strong>Instructor Dashboard → Pending Assignments</strong> or the client's progress page:
                  </p>
                  <ul className="text-sm list-disc list-inside text-muted-foreground">
                    <li>View client's responses for each paragraph</li>
                    <li>Score linked capability questions on the assessment's rating scale</li>
                    <li>Add inline feedback per paragraph</li>
                    <li>Write overall evaluation notes</li>
                    <li>Mark as evaluated to create a capability snapshot</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="scenario-ip">
                <AccordionTrigger>How does IP protection work?</AccordionTrigger>
                <AccordionContent className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    When a scenario template is marked "Protected":
                  </p>
                  <ul className="text-sm list-disc list-inside text-muted-foreground">
                    <li>Content is view-only (no copy/paste)</li>
                    <li>Text selection is disabled</li>
                    <li>Right-click context menu is blocked</li>
                    <li>Pages are watermarked with the client's email</li>
                  </ul>
                  <p className="text-sm text-muted-foreground mt-2">
                    Use this for proprietary assessment content that shouldn't be copied or shared.
                  </p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="scenario-lock">
                <AccordionTrigger>What is template locking?</AccordionTrigger>
                <AccordionContent className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Admins can lock a scenario template to prevent modifications. When locked:
                  </p>
                  <ul className="text-sm list-disc list-inside text-muted-foreground">
                    <li>Only admins can modify template structure</li>
                    <li>Linked capability questions cannot be changed</li>
                    <li>Ensures evaluation integrity across all assignments</li>
                  </ul>
                  <p className="text-sm text-muted-foreground mt-2">
                    Lock templates before widespread use to maintain scoring consistency.
                  </p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="scenario-certification">
                <AccordionTrigger>How do scenarios affect certification?</AccordionTrigger>
                <AccordionContent className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Scenarios marked "Required for Certification" must be completed and evaluated 
                    before a client can receive their program badge:
                  </p>
                  <ul className="text-sm list-disc list-inside text-muted-foreground">
                    <li>Client must submit all responses</li>
                    <li>Instructor/coach must complete evaluation</li>
                    <li>Assignment status must be "Evaluated"</li>
                  </ul>
                  <p className="text-sm text-muted-foreground mt-2">
                    Badge approval is blocked until all required scenarios are evaluated.
                  </p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        {/* Guided Paths */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Route className="h-5 w-5" />
              Guided Paths
            </CardTitle>
            <CardDescription>
              Creating personalized learning journeys
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="paths-overview">
                <AccordionTrigger>What are Guided Paths?</AccordionTrigger>
                <AccordionContent className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Guided Paths are survey-based recommendation engines. Users answer questions, 
                    and the system suggests relevant programs and modules based on conditional logic.
                  </p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="create-path">
                <AccordionTrigger>How do I create a Guided Path?</AccordionTrigger>
                <AccordionContent className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Go to <strong>Admin → Guided Paths</strong>:
                  </p>
                  <ul className="text-sm list-disc list-inside text-muted-foreground">
                    <li>Create a path family (e.g., "Career Development")</li>
                    <li>Add survey questions with answer options</li>
                    <li>Configure conditional templates based on answers</li>
                    <li>Link recommendations to programs and modules</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        {/* Organizations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Organizations
            </CardTitle>
            <CardDescription>
              Managing B2B organizations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="org-overview">
                <AccordionTrigger>What are organizations?</AccordionTrigger>
                <AccordionContent className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Organizations are B2B entities with seat-based memberships. They can have:
                  </p>
                  <ul className="text-sm list-disc list-inside text-muted-foreground">
                    <li>Sponsored plans for members</li>
                    <li>Custom organization-specific terms</li>
                    <li>Assigned programs</li>
                    <li>Org Admin roles for self-management</li>
                    <li>Billing and credit pools</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="create-org">
                <AccordionTrigger>How do I create an organization?</AccordionTrigger>
                <AccordionContent>
                  <p className="text-sm text-muted-foreground">
                    Go to <strong>Admin → Organizations → Add Organization</strong>. Configure name, 
                    seat limit, sponsored plan, assigned programs, and initial org admin.
                  </p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        {/* Add-ons */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Add-ons
            </CardTitle>
            <CardDescription>
              Managing feature and credit add-ons
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="addon-overview">
                <AccordionTrigger>What are add-ons?</AccordionTrigger>
                <AccordionContent className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Add-ons are named bundles that grant features or credits independent of subscription plans:
                  </p>
                  <ul className="text-sm list-disc list-inside text-muted-foreground">
                    <li><strong>Feature add-ons:</strong> Grant access to specific features</li>
                    <li><strong>Credit add-ons:</strong> Include consumable credits</li>
                    <li><strong>Expiring add-ons:</strong> Can have optional expiration dates</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="assign-addon">
                <AccordionTrigger>How do I assign add-ons to users?</AccordionTrigger>
                <AccordionContent className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Go to <strong>Admin → User Add-ons</strong> or the user's profile. Select add-on, 
                    set quantity, and configure optional expiration date.
                  </p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="addon-vs-plan">
                <AccordionTrigger>When to use add-ons vs plan upgrades?</AccordionTrigger>
                <AccordionContent className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Use <strong>add-ons</strong> for one-time purchases, specific features, or à la carte sales.
                    Use <strong>plan upgrades</strong> for ongoing access to multiple features or when more cost-effective.
                  </p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        {/* Resources & Content */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Resources & Content
            </CardTitle>
            <CardDescription>
              Managing the resource library and content
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="resource-library">
                <AccordionTrigger>What is the Resource Library?</AccordionTrigger>
                <AccordionContent>
                  <p className="text-sm text-muted-foreground">
                    A central repository for documents, templates, videos, and links. Resources can be 
                    attached to modules, shared directly, or linked to assessment domains for guided learning.
                    Manage at <strong>Admin → Resource Library</strong>.
                  </p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="resource-skills">
                <AccordionTrigger>How do I tag resources with skills?</AccordionTrigger>
                <AccordionContent className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    When editing a resource, assign skills from the Skills library. Tagged skills help 
                    users find relevant resources and track skill development.
                  </p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="cross-program">
                <AccordionTrigger>How does cross-program completion tracking work?</AccordionTrigger>
                <AccordionContent className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    When the same module appears in multiple programs (via TalentLMS course ID or 
                    canonical code), completing it once marks it "Completed elsewhere" in other programs.
                    Assign canonical codes in module edit → Canonical Code field.
                  </p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="feedback-templates">
                <AccordionTrigger>What are feedback templates?</AccordionTrigger>
                <AccordionContent>
                  <p className="text-sm text-muted-foreground">
                    Structured formats for instructor feedback with specific fields and rubrics. 
                    Create reusable templates at <strong>Admin → Feedback Templates</strong>.
                  </p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        {/* Badges */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              Badges & Credentials
            </CardTitle>
            <CardDescription>
              Managing program badges and digital credentials
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="badge-overview">
                <AccordionTrigger>How do badges work?</AccordionTrigger>
                <AccordionContent className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Badges are awarded for program completion. Configure badges in program settings 
                    with image, criteria, and optional digital credential integration.
                  </p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="badge-approval">
                <AccordionTrigger>How are badges approved?</AccordionTrigger>
                <AccordionContent>
                  <p className="text-sm text-muted-foreground">
                    Instructors review badge requests at <strong>Badge Approvals</strong>. They verify 
                    completion criteria are met before issuing. Clients can then accept digital credentials.
                  </p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        {/* Integrations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Integrations
            </CardTitle>
            <CardDescription>
              Connecting external platforms and services
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="available-integrations">
                <AccordionTrigger>What integrations are available?</AccordionTrigger>
                <AccordionContent>
                  <ul className="text-sm space-y-2 text-muted-foreground">
                    <li><strong>InnoTrue Academy (TalentLMS):</strong> Self-paced courses with progress sync</li>
                    <li><strong>InnoTrue Community (Circle):</strong> Community platform SSO</li>
                    <li><strong>ActiveCampaign:</strong> Marketing automation sync</li>
                    <li><strong>Lucid, Miro, Mural:</strong> Visual collaboration tools</li>
                    <li><strong>Google Drive:</strong> Document storage</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="talentlms-sync">
                <AccordionTrigger>How does TalentLMS progress sync work?</AccordionTrigger>
                <AccordionContent className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    When a user completes a course in TalentLMS, progress syncs back. Modules linked 
                    to TalentLMS courses are automatically marked complete. Manage at 
                    <strong> Admin → InnoTrue Academy</strong>.
                  </p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        {/* Cal.com Scheduling Integration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Cal.com Scheduling Integration
            </CardTitle>
            <CardDescription>
              Configuring session booking for instructors and coaches
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="calcom-overview">
                <AccordionTrigger>How does Cal.com integration work?</AccordionTrigger>
                <AccordionContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Cal.com powers 1:1 session booking. The system uses a <strong>hierarchical resolution chain</strong> to 
                    determine which instructor's calendar a client books with:
                  </p>
                  <ol className="text-sm list-decimal list-inside text-muted-foreground space-y-1">
                    <li><strong>Enrollment-specific:</strong> Instructor/coach assigned to the client's specific module</li>
                    <li><strong>Module-level:</strong> Default instructor assigned to the module</li>
                    <li><strong>Program-level:</strong> Default instructor assigned to the program</li>
                  </ol>
                  <div className="rounded-lg border p-4 bg-muted/30">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="destructive">Important</Badge>
                      <span className="font-medium">Personalised Modules</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Personalised modules (is_individualized = true) require <strong>enrollment-level staff assignment</strong> 
                      so each client books with their dedicated instructor/coach.
                    </p>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="calcom-event-mappings">
                <AccordionTrigger>What are Event Type Mappings?</AccordionTrigger>
                <AccordionContent className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Event Type Mappings connect Cal.com event types to the platform. Configure at 
                    <strong> Admin → Cal.com Integration → Event Type Mappings</strong>:
                  </p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Field</TableHead>
                        <TableHead>Description</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-medium">Event Type ID</TableCell>
                        <TableCell>The numeric ID from Cal.com (found in event type URL)</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Module Type</TableCell>
                        <TableCell>Which module type uses this event (e.g., Coaching Session, Workshop)</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Session Target</TableCell>
                        <TableCell>Module Session (1:1) or Group Session</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Scheduling URL</TableCell>
                        <TableCell>Optional override URL for direct booking links</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="calcom-mapping-comparison">
                <AccordionTrigger>What's the difference between Event Type Mappings and Instructor Event Types?</AccordionTrigger>
                <AccordionContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    These two configuration areas serve <strong>different but complementary purposes</strong>:
                  </p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead></TableHead>
                        <TableHead>Event Type Mappings</TableHead>
                        <TableHead>Instructor Event Types</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-medium">Primary Use</TableCell>
                        <TableCell>Incoming webhook routing</TableCell>
                        <TableCell>Outgoing booking URL generation</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Scope</TableCell>
                        <TableCell>Global (one per Cal.com event type)</TableCell>
                        <TableCell>Per-instructor, per-module-type</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Key Field</TableCell>
                        <TableCell>Event Type ID (parent/team event)</TableCell>
                        <TableCell>Child Event Type ID (instructor's copy)</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Purpose</TableCell>
                        <TableCell>Routes Cal.com bookings → correct session type</TableCell>
                        <TableCell>Generates personalized booking links</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                  <div className="rounded-lg border p-4 bg-muted/30">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge>How They Work Together</Badge>
                    </div>
                    <ol className="text-sm list-decimal list-inside text-muted-foreground space-y-2">
                      <li><strong>Instructor Event Types</strong> → When a client needs to book, the system looks up the instructor's Child Event Type ID for that module type to build the correct booking URL</li>
                      <li><strong>Event Type Mappings</strong> → When Cal.com sends a webhook after booking, this determines whether to create a module session or group session</li>
                    </ol>
                  </div>
                  <div className="rounded-lg border p-4 bg-accent/50">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline">Note</Badge>
                      <span className="font-medium text-sm">Scheduling URL Fallback</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      The "Scheduling URL" field in Event Type Mappings is a <strong>fallback</strong> — only used if no 
                      instructor-specific mapping exists. With complete Instructor Event Types mappings, it becomes unused.
                    </p>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="calcom-instructor-events">
                <AccordionTrigger>What are Instructor Event Types?</AccordionTrigger>
                <AccordionContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Instructor Event Types map each staff member to their <strong>personal version</strong> of a 
                    Cal.com Managed Event. This is <strong>required</strong> for personalised 1:1 scheduling.
                  </p>
                  <div className="rounded-lg border p-4 bg-muted/30">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge>Configuration Steps</Badge>
                    </div>
                    <ol className="text-sm list-decimal list-inside text-muted-foreground space-y-2">
                      <li>In Cal.com, create a <strong>Managed Event</strong> (e.g., "30-min Coaching")</li>
                      <li>Add instructors/coaches as <strong>hosts</strong> to this Managed Event</li>
                      <li>For each host, find their <strong>Child Event Type ID</strong> in Cal.com:
                        <ul className="list-disc list-inside ml-4 mt-1">
                          <li>Go to Settings → Teams → [Your Team] → Event Types</li>
                          <li>Click the team member's version of the managed event</li>
                          <li>The ID is in the URL (e.g., /event-types/<strong>123456</strong>)</li>
                        </ul>
                      </li>
                      <li>In the platform: <strong>Admin → Cal.com Integration → Instructor Event Types</strong></li>
                      <li>Add a mapping for each instructor + module type combination</li>
                    </ol>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Field</TableHead>
                        <TableHead>Description</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-medium">Staff Member</TableCell>
                        <TableCell>The instructor or coach</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Module Type</TableCell>
                        <TableCell>The type of session (must match an existing module type)</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Child Event Type ID</TableCell>
                        <TableCell>The instructor's personal event type ID from Cal.com</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="calcom-enrollment-staff">
                <AccordionTrigger>How do I assign staff to client modules?</AccordionTrigger>
                <AccordionContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    For personalised modules, assign specific instructors/coaches at the <strong>enrollment level</strong>:
                  </p>
                  <ol className="text-sm list-decimal list-inside text-muted-foreground space-y-1">
                    <li>Go to <strong>Admin → Clients → [Client Name]</strong></li>
                    <li>Expand the relevant enrollment</li>
                    <li>In the <strong>Staff Assignments</strong> section, click "Manage Staff"</li>
                    <li>For each personalised module, assign the instructor or coach</li>
                  </ol>
                  <div className="rounded-lg border p-4 bg-muted/30">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline">Resolution Priority</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      <strong>Enrollment Staff</strong> → Module Staff → Program Staff → Profile URL Fallback
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      If no matching instructor event type is found, the system falls back to the 
                      instructor's profile scheduling_url field.
                    </p>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="calcom-substitutions">
                <AccordionTrigger>How do instructor substitutions work?</AccordionTrigger>
                <AccordionContent className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    When an instructor is substituted (e.g., due to illness):
                  </p>
                  <ol className="text-sm list-decimal list-inside text-muted-foreground space-y-1">
                    <li>Update the staff assignment in the client's enrollment</li>
                    <li>Ensure the new instructor has their Child Event Type ID configured</li>
                    <li>The booking link automatically resolves to the new instructor's calendar</li>
                  </ol>
                  <p className="text-sm text-muted-foreground mt-2">
                    For modules with multiple potential instructors, consider using <strong>Cal.com Team Round-Robin</strong> 
                    event types which handle availability orchestration automatically.
                  </p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="calcom-different-durations">
                <AccordionTrigger>How do I support different session durations?</AccordionTrigger>
                <AccordionContent className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Create separate <strong>module types</strong> for different durations (e.g., "30-min Coaching", "60-min Coaching"). 
                    Then create corresponding Managed Events in Cal.com and map instructors to each:
                  </p>
                  <ul className="text-sm list-disc list-inside text-muted-foreground space-y-1">
                    <li>Module Type: "Coaching Session - 30min" → 30-minute Managed Event</li>
                    <li>Module Type: "Coaching Session - 60min" → 60-minute Managed Event</li>
                  </ul>
                  <p className="text-sm text-muted-foreground mt-2">
                    Each instructor needs separate Child Event Type IDs for each duration in their 
                    Instructor Event Types configuration.
                  </p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="calcom-rescheduling">
                <AccordionTrigger>How does session rescheduling work?</AccordionTrigger>
                <AccordionContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Session rescheduling is standardized through Cal.com for both staff and clients:
                  </p>
                  <div className="rounded-lg border p-4 bg-muted/30">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge>Cal.com-origin Sessions</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Sessions booked through Cal.com have a <strong>Reschedule</strong> button that redirects 
                      to the Cal.com reschedule page. Changes sync back automatically via webhooks.
                    </p>
                  </div>
                  <div className="rounded-lg border p-4 bg-muted/30">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline">Manual Sessions</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Sessions created manually (non-Cal.com) show a <strong>Rebook</strong> button. 
                      When clients book a new time through Cal.com, the system automatically updates the 
                      existing session record rather than creating a duplicate.
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    This "upsert" logic prevents the unique constraint error that would occur if a client 
                    has an existing active session for the same module.
                  </p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="calcom-session-visibility">
                <AccordionTrigger>When does Session Manager appear for instructors?</AccordionTrigger>
                <AccordionContent className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    The Session Manager visibility depends on module type:
                  </p>
                  <ul className="text-sm list-disc list-inside text-muted-foreground space-y-1">
                    <li><strong>Personalised modules:</strong> Only appears when viewing a specific client's enrollment</li>
                    <li><strong>Non-personalised modules:</strong> Appears in group/cohort context for batch scheduling</li>
                  </ul>
                  <p className="text-sm text-muted-foreground mt-2">
                    This ensures sessions for personalised modules are always correctly associated with a specific enrollment.
                  </p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="calcom-troubleshooting">
                <AccordionTrigger>Troubleshooting: Booking link not working?</AccordionTrigger>
                <AccordionContent className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    If clients see errors or wrong booking links:
                  </p>
                  <ol className="text-sm list-decimal list-inside text-muted-foreground space-y-1">
                    <li><strong>Check staff assignment:</strong> Is an instructor assigned at enrollment, module, or program level?</li>
                    <li><strong>Check Instructor Event Types:</strong> Does the assigned instructor have a Child Event Type ID for this module type?</li>
                    <li><strong>Check Cal.com:</strong> Is the instructor a host on the Managed Event?</li>
                    <li><strong>Fallback URL:</strong> Does the instructor have a scheduling_url in their profile?</li>
                  </ol>
                  <p className="text-xs text-muted-foreground mt-2">
                    View webhook logs at <strong>Admin → System Logs → Cal.com Webhooks</strong> to debug booking issues.
                  </p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        {/* System Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              System Settings
            </CardTitle>
            <CardDescription>
              Platform-wide configuration
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="system-config">
                <AccordionTrigger>What can I configure in System Settings?</AccordionTrigger>
                <AccordionContent>
                  <p className="text-sm text-muted-foreground">
                    Go to <strong>Admin → System Settings</strong> to configure:
                  </p>
                  <ul className="text-sm list-disc list-inside text-muted-foreground mt-2">
                    <li>Support email address</li>
                    <li>Platform name and branding</li>
                    <li>Default settings for new users</li>
                    <li>Integration API keys</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="platform-terms">
                <AccordionTrigger>How do I manage platform terms?</AccordionTrigger>
                <AccordionContent>
                  <p className="text-sm text-muted-foreground">
                    Platform terms (ToS, privacy policy) at <strong>Admin → Platform Terms</strong>. 
                    Users must accept current terms to use the platform. Version and track acceptance.
                  </p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="ai-personalization">
                <AccordionTrigger>How does AI personalization work?</AccordionTrigger>
                <AccordionContent className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    AI features (recommendations, decision insights) use client profile data:
                  </p>
                  <ul className="text-sm list-disc list-inside text-muted-foreground">
                    <li>Core Values & Motivators</li>
                    <li>Desired Target Role</li>
                    <li>Vision for Future Self</li>
                    <li>Constraints (time, location, health, family)</li>
                  </ul>
                  <p className="text-sm text-muted-foreground mt-2">
                    Encourage clients to complete profiles for better AI recommendations.
                  </p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        {/* Quick Navigation */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Quick Navigation
            </CardTitle>
            <CardDescription>
              Common admin tasks
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate('/admin/clients')}>
                <Users className="h-4 w-4 mr-2" />
                Clients
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate('/admin/programs')}>
                <BookOpen className="h-4 w-4 mr-2" />
                Programs
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate('/admin/groups')}>
                <UsersRound className="h-4 w-4 mr-2" />
                Groups
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate('/admin/plans')}>
                <Layers className="h-4 w-4 mr-2" />
                Plans
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate('/admin/resource-library')}>
                <FileText className="h-4 w-4 mr-2" />
                Resources
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate('/admin/canonical-codes')}>
                <Link2 className="h-4 w-4 mr-2" />
                Canonical Codes
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Search helper component that highlights matching text
function SearchableContent({ query, contentRef }: { query: string; contentRef: React.RefObject<HTMLDivElement> }) {
  useEffect(() => {
    if (!contentRef.current || !query) return;
    
    // Remove previous highlights
    const existingHighlights = contentRef.current.querySelectorAll('.search-highlight');
    existingHighlights.forEach(el => {
      const parent = el.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(el.textContent || ''), el);
        parent.normalize();
      }
    });
    
    // We could add highlighting logic here, but for now just show a result count
  }, [query, contentRef]);
  
  return null;
}
