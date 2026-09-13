/**
 * Optimizer module — ranks candidate questions and tests by Expected Information Gain (VOI).
 * 
 * Uses the differentialStore edge system (not legacy knowledgeBase features) so that
 * feature IDs match the actual LR edges used by computeDifferential.
 */

import type { DifferentialResult } from './computeDifferential';
import { getAllEdges, type ConditionFeatureEdge } from './differentialStore';
import { loadRegistry } from './featureRegistry';
import { tests } from '@/data/knowledgeBase';
import { computeVOIBatch, type PosteriorEntry } from './voiOptimizer';

export interface OptimizerItem {
  id: string;
  title: string;
  type: 'question' | 'test';
  cutdownPercent: number;   // IG as % of current entropy
  priorityScore: number;    // penalized score scaled 0-100
  impactDiagnoses: string[];
  metadata: {
    cost?: string;
    time?: string;
    invasiveness?: string;
    rulesOut?: string[];
    rawIG?: number;
  };
  actionId: string;
}

// ---- Cost/invasiveness penalty weights ----

const COST_PENALTY: Record<string, number> = { Low: 0, Medium: 0.05, High: 0.15 };
const INVASIVENESS_PENALTY: Record<string, number> = { Low: 0, Medium: 0.05, High: 0.15 };

function parseTimePenalty(time: string): number {
  if (time.includes('h')) {
    const hours = parseFloat(time) || 1;
    return hours * 0.02;
  }
  return 0.01;
}

const testMetadata: Record<string, { cost: string; time: string; invasiveness: string }> = {
  cta: { cost: 'High', time: '1-2h', invasiveness: 'Medium' },
  ecg: { cost: 'Low', time: '10min', invasiveness: 'Low' },
  echo: { cost: 'Medium', time: '30min', invasiveness: 'Low' },
  cxr: { cost: 'Low', time: '15min', invasiveness: 'Low' },
  pft: { cost: 'Medium', time: '45min', invasiveness: 'Low' },
  bnp: { cost: 'Low', time: '1h', invasiveness: 'Low' },
  troponin: { cost: 'Low', time: '1h', invasiveness: 'Low' },
  ddimer: { cost: 'Low', time: '1h', invasiveness: 'Low' },
  cbc: { cost: 'Low', time: '30min', invasiveness: 'Low' },
  stress_test: { cost: 'High', time: '2-3h', invasiveness: 'Medium' },
  ct_chest: { cost: 'High', time: '1h', invasiveness: 'Medium' },
  vq_scan: { cost: 'High', time: '1-2h', invasiveness: 'Medium' },
};

// Map test IDs to their associated lab-result feature labels for finding edges
const testToLabLabels: Record<string, string[]> = {
  ddimer: ['elevated_ddimer'],
  troponin: ['elevated_troponin'],
  bnp: ['elevated_bnp'],
  cbc: ['low_hgb', 'elevated_wbc'],
};

export function getOptimizerItems(
  differentialResults: DifferentialResult[],
  selectedFeatureIds: string[],
  testResultIds: string[]
): OptimizerItem[] {
  if (differentialResults.length === 0) return [];

  // Build posterior from differential results
  const totalProb = differentialResults.reduce((s, d) => s + d.probabilityPercent, 0);
  const posterior: PosteriorEntry[] = differentialResults.map(d => ({
    condition_id: d.id,
    probability: totalProb > 0 ? d.probabilityPercent / totalProb : 1 / differentialResults.length,
  }));

  const allEdges = getAllEdges();
  const conditionIds = new Set(differentialResults.map(d => d.id));

  // Build a set of all feature_ids that appear in edges for current conditions
  const candidateFeatureIds = new Set<string>();
  for (const edge of allEdges) {
    if (conditionIds.has(edge.condition_id)) {
      candidateFeatureIds.add(edge.feature_id);
    }
  }

  // Remove already-selected features
  const alreadyUsed = new Set([...selectedFeatureIds, ...testResultIds]);

  // Load registry to get labels and types
  const registry = loadRegistry();
  const registryMap = new Map(registry.map(r => [r.id, r]));

  const items: OptimizerItem[] = [];

  // ---- Questions: features not yet selected ----
  const questionFeatureIds: string[] = [];
  for (const fid of candidateFeatureIds) {
    if (alreadyUsed.has(fid)) continue;
    const reg = registryMap.get(fid);
    // Only symptom/history/vital for questions
    if (reg && ['symptom', 'history', 'vital'].includes(reg.type)) {
      questionFeatureIds.push(fid);
    }
  }

  const questionVOIs = computeVOIBatch(questionFeatureIds, posterior, allEdges);

  for (let i = 0; i < questionFeatureIds.length; i++) {
    const fid = questionFeatureIds[i];
    const voi = questionVOIs[i];
    const reg = registryMap.get(fid);

    if (voi.informationGain < 1e-6) continue;

    const cutdownPercent = voi.currentEntropy > 0
      ? Math.round((voi.informationGain / voi.currentEntropy) * 100)
      : 0;

    // Find most impacted diagnoses
    const impactDiagnoses = differentialResults
      .filter(d => {
        const edge = allEdges.find(e => e.feature_id === fid && e.condition_id === d.id);
        return edge && (edge.lr_present >= 2.0 || edge.lr_absent <= 0.5);
      })
      .slice(0, 2)
      .map(d => d.label);

    items.push({
      id: fid,
      title: `Ask about: ${reg?.canonical_label ?? fid}`,
      type: 'question',
      cutdownPercent,
      priorityScore: 0,
      impactDiagnoses,
      metadata: { rawIG: voi.informationGain },
      actionId: fid,
    });
  }

  // ---- Tests: not yet ordered ----
  // Map old knowledgeBase diagnosis IDs to current condition IDs by label
  const oldIdToConditionId = new Map<string, string>();
  const labelToOldId: Record<string, string> = {
    'Pulmonary Embolism': 'pe', 'COPD Exacerbation': 'copd', 'Congestive Heart Failure': 'chf',
    'Community-Acquired Pneumonia': 'pneumonia', 'Asthma Exacerbation': 'asthma',
    'Anxiety / Panic Disorder': 'anxiety', 'Anemia': 'anemia', 'GERD': 'gerd',
    'Pericarditis': 'pericarditis', 'Lung Cancer': 'lung_ca',
    'Interstitial Lung Disease': 'ild', 'MI / ACS': 'cad',
  };
  for (const d of differentialResults) {
    const oldId = labelToOldId[d.label];
    if (oldId) oldIdToConditionId.set(oldId, d.id);
  }

  const relevantTests = tests.filter(t => {
    if (testResultIds.some(id => id.includes(t.id))) return false;
    return t.relevantFor.some(oldId => oldIdToConditionId.has(oldId));
  });

  for (const t of relevantTests) {
    // Find lab feature IDs in the registry that match this test's lab labels
    const labLabels = testToLabLabels[t.id] || [];
    const labFeatureIds: string[] = [];
    for (const label of labLabels) {
      for (const reg of registry) {
        if (reg.canonical_label.toLowerCase() === label.toLowerCase() ||
            reg.synonyms.some(s => s.toLowerCase() === label.toLowerCase())) {
          labFeatureIds.push(reg.id);
        }
      }
    }

    let maxIG = 0;
    let bestCurrentH = 0;

    if (labFeatureIds.length > 0) {
      const testVOIs = computeVOIBatch(labFeatureIds, posterior, allEdges);
      for (const v of testVOIs) {
        if (v.informationGain > maxIG) {
          maxIG = v.informationGain;
          bestCurrentH = v.currentEntropy;
        }
      }
    } else {
      // Fallback: estimate from relevance overlap using mapped IDs
      const mappedCondIds = t.relevantFor.map(oid => oldIdToConditionId.get(oid)).filter(Boolean) as string[];
      const relevantProbs = posterior.filter(p => mappedCondIds.includes(p.condition_id));
      const relevantMass = relevantProbs.reduce((s, p) => s + p.probability, 0);
      bestCurrentH = questionVOIs.length > 0 ? questionVOIs[0]?.currentEntropy ?? 1 : 1;
      maxIG = relevantMass * 0.3 * bestCurrentH;
    }

    if (maxIG < 1e-6) continue;

    const meta = testMetadata[t.id] || { cost: 'Medium', time: '30min', invasiveness: 'Low' };

    const costPen = COST_PENALTY[meta.cost] ?? 0.05;
    const invasPen = INVASIVENESS_PENALTY[meta.invasiveness] ?? 0.05;
    const timePen = parseTimePenalty(meta.time);
    const penalizedIG = Math.max(0, maxIG - costPen - invasPen - timePen);

    const cutdownPercent = bestCurrentH > 0
      ? Math.round((maxIG / bestCurrentH) * 100)
      : 0;

    const rulesOut = t.relevantFor
      .map(oldId => {
        const condId = oldIdToConditionId.get(oldId);
        return condId ? differentialResults.find(d => d.id === condId)?.label : null;
      })
      .filter(Boolean) as string[];
    rulesOut.splice(3);

    items.push({
      id: t.id,
      title: `Test: ${t.name}`,
      type: 'test',
      cutdownPercent,
      priorityScore: 0,
      impactDiagnoses: [],
      metadata: { ...meta, rulesOut, rawIG: penalizedIG },
      actionId: t.id,
    });
  }

  // ---- Normalize priorityScore 0-100 ----
  const rawScores = items.map(it => it.metadata.rawIG ?? 0);
  const maxRaw = Math.max(...rawScores, 1e-10);

  for (const item of items) {
    const raw = item.metadata.rawIG ?? 0;
    item.priorityScore = Math.round((raw / maxRaw) * 100);
  }

  return items
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, 12);
}
