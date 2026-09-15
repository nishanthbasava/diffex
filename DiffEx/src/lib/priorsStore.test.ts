import { describe, it, expect, beforeEach } from "vitest";
import {
  derivePatientContext,
  getPriorWeightBreakdown,
  updatePrior,
  type PriorRow,
} from "./priorsStore";
import type { PatientEvidenceJoined } from "./evidenceStore";

function mkEv(overrides: Partial<PatientEvidenceJoined>): PatientEvidenceJoined {
  return {
    patient_id: "p1",
    feature_id: "f1",
    value_boolean: null,
    value_numeric: null,
    value_text: null,
    value_category: null,
    polarity: "present",
    source_spans: [],
    extracted_at: "2026-01-01T00:00:00.000Z",
    extracted_by: "manual",
    canonical_label: "Unknown",
    feature_type: "other",
    value_type: "text",
    ...overrides,
  };
}

const ageEv = (years: number) => mkEv({ canonical_label: "Age", value_numeric: years });

describe("derivePatientContext", () => {
  it("defaults to 40-64 / unknown when no context evidence", () => {
    const ctx = derivePatientContext([]);
    expect(ctx).toEqual({ age_bucket: "40-64", sex: "unknown", smoking: "unknown" });
  });

  it.each([
    [0.05, "neonate"],
    [0.5, "infant"],
    [5, "child"],
    [15, "adolescent"],
    [25, "18-39"],
    [50, "40-64"],
    [70, "65+"],
  ])("buckets age %s years as %s", (years, bucket) => {
    expect(derivePatientContext([ageEv(years as number)]).age_bucket).toBe(bucket);
  });

  it("parses sex from category values including single letters", () => {
    expect(derivePatientContext([mkEv({ canonical_label: "Sex", value_category: "Male" })]).sex).toBe("male");
    expect(derivePatientContext([mkEv({ canonical_label: "Sex", value_category: "f" })]).sex).toBe("female");
  });

  it("derives smoking status from smoking-labeled evidence polarity", () => {
    expect(derivePatientContext([mkEv({ canonical_label: "Smoking history", polarity: "present" })]).smoking).toBe("smoker");
    expect(derivePatientContext([mkEv({ canonical_label: "Smoking history", polarity: "absent" })]).smoking).toBe("non_smoker");
  });
});

describe("getPriorWeightBreakdown", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("falls back to the condition's own prior_base when no prior row exists", () => {
    const breakdown = getPriorWeightBreakdown("missing", [], 0.02);
    expect(breakdown.prior_weight).toBe(0.02);
    expect(breakdown.age_multiplier).toBe(1.0);
    expect(breakdown.sex_multiplier).toBe(1.0);
  });

  it("multiplies base prevalence by age, sex, and smoking multipliers", () => {
    const row: PriorRow = {
      condition_id: "c1",
      base_prevalence: 0.03,
      age_multipliers: { neonate: 1, infant: 1, child: 1, adolescent: 1, "18-39": 1, "40-64": 1, "65+": 2.0 },
      sex_multipliers: { male: 1.5, female: 1.0, unknown: 1.0 },
      smoking_multipliers: { smoker: 2.0, non_smoker: 1.0, unknown: 1.0 },
    };
    updatePrior(row);

    const evidence = [
      ageEv(70),
      mkEv({ canonical_label: "Sex", value_category: "male" }),
      mkEv({ canonical_label: "Smoking history", polarity: "present" }),
    ];
    const breakdown = getPriorWeightBreakdown("c1", evidence);
    expect(breakdown.age_bucket).toBe("65+");
    expect(breakdown.prior_weight).toBeCloseTo(0.03 * 2.0 * 1.5 * 2.0);
  });

  it("labels prevalence tiers from base prevalence", () => {
    const mkRow = (base: number): PriorRow => ({
      condition_id: `tier_${base}`,
      base_prevalence: base,
      age_multipliers: { neonate: 1, infant: 1, child: 1, adolescent: 1, "18-39": 1, "40-64": 1, "65+": 1 },
      sex_multipliers: { male: 1, female: 1, unknown: 1 },
      smoking_multipliers: { smoker: 1, non_smoker: 1, unknown: 1 },
    });
    updatePrior(mkRow(0.1));
    updatePrior(mkRow(0.001));
    expect(getPriorWeightBreakdown("tier_0.1", []).tier_label).toBe("very_common");
    expect(getPriorWeightBreakdown("tier_0.001", []).tier_label).toBe("very_rare");
  });
});
