import { describe, it, expect } from "vitest";
import {
  decisionTemplates,
  getTemplateById,
  getTemplatesByCategory,
  templateCategories,
} from "../decisionTemplates";

describe("decisionTemplates", () => {
  it("contains templates", () => {
    expect(decisionTemplates.length).toBeGreaterThan(0);
  });

  it("each template has required fields", () => {
    decisionTemplates.forEach((template) => {
      expect(template.id).toBeTruthy();
      expect(template.name).toBeTruthy();
      expect(template.description).toBeTruthy();
      expect(template.category).toBeTruthy();
      expect(template.icon).toBeTruthy();
      expect(["low", "medium", "high", "critical"]).toContain(template.defaultImportance);
      expect(template.defaultOptions.length).toBeGreaterThan(0);
      expect(template.defaultValues.length).toBeGreaterThan(0);
    });
  });

  it("all template IDs are unique", () => {
    const ids = decisionTemplates.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("each template has modelNotes object", () => {
    decisionTemplates.forEach((template) => {
      expect(template.modelNotes).toBeDefined();
      expect(typeof template.modelNotes).toBe("object");
    });
  });

  it("each template has reflectionPrompts object", () => {
    decisionTemplates.forEach((template) => {
      expect(template.reflectionPrompts).toBeDefined();
      expect(typeof template.reflectionPrompts).toBe("object");
    });
  });
});

describe("getTemplateById", () => {
  it("finds existing template", () => {
    const template = getTemplateById("career-change");
    expect(template).toBeDefined();
    expect(template?.name).toBe("Career Change");
  });

  it("returns undefined for non-existent ID", () => {
    expect(getTemplateById("non-existent")).toBeUndefined();
  });

  it("returns undefined for empty string", () => {
    expect(getTemplateById("")).toBeUndefined();
  });
});

describe("getTemplatesByCategory", () => {
  it("returns templates for a valid category", () => {
    const careerTemplates = getTemplatesByCategory("Career");
    expect(careerTemplates.length).toBeGreaterThan(0);
    careerTemplates.forEach((t) => {
      expect(t.category).toBe("Career");
    });
  });

  it("returns empty array for non-existent category", () => {
    expect(getTemplatesByCategory("NonExistent")).toEqual([]);
  });

  it("returns multiple templates when category has several", () => {
    const financialTemplates = getTemplatesByCategory("Financial");
    expect(financialTemplates.length).toBeGreaterThanOrEqual(1);
  });
});

describe("templateCategories", () => {
  it("contains unique category names", () => {
    const unique = new Set(templateCategories);
    expect(unique.size).toBe(templateCategories.length);
  });

  it("matches categories from templates", () => {
    const categoriesFromTemplates = new Set(decisionTemplates.map((t) => t.category));
    expect(templateCategories.sort()).toEqual([...categoriesFromTemplates].sort());
  });
});
