import { describe, it, expect, vi } from "vitest";
import { runEval, formatReport } from "./runEval";

describe("vignette evaluation", () => {
  // Silence the engine's per-run console noise; print only the report.
  const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  const report = runEval();
  logSpy.mockRestore();

  // eslint-disable-next-line no-console
  console.log(formatReport(report));

  it("every expected diagnosis exists in the knowledge base", () => {
    expect(report.missingConditions).toEqual([]);
  });

  it("every vignette finding maps to a registry feature", () => {
    const unmapped = report.results.flatMap(r =>
      r.unmappedFindings.map(f => `${r.id}: ${f}`)
    );
    expect(unmapped).toEqual([]);
  });

  it("produces a ranking for every vignette", () => {
    const misses = report.results.filter(r => r.engineRank == null).map(r => r.id);
    expect(misses).toEqual([]);
  });

  it("engine beats the prior-only baseline on top-3", () => {
    expect(report.engineTop3).toBeGreaterThan(report.baselineTop3);
  });

  it("measures latency for every run", () => {
    expect(report.medianLatencyMs).toBeGreaterThan(0);
    for (const r of report.results) {
      expect(r.durationMs).toBeGreaterThan(0);
    }
  });
});
