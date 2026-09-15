import { describe, it, expect, beforeEach, vi } from "vitest";
import { computeDifferential } from "./computeDifferential";
import type { Condition, ConditionFeatureEdge } from "./differentialStore";
import { upsertFeature, upsertPatientEvidence } from "./evidenceStore";

// Build a small synthetic knowledge base directly in localStorage so tests
// are deterministic and independent of the full seed data.

const CONDITIONS_KEY = "diffex_conditions";
const EDGES_KEY = "diffex_condition_feature_edges";

function seedKB(conditions: Condition[], edges: ConditionFeatureEdge[]): void {
  localStorage.setItem(CONDITIONS_KEY, JSON.stringify(conditions));
  localStorage.setItem(EDGES_KEY, JSON.stringify(edges));
}

function mkCondition(id: string, overrides: Partial<Condition> = {}): Condition {
  return { id, label: id, category: null, acuteness: 0.5, prior_base: 1.0, ...overrides };
}

function addFinding(patientId: string, label: string, polarity: "present" | "absent" = "present"): string {
  const f = upsertFeature({
    canonical_label: label,
    feature_type: "symptom",
    value_type: "boolean",
    synonyms: [],
  });
  upsertPatientEvidence({
    patient_id: patientId,
    feature_id: f.id,
    polarity,
    value_boolean: polarity === "present",
    extracted_by: "manual",
  });
  return f.id;
}

describe("computeDifferential", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("returns empty results when there are no conditions", () => {
    addFinding("p1", "Fever");
    const out = computeDifferential("p1");
    expect(out.results).toEqual([]);
    expect(out.coverage.totalConditions).toBe(0);
  });

  it("returns empty results when the patient has no evidence", () => {
    seedKB([mkCondition("A")], []);
    const out = computeDifferential("p1");
    expect(out.results).toEqual([]);
    expect(out.coverage.evidenceCount).toBe(0);
  });

  it("ranks a condition with a stronger likelihood ratio higher", () => {
    const f1 = addFinding("p1", "Fever");
    seedKB(
      [mkCondition("Strong"), mkCondition("Weak")],
      [
        { condition_id: "Strong", feature_id: f1, lr_present: 5.0, lr_absent: 0.5 },
        { condition_id: "Weak", feature_id: f1, lr_present: 1.5, lr_absent: 0.9 },
      ]
    );
    const out = computeDifferential("p1");
    expect(out.results[0].label).toBe("Strong");
    expect(out.results[0].probabilityPercent).toBeGreaterThan(out.results[1].probabilityPercent);
  });

  it("penalizes a condition when evidence it expects is absent", () => {
    const f1 = addFinding("p1", "Fever", "present");
    const f2 = addFinding("p1", "Cough", "absent");
    seedKB(
      [mkCondition("Penalized"), mkCondition("Neutral")],
      [
        { condition_id: "Penalized", feature_id: f1, lr_present: 5.0, lr_absent: 0.5 },
        { condition_id: "Penalized", feature_id: f2, lr_present: 5.0, lr_absent: 0.2 },
        { condition_id: "Neutral", feature_id: f1, lr_present: 5.0, lr_absent: 0.5 },
        { condition_id: "Neutral", feature_id: f2, lr_present: 5.0, lr_absent: 1.0 },
      ]
    );
    const out = computeDifferential("p1");
    expect(out.results[0].label).toBe("Neutral");
  });

  it("penalizes conditions that cannot explain a present finding", () => {
    const f1 = addFinding("p1", "Fever");
    const f2 = addFinding("p1", "Cough");
    seedKB(
      [mkCondition("ExplainsBoth"), mkCondition("ExplainsOne")],
      [
        { condition_id: "ExplainsBoth", feature_id: f1, lr_present: 5.0, lr_absent: 0.5 },
        { condition_id: "ExplainsBoth", feature_id: f2, lr_present: 5.0, lr_absent: 0.5 },
        { condition_id: "ExplainsOne", feature_id: f1, lr_present: 5.0, lr_absent: 0.5 },
      ]
    );
    const out = computeDifferential("p1");
    expect(out.results[0].label).toBe("ExplainsBoth");
  });

  it("uses prior_base to break ties between equally supported conditions", () => {
    const f1 = addFinding("p1", "Fever");
    seedKB(
      [mkCondition("Common", { prior_base: 0.1 }), mkCondition("Rare", { prior_base: 0.001 })],
      [
        { condition_id: "Common", feature_id: f1, lr_present: 3.0, lr_absent: 0.5 },
        { condition_id: "Rare", feature_id: f1, lr_present: 3.0, lr_absent: 0.5 },
      ]
    );
    const out = computeDifferential("p1");
    expect(out.results[0].label).toBe("Common");
  });

  it("normalizes probabilities to sum to 100", () => {
    const f1 = addFinding("p1", "Fever");
    seedKB(
      [mkCondition("A"), mkCondition("B"), mkCondition("C")],
      [
        { condition_id: "A", feature_id: f1, lr_present: 4.0, lr_absent: 0.5 },
        { condition_id: "B", feature_id: f1, lr_present: 2.0, lr_absent: 0.7 },
        { condition_id: "C", feature_id: f1, lr_present: 1.2, lr_absent: 0.9 },
      ]
    );
    const out = computeDifferential("p1");
    const total = out.results.reduce((sum, r) => sum + r.probabilityPercent, 0);
    expect(total).toBeCloseTo(100, 6);
  });

  it("always includes safety-net conditions and drops unrelated ones from candidates", () => {
    const f1 = addFinding("p1", "Fever");
    const matching = ["A", "B", "C", "D", "E"].map(id => mkCondition(id));
    const conditions = [
      ...matching,
      mkCondition("sepsis", { label: "Sepsis" }), // safety net, no matching edge
      mkCondition("Zebra"), // no matching edge, not safety net
    ];
    const edges = matching.map(c => ({
      condition_id: c.id, feature_id: f1, lr_present: 2.0, lr_absent: 0.7,
    }));
    seedKB(conditions, edges);

    const out = computeDifferential("p1");
    const labels = out.results.map(r => r.label);
    expect(labels).toContain("Sepsis");
    expect(labels).not.toContain("Zebra");
    expect(out.coverage.candidateCount).toBe(6);
  });

  it("falls back to scoring all conditions when too few candidates match", () => {
    const f1 = addFinding("p1", "Fever");
    seedKB(
      [mkCondition("Match"), mkCondition("NoMatch")],
      [{ condition_id: "Match", feature_id: f1, lr_present: 3.0, lr_absent: 0.5 }]
    );
    const out = computeDifferential("p1");
    expect(out.results.map(r => r.label)).toContain("NoMatch");
    expect(out.coverage.lowCoverage).toBe(true);
  });

  it("reports coverage of evidence matched by knowledge-base edges", () => {
    const f1 = addFinding("p1", "Fever");
    const f2 = addFinding("p1", "Cough");
    addFinding("p1", "Mystery finding"); // no edges anywhere
    seedKB(
      [mkCondition("A")],
      [
        { condition_id: "A", feature_id: f1, lr_present: 3.0, lr_absent: 0.5 },
        { condition_id: "A", feature_id: f2, lr_present: 2.0, lr_absent: 0.7 },
      ]
    );
    const out = computeDifferential("p1");
    expect(out.coverage.matchedEdgeCount).toBe(2);
    expect(out.coverage.evidenceCount).toBe(3);
    expect(out.coverage.coverageRatio).toBeCloseTo(2 / 3);
  });

  it("exposes per-diagnosis evidence contributions", () => {
    const f1 = addFinding("p1", "Fever");
    seedKB(
      [mkCondition("A")],
      [{ condition_id: "A", feature_id: f1, lr_present: 4.0, lr_absent: 0.5 }]
    );
    const out = computeDifferential("p1");
    const top = out.results[0];
    expect(top.boosts).toHaveLength(1);
    expect(top.boosts[0].feature_label).toBe("Fever");
    expect(top.boosts[0].lr_used).toBe(4.0);
    expect(top.contributingFeatures[0]).toContain("Fever");
  });

  it("reports a positive run duration", () => {
    const f1 = addFinding("p1", "Fever");
    seedKB(
      [mkCondition("A")],
      [{ condition_id: "A", feature_id: f1, lr_present: 3.0, lr_absent: 0.5 }]
    );
    const out = computeDifferential("p1");
    expect(out.durationMs).toBeGreaterThan(0);
  });
});
