import type { Diagnosis, Feature, ChangeLogEntry } from '@/types';
import { diagnoses, features } from '@/data/knowledgeBase';

export interface ScoredDiagnosis extends Diagnosis {
  score: number;
  probability: number;
  contributingFactors: string[];
}

export function computeScores(
  selectedFeatureIds: string[],
  testResultIds: string[]
): ScoredDiagnosis[] {
  const allSelectedIds = [...selectedFeatureIds, ...testResultIds];
  const selectedFeatures = features.filter(f => allSelectedIds.includes(f.id));

  const scored = diagnoses.map(diagnosis => {
    let score = diagnosis.baseWeight;
    const contributingFactors: string[] = [];

    selectedFeatures.forEach(feature => {
      const weight = feature.weights[diagnosis.id] || 0;
      if (weight > 0) {
        score += weight;
        if (weight >= 1.5) {
          contributingFactors.push(`${feature.name} (+${weight.toFixed(1)})`);
        }
      }
    });

    return {
      ...diagnosis,
      score,
      probability: 0, // Will be computed via softmax
      contributingFactors: contributingFactors.slice(0, 3),
    };
  });

  // Apply softmax for probability distribution
  const maxScore = Math.max(...scored.map(s => s.score));
  const expScores = scored.map(s => Math.exp(s.score - maxScore)); // Subtract max for numerical stability
  const sumExp = expScores.reduce((a, b) => a + b, 0);

  return scored
    .map((s, i) => ({
      ...s,
      probability: (expScores[i] / sumExp) * 100,
    }))
    .sort((a, b) => b.probability - a.probability);
}

export function getTopReasons(
  featureId: string,
  action: 'add' | 'remove',
  selectedFeatureIds: string[]
): string[] {
  const feature = features.find(f => f.id === featureId);
  if (!feature) return [];

  const idsForComputation = action === 'add' 
    ? [...selectedFeatureIds, featureId]
    : selectedFeatureIds.filter(id => id !== featureId);

  const newScores = computeScores(idsForComputation, []);
  const topTwo = newScores.slice(0, 2);

  return topTwo.map(d => {
    const weight = feature.weights[d.id] || 0;
    const impact = action === 'add' ? 'increases' : 'decreases';
    return `${d.name} ${impact} (weight: ${weight.toFixed(1)})`;
  });
}

export function createLogEntry(
  featureId: string,
  action: 'add' | 'remove',
  selectedFeatureIds: string[]
): ChangeLogEntry {
  const feature = features.find(f => f.id === featureId);
  return {
    id: crypto.randomUUID(),
    timestamp: new Date(),
    action,
    featureName: feature?.name || 'Unknown',
    topReasons: getTopReasons(featureId, action, selectedFeatureIds),
  };
}
