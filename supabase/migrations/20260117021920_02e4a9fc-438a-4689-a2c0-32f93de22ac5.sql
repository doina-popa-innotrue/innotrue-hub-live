-- First, let's set up plan credit allowances based on plan tier
-- This represents the total monthly credits each plan provides

-- Update plan credit allowances (using weighted sum of feature limits)
-- Free: 5+5+3+1 = 14 credits (scaled: ~20)
-- Base: 50+50+5+3 = 108 credits (scaled: ~150)
-- Pro: 100+100+5+1+1 = 207 credits (scaled: ~250)
-- Advanced: 200+200+2+1 = 403 credits (scaled: ~500)
-- Elite: 300+300+2+2 = 604 credits (scaled: ~750)

UPDATE plans SET credit_allowance = 20 WHERE name = 'Free';
UPDATE plans SET credit_allowance = 150 WHERE name = 'Base';
UPDATE plans SET credit_allowance = 250 WHERE name = 'Pro';
UPDATE plans SET credit_allowance = 500 WHERE name = 'Advanced';
UPDATE plans SET credit_allowance = 750 WHERE name = 'Elite';

-- Insert credit services for all consumable features
-- Category: ai - AI features (1 credit per use)
INSERT INTO credit_services (name, description, credit_cost, category, feature_id, is_active)
SELECT 'AI Insight', 'Generate an AI insight for decisions', 1, 'ai', id, true
FROM features WHERE key = 'ai_insights'
ON CONFLICT DO NOTHING;

INSERT INTO credit_services (name, description, credit_cost, category, feature_id, is_active)
SELECT 'AI Recommendation', 'Generate an AI recommendation', 1, 'ai', id, true
FROM features WHERE key = 'ai_recommendations'
ON CONFLICT DO NOTHING;

-- Category: sessions - Session types (higher credit costs)
INSERT INTO credit_services (name, description, credit_cost, category, feature_id, is_active)
SELECT 'Coaching Session', 'Book a 1:1 coaching session', 10, 'sessions', id, true
FROM features WHERE key = 'session_coaching'
ON CONFLICT DO NOTHING;

INSERT INTO credit_services (name, description, credit_cost, category, feature_id, is_active)
SELECT 'Group Session', 'Join a group session', 5, 'sessions', id, true
FROM features WHERE key = 'session_group'
ON CONFLICT DO NOTHING;

INSERT INTO credit_services (name, description, credit_cost, category, feature_id, is_active)
SELECT 'Peer Coaching Session', 'Participate in peer coaching', 3, 'sessions', id, true
FROM features WHERE key = 'session_peer_coaching'
ON CONFLICT DO NOTHING;

INSERT INTO credit_services (name, description, credit_cost, category, feature_id, is_active)
SELECT 'Workshop', 'Attend a workshop session', 8, 'sessions', id, true
FROM features WHERE key = 'session_workshop'
ON CONFLICT DO NOTHING;

INSERT INTO credit_services (name, description, credit_cost, category, feature_id, is_active)
SELECT 'Review Board Session', 'Participate in a review board', 15, 'sessions', id, true
FROM features WHERE key = 'session_review_board'
ON CONFLICT DO NOTHING;

-- Category: programs - Program enrollments
INSERT INTO credit_services (name, description, credit_cost, category, feature_id, is_active)
SELECT 'Base Program Enrollment', 'Enroll in a base program', 25, 'programs', id, true
FROM features WHERE key = 'programs_base'
ON CONFLICT DO NOTHING;

INSERT INTO credit_services (name, description, credit_cost, category, feature_id, is_active)
SELECT 'Pro Program Enrollment', 'Enroll in a pro program', 50, 'programs', id, true
FROM features WHERE key = 'programs_pro'
ON CONFLICT DO NOTHING;

INSERT INTO credit_services (name, description, credit_cost, category, feature_id, is_active)
SELECT 'Advanced Program Enrollment', 'Enroll in an advanced program', 100, 'programs', id, true
FROM features WHERE key = 'programs_advanced'
ON CONFLICT DO NOTHING;

INSERT INTO credit_services (name, description, credit_cost, category, feature_id, is_active)
SELECT 'Micro-learning Course', 'Access a micro-learning or short program', 5, 'programs', id, true
FROM features WHERE key = 'courses_free'
ON CONFLICT DO NOTHING;

-- Category: specialty - Specialty features (SF CTA Review Board Mocks)
INSERT INTO credit_services (name, description, credit_cost, category, feature_id, is_active)
SELECT 'SF CTA Review Board Mock (Async)', 'Salesforce CTA Review Board Mock - Asynchronous', 75, 'specialty', id, true
FROM features WHERE key = 'sf_cta_rbm_full_asynch'
ON CONFLICT DO NOTHING;

INSERT INTO credit_services (name, description, credit_cost, category, feature_id, is_active)
SELECT 'SF CTA Review Board Mock (Live)', 'Salesforce CTA Review Board Mock - Live', 150, 'specialty', id, true
FROM features WHERE key = 'sf_cta_rbm_full_live'
ON CONFLICT DO NOTHING;

-- Category: goals - Goals feature
INSERT INTO credit_services (name, description, credit_cost, category, feature_id, is_active)
SELECT 'Goal Creation', 'Create a new goal', 2, 'goals', id, true
FROM features WHERE key = 'goals'
ON CONFLICT DO NOTHING;

-- Create plan_credit_allocations table to track feature-specific allocations per plan
-- This allows plans to specify how many credits are pre-allocated per feature category
CREATE TABLE IF NOT EXISTS plan_credit_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  monthly_allocation INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(plan_id, feature_key)
);

-- Enable RLS
ALTER TABLE plan_credit_allocations ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read allocations (needed for plan comparison)
CREATE POLICY "Anyone can read plan credit allocations"
  ON plan_credit_allocations FOR SELECT
  USING (true);

-- Only admins can modify
CREATE POLICY "Admins can manage plan credit allocations"
  ON plan_credit_allocations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Insert plan credit allocations based on existing plan_features limits
INSERT INTO plan_credit_allocations (plan_id, feature_key, monthly_allocation)
SELECT 
  pf.plan_id,
  f.key,
  pf.limit_value
FROM plan_features pf
JOIN features f ON pf.feature_id = f.id
WHERE pf.limit_value IS NOT NULL
ON CONFLICT (plan_id, feature_key) DO UPDATE SET
  monthly_allocation = EXCLUDED.monthly_allocation,
  updated_at = now();