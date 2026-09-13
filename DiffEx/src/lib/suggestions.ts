import type { SuggestedQuestion, SuggestedTest } from '@/types';
import type { ScoredDiagnosis } from '@/lib/scoring';
import { features, tests } from '@/data/knowledgeBase';

export function getSuggestedQuestions(
  topDiagnoses: ScoredDiagnosis[],
  selectedFeatureIds: string[]
): SuggestedQuestion[] {
  const suggestions: SuggestedQuestion[] = [];
  const topDiagnosisIds = topDiagnoses.slice(0, 5).map(d => d.id);

  // Find features that would help differentiate between top diagnoses
  const relevantFeatures = features.filter(f => {
    // Skip already selected features
    if (selectedFeatureIds.includes(f.id)) return false;
    
    // Only include symptom, history, and vital types as "questions"
    if (!['symptom', 'history', 'vital'].includes(f.type)) return false;

    // Check if this feature has meaningful weights for top diagnoses
    const relevantWeights = topDiagnosisIds.filter(
      diagId => (f.weights[diagId] || 0) >= 1.5
    );
    return relevantWeights.length > 0;
  });

  // Score features by their discriminatory power
  const scoredFeatures = relevantFeatures.map(f => {
    const weights = topDiagnosisIds.map(id => f.weights[id] || 0);
    const variance = calculateVariance(weights);
    const maxWeight = Math.max(...weights);
    return { feature: f, score: variance * maxWeight };
  });

  scoredFeatures
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .forEach(({ feature }) => {
      const relevantDiags = topDiagnoses
        .filter(d => (feature.weights[d.id] || 0) >= 1.5)
        .slice(0, 2);
      
      const rationale = relevantDiags.length > 0
        ? `Helps evaluate ${relevantDiags.map(d => d.name).join(', ')}`
        : 'May help narrow differential';

      suggestions.push({
        id: feature.id,
        title: `Ask about: ${feature.name}`,
        rationale,
        featureId: feature.id,
      });
    });

  return suggestions;
}

export function getSuggestedTests(
  topDiagnoses: ScoredDiagnosis[],
  selectedTestIds: string[]
): SuggestedTest[] {
  const suggestions: SuggestedTest[] = [];
  const topDiagnosisIds = topDiagnoses.slice(0, 5).map(d => d.id);

  const relevantTests = tests.filter(t => {
    if (selectedTestIds.includes(t.id)) return false;
    return t.relevantFor.some(diagId => topDiagnosisIds.includes(diagId));
  });

  // Score tests by how many top diagnoses they help with
  const scoredTests = relevantTests.map(t => {
    const matchCount = t.relevantFor.filter(id => topDiagnosisIds.includes(id)).length;
    const avgPosition = t.relevantFor.reduce((sum, id) => {
      const idx = topDiagnosisIds.indexOf(id);
      return sum + (idx >= 0 ? 5 - idx : 0);
    }, 0);
    return { test: t, score: matchCount * 10 + avgPosition };
  });

  scoredTests
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .forEach(({ test }) => {
      suggestions.push({
        id: test.id,
        title: test.name,
        rationale: test.rationale,
        testId: test.id,
      });
    });

  return suggestions;
}

function calculateVariance(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
}
