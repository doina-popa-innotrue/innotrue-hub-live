/**
 * Assessment Scoring Utilities
 *
 * Provides scoring logic for capability assessments with optional
 * question-type-based weighted scoring (R1).
 *
 * Two modes:
 * 1. Simple average (no question types) — current behavior, backward compatible
 * 2. Weighted by question type — when assessment has question_types configured
 */

// ── Types ──────────────────────────────────────────────────

export interface QuestionTypeDefinition {
  name: string;
  weight: number; // percentage (should sum to 100 across all types)
}

export interface ScoredQuestion {
  questionId: string;
  rating: number;
  questionType: string | null;
  typeWeight: number | null; // per-question override
}

export interface TypeSubtotal {
  typeName: string;
  typeWeight: number;
  average: number;
  questionCount: number;
}

export interface DomainScore {
  domainId: string;
  simpleAverage: number;
  weightedAverage: number | null; // null when no types configured
  typeSubtotals: TypeSubtotal[];
  questionCount: number;
}

export interface AssessmentTypeScore {
  typeName: string;
  typeWeight: number;
  average: number; // average across ALL domains for this type
  questionCount: number;
}

// ── Parsing ────────────────────────────────────────────────

/**
 * Safely parse question_types JSONB from the database.
 * Returns null if invalid or empty.
 */
export function parseQuestionTypes(
  raw: unknown,
): QuestionTypeDefinition[] | null {
  if (!raw || !Array.isArray(raw)) return null;
  const types = raw.filter(
    (t): t is QuestionTypeDefinition =>
      typeof t === "object" &&
      t !== null &&
      typeof t.name === "string" &&
      t.name.trim().length > 0 &&
      typeof t.weight === "number" &&
      t.weight > 0,
  );
  return types.length > 0 ? types : null;
}

/**
 * Check if question types weights sum to 100 (with tolerance).
 */
export function validateTypeWeights(
  types: QuestionTypeDefinition[],
): { valid: boolean; total: number } {
  const total = types.reduce((sum, t) => sum + t.weight, 0);
  return { valid: Math.abs(total - 100) < 0.01, total };
}

// ── Domain Scoring ─────────────────────────────────────────

/**
 * Calculate the score for a single domain.
 *
 * Without types: simple average of all question ratings.
 * With types: weighted average where each type's average contributes
 * proportionally to its weight.
 *
 * Questions with no question_type are grouped as "Untyped".
 * If all questions are untyped, falls back to simple average.
 */
export function calculateDomainScore(
  questions: ScoredQuestion[],
  questionTypes: QuestionTypeDefinition[] | null,
): DomainScore & { domainId: string } {
  if (questions.length === 0) {
    return {
      domainId: "",
      simpleAverage: 0,
      weightedAverage: null,
      typeSubtotals: [],
      questionCount: 0,
    };
  }

  // Simple average (always calculated)
  const simpleAverage =
    questions.reduce((sum, q) => sum + q.rating, 0) / questions.length;

  // If no types configured, return simple average only
  if (!questionTypes || questionTypes.length === 0) {
    return {
      domainId: "",
      simpleAverage,
      weightedAverage: null,
      typeSubtotals: [],
      questionCount: questions.length,
    };
  }

  // Group questions by type
  const grouped = new Map<string, ScoredQuestion[]>();
  for (const q of questions) {
    const key = q.questionType || "__untyped__";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(q);
  }

  // Calculate per-type averages
  const typeSubtotals: TypeSubtotal[] = [];
  let totalAssignedWeight = 0;

  for (const typeDef of questionTypes) {
    const typeQuestions = grouped.get(typeDef.name);
    if (typeQuestions && typeQuestions.length > 0) {
      const avg =
        typeQuestions.reduce((sum, q) => sum + q.rating, 0) /
        typeQuestions.length;
      typeSubtotals.push({
        typeName: typeDef.name,
        typeWeight: typeDef.weight,
        average: avg,
        questionCount: typeQuestions.length,
      });
      totalAssignedWeight += typeDef.weight;
    }
  }

  // Handle untyped questions
  const untypedQuestions = grouped.get("__untyped__");
  if (untypedQuestions && untypedQuestions.length > 0) {
    const untypedAvg =
      untypedQuestions.reduce((sum, q) => sum + q.rating, 0) /
      untypedQuestions.length;
    const remainingWeight = Math.max(0, 100 - totalAssignedWeight);
    typeSubtotals.push({
      typeName: "Untyped",
      typeWeight: remainingWeight,
      average: untypedAvg,
      questionCount: untypedQuestions.length,
    });
    totalAssignedWeight += remainingWeight;
  }

  // Calculate weighted average
  let weightedAverage: number;
  if (totalAssignedWeight > 0) {
    weightedAverage =
      typeSubtotals.reduce(
        (sum, ts) => sum + ts.average * (ts.typeWeight / totalAssignedWeight),
        0,
      );
  } else {
    weightedAverage = simpleAverage;
  }

  return {
    domainId: "",
    simpleAverage,
    weightedAverage,
    typeSubtotals,
    questionCount: questions.length,
  };
}

// ── Cross-Domain Type Scores ───────────────────────────────

/**
 * Calculate per-type averages across ALL domains.
 * Used for the "View by Question Types" radar chart mode.
 */
export function calculateTypeScores(
  allQuestions: ScoredQuestion[],
  questionTypes: QuestionTypeDefinition[],
): AssessmentTypeScore[] {
  if (!questionTypes || questionTypes.length === 0) return [];

  const scores: AssessmentTypeScore[] = [];

  for (const typeDef of questionTypes) {
    const typeQuestions = allQuestions.filter(
      (q) => q.questionType === typeDef.name,
    );
    if (typeQuestions.length > 0) {
      const avg =
        typeQuestions.reduce((sum, q) => sum + q.rating, 0) /
        typeQuestions.length;
      scores.push({
        typeName: typeDef.name,
        typeWeight: typeDef.weight,
        average: avg,
        questionCount: typeQuestions.length,
      });
    } else {
      scores.push({
        typeName: typeDef.name,
        typeWeight: typeDef.weight,
        average: 0,
        questionCount: 0,
      });
    }
  }

  return scores;
}
