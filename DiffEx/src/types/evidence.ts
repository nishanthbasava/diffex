// ---- Feature Registry (global, shared across patients) ----

export interface RegistryFeature {
  id: string;
  canonical_label: string;
  type: 'symptom' | 'vital' | 'history' | 'lab' | 'test' | 'other';
  value_type: 'boolean' | 'numeric' | 'categorical' | 'text';
  synonyms: string[];
  created_at: string;
  updated_at: string;
  created_by: string | null;
  usage_count: number;
  status: 'active' | 'pending_review' | 'merged';
  /** If status=merged, points to the feature it was merged into */
  merged_into?: string;
  /** Maps to a knowledgeBase feature id if one exists */
  kb_feature_id?: string;
}

// ---- Patient Evidence (per patient) ----

export interface SourceSpan {
  start: number;
  end: number;
  text: string;
}

export interface PatientEvidence {
  patient_id: string;
  feature_id: string; // FK -> RegistryFeature.id
  value_boolean: boolean | null;
  value_numeric: number | null;
  value_text: string | null;
  value_category: string | null;
  polarity: 'present' | 'absent' | 'unknown';
  source_spans: SourceSpan[];
  extracted_at: string;
  extracted_by: 'auto' | 'manual' | 'ai';
}

// ---- Extraction pipeline types ----

export interface ExtractionCandidate {
  label: string;
  type: RegistryFeature['type'];
  value_type: RegistryFeature['value_type'];
  polarity: PatientEvidence['polarity'];
  value: string | number | boolean | null;
  spans: SourceSpan[];
  confidence: number; // 0-1
  raw_terms: string[];
}

export interface ExtractionResult {
  candidates: ExtractionCandidate[];
  evidence: PatientEvidence[];
}
