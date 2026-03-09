# Plan: Peer Scenario Presentations in Group Sessions

## Context

Group sessions are currently scheduling containers (date, location, participants, RSVP) without structured activities. The user wants some sessions to work like assignments: one group member **presents** a scenario solution, another member **assesses** it — enabling peer-to-peer learning.

**Key constraints:**
- **Member-driven** — leader, presenter, or assessor sets up the activity. No admin involvement needed.
- **Like a program assignment** — presenter uses an assignment type (structured form from `module_assignment_types`) to submit artifacts before the session, with file/link attachments.
- **Flexible scenario context** — topic can be a structured scenario template, a resource from the library, an external link, or just a title + description.
- **Flexible evaluation** — evaluator uses either a capability assessment rubric OR free-text feedback.
- **Self-nomination** — members volunteer for presenter/assessor roles.
- **Simple** — 1 presenter, 1 assessor per session activity.

**Existing infrastructure reused:**
- `module_assignment_types.structure` — JSON field definitions for structured forms (text, textarea, number, rating, checkbox, select)
- `capability_assessments` + `capability_snapshots` — evaluation rubrics and completed assessments
- `evaluation_relationship = "peer"` on `capability_snapshots` — existing peer assessment pattern
- Field rendering logic from `ModuleAssignmentForm.tsx` (`renderField` switch/case)
- Attachment pattern from `module_assignment_attachments` (link/file/image with Supabase Storage)

## Approach

Two new tables:
1. `group_session_activities` — links a session to a topic + assignment type + evaluation method, tracks presenter/assessor roles, stores presenter's form responses and evaluator feedback
2. `group_session_activity_attachments` — presenter's file/link attachments (same pattern as `module_assignment_attachments`)

Evaluation via capability assessment creates a `capability_snapshot` (existing table) with `evaluation_relationship = "peer"`. Free feedback is stored directly on the activity row.

All setup, volunteering, submission, and evaluation happens from the client-facing `GroupSessionDetail.tsx` page — no admin pages needed.

## Steps

### 1. Migration — `YYYYMMDDHHMMSS_add_peer_session_activities.sql`

**Table: `group_session_activities`**

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `session_id` | FK → `group_sessions` (UNIQUE) | One activity per session |
| `topic_title` | TEXT NOT NULL | Name/title of the scenario or topic |
| `topic_description` | TEXT, nullable | Additional context or instructions |
| `scenario_template_id` | FK → `scenario_templates`, nullable | Structured scenario as the topic |
| `resource_id` | FK → `resource_library`, nullable | Library resource as the topic |
| `resource_url` | TEXT, nullable | External link (Google Doc, etc.) as the topic |
| `assignment_type_id` | FK → `module_assignment_types`, nullable | Structured form for presenter's submission |
| `capability_assessment_id` | FK → `capability_assessments`, nullable | Rubric for evaluator (if not free feedback) |
| `presenter_user_id` | FK → `auth.users`, nullable | Self-nominated presenter |
| `assessor_user_id` | FK → `auth.users`, nullable | Self-nominated assessor |
| `responses` | JSONB, nullable | Presenter's form responses (fieldId → value, same format as `module_assignments.responses`) |
| `overall_comments` | TEXT, nullable | Presenter's additional comments |
| `submitted_at` | TIMESTAMPTZ, nullable | When presenter submitted |
| `scoring_snapshot_id` | FK → `capability_snapshots`, nullable | Evaluator's capability assessment result |
| `evaluator_notes` | TEXT, nullable | Free-text feedback (alternative to capability assessment) |
| `evaluated_at` | TIMESTAMPTZ, nullable | When evaluation was completed |
| `status` | TEXT CHECK | `open` → `presenter_assigned` → `submitted` → `assessor_assigned` → `evaluated` |
| `created_by` | FK → `auth.users` NOT NULL | Who set up the activity |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

**Table: `group_session_activity_attachments`**

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `activity_id` | FK → `group_session_activities` ON DELETE CASCADE | |
| `user_id` | FK → `auth.users` NOT NULL | Who added the attachment |
| `attachment_type` | TEXT CHECK (`link`, `file`, `image`) | |
| `title` | TEXT NOT NULL | |
| `description` | TEXT, nullable | |
| `url` | TEXT, nullable | For link-type attachments |
| `file_path` | TEXT, nullable | Supabase Storage path |
| `file_size` | BIGINT, nullable | |
| `mime_type` | TEXT, nullable | |
| `created_at` | TIMESTAMPTZ | |

**Storage bucket:** `peer-presentation-attachments` (INSERT via `INSERT INTO storage.buckets`)

**RLS policies (consolidated to avoid timeout):**
- `group_session_activities`: 2 policies — admin/instructor ALL; group members SELECT + INSERT + UPDATE (via SECURITY DEFINER function `is_group_member(session_id)`)
- `group_session_activity_attachments`: 2 policies — admin ALL; activity presenter/assessor SELECT + INSERT + DELETE
- Storage: authenticated users can upload/read from `peer-presentation-attachments` bucket

**SECURITY DEFINER function:** `is_session_group_member(p_session_id UUID)` — returns TRUE if `auth.uid()` is an active member of the group that owns the session.

### 2. Regenerate types

```bash
npm run push:migrations
npx supabase gen types typescript --project-id jtzcrirqflfnagceendt > src/integrations/supabase/types.ts
```

### 3. New hook — `src/hooks/useGroupSessionActivity.ts`

- `useGroupSessionActivity(sessionId)` — React Query hook fetching the activity + assignment type structure + capability assessment name
- Mutations:
  - `setupActivity({ topicTitle, topicDescription?, scenarioTemplateId?, resourceId?, resourceUrl?, assignmentTypeId?, capabilityAssessmentId? })` — creates activity row
  - `volunteerAsPresenter()` — sets `presenter_user_id`, status → `presenter_assigned`
  - `volunteerAsAssessor()` — sets `assessor_user_id`, status → `assessor_assigned`
  - `submitPresentation({ responses, overallComments })` — saves form data, status → `submitted`
  - `submitEvaluation({ scoringSnapshotId?, evaluatorNotes? })` — saves evaluation, status → `evaluated`

### 4. New component — `src/components/groups/sessions/SessionActivityCard.tsx`

Card displayed on `GroupSessionDetail.tsx` with states based on activity status:

**No activity yet:** "Add Presentation Activity" button → opens setup dialog:
- Topic title (required) + description (optional)
- Topic source (optional, pick one): scenario template picker, library resource picker, OR external URL
- Assignment type dropdown (optional, from `module_assignment_types` where `is_active = true`)
- Capability assessment dropdown (optional, from `capability_assessments` where `is_active = true`)
- Setup creator can also volunteer as presenter in one step

**Activity exists — `open`:** Shows topic info + "Volunteer as Presenter" button

**`presenter_assigned`:** Shows presenter name + assignment type form (same field types as `ModuleAssignmentForm`) + attachment management + "Submit" button. Only the presenter sees the editable form; others see "Waiting for submission."

**`submitted`:** Shows presenter's responses (read-only) + attachments. "Volunteer as Assessor" button visible to other members.

**`assessor_assigned`:** Shows assessor name + evaluation action:
- If `capability_assessment_id` is set: "Start Assessment" button → navigates to `/peer-evaluate/:activityId`
- If not: inline free-text feedback textarea + "Submit Feedback" button

**`evaluated`:** Shows completed state — presenter's submission + evaluator's feedback/assessment results

### 5. New component — `src/components/groups/sessions/PeerSubmissionForm.tsx`

Renders the assignment type's `structure` fields for the presenter:
- Same field types as `ModuleAssignmentForm.renderField`: text, textarea, number, rating, checkbox, select
- Responses stored as `{ [fieldId]: value }` JSONB
- Attachment management (add link / upload file / delete)
- Submit button disabled until all required fields are filled
- Read-only mode for viewing submitted responses

### 6. Peer evaluation page — `src/pages/client/PeerSessionEvaluationPage.tsx`

Route: `/peer-evaluate/:activityId`

- Fetches activity + validates current user is the designated assessor
- Shows presenter's submission (responses + attachments) as read-only context panel
- Renders capability assessment form (reusing `CapabilityAssessmentForm` or the assessment rendering from `SelfAssessmentPage`)
- Creates `capability_snapshot` with:
  - `user_id` = presenter
  - `evaluator_id` = current user (assessor)
  - `evaluation_relationship = "peer"`
  - `is_self_assessment = false`
- On complete: updates activity's `scoring_snapshot_id` and `status` → `evaluated`
- Back navigation → group session detail page

### 7. Integrate into `GroupSessionDetail.tsx`

`src/pages/client/GroupSessionDetail.tsx`:
- Import and render `<SessionActivityCard sessionId={session.id} groupId={session.group_id} />` below the participants section
- Visible to all group members

### 8. Route — `src/App.tsx`

Add `/peer-evaluate/:activityId` under client routes → lazy-loaded `PeerSessionEvaluationPage`

### 9. Verify + deploy

```bash
npm run verify
```

**Test flow:**
1. Member opens a group session detail page
2. Member clicks "Add Presentation Activity" → fills in topic + selects assignment type + optionally selects capability assessment
3. Member A volunteers as presenter
4. Member A fills in the assignment type form + attaches files/links → submits
5. Member B volunteers as assessor
6. If capability assessment is linked: Member B navigates to `/peer-evaluate/:activityId` and completes the assessment
7. If free feedback: Member B writes notes inline and submits
8. Activity shows as "Evaluated" with all details visible

## Files Modified/Created

| File | Change |
|------|--------|
| `supabase/migrations/YYYYMMDD_add_peer_session_activities.sql` | **New** — 2 tables, storage bucket, RLS, helper function |
| `src/integrations/supabase/types.ts` | Regenerated |
| `src/hooks/useGroupSessionActivity.ts` | **New** — activity query + 5 mutations |
| `src/components/groups/sessions/SessionActivityCard.tsx` | **New** — activity card with setup + volunteer + status UI |
| `src/components/groups/sessions/PeerSubmissionForm.tsx` | **New** — assignment type form + attachments for presenter |
| `src/pages/client/GroupSessionDetail.tsx` | Add `<SessionActivityCard>` |
| `src/pages/client/PeerSessionEvaluationPage.tsx` | **New** — peer evaluation page with capability assessment |
| `src/App.tsx` | Add `/peer-evaluate/:activityId` route |

## Risks & Mitigations

- **RLS policy count:** Capped at 2 per table (admin + member) using SECURITY DEFINER helper functions to avoid query timeouts.
- **Assignment type coupling:** Reusing `module_assignment_types` for form structure but NOT `module_assignments` table — keeps peer presentations decoupled from program modules.
- **Storage bucket:** New `peer-presentation-attachments` bucket avoids conflicts with existing module attachment policies.
- **Capability snapshot reuse:** Peer evaluations create snapshots with `evaluation_relationship = "peer"` — same pattern as existing `GroupPeerAssessmentsPanel`, so existing queries/views already handle this.
