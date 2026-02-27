// Industry-standard 10 Wheel of Life categories
// Keys match column names in wheel_of_life_snapshots table
export const WHEEL_OF_LIFE_CATEGORIES = {
  health_fitness: "Health & Well-being",
  career_business: "Career & Work",
  finances: "Finances",
  relationships: "Relationships",
  personal_growth: "Personal Growth",
  fun_recreation: "Fun & Recreation",
  physical_environment: "Physical Environment",
  spirituality: "Spirituality & Faith",
  romance: "Love & Intimacy",
  contribution: "Contribution & Service",
} as const;

export type WheelCategory = keyof typeof WHEEL_OF_LIFE_CATEGORIES;

// Short descriptions for each category
export const WHEEL_CATEGORY_DESCRIPTIONS: Record<WheelCategory, string> = {
  health_fitness:
    "Your physical health, emotional wellness, energy levels, and overall well-being.",
  career_business:
    "Your professional life, job satisfaction, career growth, and work achievements.",
  finances: "Your financial stability, savings, investments, and money management.",
  relationships: "Your connections with family, friends, colleagues, and social network.",
  personal_growth: "Your learning, self-improvement, skills development, and mindset.",
  fun_recreation: "Your hobbies, leisure activities, entertainment, and enjoyment of life.",
  physical_environment: "Your home, workspace, surroundings, and living conditions.",
  spirituality:
    "Your connection to something greater, sources of meaning, and spiritual practices.",
  romance: "Your romantic relationship, intimacy, and partnership satisfaction.",
  contribution:
    "Your impact on others, community involvement, volunteer work, and sense of purpose.",
};

// Mapping old categories to new ones for display purposes
export const LEGACY_CATEGORY_MAPPING: Record<string, string> = {
  family_home: "Relationships",
  family_friends: "Relationships",
  financial_career: "Career & Work",
  mental_educational: "Personal Growth",
  spiritual_ethical: "Spirituality & Faith",
  social_cultural: "Relationships",
  physical_health: "Health & Well-being",
};

// Combined labels for backward compatibility in display
export const CATEGORY_LABELS: Record<string, string> = {
  ...WHEEL_OF_LIFE_CATEGORIES,
  // Legacy categories
  family_home: "Family & Home",
  family_friends: "Family & Friends",
  financial_career: "Financial & Career",
  mental_educational: "Mental & Educational",
  spiritual_ethical: "Spiritual & Ethical",
  social_cultural: "Social & Cultural",
  physical_health: "Physical & Health",
};

// Colors for each category (using HSL values from design system)
export const CATEGORY_COLORS: Record<WheelCategory, string> = {
  health_fitness: "hsl(var(--chart-1))",
  career_business: "hsl(var(--chart-2))",
  finances: "hsl(var(--chart-3))",
  relationships: "hsl(var(--chart-4))",
  personal_growth: "hsl(var(--chart-5))",
  fun_recreation: "hsl(var(--chart-1))",
  physical_environment: "hsl(var(--chart-2))",
  spirituality: "hsl(var(--chart-3))",
  romance: "hsl(var(--chart-4))",
  contribution: "hsl(var(--chart-5))",
};

export interface WheelSnapshot {
  id: string;
  user_id: string;
  snapshot_date: string;
  notes: string | null;
  shared_with_coach: boolean;
  health_fitness: number | null;
  career_business: number | null;
  finances: number | null;
  relationships: number | null;
  personal_growth: number | null;
  fun_recreation: number | null;
  physical_environment: number | null;
  spirituality: number | null;
  romance: number | null;
  contribution: number | null;
  // Legacy column — kept for backward compat with old snapshots
  family_friends?: number | null;
  created_at: string;
  updated_at: string;
}

export function getSnapshotRatings(
  snapshot: WheelSnapshot,
): { category: WheelCategory; label: string; value: number }[] {
  const categories = Object.keys(WHEEL_OF_LIFE_CATEGORIES) as WheelCategory[];
  return categories.map((cat) => ({
    category: cat,
    label: WHEEL_OF_LIFE_CATEGORIES[cat],
    value: snapshot[cat] || 0,
  }));
}
