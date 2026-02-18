import { describe, it, expect } from "vitest";
import {
  parseQuestionTypes,
  validateTypeWeights,
  calculateDomainScore,
  calculateTypeScores,
  type QuestionTypeDefinition,
  type ScoredQuestion,
} from "../assessmentScoring";

// ── parseQuestionTypes ─────────────────────────────────────

describe("parseQuestionTypes", () => {
  it("returns null for null/undefined/empty input", () => {
    expect(parseQuestionTypes(null)).toBeNull();
    expect(parseQuestionTypes(undefined)).toBeNull();
    expect(parseQuestionTypes([])).toBeNull();
    expect(parseQuestionTypes("")).toBeNull();
  });

  it("parses valid question types", () => {
    const input = [
      { name: "Knowledge", weight: 30 },
      { name: "Judgement", weight: 50 },
      { name: "Communication", weight: 20 },
    ];
    const result = parseQuestionTypes(input);
    expect(result).toHaveLength(3);
    expect(result![0].name).toBe("Knowledge");
    expect(result![0].weight).toBe(30);
  });

  it("filters out invalid entries", () => {
    const input = [
      { name: "Valid", weight: 50 },
      { name: "", weight: 30 }, // empty name
      { name: "Zero", weight: 0 }, // zero weight
      { name: "Negative", weight: -10 }, // negative weight
      { foo: "bar" }, // missing fields
      null,
    ];
    const result = parseQuestionTypes(input);
    expect(result).toHaveLength(1);
    expect(result![0].name).toBe("Valid");
  });

  it("returns null when all entries are invalid", () => {
    const input = [{ name: "", weight: 0 }, null, { foo: "bar" }];
    expect(parseQuestionTypes(input)).toBeNull();
  });
});

// ── validateTypeWeights ────────────────────────────────────

describe("validateTypeWeights", () => {
  it("validates weights summing to 100", () => {
    const types: QuestionTypeDefinition[] = [
      { name: "A", weight: 30 },
      { name: "B", weight: 50 },
      { name: "C", weight: 20 },
    ];
    const result = validateTypeWeights(types);
    expect(result.valid).toBe(true);
    expect(result.total).toBe(100);
  });

  it("invalidates weights not summing to 100", () => {
    const types: QuestionTypeDefinition[] = [
      { name: "A", weight: 30 },
      { name: "B", weight: 50 },
    ];
    const result = validateTypeWeights(types);
    expect(result.valid).toBe(false);
    expect(result.total).toBe(80);
  });

  it("handles floating point precision", () => {
    const types: QuestionTypeDefinition[] = [
      { name: "A", weight: 33.33 },
      { name: "B", weight: 33.34 },
      { name: "C", weight: 33.33 },
    ];
    const result = validateTypeWeights(types);
    expect(result.valid).toBe(true);
  });
});

// ── calculateDomainScore ───────────────────────────────────

describe("calculateDomainScore", () => {
  it("returns zero for empty questions", () => {
    const result = calculateDomainScore([], null);
    expect(result.simpleAverage).toBe(0);
    expect(result.weightedAverage).toBeNull();
    expect(result.questionCount).toBe(0);
  });

  it("calculates simple average without question types", () => {
    const questions: ScoredQuestion[] = [
      { questionId: "q1", rating: 8, questionType: null, typeWeight: null },
      { questionId: "q2", rating: 6, questionType: null, typeWeight: null },
      { questionId: "q3", rating: 10, questionType: null, typeWeight: null },
    ];
    const result = calculateDomainScore(questions, null);
    expect(result.simpleAverage).toBe(8); // (8+6+10)/3
    expect(result.weightedAverage).toBeNull();
    expect(result.typeSubtotals).toHaveLength(0);
    expect(result.questionCount).toBe(3);
  });

  it("calculates weighted average with question types", () => {
    const types: QuestionTypeDefinition[] = [
      { name: "Knowledge", weight: 30 },
      { name: "Judgement", weight: 70 },
    ];
    const questions: ScoredQuestion[] = [
      { questionId: "q1", rating: 10, questionType: "Knowledge", typeWeight: null },
      { questionId: "q2", rating: 10, questionType: "Knowledge", typeWeight: null },
      { questionId: "q3", rating: 5, questionType: "Judgement", typeWeight: null },
      { questionId: "q4", rating: 5, questionType: "Judgement", typeWeight: null },
    ];
    const result = calculateDomainScore(questions, types);

    // Knowledge avg = 10, Judgement avg = 5
    // Weighted = (10 * 30/100) + (5 * 70/100) = 3 + 3.5 = 6.5
    expect(result.weightedAverage).toBeCloseTo(6.5, 2);
    expect(result.simpleAverage).toBe(7.5); // (10+10+5+5)/4
    expect(result.typeSubtotals).toHaveLength(2);
    expect(result.questionCount).toBe(4);

    const knowledgeSub = result.typeSubtotals.find((t) => t.typeName === "Knowledge");
    expect(knowledgeSub?.average).toBe(10);
    expect(knowledgeSub?.questionCount).toBe(2);

    const judgementSub = result.typeSubtotals.find((t) => t.typeName === "Judgement");
    expect(judgementSub?.average).toBe(5);
    expect(judgementSub?.questionCount).toBe(2);
  });

  it("handles untyped questions alongside typed ones", () => {
    const types: QuestionTypeDefinition[] = [
      { name: "Knowledge", weight: 60 },
    ];
    const questions: ScoredQuestion[] = [
      { questionId: "q1", rating: 10, questionType: "Knowledge", typeWeight: null },
      { questionId: "q2", rating: 4, questionType: null, typeWeight: null }, // untyped
    ];
    const result = calculateDomainScore(questions, types);

    // Knowledge avg = 10 (weight 60%), Untyped avg = 4 (remaining weight 40%)
    // Weighted = (10 * 60/100) + (4 * 40/100) = 6 + 1.6 = 7.6
    expect(result.weightedAverage).toBeCloseTo(7.6, 2);
    expect(result.typeSubtotals).toHaveLength(2);

    const untypedSub = result.typeSubtotals.find((t) => t.typeName === "Untyped");
    expect(untypedSub?.average).toBe(4);
    expect(untypedSub?.typeWeight).toBe(40);
  });

  it("falls back to simple average when all questions are untyped", () => {
    const types: QuestionTypeDefinition[] = [
      { name: "Knowledge", weight: 50 },
      { name: "Judgement", weight: 50 },
    ];
    const questions: ScoredQuestion[] = [
      { questionId: "q1", rating: 8, questionType: null, typeWeight: null },
      { questionId: "q2", rating: 6, questionType: null, typeWeight: null },
    ];
    const result = calculateDomainScore(questions, types);

    // All untyped → untyped gets remaining weight (100%)
    // Weighted = simple average = 7
    expect(result.weightedAverage).toBeCloseTo(7, 2);
    expect(result.typeSubtotals).toHaveLength(1);
    expect(result.typeSubtotals[0].typeName).toBe("Untyped");
    expect(result.typeSubtotals[0].typeWeight).toBe(100);
  });

  it("handles types with no matching questions", () => {
    const types: QuestionTypeDefinition[] = [
      { name: "Knowledge", weight: 50 },
      { name: "Judgement", weight: 50 },
    ];
    const questions: ScoredQuestion[] = [
      { questionId: "q1", rating: 8, questionType: "Knowledge", typeWeight: null },
    ];
    const result = calculateDomainScore(questions, types);

    // Only Knowledge has questions (avg 8, weight 50)
    // Judgement has no questions → not included
    // Total assigned weight = 50, so Knowledge gets normalized to 100%
    expect(result.weightedAverage).toBeCloseTo(8, 2);
    expect(result.typeSubtotals).toHaveLength(1);
  });
});

// ── calculateTypeScores ────────────────────────────────────

describe("calculateTypeScores", () => {
  it("returns empty array without types", () => {
    expect(calculateTypeScores([], [])).toHaveLength(0);
  });

  it("calculates cross-domain type averages", () => {
    const types: QuestionTypeDefinition[] = [
      { name: "Knowledge", weight: 40 },
      { name: "Judgement", weight: 60 },
    ];
    const questions: ScoredQuestion[] = [
      // Domain A
      { questionId: "a1", rating: 8, questionType: "Knowledge", typeWeight: null },
      { questionId: "a2", rating: 6, questionType: "Judgement", typeWeight: null },
      // Domain B
      { questionId: "b1", rating: 10, questionType: "Knowledge", typeWeight: null },
      { questionId: "b2", rating: 4, questionType: "Judgement", typeWeight: null },
    ];

    const scores = calculateTypeScores(questions, types);
    expect(scores).toHaveLength(2);

    const knowledge = scores.find((s) => s.typeName === "Knowledge");
    expect(knowledge?.average).toBe(9); // (8+10)/2
    expect(knowledge?.questionCount).toBe(2);

    const judgement = scores.find((s) => s.typeName === "Judgement");
    expect(judgement?.average).toBe(5); // (6+4)/2
    expect(judgement?.questionCount).toBe(2);
  });

  it("returns zero average for types with no questions", () => {
    const types: QuestionTypeDefinition[] = [
      { name: "Knowledge", weight: 50 },
      { name: "Unused", weight: 50 },
    ];
    const questions: ScoredQuestion[] = [
      { questionId: "q1", rating: 8, questionType: "Knowledge", typeWeight: null },
    ];

    const scores = calculateTypeScores(questions, types);
    const unused = scores.find((s) => s.typeName === "Unused");
    expect(unused?.average).toBe(0);
    expect(unused?.questionCount).toBe(0);
  });
});
