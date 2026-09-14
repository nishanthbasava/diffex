import { describe, it, expect, beforeEach } from "vitest";
import { recordLatency, getLatencyStats, clearLatencySamples } from "./perfStats";

describe("perfStats", () => {
  beforeEach(() => {
    clearLatencySamples();
  });

  it("returns null when no samples recorded", () => {
    expect(getLatencyStats()).toBeNull();
  });

  it("computes stats for a single sample", () => {
    recordLatency(10);
    const stats = getLatencyStats()!;
    expect(stats.count).toBe(1);
    expect(stats.lastMs).toBe(10);
    expect(stats.meanMs).toBe(10);
    expect(stats.medianMs).toBe(10);
    expect(stats.p95Ms).toBe(10);
  });

  it("computes median for odd sample count", () => {
    [5, 1, 3].forEach(recordLatency);
    expect(getLatencyStats()!.medianMs).toBe(3);
  });

  it("computes median for even sample count", () => {
    [1, 2, 3, 10].forEach(recordLatency);
    expect(getLatencyStats()!.medianMs).toBe(2.5);
  });

  it("computes p95 from the sorted distribution", () => {
    // 100 samples: 1..100 → p95 should be 95
    for (let i = 1; i <= 100; i++) recordLatency(i);
    expect(getLatencyStats()!.p95Ms).toBe(95);
  });

  it("tracks lastMs as the most recent sample", () => {
    recordLatency(1);
    recordLatency(99);
    recordLatency(7);
    expect(getLatencyStats()!.lastMs).toBe(7);
  });

  it("ignores negative and non-finite values", () => {
    recordLatency(-5);
    recordLatency(NaN);
    recordLatency(Infinity);
    expect(getLatencyStats()).toBeNull();
    recordLatency(4);
    expect(getLatencyStats()!.count).toBe(1);
  });

  it("caps the rolling window at 500 samples, keeping the newest", () => {
    for (let i = 0; i < 600; i++) recordLatency(i);
    const stats = getLatencyStats()!;
    expect(stats.count).toBe(500);
    expect(stats.lastMs).toBe(599);
    // Oldest 100 samples (0-99) were evicted, so min is 100 → median of 100..599 is 349.5
    expect(stats.medianMs).toBe(349.5);
  });

  it("clears samples", () => {
    recordLatency(5);
    clearLatencySamples();
    expect(getLatencyStats()).toBeNull();
  });
});
