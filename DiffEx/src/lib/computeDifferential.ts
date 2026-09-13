import { getPatientEvidence, type PatientEvidenceJoined } from './evidenceStore';
import { getConditions, getAllEdges, type Condition, type ConditionFeatureEdge } from './differentialStore';
import { isCacheReady, getSupabaseFeatureId } from './knowledgeCache';
import { getPriorWeight, getPriorWeightBreakdown, derivePatientContext, type PriorBreakdown } from './priorsStore';
import { getIcd10CodesForCondition } from '@/data/icd10Dictionary';

export interface FeatureContribution {
  feature_id: string;
  feature_label: string;
  polarity: 'present' | 'absent';
  lr_used: number;
  contributionLog: number;
}

export interface DifferentialResult {
  id: string;
  label: string;
  category: string | null;
  acuteness: number;
  probabilityPercent: number;
  contributingFeatures: string[];
  boosts: FeatureContribution[];
  penalties: FeatureContribution[];
  priorWeight: number;
  priorBreakdown: PriorBreakdown;
  icd10_codes: string[];
}

export interface CoverageInfo {
  matchedEdgeCount: number;
  evidenceCount: number;
  coverageRatio: number;
  lowCoverage: boolean;
  candidateCount: number;
  totalConditions: number;
}

export interface DifferentialOutput {
  results: DifferentialResult[];
  coverage: CoverageInfo;
}

// Labels of conditions that should always be included in candidate set (safety net)
const ALWAYS_INCLUDE_LABELS = [
  'Sepsis',
  'MI / ACS',
  'Pulmonary Embolism',
  'Aortic Dissection',
  'Meningitis',
  'Neonatal Sepsis',
];

const LOW_COVERAGE_THRESHOLD = 0.15;
const MIN_CANDIDATE_COUNT = 5;

export function computeDifferential(patientId: string): DifferentialOutput {
  const evidence = getPatientEvidence(patientId);
  const conditions = getConditions();
  const allEdges = getAllEdges();

  const emptyCoverage: CoverageInfo = {
    matchedEdgeCount: 0,
    evidenceCount: 0,
    coverageRatio: 0,
    lowCoverage: false,
    candidateCount: 0,
    totalConditions: conditions.length,
  };

  if (conditions.length === 0) return { results: [], coverage: emptyCoverage };
  if (evidence.length === 0) return { results: [], coverage: emptyCoverage };

  // Index edges by condition_id
  const edgesByCondition = new Map<string, ConditionFeatureEdge[]>();
  for (const edge of allEdges) {
    const arr = edgesByCondition.get(edge.condition_id) || [];
    arr.push(edge);
    edgesByCondition.set(edge.condition_id, arr);
  }

  // Index evidence by feature_id.
  // When the Supabase cache is active, edges use Supabase IDs while patient
  // evidence uses localStorage IDs. Bridge them via canonical_label.
  const evidenceByFeature = new Map<string, PatientEvidenceJoined>();
  for (const ev of evidence) {
    evidenceByFeature.set(ev.feature_id, ev);
    if (isCacheReady()) {
      const supabaseId = getSupabaseFeatureId(ev.canonical_label);
      if (supabaseId && supabaseId !== ev.feature_id) {
        evidenceByFeature.set(supabaseId, ev);
      }
    }
  }

  // Present/absent evidence feature IDs (include both local and Supabase IDs)
  const activeEvidenceIds = new Set<string>();
  for (const ev of evidence) {
    if (ev.polarity === 'present' || ev.polarity === 'absent') {
      activeEvidenceIds.add(ev.feature_id);
      if (isCacheReady()) {
        const supabaseId = getSupabaseFeatureId(ev.canonical_label);
        if (supabaseId) activeEvidenceIds.add(supabaseId);
      }
    }
  }

  // ---- Candidate generation ----
  // Derive patient context for age-aware candidate generation
  const patientCtx = derivePatientContext(evidence);
  const isPediatric = ['neonate', 'infant', 'child', 'adolescent'].includes(patientCtx.age_bucket);

  // 1) Conditions with at least one edge connected to any PRESENT evidence feature
  const presentFeatureIds = new Set<string>();
  for (const ev of evidence) {
    if (ev.polarity === 'present') {
      presentFeatureIds.add(ev.feature_id);
      if (isCacheReady()) {
        const supabaseId = getSupabaseFeatureId(ev.canonical_label);
        if (supabaseId) presentFeatureIds.add(supabaseId);
      }
    }
  }

  const candidateIds = new Set<string>();
  const alwaysIncludeIds = new Set<string>();

  for (const cond of conditions) {
    // Always include safety-net conditions
    if (ALWAYS_INCLUDE_LABELS.includes(cond.label)) {
      candidateIds.add(cond.id);
      alwaysIncludeIds.add(cond.id);
      continue;
    }

    // When pediatric, always include pediatric category conditions
    if (isPediatric && cond.category === 'Pediatric') {
      candidateIds.add(cond.id);
      continue;
    }

    const edges = edgesByCondition.get(cond.id) || [];
    for (const edge of edges) {
      if (presentFeatureIds.has(edge.feature_id)) {
        candidateIds.add(cond.id);
        break;
      }
    }
  }

  // ---- Coverage detection ----
  let matchedEdgeCount = 0;
  for (const cond of conditions) {
    const edges = edgesByCondition.get(cond.id) || [];
    for (const edge of edges) {
      if (activeEvidenceIds.has(edge.feature_id)) {
        matchedEdgeCount++;
      }
    }
  }

  const evidenceCount = activeEvidenceIds.size;
  const coverageRatio = matchedEdgeCount / Math.max(1, evidenceCount);
  const lowCoverage = coverageRatio < LOW_COVERAGE_THRESHOLD;

  // If too few candidates, fall back to all conditions
  const useFallback = candidateIds.size < MIN_CANDIDATE_COUNT;
  const scoringConditions = useFallback
    ? conditions
    : conditions.filter(c => candidateIds.has(c.id));

  // ---- Score candidates ----
  // Implicit penalty for evidence a condition can't explain
  const UNEXPLAINED_PENALTY = 0.85; // small penalty per unexplained present finding
  const logUnexplainedPenalty = Math.log(UNEXPLAINED_PENALTY);

  const scored = scoringConditions.map(condition => {
    // Pass condition.prior_base so imported diseases (no localStorage prior row)
    // use their own stored prevalence instead of a flat 1.0.
    const breakdown = getPriorWeightBreakdown(condition.id, evidence, condition.prior_base);
    const priorWeight = breakdown.prior_weight;
    const priorLogScore = Math.log(priorWeight > 0 ? priorWeight : condition.prior_base);
    const contributingFeatures: string[] = [];
    const allContributions: FeatureContribution[] = [];
    const edges = edgesByCondition.get(condition.id) || [];

    // Build set of feature IDs this condition has edges for
    const conditionFeatureIds = new Set(edges.map(e => e.feature_id));

    // Accumulate LR contributions separately from the prior so we can
    // normalize by matched edge count (fix 2: edge-count bias).
    let lrLogSum = 0;

    for (const edge of edges) {
      const ev = evidenceByFeature.get(edge.feature_id);
      if (!ev) continue;

      let lr_used = 0;
      let polarity: 'present' | 'absent' = 'present';

      if (ev.polarity === 'present' && edge.lr_present > 0) {
        lr_used = edge.lr_present;
        polarity = 'present';
        lrLogSum += Math.log(lr_used);
        if (lr_used >= 2.0) {
          contributingFeatures.push(`${ev.canonical_label} (+${lr_used.toFixed(1)})`);
        }
      } else if (ev.polarity === 'absent' && edge.lr_absent > 0) {
        lr_used = edge.lr_absent;
        polarity = 'absent';
        lrLogSum += Math.log(lr_used);
        if (lr_used <= 0.5) {
          contributingFeatures.push(`${ev.canonical_label} absent (${lr_used.toFixed(1)})`);
        }
      } else {
        continue;
      }

      allContributions.push({
        feature_id: ev.feature_id,
        feature_label: ev.canonical_label,
        polarity,
        lr_used,
        contributionLog: Math.log(lr_used),
      });
    }

    // Normalize LR log-sum by matched edge count so conditions with more
    // edges don't automatically beat conditions with fewer but stronger LRs.
    // A condition that perfectly explains 3 findings should rank above one
    // that weakly explains 10.
    const matchedEdges = allContributions.length;
    const normalizedLR = matchedEdges > 0 ? lrLogSum / matchedEdges : 0;

    // Unexplained penalty: present findings this condition has no edge for.
    let unexplainedPenaltyLog = 0;
    for (const ev of evidence) {
      if (ev.polarity === 'present' && !conditionFeatureIds.has(ev.feature_id)) {
        const label = ev.canonical_label.toLowerCase();
        if (label === 'age' || label === 'sex') continue;
        unexplainedPenaltyLog += logUnexplainedPenalty;
      }
    }

    const logScore = priorLogScore + normalizedLR + unexplainedPenaltyLog;

    const boosts = allContributions
      .filter(c => c.contributionLog > 0)
      .sort((a, b) => b.contributionLog - a.contributionLog)
      .slice(0, 5);
    const penalties = allContributions
      .filter(c => c.contributionLog < 0)
      .sort((a, b) => a.contributionLog - b.contributionLog)
      .slice(0, 5);

    return {
      id: condition.id,
      label: condition.label,
      category: condition.category,
      acuteness: condition.acuteness,
      logScore,
      priorWeight,
      priorBreakdown: breakdown,
      contributingFeatures: contributingFeatures.slice(0, 3),
      boosts,
      penalties,
    };
  });

  // Stabilized softmax
  const maxLog = Math.max(...scored.map(s => s.logScore));
  const expScores = scored.map(s => Math.exp(s.logScore - maxLog));
  const sumExp = expScores.reduce((a, b) => a + b, 0);

  const results: DifferentialResult[] = scored
    .map((s, i) => ({
      id: s.id,
      label: s.label,
      category: s.category,
      acuteness: s.acuteness,
      probabilityPercent: (expScores[i] / sumExp) * 100,
      contributingFeatures: s.contributingFeatures,
      boosts: s.boosts,
      penalties: s.penalties,
      priorWeight: s.priorWeight,
      priorBreakdown: s.priorBreakdown,
      icd10_codes: getIcd10CodesForCondition(s.label),
    }))
    .sort((a, b) => b.probabilityPercent - a.probabilityPercent);

  const coverage: CoverageInfo = {
    matchedEdgeCount,
    evidenceCount,
    coverageRatio,
    lowCoverage: lowCoverage || useFallback,
    candidateCount: candidateIds.size,
    totalConditions: conditions.length,
  };

  console.log(`[DiffEx] Coverage: ${matchedEdgeCount} edges matched / ${evidenceCount} evidence items = ${coverageRatio.toFixed(2)}. Candidates: ${candidateIds.size}/${conditions.length}${useFallback ? ' (fallback)' : ''}`);
  console.log('[DiffEx] Top 5 differential:', results.slice(0, 5).map(r =>
    `${r.label}: ${r.probabilityPercent.toFixed(1)}% [${r.contributingFeatures.join(', ')}]`
  ));

  return { results, coverage };
}
