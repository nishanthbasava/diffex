// ---- Vignette evaluation runner ----
// Seeds the localStorage-backed knowledge base (same path the app uses),
// loads each vignette as a patient, and scores the engine's ranking of the
// expected diagnosis. Also ranks a prior-only baseline (findings ignored)
// so top-1/top-3 gains attributable to the LR evidence model are visible.

import { seedIfEmpty, getConditions } from '@/lib/differentialStore';
import { seedPriorsIfEmpty, getPriorWeightBreakdown } from '@/lib/priorsStore';
import { upsertFeature, findFeatureByLabelOrSynonym, upsertPatientEvidence, getPatientEvidence } from '@/lib/evidenceStore';
import { computeDifferential } from '@/lib/computeDifferential';
import { VIGNETTES, type Vignette } from './vignettes';

export interface VignetteResult {
  id: string;
  expected: string;
  engineRank: number | null;
  baselineRank: number | null;
  topLabel: string;
  durationMs: number;
  unmappedFindings: string[];
}

export interface EvalReport {
  results: VignetteResult[];
  vignetteCount: number;
  missingConditions: string[];
  engineTop1: number;
  engineTop3: number;
  baselineTop1: number;
  baselineTop3: number;
  medianLatencyMs: number;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function loadVignetteAsPatient(v: Vignette): { patientId: string; unmapped: string[] } {
  const patientId = `eval_${v.id}`;
  const unmapped: string[] = [];

  if (v.ageYears != null) {
    const age = upsertFeature({ canonical_label: 'Age', feature_type: 'other', value_type: 'numeric', synonyms: [] });
    upsertPatientEvidence({
      patient_id: patientId, feature_id: age.id, polarity: 'present',
      value_numeric: v.ageYears, extracted_by: 'manual',
    });
  }
  if (v.sex) {
    const sex = upsertFeature({ canonical_label: 'Sex', feature_type: 'other', value_type: 'categorical', synonyms: [] });
    upsertPatientEvidence({
      patient_id: patientId, feature_id: sex.id, polarity: 'present',
      value_category: v.sex, extracted_by: 'manual',
    });
  }

  for (const finding of v.findings) {
    const feature = findFeatureByLabelOrSynonym(finding.label);
    if (!feature) {
      unmapped.push(finding.label);
      continue;
    }
    upsertPatientEvidence({
      patient_id: patientId, feature_id: feature.id, polarity: finding.polarity,
      value_boolean: finding.polarity === 'present', extracted_by: 'manual',
    });
  }

  return { patientId, unmapped };
}

/** Rank of the expected label when conditions are ordered by prior weight alone. */
function baselineRankFor(v: Vignette, patientId: string): number | null {
  const evidence = getPatientEvidence(patientId);
  const ranked = getConditions()
    .map(c => ({ label: c.label, prior: getPriorWeightBreakdown(c.id, evidence, c.prior_base).prior_weight }))
    .sort((a, b) => b.prior - a.prior);
  const idx = ranked.findIndex(r => r.label === v.expected);
  return idx >= 0 ? idx + 1 : null;
}

export function runEval(): EvalReport {
  seedIfEmpty();
  seedPriorsIfEmpty();

  const conditionLabels = new Set(getConditions().map(c => c.label));
  const missingConditions = [...new Set(
    VIGNETTES.filter(v => !conditionLabels.has(v.expected)).map(v => v.expected)
  )];

  const results: VignetteResult[] = VIGNETTES.map(v => {
    const { patientId, unmapped } = loadVignetteAsPatient(v);
    const output = computeDifferential(patientId);
    const idx = output.results.findIndex(r => r.label === v.expected);
    return {
      id: v.id,
      expected: v.expected,
      engineRank: idx >= 0 ? idx + 1 : null,
      baselineRank: baselineRankFor(v, patientId),
      topLabel: output.results[0]?.label ?? '(none)',
      durationMs: output.durationMs,
      unmappedFindings: unmapped,
    };
  });

  const inTop = (rank: number | null, n: number) => rank != null && rank <= n;
  return {
    results,
    vignetteCount: results.length,
    missingConditions,
    engineTop1: results.filter(r => inTop(r.engineRank, 1)).length,
    engineTop3: results.filter(r => inTop(r.engineRank, 3)).length,
    baselineTop1: results.filter(r => inTop(r.baselineRank, 1)).length,
    baselineTop3: results.filter(r => inTop(r.baselineRank, 3)).length,
    medianLatencyMs: median(results.map(r => r.durationMs)),
  };
}

export function formatReport(report: EvalReport): string {
  const pct = (n: number) => `${((n / report.vignetteCount) * 100).toFixed(1)}%`;
  const lines = [
    '── DiffEx vignette evaluation ──',
    ...report.results.map(r => {
      const rank = r.engineRank == null ? 'MISS' : `#${r.engineRank}`;
      const base = r.baselineRank == null ? 'MISS' : `#${r.baselineRank}`;
      const flag = r.engineRank === 1 ? '✓' : r.engineRank != null && r.engineRank <= 3 ? '~' : '✗';
      return `${flag} ${r.id.padEnd(16)} ${r.expected.padEnd(32)} engine ${rank.padEnd(5)} baseline ${base.padEnd(5)} top: ${r.topLabel}`;
    }),
    '────────────────────────────────',
    `Vignettes: ${report.vignetteCount}`,
    `Engine   top-1: ${report.engineTop1} (${pct(report.engineTop1)})   top-3: ${report.engineTop3} (${pct(report.engineTop3)})`,
    `Baseline top-1: ${report.baselineTop1} (${pct(report.baselineTop1)})   top-3: ${report.baselineTop3} (${pct(report.baselineTop3)})`,
    `Median latency: ${report.medianLatencyMs.toFixed(2)} ms`,
  ];
  return lines.join('\n');
}
