import { describe, it, expect } from "vitest";
import {
  getIcd10CodesForCondition,
  getIcd10TitlesForCondition,
  findConditionsByIcd10,
  looksLikeIcd10,
  conditionIcd10Map,
  icd10Dictionary,
} from "./icd10Dictionary";

describe("icd10Dictionary", () => {
  it("maps known condition labels to ICD-10 codes", () => {
    expect(getIcd10CodesForCondition("Pulmonary Embolism")).toContain("I26.99");
    expect(getIcd10CodesForCondition("Unknown Condition")).toEqual([]);
  });

  it("resolves code titles for a condition", () => {
    const titles = getIcd10TitlesForCondition("Pulmonary Embolism");
    expect(titles.length).toBeGreaterThan(0);
    expect(titles.join(" ")).toMatch(/pulmonary embolism/i);
  });

  it("finds conditions by ICD-10 code prefix, case-insensitively", () => {
    expect(findConditionsByIcd10("I26")).toContain("Pulmonary Embolism");
    expect(findConditionsByIcd10("i26.99")).toContain("Pulmonary Embolism");
    expect(findConditionsByIcd10("ZZZ99")).toEqual([]);
  });

  it("recognizes ICD-10-shaped queries", () => {
    expect(looksLikeIcd10("I26.99")).toBe(true);
    expect(looksLikeIcd10("J18")).toBe(true);
    expect(looksLikeIcd10("chest pain")).toBe(false);
  });

  it("every mapped code resolves to a dictionary entry", () => {
    const dangling = Object.entries(conditionIcd10Map).flatMap(([label, codes]) =>
      codes.filter(code => !icd10Dictionary[code]).map(code => `${label}: ${code}`)
    );
    expect(dangling).toEqual([]);
  });
});
