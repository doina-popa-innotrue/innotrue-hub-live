/**
 * Decision Toolkit Feature Configuration
 * 
 * This file maps decision-related capabilities to feature keys.
 * Adjust assignments here to change which features are included in each tier.
 * 
 * Feature keys:
 * - decision_toolkit_basic: Core decision and task management
 * - decision_toolkit_advanced: Advanced analysis, frameworks, and tracking
 */

export type DecisionCapability =
  | 'core_decisions'        // Create/edit decisions with status, importance, urgency
  | 'options_pros_cons'     // Add options with pros/cons lists
  | 'basic_reflections'     // Post-decision reflection
  | 'task_management'       // Eisenhower Matrix tasks
  | 'advanced_frameworks'   // Buyer's Model, 10-10-10, Internal Check, etc.
  | 'values_alignment'      // Link decisions to values with scoring
  | 'analytics_dashboard'   // Decision patterns, trends, accuracy
  | 'reminders_followups'   // Scheduled reminders and follow-ups
  | 'outcome_tracking'      // Expected vs actual outcomes
  | 'decision_templates'    // Pre-built templates
  | 'decision_journaling'   // Timestamped journal entries
  | 'coach_sharing';        // Share decisions with coach

/**
 * Maps each capability to its required feature key.
 * Change these assignments to move capabilities between tiers.
 */
export const DECISION_CAPABILITY_FEATURES: Record<DecisionCapability, string> = {
  // Basic tier capabilities
  core_decisions: 'decision_toolkit_basic',
  options_pros_cons: 'decision_toolkit_basic',
  basic_reflections: 'decision_toolkit_basic',
  task_management: 'decision_toolkit_basic',
  
  // Advanced tier capabilities
  advanced_frameworks: 'decision_toolkit_advanced',
  values_alignment: 'decision_toolkit_advanced',
  analytics_dashboard: 'decision_toolkit_advanced',
  reminders_followups: 'decision_toolkit_advanced',
  outcome_tracking: 'decision_toolkit_advanced',
  decision_templates: 'decision_toolkit_advanced',
  decision_journaling: 'decision_toolkit_advanced',
  coach_sharing: 'decision_toolkit_advanced',
};

/**
 * Get the feature key required for a capability
 */
export function getFeatureKeyForCapability(capability: DecisionCapability): string {
  return DECISION_CAPABILITY_FEATURES[capability];
}

/**
 * Get all capabilities for a given feature key
 */
export function getCapabilitiesForFeature(featureKey: string): DecisionCapability[] {
  return (Object.entries(DECISION_CAPABILITY_FEATURES) as [DecisionCapability, string][])
    .filter(([_, key]) => key === featureKey)
    .map(([capability]) => capability);
}
