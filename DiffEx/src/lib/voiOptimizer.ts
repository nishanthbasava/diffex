/**
 * Value-of-Information (VOI) Optimizer
 * 
 * Computes Expected Information Gain (EIG) for candidate features/tests
 * using Bayesian expected entropy reduction over the current posterior.
 * 
 * All math is done in log-space to prevent underflow.
 */

import type { ConditionFeatureEdge } from './differentialStore';

// ---- Types ----

export interface PosteriorEntry {
  condition_id: string;
  probability: number; // normalized, sums to 1
}

export interface VOIResult {
  featureId: string;
  informationGain: number; // bits (natural log)
  currentEntropy: number;
  expectedPostEntropy: number;
}

// ---- Core entropy computation (log-space) ----

function entropy(probs: number[]): number {
  let h = 0;
  for (const p of probs) {
    if (p > 1e-15) {
      h -= p * Math.log(p);
    }
  }
  return h;
}

// ---- Log-sum-exp for numerical stability ----

function logSumExp(logValues: number[]): number {
  if (logValues.length === 0) return -Infinity;
  const maxLog = Math.max(...logValues);
  if (!isFinite(maxLog)) return -Infinity;
  let sum = 0;
  for (const lv of logValues) {
    sum += Math.exp(lv - maxLog);
  }
  return maxLog + Math.log(sum);
}

// ---- Compute VOI for a single feature ----

/**
 * Computes the Expected Information Gain from observing a feature.
 * 
 * For each possible outcome o ∈ {present, absent}:
 *   1. posterior_o[d] ∝ posterior[d] × LR(d, feature, o)
 *   2. P(o) = Σ_d posterior[d] × P(o|d)
 *      where P(o|d) = LR(d,o) / (LR(d,present) + LR(d,absent))
 *   3. H_o = entropy of posterior_o
 * 
 * EIG = H_current - Σ_o P(o) × H_o
 */
export function computeVOIForFeature(
  featureId: string,
  posterior: PosteriorEntry[],
  edgesByCondition: Map<string, ConditionFeatureEdge>,
  outcomes: string[] = ['present', 'absent']
): VOIResult {
  const probs = posterior.map(p => p.probability);
  const currentH = entropy(probs);

  if (currentH < 1e-12) {
    // Already certain — no information to gain
    return { featureId, informationGain: 0, currentEntropy: currentH, expectedPostEntropy: currentH };
  }

  let expectedPostEntropy = 0;

  for (const outcome of outcomes) {
    // Step 1: Compute log-posterior for each condition under this outcome
    const logPosteriorO: number[] = [];
    const logPOutcomeTerms: number[] = []; // log(P(o|d) * posterior[d]) for P(o)

    for (let i = 0; i < posterior.length; i++) {
      const p = posterior[i];
      const edge = edgesByCondition.get(p.condition_id);

      // Get LR for this outcome
      let lrPresent: number;
      let lrAbsent: number;

      if (edge) {
        lrPresent = edge.lr_present > 0 ? edge.lr_present : 1.0;
        lrAbsent = edge.lr_absent > 0 ? edge.lr_absent : 1.0;
      } else {
        // No edge = feature is uninformative for this condition
        lrPresent = 1.0;
        lrAbsent = 1.0;
      }

      const lr = outcome === 'present' ? lrPresent : lrAbsent;

      // P(o|d) = LR(d,o) / (LR(d,present) + LR(d,absent))
      const pOutcomeGivenD = lr / (lrPresent + lrAbsent);

      const logP = Math.log(Math.max(p.probability, 1e-15));
      logPosteriorO.push(logP + Math.log(lr));
      logPOutcomeTerms.push(logP + Math.log(Math.max(pOutcomeGivenD, 1e-15)));
    }

    // P(o) = Σ_d posterior[d] * P(o|d)
    const logPOutcome = logSumExp(logPOutcomeTerms);
    const pOutcome = Math.exp(logPOutcome);

    if (pOutcome < 1e-15) continue;

    // Normalize posterior_o
    const logNorm = logSumExp(logPosteriorO);
    const posteriorO = logPosteriorO.map(lp => Math.exp(lp - logNorm));

    // Entropy of posterior under this outcome
    const hO = entropy(posteriorO);

    expectedPostEntropy += pOutcome * hO;
  }

  const ig = Math.max(0, currentH - expectedPostEntropy);

  return {
    featureId,
    informationGain: ig,
    currentEntropy: currentH,
    expectedPostEntropy,
  };
}

// ---- Batch compute VOI for multiple features ----

export function computeVOIBatch(
  featureIds: string[],
  posterior: PosteriorEntry[],
  allEdges: ConditionFeatureEdge[]
): VOIResult[] {
  // Pre-index edges by feature_id -> condition_id -> edge
  const edgeIndex = new Map<string, Map<string, ConditionFeatureEdge>>();
  for (const edge of allEdges) {
    let byCondition = edgeIndex.get(edge.feature_id);
    if (!byCondition) {
      byCondition = new Map();
      edgeIndex.set(edge.feature_id, byCondition);
    }
    byCondition.set(edge.condition_id, edge);
  }

  return featureIds.map(fid => {
    const edgesByCondition = edgeIndex.get(fid) ?? new Map();
    return computeVOIForFeature(fid, posterior, edgesByCondition);
  });
}
