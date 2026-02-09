import { describe, it, expect } from 'vitest';
import {
  getFeatureKeyForCapability,
  getCapabilitiesForFeature,
  DECISION_CAPABILITY_FEATURES,
} from '../decisionFeatureConfig';
import type { DecisionCapability } from '../decisionFeatureConfig';

describe('getFeatureKeyForCapability', () => {
  it('returns basic feature key for basic capabilities', () => {
    expect(getFeatureKeyForCapability('core_decisions')).toBe('decision_toolkit_basic');
    expect(getFeatureKeyForCapability('options_pros_cons')).toBe('decision_toolkit_basic');
    expect(getFeatureKeyForCapability('basic_reflections')).toBe('decision_toolkit_basic');
    expect(getFeatureKeyForCapability('task_management')).toBe('decision_toolkit_basic');
  });

  it('returns advanced feature key for advanced capabilities', () => {
    expect(getFeatureKeyForCapability('advanced_frameworks')).toBe('decision_toolkit_advanced');
    expect(getFeatureKeyForCapability('values_alignment')).toBe('decision_toolkit_advanced');
    expect(getFeatureKeyForCapability('analytics_dashboard')).toBe('decision_toolkit_advanced');
    expect(getFeatureKeyForCapability('reminders_followups')).toBe('decision_toolkit_advanced');
    expect(getFeatureKeyForCapability('outcome_tracking')).toBe('decision_toolkit_advanced');
    expect(getFeatureKeyForCapability('decision_templates')).toBe('decision_toolkit_advanced');
    expect(getFeatureKeyForCapability('decision_journaling')).toBe('decision_toolkit_advanced');
    expect(getFeatureKeyForCapability('coach_sharing')).toBe('decision_toolkit_advanced');
  });

  it('covers all declared capabilities', () => {
    const allCapabilities = Object.keys(DECISION_CAPABILITY_FEATURES) as DecisionCapability[];
    allCapabilities.forEach((cap) => {
      const result = getFeatureKeyForCapability(cap);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });
});

describe('getCapabilitiesForFeature', () => {
  it('returns basic capabilities for basic feature key', () => {
    const capabilities = getCapabilitiesForFeature('decision_toolkit_basic');
    expect(capabilities).toContain('core_decisions');
    expect(capabilities).toContain('options_pros_cons');
    expect(capabilities).toContain('basic_reflections');
    expect(capabilities).toContain('task_management');
    expect(capabilities.length).toBe(4);
  });

  it('returns advanced capabilities for advanced feature key', () => {
    const capabilities = getCapabilitiesForFeature('decision_toolkit_advanced');
    expect(capabilities).toContain('advanced_frameworks');
    expect(capabilities).toContain('values_alignment');
    expect(capabilities).toContain('analytics_dashboard');
    expect(capabilities).toContain('reminders_followups');
    expect(capabilities).toContain('outcome_tracking');
    expect(capabilities).toContain('decision_templates');
    expect(capabilities).toContain('decision_journaling');
    expect(capabilities).toContain('coach_sharing');
    expect(capabilities.length).toBe(8);
  });

  it('returns empty array for unknown feature key', () => {
    const capabilities = getCapabilitiesForFeature('nonexistent_feature');
    expect(capabilities).toEqual([]);
  });

  it('returns empty array for empty string', () => {
    const capabilities = getCapabilitiesForFeature('');
    expect(capabilities).toEqual([]);
  });

  it('all capabilities are accounted for between basic and advanced', () => {
    const basic = getCapabilitiesForFeature('decision_toolkit_basic');
    const advanced = getCapabilitiesForFeature('decision_toolkit_advanced');
    const total = basic.length + advanced.length;
    expect(total).toBe(Object.keys(DECISION_CAPABILITY_FEATURES).length);
  });
});
