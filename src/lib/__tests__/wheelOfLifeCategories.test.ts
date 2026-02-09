import { describe, it, expect } from 'vitest';
import {
  WHEEL_OF_LIFE_CATEGORIES,
  WHEEL_CATEGORY_DESCRIPTIONS,
  LEGACY_CATEGORY_MAPPING,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  getSnapshotRatings,
} from '../wheelOfLifeCategories';
import type { WheelCategory, WheelSnapshot } from '../wheelOfLifeCategories';

describe('WHEEL_OF_LIFE_CATEGORIES', () => {
  it('contains exactly 10 categories', () => {
    expect(Object.keys(WHEEL_OF_LIFE_CATEGORIES)).toHaveLength(10);
  });

  it('includes all expected category keys', () => {
    const expectedKeys: WheelCategory[] = [
      'health_fitness', 'career_business', 'finances', 'relationships',
      'personal_growth', 'fun_recreation', 'physical_environment',
      'family_friends', 'romance', 'contribution',
    ];
    expectedKeys.forEach(key => {
      expect(WHEEL_OF_LIFE_CATEGORIES).toHaveProperty(key);
    });
  });
});

describe('WHEEL_CATEGORY_DESCRIPTIONS', () => {
  it('has a description for every category', () => {
    const categories = Object.keys(WHEEL_OF_LIFE_CATEGORIES) as WheelCategory[];
    categories.forEach(cat => {
      expect(WHEEL_CATEGORY_DESCRIPTIONS[cat]).toBeDefined();
      expect(WHEEL_CATEGORY_DESCRIPTIONS[cat].length).toBeGreaterThan(0);
    });
  });
});

describe('LEGACY_CATEGORY_MAPPING', () => {
  it('maps old categories to new labels', () => {
    expect(LEGACY_CATEGORY_MAPPING.family_home).toBe('Family & Friends');
    expect(LEGACY_CATEGORY_MAPPING.financial_career).toBe('Career & Business');
    expect(LEGACY_CATEGORY_MAPPING.physical_health).toBe('Health & Fitness');
  });

  it('maps all 6 legacy categories', () => {
    expect(Object.keys(LEGACY_CATEGORY_MAPPING)).toHaveLength(6);
  });
});

describe('CATEGORY_LABELS', () => {
  it('includes all current categories', () => {
    const categories = Object.keys(WHEEL_OF_LIFE_CATEGORIES) as WheelCategory[];
    categories.forEach(cat => {
      expect(CATEGORY_LABELS[cat]).toBe(WHEEL_OF_LIFE_CATEGORIES[cat]);
    });
  });

  it('includes legacy category labels', () => {
    expect(CATEGORY_LABELS.family_home).toBe('Family & Home');
    expect(CATEGORY_LABELS.spiritual_ethical).toBe('Spiritual & Ethical');
  });
});

describe('CATEGORY_COLORS', () => {
  it('has a color for every category', () => {
    const categories = Object.keys(WHEEL_OF_LIFE_CATEGORIES) as WheelCategory[];
    categories.forEach(cat => {
      expect(CATEGORY_COLORS[cat]).toBeDefined();
      expect(CATEGORY_COLORS[cat]).toMatch(/^hsl\(var\(--chart-\d+\)\)$/);
    });
  });
});

describe('getSnapshotRatings', () => {
  const mockSnapshot: WheelSnapshot = {
    id: 'snap-1',
    user_id: 'user-1',
    snapshot_date: '2025-03-15',
    notes: null,
    shared_with_coach: false,
    health_fitness: 8,
    career_business: 7,
    finances: 6,
    relationships: 9,
    personal_growth: 5,
    fun_recreation: 4,
    physical_environment: 7,
    family_friends: 8,
    romance: 6,
    contribution: 3,
    created_at: '2025-03-15T10:00:00Z',
    updated_at: '2025-03-15T10:00:00Z',
  };

  it('returns 10 ratings', () => {
    const ratings = getSnapshotRatings(mockSnapshot);
    expect(ratings).toHaveLength(10);
  });

  it('includes category key, label, and value for each rating', () => {
    const ratings = getSnapshotRatings(mockSnapshot);
    ratings.forEach(rating => {
      expect(rating).toHaveProperty('category');
      expect(rating).toHaveProperty('label');
      expect(rating).toHaveProperty('value');
    });
  });

  it('maps correct values from snapshot', () => {
    const ratings = getSnapshotRatings(mockSnapshot);
    const healthRating = ratings.find(r => r.category === 'health_fitness');
    expect(healthRating?.value).toBe(8);
    expect(healthRating?.label).toBe('Health & Fitness');

    const contributionRating = ratings.find(r => r.category === 'contribution');
    expect(contributionRating?.value).toBe(3);
  });

  it('defaults null values to 0', () => {
    const snapshotWithNulls: WheelSnapshot = {
      ...mockSnapshot,
      health_fitness: null,
      finances: null,
    };
    const ratings = getSnapshotRatings(snapshotWithNulls);
    const healthRating = ratings.find(r => r.category === 'health_fitness');
    expect(healthRating?.value).toBe(0);
    const financesRating = ratings.find(r => r.category === 'finances');
    expect(financesRating?.value).toBe(0);
  });
});
