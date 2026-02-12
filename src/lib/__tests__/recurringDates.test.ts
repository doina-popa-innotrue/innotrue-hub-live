import { describe, it, expect } from "vitest";
import {
  getNextRecurringDate,
  generateRecurringDates,
  generateRecurringDatesSimple,
} from "../recurringDates";
import { addDays, addWeeks, addMonths, differenceInDays } from "date-fns";

describe("getNextRecurringDate", () => {
  const baseDate = new Date("2026-03-01T10:00:00Z");

  it("adds 1 day for daily pattern", () => {
    const result = getNextRecurringDate(baseDate, "daily");
    expect(result.getTime()).toBe(addDays(baseDate, 1).getTime());
  });

  it("adds 1 week for weekly pattern", () => {
    const result = getNextRecurringDate(baseDate, "weekly");
    expect(result.getTime()).toBe(addWeeks(baseDate, 1).getTime());
  });

  it("adds 2 weeks for bi-weekly pattern", () => {
    const result = getNextRecurringDate(baseDate, "bi-weekly");
    expect(result.getTime()).toBe(addWeeks(baseDate, 2).getTime());
  });

  it("adds 1 month for monthly pattern", () => {
    const result = getNextRecurringDate(baseDate, "monthly");
    expect(result.getTime()).toBe(addMonths(baseDate, 1).getTime());
  });

  it("defaults to weekly for unknown pattern", () => {
    const result = getNextRecurringDate(baseDate, "unknown-pattern");
    expect(result.getTime()).toBe(addWeeks(baseDate, 1).getTime());
  });

  it("is case-insensitive", () => {
    const result = getNextRecurringDate(baseDate, "DAILY");
    expect(result.getTime()).toBe(addDays(baseDate, 1).getTime());
  });

  it("does not mutate the original date", () => {
    const original = new Date("2026-03-01T10:00:00Z");
    const originalTime = original.getTime();
    getNextRecurringDate(original, "daily");
    expect(original.getTime()).toBe(originalTime);
  });
});

describe("generateRecurringDates", () => {
  const startDate = new Date("2026-03-01T10:00:00Z");

  // --- Count-based generation ---
  it("generates correct number of dates with count-based end type", () => {
    const dates = generateRecurringDates({
      startDate,
      pattern: "weekly",
      endType: "count",
      count: 5,
      maxLimit: 10,
    });
    // count=5, so effectiveMax=5, loop generates up to effectiveMax-1=4 dates
    expect(dates.length).toBe(4);
  });

  it("respects maxLimit when count exceeds it", () => {
    const dates = generateRecurringDates({
      startDate,
      pattern: "weekly",
      endType: "count",
      count: 100,
      maxLimit: 5,
    });
    // effectiveMax = min(100, 5) = 5, generates up to 4
    expect(dates.length).toBe(4);
  });

  it("excludes the start date (master session)", () => {
    const dates = generateRecurringDates({
      startDate,
      pattern: "weekly",
      endType: "count",
      count: 3,
      maxLimit: 10,
    });
    dates.forEach((date) => {
      expect(date.getTime()).not.toBe(startDate.getTime());
    });
  });

  it("generates weekly dates in correct sequence", () => {
    const dates = generateRecurringDates({
      startDate,
      pattern: "weekly",
      endType: "count",
      count: 4,
      maxLimit: 10,
    });
    // Each date should be 7 days after the previous
    for (let i = 1; i < dates.length; i++) {
      expect(differenceInDays(dates[i], dates[i - 1])).toBe(7);
    }
    // First date should be 7 days after start
    expect(differenceInDays(dates[0], startDate)).toBe(7);
  });

  it("generates daily dates in correct sequence", () => {
    const dates = generateRecurringDates({
      startDate,
      pattern: "daily",
      endType: "count",
      count: 4,
      maxLimit: 10,
    });
    for (let i = 1; i < dates.length; i++) {
      expect(differenceInDays(dates[i], dates[i - 1])).toBe(1);
    }
  });

  // --- Date-based generation ---
  it("stops at endDate for date-based end type", () => {
    const endDate = addWeeks(startDate, 3).toISOString();
    const dates = generateRecurringDates({
      startDate,
      pattern: "weekly",
      endType: "date",
      endDate,
      maxLimit: 100,
    });
    // Should generate 2 dates: week 1 and week 2 (week 3 = endDate, week 4 > endDate)
    dates.forEach((date) => {
      expect(date.getTime()).toBeLessThanOrEqual(new Date(endDate).getTime());
    });
    expect(dates.length).toBeGreaterThan(0);
  });

  it("respects 6-month safety limit", () => {
    const dates = generateRecurringDates({
      startDate,
      pattern: "weekly",
      endType: "date",
      endDate: addMonths(startDate, 12).toISOString(), // 12 months out
      maxLimit: 1000,
    });
    // All dates should be within 6 months of start
    const sixMonthsLater = addMonths(startDate, 6);
    dates.forEach((date) => {
      expect(date.getTime()).toBeLessThanOrEqual(sixMonthsLater.getTime());
    });
  });

  it("returns empty array when endDate is before first recurrence", () => {
    const endDate = startDate.toISOString(); // Same as start
    const dates = generateRecurringDates({
      startDate,
      pattern: "weekly",
      endType: "date",
      endDate,
      maxLimit: 10,
    });
    expect(dates.length).toBe(0);
  });

  // --- Default values ---
  it("defaults to count=4 and endType=count", () => {
    const dates = generateRecurringDates({
      startDate,
      pattern: "weekly",
      maxLimit: 10,
    });
    // Default count=4, effectiveMax=4, generates 3
    expect(dates.length).toBe(3);
  });

  // --- Returns new Date instances ---
  it("returns new Date instances (not references)", () => {
    const dates = generateRecurringDates({
      startDate,
      pattern: "weekly",
      endType: "count",
      count: 3,
      maxLimit: 10,
    });
    // Each date should be a unique instance
    for (let i = 0; i < dates.length; i++) {
      for (let j = i + 1; j < dates.length; j++) {
        expect(dates[i]).not.toBe(dates[j]);
      }
    }
  });
});

describe("generateRecurringDatesSimple", () => {
  const startDate = new Date("2026-03-01T10:00:00Z");

  it("delegates to generateRecurringDates with endType=date", () => {
    const endDate = addWeeks(startDate, 5).toISOString();
    const dates = generateRecurringDatesSimple(startDate, "weekly", endDate, 100);
    expect(dates.length).toBeGreaterThan(0);
    dates.forEach((date) => {
      expect(date.getTime()).toBeLessThanOrEqual(new Date(endDate).getTime());
    });
  });

  it("handles null endDate", () => {
    const dates = generateRecurringDatesSimple(startDate, "weekly", null, 10);
    // Should still generate dates (up to 6-month limit and maxLimit)
    expect(dates.length).toBeGreaterThan(0);
  });

  it("respects maxLimit", () => {
    const endDate = addMonths(startDate, 6).toISOString();
    const dates = generateRecurringDatesSimple(startDate, "daily", endDate, 5);
    expect(dates.length).toBeLessThanOrEqual(4); // maxLimit - 1
  });
});
