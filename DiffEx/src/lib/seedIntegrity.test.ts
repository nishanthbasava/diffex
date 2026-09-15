import { describe, it, expect, beforeAll, vi } from "vitest";
import { seedIfEmpty, getConditions, getAllEdges } from "./differentialStore";
import { seedPriorsIfEmpty, getAllPriors } from "./priorsStore";

// Guards against silent seed-data drift: a condition without a prior row
// falls back to prior_base = 1.0, which massively outranks realistically
// seeded prevalences (0.001-0.10) in log-space scoring.

describe("seed data integrity", () => {
  beforeAll(() => {
    localStorage.clear();
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    seedIfEmpty();
    seedPriorsIfEmpty();
    logSpy.mockRestore();
  });

  it("every seeded condition has a prior row", () => {
    const priorIds = new Set(getAllPriors().map(p => p.condition_id));
    const missing = getConditions()
      .filter(c => !priorIds.has(c.id))
      .map(c => c.label);
    expect(missing).toEqual([]);
  });

  it("every seeded condition has at least one edge", () => {
    const edgeConditionIds = new Set(getAllEdges().map(e => e.condition_id));
    const missing = getConditions()
      .filter(c => !edgeConditionIds.has(c.id))
      .map(c => c.label);
    expect(missing).toEqual([]);
  });

  it("every prior row points at an existing condition", () => {
    const conditionIds = new Set(getConditions().map(c => c.id));
    const dangling = getAllPriors().filter(p => !conditionIds.has(p.condition_id));
    expect(dangling).toEqual([]);
  });
});
