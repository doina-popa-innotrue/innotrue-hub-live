// Standard 10 Wheel of Life categories
export const WHEEL_OF_LIFE_CATEGORIES = {
  health_fitness: "Health & Fitness",
  career_business: "Career & Business",
  finances: "Finances",
  relationships: "Relationships",
  personal_growth: "Personal Growth",
  fun_recreation: "Fun & Recreation",
  physical_environment: "Physical Environment",
  family_friends: "Family & Friends",
  romance: "Romance",
  contribution: "Contribution",
} as const;

export type WheelCategory = keyof typeof WHEEL_OF_LIFE_CATEGORIES;

// Short descriptions for each category
export const WHEEL_CATEGORY_DESCRIPTIONS: Record<WheelCategory, string> = {
  health_fitness: "Your physical health, energy levels, exercise habits, and overall wellness.",
  career_business:
    "Your professional life, job satisfaction, career growth, and work achievements.",
  finances: "Your financial stability, savings, investments, and money management.",
  relationships: "Your connections with colleagues, acquaintances, and social network.",
  personal_growth: "Your learning, self-improvement, skills development, and mindset.",
  fun_recreation: "Your hobbies, leisure activities, entertainment, and enjoyment of life.",
  physical_environment: "Your home, workspace, surroundings, and living conditions.",
  family_friends: "Your close relationships with family members and close friends.",
  romance: "Your romantic relationship, intimacy, and partnership satisfaction.",
  contribution: "Your impact on others, community involvement, and sense of purpose.",
};

// Mapping old categories to new ones for display purposes
export const LEGACY_CATEGORY_MAPPING: Record<string, string> = {
  family_home: "Family & Friends",
  financial_career: "Career & Business",
  mental_educational: "Personal Growth",
  spiritual_ethical: "Contribution",
  social_cultural: "Relationships",
  physical_health: "Health & Fitness",
};

// Combined labels for backward compatibility in display
export const CATEGORY_LABELS: Record<string, string> = {
  ...WHEEL_OF_LIFE_CATEGORIES,
  // Legacy categories
  family_home: "Family & Home",
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
  family_friends: "hsl(var(--chart-3))",
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
  family_friends: number | null;
  romance: number | null;
  contribution: number | null;
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
