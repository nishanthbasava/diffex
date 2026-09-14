// ---- Engine latency tracking ----
// Rolling window of computeDifferential run durations so we can report
// median/p95 latency without unbounded memory growth.

const MAX_SAMPLES = 500;

export interface LatencyStats {
  count: number;
  lastMs: number;
  meanMs: number;
  medianMs: number;
  p95Ms: number;
}

const samples: number[] = [];

export function recordLatency(ms: number): void {
  if (!Number.isFinite(ms) || ms < 0) return;
  samples.push(ms);
  if (samples.length > MAX_SAMPLES) {
    samples.splice(0, samples.length - MAX_SAMPLES);
  }
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

export function getLatencyStats(): LatencyStats | null {
  if (samples.length === 0) return null;
  const sorted = [...samples].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const medianMs = sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;

  return {
    count: samples.length,
    lastMs: samples[samples.length - 1],
    meanMs: samples.reduce((a, b) => a + b, 0) / samples.length,
    medianMs,
    p95Ms: percentile(sorted, 95),
  };
}

export function clearLatencySamples(): void {
  samples.length = 0;
}
