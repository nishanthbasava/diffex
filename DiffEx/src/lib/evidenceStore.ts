import type { RegistryFeature, PatientEvidence, SourceSpan } from '@/types/evidence';

const REGISTRY_KEY = 'diffex_feature_registry';
const EVIDENCE_KEY = 'diffex_patient_evidence';

// ---- Internal helpers ----

function loadRegistryRaw(): RegistryFeature[] {
  try {
    const stored = localStorage.getItem(REGISTRY_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveRegistryRaw(registry: RegistryFeature[]): void {
  localStorage.setItem(REGISTRY_KEY, JSON.stringify(registry));
}

function loadAllEvidence(): PatientEvidence[] {
  try {
    const stored = localStorage.getItem(EVIDENCE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveAllEvidence(evidence: PatientEvidence[]): void {
  localStorage.setItem(EVIDENCE_KEY, JSON.stringify(evidence));
}

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalize(s: string): string {
  return s.toLowerCase().trim();
}

// ---- Public API ----

export function getAllFeatures(): RegistryFeature[] {
  return loadRegistryRaw();
}

export function findFeatureById(id: string): RegistryFeature | null {
  const registry = loadRegistryRaw();
  return registry.find(f => f.id === id) ?? null;
}

export function findFeatureByLabelOrSynonym(label: string): RegistryFeature | null {
  const registry = loadRegistryRaw();
  const norm = normalize(label);
  for (const f of registry) {
    if (normalize(f.canonical_label) === norm) return f;
    if (f.synonyms.some(s => normalize(s) === norm)) return f;
  }
  return null;
}

export function upsertFeature(params: {
  canonical_label: string;
  feature_type: RegistryFeature['type'];
  value_type: RegistryFeature['value_type'];
  synonyms: string[];
}): RegistryFeature {
  const registry = loadRegistryRaw();
  const norm = normalize(params.canonical_label);
  const idx = registry.findIndex(f => normalize(f.canonical_label) === norm);

  if (idx >= 0) {
    const existing = registry[idx];
    const merged = [...new Set([...existing.synonyms, ...params.synonyms])];
    existing.synonyms = merged;
    existing.updated_at = new Date().toISOString();
    saveRegistryRaw(registry);
    return existing;
  }

  const newFeature: RegistryFeature = {
    id: generateId(),
    canonical_label: params.canonical_label,
    type: params.feature_type,
    value_type: params.value_type,
    synonyms: params.synonyms,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    created_by: null,
    usage_count: 0,
    status: 'active',
  };
  registry.push(newFeature);
  saveRegistryRaw(registry);
  return newFeature;
}

export function incrementFeatureUsage(featureId: string): void {
  const registry = loadRegistryRaw();
  const f = registry.find(r => r.id === featureId);
  if (f) {
    f.usage_count++;
    f.updated_at = new Date().toISOString();
    saveRegistryRaw(registry);
  }
}

export function upsertPatientEvidence(params: {
  patient_id: string;
  feature_id: string;
  polarity: PatientEvidence['polarity'];
  value_boolean?: boolean | null;
  value_numeric?: number | null;
  value_text?: string | null;
  value_category?: string | null;
  source_spans?: SourceSpan[];
  extracted_by: PatientEvidence['extracted_by'];
}): PatientEvidence {
  const all = loadAllEvidence();
  const idx = all.findIndex(
    e => e.patient_id === params.patient_id && e.feature_id === params.feature_id
  );

  const record: PatientEvidence = {
    patient_id: params.patient_id,
    feature_id: params.feature_id,
    polarity: params.polarity,
    value_boolean: params.value_boolean ?? null,
    value_numeric: params.value_numeric ?? null,
    value_text: params.value_text ?? null,
    value_category: params.value_category ?? null,
    source_spans: params.source_spans ?? [],
    extracted_at: new Date().toISOString(),
    extracted_by: params.extracted_by,
  };

  if (idx >= 0) {
    all[idx] = record;
  } else {
    all.push(record);
  }
  saveAllEvidence(all);
  return record;
}

export interface PatientEvidenceJoined extends PatientEvidence {
  canonical_label: string;
  feature_type: RegistryFeature['type'];
  value_type: RegistryFeature['value_type'];
}

export function getPatientEvidence(patientId: string): PatientEvidenceJoined[] {
  const all = loadAllEvidence();
  const registry = loadRegistryRaw();
  const regMap = new Map(registry.map(f => [f.id, f]));

  return all
    .filter(e => e.patient_id === patientId)
    .map(e => {
      const feat = regMap.get(e.feature_id);
      return {
        ...e,
        canonical_label: feat?.canonical_label ?? 'Unknown',
        feature_type: feat?.type ?? 'other',
        value_type: feat?.value_type ?? 'text',
      };
    });
}
