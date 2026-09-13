import type { PatientEvidence, ExtractionCandidate } from '@/types/evidence';
import { supabase } from '@/integrations/supabase/client';
import {
  findFeatureByLabelOrSynonym,
  upsertFeature,
  incrementFeatureUsage,
  upsertPatientEvidence,
} from './evidenceStore';
import { buildVocabularyPrompt } from './featureVocabulary';

interface AIFinding {
  term: string;
  type: 'symptom' | 'history' | 'vital' | 'lab' | 'test' | 'other';
  value_type: 'boolean' | 'numeric' | 'categorical';
  polarity: 'present' | 'absent';
  value?: number | string | null;
}

/**
 * Call the AI edge function to extract clinical terms from a note.
 * Returns structured findings that can be registered into the evidence store.
 */
export async function extractWithAI(noteText: string): Promise<AIFinding[]> {
  const vocabulary = buildVocabularyPrompt();
  const { data, error } = await supabase.functions.invoke('extract-clinical-terms', {
    body: { noteText, vocabulary },
  });

  if (error) {
    console.error('[DiffEx AI] Extraction error:', error);
    return [];
  }

  return data?.findings ?? [];
}

/**
 * Process AI findings: register new features globally and create patient evidence.
 * Returns candidates and evidence arrays compatible with existing UI.
 */
export function processAIFindings(
  findings: AIFinding[],
  patientId: string,
): { candidates: ExtractionCandidate[]; evidence: PatientEvidence[] } {
  const candidates: ExtractionCandidate[] = [];
  const evidence: PatientEvidence[] = [];
  const usedLabels = new Set<string>();

  for (const finding of findings) {
    const labelKey = finding.term.toLowerCase();
    if (usedLabels.has(labelKey)) continue;
    usedLabels.add(labelKey);

    // Try to match existing feature first
    let feature = findFeatureByLabelOrSynonym(finding.term);
    let featureId: string;
    let label: string;
    let confidence: number;

    if (feature) {
      featureId = feature.id;
      label = feature.canonical_label;
      confidence = 0.95;
    } else {
      // Auto-register new feature into the global registry
      const created = upsertFeature({
        canonical_label: finding.term,
        feature_type: finding.type,
        value_type: finding.value_type,
        synonyms: [finding.term.toLowerCase()],
      });
      featureId = created.id;
      label = finding.term;
      confidence = 0.8; // AI-extracted, high confidence
      console.log(`[DiffEx AI] Auto-registered new feature: "${finding.term}" (${finding.type})`);
    }

    incrementFeatureUsage(featureId);

    candidates.push({
      label,
      type: finding.type,
      value_type: finding.value_type,
      polarity: finding.polarity,
      value: finding.value ?? (finding.polarity === 'present'),
      spans: [],
      confidence,
      raw_terms: [finding.term],
    });

    // Parse numeric values — AI often returns numbers as strings (e.g. "35" instead of 35)
    let numericValue: number | null = null;
    if (finding.value_type === 'numeric' && finding.value != null) {
      const parsed = Number(finding.value);
      if (!isNaN(parsed)) numericValue = parsed;
    } else if (typeof finding.value === 'number') {
      numericValue = finding.value;
    }

    const ev = upsertPatientEvidence({
      patient_id: patientId,
      feature_id: featureId,
      polarity: finding.polarity,
      value_boolean: finding.value_type === 'boolean' ? finding.polarity === 'present' : null,
      value_numeric: numericValue,
      value_category: typeof finding.value === 'string' && finding.value_type !== 'numeric' ? finding.value : null,
      source_spans: [],
      extracted_by: 'ai',
    });
    evidence.push(ev);
  }

  return { candidates, evidence };
}
