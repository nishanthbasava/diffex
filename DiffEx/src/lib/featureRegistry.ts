import type { RegistryFeature } from '@/types/evidence';
import { features as kbFeatures } from '@/data/knowledgeBase';

const STORAGE_KEY = 'diffex_feature_registry';

// ---- Seed from knowledgeBase ----

function buildSeedRegistry(): RegistryFeature[] {
  const synonymMap: Record<string, string[]> = {
    sob: ['SOB', 'dyspnea', 'trouble breathing', 'difficulty breathing', 'breathlessness', 'short of breath'],
    chest_pain: ['chest pain', 'chest discomfort', 'substernal pain', 'angina'],
    cough: ['cough', 'coughing'],
    hemoptysis: ['hemoptysis', 'coughing blood', 'blood in sputum'],
    leg_swelling: ['leg swelling', 'lower extremity edema', 'pedal edema', 'swollen legs'],
    orthopnea: ['orthopnea', 'can\'t breathe lying down'],
    pnd: ['PND', 'paroxysmal nocturnal dyspnea', 'waking up short of breath'],
    palpitations: ['palpitations', 'heart racing', 'irregular heartbeat'],
    fatigue: ['fatigue', 'tiredness', 'exhaustion', 'malaise', 'lethargy'],
    fever: ['fever', 'febrile', 'elevated temperature', 'chills'],
    weight_loss: ['weight loss', 'unintentional weight loss', 'losing weight'],
    pleuritic: ['pleuritic chest pain', 'pain worse with breathing', 'sharp chest pain with inspiration'],
    smoker: ['smoking', 'smoker', 'tobacco use', 'pack-year', 'cigarette'],
    sedentary: ['sedentary', 'inactive', 'sedentary lifestyle'],
    hx_gerd: ['GERD', 'acid reflux', 'heartburn', 'gastroesophageal reflux'],
    hx_dm: ['diabetes', 'DM', 'type 2 diabetes', 'T2DM', 'diabetes mellitus'],
    hx_htn: ['hypertension', 'HTN', 'high blood pressure', 'elevated blood pressure'],
    hx_dvt: ['DVT', 'deep vein thrombosis', 'PE', 'pulmonary embolism', 'VTE', 'history of DVT'],
    recent_surgery: ['recent surgery', 'immobilization', 'recent immobilization', 'post-operative'],
    family_cad: ['family history of CAD', 'family history of heart disease', 'familial CAD'],
    tachycardia: ['tachycardia', 'rapid heart rate', 'HR > 100', 'heart rate elevated'],
    hypoxia: ['hypoxia', 'low oxygen', 'SpO2 < 94', 'desaturation', 'low O2'],
    tachypnea: ['tachypnea', 'rapid breathing', 'RR > 20', 'respiratory rate elevated'],
    hypertension: ['elevated BP', 'high blood pressure reading'],
    hypotension: ['hypotension', 'low blood pressure', 'BP low'],
    elevated_ddimer: ['elevated D-dimer', 'D-dimer positive', 'high D-dimer'],
    elevated_troponin: ['elevated troponin', 'troponin positive', 'high troponin'],
    elevated_bnp: ['elevated BNP', 'elevated NT-proBNP', 'high BNP'],
    low_hgb: ['low hemoglobin', 'anemia', 'low Hgb', 'low Hb'],
    elevated_wbc: ['elevated WBC', 'leukocytosis', 'high white count'],
    elevated_crp: ['elevated CRP', 'elevated ESR', 'high CRP', 'high ESR'],
  };

  return kbFeatures.map(f => ({
    id: `kb_${f.id}`,
    canonical_label: f.name,
    type: f.type as RegistryFeature['type'],
    value_type: (f.type === 'lab' || f.type === 'vital') ? 'numeric' as const : 'boolean' as const,
    synonyms: synonymMap[f.id] || [f.name.toLowerCase()],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    created_by: 'system',
    usage_count: 0,
    status: 'active' as const,
    kb_feature_id: f.id,
  }));
}

// ---- Registry CRUD ----

export function loadRegistry(): RegistryFeature[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as RegistryFeature[];
      // Ensure seed features exist
      const seedFeatures = buildSeedRegistry();
      const existingIds = new Set(parsed.map(f => f.id));
      const missing = seedFeatures.filter(f => !existingIds.has(f.id));
      if (missing.length > 0) {
        const merged = [...parsed, ...missing];
        saveRegistry(merged);
        return merged;
      }
      return parsed;
    }
  } catch {
    // fall through
  }
  const seed = buildSeedRegistry();
  saveRegistry(seed);
  return seed;
}

export function saveRegistry(registry: RegistryFeature[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(registry));
}

export function addFeatureToRegistry(feature: Omit<RegistryFeature, 'id' | 'created_at' | 'updated_at' | 'usage_count'>): RegistryFeature {
  const registry = loadRegistry();
  const newFeature: RegistryFeature = {
    ...feature,
    id: `rf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    usage_count: 0,
  };
  registry.push(newFeature);
  saveRegistry(registry);
  return newFeature;
}

export function updateRegistryFeature(id: string, updates: Partial<RegistryFeature>): void {
  const registry = loadRegistry();
  const idx = registry.findIndex(f => f.id === id);
  if (idx >= 0) {
    registry[idx] = { ...registry[idx], ...updates, updated_at: new Date().toISOString() };
    saveRegistry(registry);
  }
}

export function mergeFeatures(sourceId: string, targetId: string): void {
  const registry = loadRegistry();
  const source = registry.find(f => f.id === sourceId);
  const target = registry.find(f => f.id === targetId);
  if (!source || !target) return;

  // Transfer synonyms
  const allSynonyms = [...new Set([...target.synonyms, ...source.synonyms])];
  target.synonyms = allSynonyms;
  target.usage_count += source.usage_count;
  target.updated_at = new Date().toISOString();

  source.status = 'merged';
  source.merged_into = targetId;
  source.updated_at = new Date().toISOString();

  saveRegistry(registry);
}

export function incrementUsage(id: string): void {
  const registry = loadRegistry();
  const feature = registry.find(f => f.id === id);
  if (feature) {
    feature.usage_count++;
    feature.updated_at = new Date().toISOString();
    saveRegistry(registry);
  }
}

// ---- Matching ----

/** Normalize text for comparison */
function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
}

/** Simple Dice coefficient for fuzzy matching */
function diceCoefficient(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 1;
  if (na.length < 2 || nb.length < 2) return 0;
  const bigrams = (s: string) => {
    const set = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const bi = s.slice(i, i + 2);
      set.set(bi, (set.get(bi) || 0) + 1);
    }
    return set;
  };
  const aBigrams = bigrams(na);
  const bBigrams = bigrams(nb);
  let intersection = 0;
  for (const [bi, count] of aBigrams) {
    intersection += Math.min(count, bBigrams.get(bi) || 0);
  }
  return (2 * intersection) / (na.length - 1 + nb.length - 1);
}

export interface MatchResult {
  feature: RegistryFeature;
  matchType: 'exact' | 'synonym' | 'fuzzy';
  score: number;
}

/**
 * Find the best match in the registry for a given term.
 * Returns null if no sufficiently good match is found.
 */
export function findBestMatch(term: string, registry: RegistryFeature[]): MatchResult | null {
  const normalized = normalize(term);
  const active = registry.filter(f => f.status !== 'merged');

  // 1. Exact canonical_label match
  for (const f of active) {
    if (normalize(f.canonical_label) === normalized) {
      return { feature: f, matchType: 'exact', score: 1 };
    }
  }

  // 2. Synonym match
  for (const f of active) {
    for (const syn of f.synonyms) {
      if (normalize(syn) === normalized) {
        return { feature: f, matchType: 'synonym', score: 0.95 };
      }
    }
  }

  // 3. Substring / contains match (e.g., "trouble breathing" matches synonym "trouble breathing")
  for (const f of active) {
    const normLabel = normalize(f.canonical_label);
    if (normLabel.includes(normalized) || normalized.includes(normLabel)) {
      return { feature: f, matchType: 'fuzzy', score: 0.85 };
    }
    for (const syn of f.synonyms) {
      const normSyn = normalize(syn);
      if (normSyn.includes(normalized) || normalized.includes(normSyn)) {
        return { feature: f, matchType: 'fuzzy', score: 0.8 };
      }
    }
  }

  // 4. Fuzzy match (conservative threshold)
  let bestMatch: MatchResult | null = null;
  const FUZZY_THRESHOLD = 0.65;

  for (const f of active) {
    const labelScore = diceCoefficient(normalized, f.canonical_label);
    if (labelScore > FUZZY_THRESHOLD && (!bestMatch || labelScore > bestMatch.score)) {
      bestMatch = { feature: f, matchType: 'fuzzy', score: labelScore };
    }
    for (const syn of f.synonyms) {
      const synScore = diceCoefficient(normalized, syn);
      if (synScore > FUZZY_THRESHOLD && (!bestMatch || synScore > bestMatch.score)) {
        bestMatch = { feature: f, matchType: 'fuzzy', score: synScore };
      }
    }
  }

  return bestMatch;
}
