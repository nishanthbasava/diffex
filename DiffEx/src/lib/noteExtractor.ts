import type { ExtractionCandidate, PatientEvidence, SourceSpan } from '@/types/evidence';
import { loadRegistry } from './featureRegistry';
import { findFeatureByLabelOrSynonym, upsertFeature, incrementFeatureUsage, upsertPatientEvidence } from './evidenceStore';
import type { RegistryFeature } from '@/types/evidence';

// ---- Negation patterns ----

const NEGATION_PREFIXES = [
  'denies', 'denied', 'deny',
  'no ', 'no\n',
  'not ', 'not\n',
  'without ',
  'negative for ',
  'neg for ',
  'absence of ',
  'absent ',
  'rules out ',
  'ruled out ',
  'does not have ',
  'doesn\'t have ',
  'non ',
  'non-',
];

const NEGATION_WINDOW = 60;

function isNegated(text: string, spanStart: number): boolean {
  const windowStart = Math.max(0, spanStart - NEGATION_WINDOW);
  const preceding = text.slice(windowStart, spanStart).toLowerCase();
  for (const neg of NEGATION_PREFIXES) {
    if (preceding.trimEnd().endsWith(neg.trim())) return true;
  }
  const sentenceStart = Math.max(
    preceding.lastIndexOf('.'),
    preceding.lastIndexOf('\n'),
    0
  );
  const sentence = preceding.slice(sentenceStart);
  for (const neg of NEGATION_PREFIXES) {
    if (sentence.includes(neg)) return true;
  }
  return false;
}

// ---- Demographic extraction ----

interface DemographicResult {
  age?: { value: number; span: SourceSpan };
  sex?: { value: string; span: SourceSpan };
}

function extractDemographics(text: string): DemographicResult {
  const result: DemographicResult = {};

  const agePatterns: Array<{ pattern: RegExp; unit: 'years' | 'months' | 'days' }> = [
    { pattern: /(\d{1,3})\s*[-–]?\s*(?:month|mo|m)\s*[-/]?\s*(?:old|o)\b/gi, unit: 'months' },
    { pattern: /(\d{1,3})\s*[-–]?\s*(?:day|d)\s*[-/]?\s*(?:old|o)\b/gi, unit: 'days' },
    { pattern: /(\d{1,3})\s*[-–]?\s*(?:week|wk|w)\s*[-/]?\s*(?:old|o)\b/gi, unit: 'months' },
    { pattern: /(\d{1,3})\s*[-–]?\s*(?:year|yr|y)\s*[-/]?\s*(?:old|o)\b/gi, unit: 'years' },
    { pattern: /\bage\s*[:=]?\s*(\d{1,3})\b/gi, unit: 'years' },
    { pattern: /(\d{1,3})\s*(?:yo|y\.o\.)\b/gi, unit: 'years' },
  ];
  for (const { pattern, unit } of agePatterns) {
    const match = pattern.exec(text);
    if (match) {
      let age = parseInt(match[1], 10);
      if (unit === 'months') age = Math.max(0, Math.round(age / 12));
      else if (unit === 'days') age = 0;
      if (age >= 0 && age < 130) {
        result.age = {
          value: age,
          span: { start: match.index, end: match.index + match[0].length, text: match[0] },
        };
        break;
      }
    }
  }

  const sexPatterns = [
    /\b(male|female)\b/gi,
    /\b(man|woman)\b/gi,
    /\b(boy|girl)\b/gi,
    /\b(?:(\d+)\s*[-–]?\s*(?:year|yr|y|month|mo|m|day|d|week|wk|w)\s*[-/]?\s*(?:old|o)\s+)(F|M)\b/gi,
  ];
  for (const pattern of sexPatterns) {
    const match = pattern.exec(text);
    if (match) {
      // The last capturing group has the sex token
      const raw = (match[match.length - 1] || match[1]).toLowerCase();
      const sex = ['male', 'man', 'boy', 'm'].includes(raw) ? 'Male' : 'Female';
      const sexText = match[match.length - 1] || match[1];
      const sexStart = match.index + match[0].length - sexText.length;
      result.sex = {
        value: sex,
        span: { start: sexStart, end: sexStart + sexText.length, text: sexText },
      };
      break;
    }
  }

  return result;
}

// ---- Symptom/clinical term extraction ----

interface RawExtraction {
  term: string;
  span: SourceSpan;
  negated: boolean;
  inferredType: RegistryFeature['type'];
  inferredValueType: RegistryFeature['value_type'];
  numericValue?: number;
}

const EXTRA_CLINICAL_TERMS: Array<{ term: string; type: RegistryFeature['type']; valueType: RegistryFeature['value_type'] }> = [
  // GI
  { term: 'nausea', type: 'symptom', valueType: 'boolean' },
  { term: 'vomiting', type: 'symptom', valueType: 'boolean' },
  { term: 'diarrhea', type: 'symptom', valueType: 'boolean' },
  { term: 'constipation', type: 'symptom', valueType: 'boolean' },
  { term: 'abdominal pain', type: 'symptom', valueType: 'boolean' },
  { term: 'stomach pain', type: 'symptom', valueType: 'boolean' },
  { term: 'belly pain', type: 'symptom', valueType: 'boolean' },
  { term: 'epigastric pain', type: 'symptom', valueType: 'boolean' },
  { term: 'bloating', type: 'symptom', valueType: 'boolean' },
  { term: 'bloody stool', type: 'symptom', valueType: 'boolean' },
  { term: 'melena', type: 'symptom', valueType: 'boolean' },
  { term: 'hematemesis', type: 'symptom', valueType: 'boolean' },
  { term: 'anorexia', type: 'symptom', valueType: 'boolean' },
  { term: 'not eating', type: 'symptom', valueType: 'boolean' },
  { term: 'poor appetite', type: 'symptom', valueType: 'boolean' },
  { term: 'decreased appetite', type: 'symptom', valueType: 'boolean' },
  { term: 'loss of appetite', type: 'symptom', valueType: 'boolean' },
  { term: 'poor feeding', type: 'symptom', valueType: 'boolean' },
  { term: 'projectile vomiting', type: 'symptom', valueType: 'boolean' },
  { term: 'bilious vomiting', type: 'symptom', valueType: 'boolean' },
  { term: 'currant jelly stool', type: 'symptom', valueType: 'boolean' },

  // ENT / Throat
  { term: 'sore throat', type: 'symptom', valueType: 'boolean' },
  { term: 'throat pain', type: 'symptom', valueType: 'boolean' },
  { term: 'pharyngitis', type: 'symptom', valueType: 'boolean' },
  { term: 'throat ulcers', type: 'symptom', valueType: 'boolean' },
  { term: 'oral ulcers', type: 'symptom', valueType: 'boolean' },
  { term: 'mouth ulcers', type: 'symptom', valueType: 'boolean' },
  { term: 'mouth sores', type: 'symptom', valueType: 'boolean' },
  { term: 'ulcers', type: 'symptom', valueType: 'boolean' },
  { term: 'vesicles', type: 'symptom', valueType: 'boolean' },
  { term: 'oral vesicles', type: 'symptom', valueType: 'boolean' },
  { term: 'posterior oral vesicles', type: 'symptom', valueType: 'boolean' },
  { term: 'painful swallowing', type: 'symptom', valueType: 'boolean' },
  { term: 'difficulty swallowing', type: 'symptom', valueType: 'boolean' },
  { term: 'odynophagia', type: 'symptom', valueType: 'boolean' },
  { term: 'dysphagia', type: 'symptom', valueType: 'boolean' },
  { term: 'drooling', type: 'symptom', valueType: 'boolean' },
  { term: 'trismus', type: 'symptom', valueType: 'boolean' },
  { term: 'tonsillar exudate', type: 'symptom', valueType: 'boolean' },
  { term: 'tonsillar swelling', type: 'symptom', valueType: 'boolean' },
  { term: 'ear pain', type: 'symptom', valueType: 'boolean' },
  { term: 'otalgia', type: 'symptom', valueType: 'boolean' },
  { term: 'ear discharge', type: 'symptom', valueType: 'boolean' },
  { term: 'rhinorrhea', type: 'symptom', valueType: 'boolean' },
  { term: 'runny nose', type: 'symptom', valueType: 'boolean' },
  { term: 'nasal congestion', type: 'symptom', valueType: 'boolean' },
  { term: 'congestion', type: 'symptom', valueType: 'boolean' },
  { term: 'sneezing', type: 'symptom', valueType: 'boolean' },
  { term: 'hoarseness', type: 'symptom', valueType: 'boolean' },

  // Respiratory
  { term: 'cough', type: 'symptom', valueType: 'boolean' },
  { term: 'barky cough', type: 'symptom', valueType: 'boolean' },
  { term: 'whooping cough', type: 'symptom', valueType: 'boolean' },
  { term: 'productive cough', type: 'symptom', valueType: 'boolean' },
  { term: 'hemoptysis', type: 'symptom', valueType: 'boolean' },
  { term: 'wheezing', type: 'symptom', valueType: 'boolean' },
  { term: 'stridor', type: 'symptom', valueType: 'boolean' },
  { term: 'tachypnea', type: 'symptom', valueType: 'boolean' },
  { term: 'retractions', type: 'symptom', valueType: 'boolean' },
  { term: 'grunting', type: 'symptom', valueType: 'boolean' },
  { term: 'nasal flaring', type: 'symptom', valueType: 'boolean' },
  { term: 'apnea', type: 'symptom', valueType: 'boolean' },
  { term: 'cyanosis', type: 'symptom', valueType: 'boolean' },

  // Neuro
  { term: 'headache', type: 'symptom', valueType: 'boolean' },
  { term: 'dizziness', type: 'symptom', valueType: 'boolean' },
  { term: 'syncope', type: 'symptom', valueType: 'boolean' },
  { term: 'seizure', type: 'symptom', valueType: 'boolean' },
  { term: 'seizure activity', type: 'symptom', valueType: 'boolean' },
  { term: 'convulsion', type: 'symptom', valueType: 'boolean' },
  { term: 'altered mental status', type: 'symptom', valueType: 'boolean' },
  { term: 'confusion', type: 'symptom', valueType: 'boolean' },
  { term: 'lethargy', type: 'symptom', valueType: 'boolean' },
  { term: 'irritability', type: 'symptom', valueType: 'boolean' },
  { term: 'neck stiffness', type: 'symptom', valueType: 'boolean' },
  { term: 'stiff neck', type: 'symptom', valueType: 'boolean' },
  { term: 'bulging fontanelle', type: 'symptom', valueType: 'boolean' },
  { term: 'photophobia', type: 'symptom', valueType: 'boolean' },
  { term: 'focal weakness', type: 'symptom', valueType: 'boolean' },

  // Skin / Rash
  { term: 'rash', type: 'symptom', valueType: 'boolean' },
  { term: 'petechiae', type: 'symptom', valueType: 'boolean' },
  { term: 'purpura', type: 'symptom', valueType: 'boolean' },
  { term: 'urticaria', type: 'symptom', valueType: 'boolean' },
  { term: 'hives', type: 'symptom', valueType: 'boolean' },
  { term: 'erythema', type: 'symptom', valueType: 'boolean' },
  { term: 'jaundice', type: 'symptom', valueType: 'boolean' },
  { term: 'pallor', type: 'symptom', valueType: 'boolean' },
  { term: 'strawberry tongue', type: 'symptom', valueType: 'boolean' },
  { term: 'conjunctivitis', type: 'symptom', valueType: 'boolean' },
  { term: 'red eyes', type: 'symptom', valueType: 'boolean' },
  { term: 'hand foot rash', type: 'symptom', valueType: 'boolean' },
  { term: 'desquamation', type: 'symptom', valueType: 'boolean' },
  { term: 'peeling skin', type: 'symptom', valueType: 'boolean' },

  // Cardiac
  { term: 'chest pain', type: 'symptom', valueType: 'boolean' },
  { term: 'palpitations', type: 'symptom', valueType: 'boolean' },
  { term: 'tachycardia', type: 'symptom', valueType: 'boolean' },
  { term: 'murmur', type: 'symptom', valueType: 'boolean' },
  { term: 'diaphoresis', type: 'symptom', valueType: 'boolean' },
  { term: 'edema', type: 'symptom', valueType: 'boolean' },

  // GU
  { term: 'dysuria', type: 'symptom', valueType: 'boolean' },
  { term: 'painful urination', type: 'symptom', valueType: 'boolean' },
  { term: 'hematuria', type: 'symptom', valueType: 'boolean' },
  { term: 'frequency', type: 'symptom', valueType: 'boolean' },
  { term: 'urgency', type: 'symptom', valueType: 'boolean' },
  { term: 'flank pain', type: 'symptom', valueType: 'boolean' },
  { term: 'testicular pain', type: 'symptom', valueType: 'boolean' },
  { term: 'scrotal swelling', type: 'symptom', valueType: 'boolean' },
  { term: 'vaginal discharge', type: 'symptom', valueType: 'boolean' },
  { term: 'vaginal bleeding', type: 'symptom', valueType: 'boolean' },

  // General / Systemic
  { term: 'fever', type: 'symptom', valueType: 'boolean' },
  { term: 'chills', type: 'symptom', valueType: 'boolean' },
  { term: 'rigors', type: 'symptom', valueType: 'boolean' },
  { term: 'night sweats', type: 'symptom', valueType: 'boolean' },
  { term: 'fatigue', type: 'symptom', valueType: 'boolean' },
  { term: 'malaise', type: 'symptom', valueType: 'boolean' },
  { term: 'weight loss', type: 'symptom', valueType: 'boolean' },
  { term: 'failure to thrive', type: 'symptom', valueType: 'boolean' },
  { term: 'dehydration', type: 'symptom', valueType: 'boolean' },
  { term: 'lymphadenopathy', type: 'symptom', valueType: 'boolean' },
  { term: 'swollen lymph nodes', type: 'symptom', valueType: 'boolean' },

  // MSK
  { term: 'back pain', type: 'symptom', valueType: 'boolean' },
  { term: 'joint pain', type: 'symptom', valueType: 'boolean' },
  { term: 'muscle pain', type: 'symptom', valueType: 'boolean' },
  { term: 'myalgia', type: 'symptom', valueType: 'boolean' },
  { term: 'arthralgia', type: 'symptom', valueType: 'boolean' },
  { term: 'limping', type: 'symptom', valueType: 'boolean' },
  { term: 'extremity swelling', type: 'symptom', valueType: 'boolean' },

  // History
  { term: 'anxiety', type: 'symptom', valueType: 'boolean' },
  { term: 'insomnia', type: 'symptom', valueType: 'boolean' },
  { term: 'obesity', type: 'history', valueType: 'boolean' },
  { term: 'pregnant', type: 'history', valueType: 'boolean' },
  { term: 'oral contraceptive', type: 'history', valueType: 'boolean' },
  { term: 'cancer', type: 'history', valueType: 'boolean' },
  { term: 'malignancy', type: 'history', valueType: 'boolean' },
  { term: 'immunocompromised', type: 'history', valueType: 'boolean' },
  { term: 'premature', type: 'history', valueType: 'boolean' },
  { term: 'unvaccinated', type: 'history', valueType: 'boolean' },
  { term: 'sick contacts', type: 'history', valueType: 'boolean' },
  { term: 'daycare', type: 'history', valueType: 'boolean' },
  { term: 'travel history', type: 'history', valueType: 'boolean' },
];

// Breathing-related terms that map to canonical "Breathing issues"
const BREATHING_SYNONYMS = [
  'trouble breathing', 'shortness of breath', 'short of breath',
  'sob', 'dyspnea', 'difficulty breathing', 'breathlessness',
  'can\'t breathe', 'cannot breathe', 'breathing difficulty',
  'respiratory distress', 'air hunger',
];

const VITAL_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\bHR\s*[:=]?\s*(\d{2,3})\b/gi, label: 'Heart Rate' },
  { pattern: /\bheart rate\s*[:=]?\s*(\d{2,3})\b/gi, label: 'Heart Rate' },
  { pattern: /\bSpO2\s*[:=]?\s*(\d{2,3})\s*%?/gi, label: 'SpO2' },
  { pattern: /\bO2\s*sat\w*\s*[:=]?\s*(\d{2,3})\s*%?/gi, label: 'SpO2' },
  { pattern: /\bRR\s*[:=]?\s*(\d{1,2})\b/gi, label: 'Respiratory Rate' },
  { pattern: /\bresp(?:iratory)?\s*rate\s*[:=]?\s*(\d{1,2})\b/gi, label: 'Respiratory Rate' },
  { pattern: /\bBP\s*[:=]?\s*(\d{2,3})\s*\/\s*(\d{2,3})/gi, label: 'Blood Pressure' },
  { pattern: /\btemp(?:erature)?\s*[:=]?\s*(\d{2,3}(?:\.\d)?)\s*°?\s*[FC]?/gi, label: 'Temperature' },
  { pattern: /\bBMI\s*[:=]?\s*(\d{2,3}(?:\.\d)?)/gi, label: 'BMI' },
];

function extractClinicalTerms(text: string): RawExtraction[] {
  const results: RawExtraction[] = [];
  const lowerText = text.toLowerCase();

  const registry = loadRegistry();

  // 0. Check breathing synonyms first — map to canonical "Breathing issues"
  for (const syn of BREATHING_SYNONYMS) {
    const idx = lowerText.indexOf(syn);
    if (idx === -1) continue;
    // Word boundary check
    const before = idx > 0 ? lowerText[idx - 1] : ' ';
    const after = idx + syn.length < lowerText.length ? lowerText[idx + syn.length] : ' ';
    if (/[a-z0-9]/.test(before) || /[a-z0-9]/.test(after)) continue;
    results.push({
      term: 'Breathing issues',
      span: { start: idx, end: idx + syn.length, text: text.slice(idx, idx + syn.length) },
      negated: isNegated(text, idx),
      inferredType: 'symptom',
      inferredValueType: 'boolean',
    });
    break; // one match is enough
  }

  // 1. Match registry synonyms in text
  for (const feature of registry) {
    if (feature.status === 'merged') continue;
    const allTerms = [feature.canonical_label, ...feature.synonyms];
    for (const term of allTerms) {
      const termLower = term.toLowerCase();
      let searchFrom = 0;
      while (true) {
        const idx = lowerText.indexOf(termLower, searchFrom);
        if (idx === -1) break;
        const before = idx > 0 ? lowerText[idx - 1] : ' ';
        const after = idx + termLower.length < lowerText.length ? lowerText[idx + termLower.length] : ' ';
        if (/[a-z0-9]/.test(before) || /[a-z0-9]/.test(after)) {
          searchFrom = idx + 1;
          continue;
        }
        results.push({
          term: feature.canonical_label,
          span: { start: idx, end: idx + termLower.length, text: text.slice(idx, idx + termLower.length) },
          negated: isNegated(text, idx),
          inferredType: feature.type,
          inferredValueType: feature.value_type,
        });
        searchFrom = idx + termLower.length;
        break;
      }
    }
  }

  // 2. Match extra clinical terms
  for (const { term, type, valueType } of EXTRA_CLINICAL_TERMS) {
    const termLower = term.toLowerCase();
    const idx = lowerText.indexOf(termLower);
    if (idx === -1) continue;
    if (results.some(r => r.span.start <= idx && r.span.end >= idx + termLower.length)) continue;
    results.push({
      term,
      span: { start: idx, end: idx + termLower.length, text: text.slice(idx, idx + termLower.length) },
      negated: isNegated(text, idx),
      inferredType: type,
      inferredValueType: valueType,
    });
  }

  // 3. Extract numeric vitals
  for (const { pattern, label } of VITAL_PATTERNS) {
    pattern.lastIndex = 0;
    const match = pattern.exec(text);
    if (match) {
      const numericVal = parseFloat(match[1]);
      if (!results.some(r => r.span.start <= match.index && r.span.end >= match.index + match[0].length)) {
        results.push({
          term: label,
          span: { start: match.index, end: match.index + match[0].length, text: match[0] },
          negated: false,
          inferredType: 'vital',
          inferredValueType: 'numeric',
          numericValue: numericVal,
        });
      }
    }
  }

  return results;
}

// ---- Deduplication ----

function deduplicateExtractions(extractions: RawExtraction[]): RawExtraction[] {
  const seen = new Map<string, RawExtraction>();
  for (const ext of extractions) {
    const key = ext.term.toLowerCase();
    if (!seen.has(key)) {
      seen.set(key, ext);
    } else if (seen.get(key)!.negated !== ext.negated) {
      seen.set(key + '_neg', ext);
    }
  }
  return Array.from(seen.values());
}

// ---- Main extraction function ----

function toTitleCase(s: string): string {
  return s.replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Extract evidence from a clinical note. Now persists via evidenceStore:
 * - upsertFeature for global labels
 * - upsertPatientEvidence for per-patient data
 * - incrementFeatureUsage for tracking
 */
export function extractEvidenceFromNote(
  noteText: string,
  patientId: string
): { candidates: ExtractionCandidate[]; evidence: PatientEvidence[] } {
  if (!noteText.trim()) return { candidates: [], evidence: [] };

  const demographics = extractDemographics(noteText);
  const rawExtractions = extractClinicalTerms(noteText);
  const deduplicated = deduplicateExtractions(rawExtractions);

  const candidates: ExtractionCandidate[] = [];
  const evidence: PatientEvidence[] = [];
  const usedLabels = new Set<string>();

  // ---- Process demographics via evidenceStore ----

  if (demographics.age) {
    const ageFeat = upsertFeature({
      canonical_label: 'Age',
      feature_type: 'history',
      value_type: 'numeric',
      synonyms: ['age', 'years old', 'y/o'],
    });
    incrementFeatureUsage(ageFeat.id);

    candidates.push({
      label: 'Age',
      type: 'history',
      value_type: 'numeric',
      polarity: 'present',
      value: demographics.age.value,
      spans: [demographics.age.span],
      confidence: 1,
      raw_terms: [demographics.age.span.text],
    });

    const ev = upsertPatientEvidence({
      patient_id: patientId,
      feature_id: ageFeat.id,
      polarity: 'present',
      value_numeric: demographics.age.value,
      source_spans: [demographics.age.span],
      extracted_by: 'auto',
    });
    evidence.push(ev);
    usedLabels.add('age');
  }

  if (demographics.sex) {
    const sexFeat = upsertFeature({
      canonical_label: 'Sex',
      feature_type: 'history',
      value_type: 'categorical',
      synonyms: ['sex', 'gender', 'male', 'female'],
    });
    incrementFeatureUsage(sexFeat.id);

    candidates.push({
      label: 'Sex',
      type: 'history',
      value_type: 'categorical',
      polarity: 'present',
      value: demographics.sex.value,
      spans: [demographics.sex.span],
      confidence: 1,
      raw_terms: [demographics.sex.span.text],
    });

    const ev = upsertPatientEvidence({
      patient_id: patientId,
      feature_id: sexFeat.id,
      polarity: 'present',
      value_category: demographics.sex.value,
      source_spans: [demographics.sex.span],
      extracted_by: 'auto',
    });
    evidence.push(ev);
    usedLabels.add('sex');
  }

  // ---- Process clinical extractions via evidenceStore ----

  for (const ext of deduplicated) {
    const labelKey = ext.term.toLowerCase();
    if (usedLabels.has(labelKey)) continue;
    usedLabels.add(labelKey);

    // Try evidenceStore lookup first, then fallback to registry match
    let feature = findFeatureByLabelOrSynonym(ext.term);

    if (!feature) {
      // Also check raw span text as synonym
      feature = findFeatureByLabelOrSynonym(ext.span.text);
    }

    let featureId: string;
    let label: string;
    let confidence: number;

    if (feature) {
      featureId = feature.id;
      label = feature.canonical_label;
      confidence = 0.95;
      // Ensure raw term is added as synonym
      const normRaw = ext.span.text.toLowerCase();
      if (!feature.synonyms.some(s => s.toLowerCase() === normRaw)) {
        upsertFeature({
          canonical_label: feature.canonical_label,
          feature_type: feature.type,
          value_type: feature.value_type,
          synonyms: [...feature.synonyms, ext.span.text],
        });
      }
    } else {
      // Create new global feature via evidenceStore
      const cleanLabel = toTitleCase(ext.term);
      const created = upsertFeature({
        canonical_label: cleanLabel,
        feature_type: ext.inferredType,
        value_type: ext.inferredValueType,
        synonyms: [ext.span.text.toLowerCase()],
      });
      featureId = created.id;
      label = cleanLabel;
      confidence = 0.5;
    }

    incrementFeatureUsage(featureId);

    const polarity = ext.negated ? 'absent' as const : 'present' as const;

    candidates.push({
      label,
      type: ext.inferredType,
      value_type: ext.inferredValueType,
      polarity,
      value: ext.numericValue ?? (polarity === 'present'),
      spans: [ext.span],
      confidence,
      raw_terms: [ext.span.text],
    });

    const ev = upsertPatientEvidence({
      patient_id: patientId,
      feature_id: featureId,
      polarity,
      value_boolean: ext.inferredValueType === 'boolean' ? polarity === 'present' : null,
      value_numeric: ext.numericValue ?? null,
      value_category: null,
      source_spans: [ext.span],
      extracted_by: 'auto',
    });
    evidence.push(ev);
  }

  return { candidates, evidence };
}
