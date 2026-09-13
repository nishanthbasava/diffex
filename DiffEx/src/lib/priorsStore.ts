import { getConditions } from './differentialStore';
import type { PatientEvidenceJoined } from './evidenceStore';

const PRIORS_KEY = 'diffex_priors';
const PRIORS_SEEDED_KEY = 'diffex_priors_seeded_v1';

// ---- Types ----

export interface PriorRow {
  condition_id: string;
  base_prevalence: number;
  age_multipliers: { 'neonate': number; 'infant': number; 'child': number; 'adolescent': number; '18-39': number; '40-64': number; '65+': number };
  sex_multipliers: { male: number; female: number; unknown: number };
  smoking_multipliers: { smoker: number; non_smoker: number; unknown: number };
  notes?: string;
}

export type AgeBucket = 'neonate' | 'infant' | 'child' | 'adolescent' | '18-39' | '40-64' | '65+';
export type SexBucket = 'male' | 'female' | 'unknown';
export type SmokingBucket = 'smoker' | 'non_smoker' | 'unknown';

export interface PatientContext {
  age_bucket: AgeBucket;
  sex: SexBucket;
  smoking: SmokingBucket;
}

export interface PriorBreakdown {
  base_prevalence: number;
  tier_label: string;
  age_bucket: AgeBucket;
  age_multiplier: number;
  sex: SexBucket;
  sex_multiplier: number;
  smoker_status: SmokingBucket;
  smoking_multiplier: number;
  prior_weight: number;
}

// ---- Storage helpers ----

function loadPriors(): PriorRow[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(PRIORS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}

function savePriors(rows: PriorRow[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PRIORS_KEY, JSON.stringify(rows));
}

// ---- Derive patient context from evidence ----

export function derivePatientContext(evidence: PatientEvidenceJoined[]): PatientContext {
  let age_bucket: AgeBucket = '40-64';
  let sex: SexBucket = 'unknown';
  let smoking: SmokingBucket = 'unknown';

  for (const ev of evidence) {
    const label = ev.canonical_label.toLowerCase();
    if (label === 'age' && ev.value_numeric != null) {
      const age = ev.value_numeric;
      if (age < 0.077) age_bucket = 'neonate';       // ~28 days
      else if (age < 1) age_bucket = 'infant';
      else if (age < 13) age_bucket = 'child';
      else if (age < 18) age_bucket = 'adolescent';
      else if (age < 40) age_bucket = '18-39';
      else if (age < 65) age_bucket = '40-64';
      else age_bucket = '65+';
    }
    if (label === 'sex' && ev.value_category) {
      const val = ev.value_category.toLowerCase();
      if (val === 'male' || val === 'm') sex = 'male';
      else if (val === 'female' || val === 'f') sex = 'female';
    }
    if (label.includes('smoking')) {
      if (ev.polarity === 'present') smoking = 'smoker';
      else if (ev.polarity === 'absent') smoking = 'non_smoker';
    }
  }

  return { age_bucket, sex, smoking };
}

// ---- Tier label helper ----

function getTierLabel(prevalence: number): string {
  if (prevalence >= 0.08) return 'very_common';
  if (prevalence >= 0.02) return 'common';
  if (prevalence >= 0.005) return 'uncommon';
  if (prevalence >= 0.002) return 'rare';
  return 'very_rare';
}

// ---- Get prior weight with full breakdown ----

export function getPriorWeightBreakdown(
  conditionId: string,
  evidence: PatientEvidenceJoined[],
  conditionPriorBase: number = 1.0
): PriorBreakdown {
  const priors = loadPriors();
  const row = priors.find(p => p.condition_id === conditionId);
  const ctx = derivePatientContext(evidence);

  if (!row) {
    // Use the condition's own prior_base (set during import) rather than a
    // flat 1.0, so imported diseases compete on realistic prevalence footing.
    return {
      base_prevalence: conditionPriorBase,
      tier_label: getTierLabel(conditionPriorBase),
      age_bucket: ctx.age_bucket,
      age_multiplier: 1.0,
      sex: ctx.sex,
      sex_multiplier: 1.0,
      smoker_status: ctx.smoking,
      smoking_multiplier: 1.0,
      prior_weight: conditionPriorBase,
    };
  }

  const age_multiplier = row.age_multipliers[ctx.age_bucket];
  const sex_multiplier = row.sex_multipliers[ctx.sex];
  const smoking_multiplier = row.smoking_multipliers[ctx.smoking];
  const prior_weight = row.base_prevalence * age_multiplier * sex_multiplier * smoking_multiplier;

  return {
    base_prevalence: row.base_prevalence,
    tier_label: getTierLabel(row.base_prevalence),
    age_bucket: ctx.age_bucket,
    age_multiplier,
    sex: ctx.sex,
    sex_multiplier,
    smoker_status: ctx.smoking,
    smoking_multiplier,
    prior_weight,
  };
}

export function getPriorWeight(conditionId: string, evidence: PatientEvidenceJoined[], conditionPriorBase: number = 1.0): number {
  return getPriorWeightBreakdown(conditionId, evidence, conditionPriorBase).prior_weight;
}

// ---- Public API for editor ----

export function getAllPriors(): PriorRow[] {
  return loadPriors();
}

export function updatePrior(updated: PriorRow): void {
  const all = loadPriors();
  const idx = all.findIndex(p => p.condition_id === updated.condition_id);
  if (idx >= 0) {
    all[idx] = updated;
  } else {
    all.push(updated);
  }
  savePriors(all);
}

export function resetPriors(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(PRIORS_KEY);
  localStorage.removeItem(PRIORS_SEEDED_KEY);
  seedPriorsIfEmpty();
}

// ---- Prevalence tiers ----
const VERY_COMMON = 0.10;
const COMMON = 0.03;
const UNCOMMON = 0.01;
const RARE = 0.003;
const VERY_RARE = 0.001;

// Default neutral multipliers
const AGE_NEUTRAL = { neonate: 1.0, infant: 1.0, child: 1.0, adolescent: 1.0, '18-39': 1.0, '40-64': 1.0, '65+': 1.0 };
// Adult-skewed: low in pediatric buckets
const AGE_ADULT = (vals: {n?: number; i?: number; c?: number; a?: number; y?: number; m?: number; o?: number}) =>
  ({ neonate: vals.n ?? 0.1, infant: vals.i ?? 0.1, child: vals.c ?? 0.2, adolescent: vals.a ?? 0.3, '18-39': vals.y ?? 1.0, '40-64': vals.m ?? 1.0, '65+': vals.o ?? 1.0 });
// Pediatric-skewed: high in pediatric buckets, low in adult
const AGE_PEDS = (vals: {n?: number; i?: number; c?: number; a?: number; y?: number; m?: number; o?: number}) =>
  ({ neonate: vals.n ?? 1.0, infant: vals.i ?? 1.5, child: vals.c ?? 1.5, adolescent: vals.a ?? 1.2, '18-39': vals.y ?? 0.1, '40-64': vals.m ?? 0.05, '65+': vals.o ?? 0.05 });
const SEX_NEUTRAL = { male: 1.0, female: 1.0, unknown: 1.0 };
const SMOKE_NEUTRAL = { smoker: 1.0, non_smoker: 1.0, unknown: 1.0 };

export function seedPriorsIfEmpty(): void {
  if (typeof window === 'undefined') return;
  if (localStorage.getItem(PRIORS_SEEDED_KEY)) return;

  const conditions = getConditions();
  if (conditions.length === 0) return;

  const labelMap = new Map(conditions.map(c => [c.label, c.id]));
  const id = (label: string) => labelMap.get(label) ?? '';

  const rows: PriorRow[] = [
    // ---- Adult cardiopulm (with pediatric downweight) ----
    { condition_id: id('Pulmonary Embolism'), base_prevalence: RARE, age_multipliers: AGE_ADULT({n:0.05,i:0.05,c:0.1,a:0.3,y:0.8,m:1.2,o:1.8}), sex_multipliers: { male: 1.0, female: 1.2, unknown: 1.0 }, smoking_multipliers: SMOKE_NEUTRAL, notes: 'Very rare in children' },
    { condition_id: id('COPD Exacerbation'), base_prevalence: COMMON, age_multipliers: AGE_ADULT({n:0.01,i:0.01,c:0.05,a:0.1,y:0.6,m:1.3,o:2.0}), sex_multipliers: { male: 1.1, female: 1.0, unknown: 1.0 }, smoking_multipliers: { smoker: 2.5, non_smoker: 0.5, unknown: 1.0 }, notes: 'Essentially adult disease' },
    { condition_id: id('Congestive Heart Failure'), base_prevalence: UNCOMMON, age_multipliers: AGE_ADULT({n:0.1,i:0.1,c:0.1,a:0.2,y:0.6,m:1.2,o:2.5}), sex_multipliers: { male: 1.2, female: 1.0, unknown: 1.0 }, smoking_multipliers: { smoker: 1.3, non_smoker: 1.0, unknown: 1.0 }, notes: 'Rare in children except congenital' },
    { condition_id: id('Community-Acquired Pneumonia'), base_prevalence: COMMON, age_multipliers: { neonate: 0.8, infant: 1.2, child: 1.2, adolescent: 0.9, '18-39': 0.8, '40-64': 1.0, '65+': 1.8 }, sex_multipliers: SEX_NEUTRAL, smoking_multipliers: { smoker: 1.5, non_smoker: 1.0, unknown: 1.0 }, notes: 'Common across all ages' },
    { condition_id: id('Asthma Exacerbation'), base_prevalence: COMMON, age_multipliers: { neonate: 0.3, infant: 0.8, child: 1.5, adolescent: 1.3, '18-39': 1.2, '40-64': 1.0, '65+': 0.8 }, sex_multipliers: { male: 0.9, female: 1.1, unknown: 1.0 }, smoking_multipliers: { smoker: 1.3, non_smoker: 1.0, unknown: 1.0 }, notes: 'Common in children' },
    { condition_id: id('Anxiety / Panic Disorder'), base_prevalence: COMMON, age_multipliers: AGE_ADULT({n:0.01,i:0.01,c:0.1,a:0.6,y:1.3,m:1.0,o:0.7}), sex_multipliers: { male: 0.8, female: 1.3, unknown: 1.0 }, smoking_multipliers: SMOKE_NEUTRAL, notes: 'Peaks in young adults' },
    { condition_id: id('Anemia'), base_prevalence: COMMON, age_multipliers: { neonate: 0.8, infant: 1.0, child: 1.0, adolescent: 1.0, '18-39': 1.0, '40-64': 1.0, '65+': 1.5 }, sex_multipliers: { male: 0.8, female: 1.3, unknown: 1.0 }, smoking_multipliers: SMOKE_NEUTRAL, notes: 'Can occur at any age' },
    { condition_id: id('GERD'), base_prevalence: VERY_COMMON, age_multipliers: AGE_ADULT({n:0.1,i:0.3,c:0.3,a:0.4,y:0.9,m:1.2,o:1.3}), sex_multipliers: SEX_NEUTRAL, smoking_multipliers: { smoker: 1.2, non_smoker: 1.0, unknown: 1.0 }, notes: 'Uncommon in children' },
    { condition_id: id('Pericarditis'), base_prevalence: RARE, age_multipliers: { neonate: 0.3, infant: 0.3, child: 0.5, adolescent: 0.8, '18-39': 1.2, '40-64': 1.0, '65+': 1.0 }, sex_multipliers: { male: 1.2, female: 0.9, unknown: 1.0 }, smoking_multipliers: SMOKE_NEUTRAL, notes: 'Uncommon in children' },
    { condition_id: id('Lung Cancer'), base_prevalence: RARE, age_multipliers: AGE_ADULT({n:0.01,i:0.01,c:0.01,a:0.02,y:0.5,m:1.5,o:2.5}), sex_multipliers: { male: 1.3, female: 1.0, unknown: 1.0 }, smoking_multipliers: { smoker: 3.0, non_smoker: 0.5, unknown: 1.0 }, notes: 'Essentially absent in children' },
    { condition_id: id('Interstitial Lung Disease'), base_prevalence: RARE, age_multipliers: AGE_ADULT({n:0.05,i:0.05,c:0.1,a:0.2,y:0.7,m:1.3,o:1.8}), sex_multipliers: { male: 1.1, female: 1.0, unknown: 1.0 }, smoking_multipliers: { smoker: 1.5, non_smoker: 1.0, unknown: 1.0 }, notes: 'Very rare in children' },
    { condition_id: id('MI / ACS'), base_prevalence: UNCOMMON, age_multipliers: AGE_ADULT({n:0.01,i:0.01,c:0.01,a:0.05,y:0.6,m:1.5,o:2.5}), sex_multipliers: { male: 1.5, female: 0.8, unknown: 1.0 }, smoking_multipliers: { smoker: 1.8, non_smoker: 1.0, unknown: 1.0 }, notes: 'Essentially absent in children' },
    { condition_id: id('Pneumothorax'), base_prevalence: RARE, age_multipliers: { neonate: 0.5, infant: 0.3, child: 0.5, adolescent: 1.0, '18-39': 1.3, '40-64': 1.0, '65+': 1.0 }, sex_multipliers: { male: 1.5, female: 0.7, unknown: 1.0 }, smoking_multipliers: { smoker: 1.5, non_smoker: 1.0, unknown: 1.0 }, notes: 'Can occur in adolescents' },
    { condition_id: id('Pleural Effusion'), base_prevalence: UNCOMMON, age_multipliers: AGE_ADULT({n:0.2,i:0.3,c:0.4,a:0.5,y:0.8,m:1.2,o:1.5}), sex_multipliers: SEX_NEUTRAL, smoking_multipliers: SMOKE_NEUTRAL, notes: 'Less common in children' },
    { condition_id: id('Aortic Dissection'), base_prevalence: VERY_RARE, age_multipliers: AGE_ADULT({n:0.01,i:0.01,c:0.01,a:0.05,y:0.6,m:1.5,o:2.0}), sex_multipliers: { male: 1.5, female: 0.8, unknown: 1.0 }, smoking_multipliers: { smoker: 1.3, non_smoker: 1.0, unknown: 1.0 }, notes: 'Absent in children' },
    { condition_id: id('Pulmonary Hypertension'), base_prevalence: RARE, age_multipliers: { neonate: 0.5, infant: 0.4, child: 0.5, adolescent: 0.6, '18-39': 1.0, '40-64': 1.2, '65+': 1.5 }, sex_multipliers: { male: 0.8, female: 1.3, unknown: 1.0 }, smoking_multipliers: SMOKE_NEUTRAL, notes: 'Can occur in neonates' },
    { condition_id: id('Myocarditis'), base_prevalence: RARE, age_multipliers: { neonate: 0.5, infant: 0.8, child: 0.8, adolescent: 1.0, '18-39': 1.3, '40-64': 1.0, '65+': 0.8 }, sex_multipliers: { male: 1.3, female: 0.8, unknown: 1.0 }, smoking_multipliers: SMOKE_NEUTRAL, notes: 'Can occur in children' },
    { condition_id: id('Costochondritis'), base_prevalence: COMMON, age_multipliers: { neonate: 0.1, infant: 0.1, child: 0.5, adolescent: 1.0, '18-39': 1.2, '40-64': 1.0, '65+': 0.8 }, sex_multipliers: { male: 0.9, female: 1.1, unknown: 1.0 }, smoking_multipliers: SMOKE_NEUTRAL, notes: 'Can occur in adolescents' },
    { condition_id: id('Tuberculosis'), base_prevalence: RARE, age_multipliers: { neonate: 0.5, infant: 0.8, child: 0.8, adolescent: 0.9, '18-39': 1.2, '40-64': 1.0, '65+': 1.3 }, sex_multipliers: { male: 1.2, female: 0.9, unknown: 1.0 }, smoking_multipliers: { smoker: 1.3, non_smoker: 1.0, unknown: 1.0 }, notes: 'Can occur at any age' },
    { condition_id: id('Sarcoidosis'), base_prevalence: RARE, age_multipliers: AGE_ADULT({n:0.01,i:0.01,c:0.05,a:0.2,y:1.3,m:1.0,o:0.8}), sex_multipliers: { male: 0.9, female: 1.1, unknown: 1.0 }, smoking_multipliers: SMOKE_NEUTRAL, notes: 'Very rare in children' },
    { condition_id: id('Atrial Fibrillation'), base_prevalence: UNCOMMON, age_multipliers: AGE_ADULT({n:0.01,i:0.01,c:0.02,a:0.05,y:0.6,m:1.2,o:2.5}), sex_multipliers: { male: 1.3, female: 0.8, unknown: 1.0 }, smoking_multipliers: { smoker: 1.2, non_smoker: 1.0, unknown: 1.0 }, notes: 'Essentially absent in children' },
    { condition_id: id('Valvular Heart Disease'), base_prevalence: UNCOMMON, age_multipliers: { neonate: 0.3, infant: 0.3, child: 0.4, adolescent: 0.5, '18-39': 0.8, '40-64': 1.2, '65+': 2.0 }, sex_multipliers: SEX_NEUTRAL, smoking_multipliers: SMOKE_NEUTRAL, notes: 'Congenital can occur early' },
    { condition_id: id('Bronchiectasis'), base_prevalence: RARE, age_multipliers: { neonate: 0.1, infant: 0.2, child: 0.5, adolescent: 0.6, '18-39': 0.9, '40-64': 1.2, '65+': 1.5 }, sex_multipliers: { male: 0.9, female: 1.1, unknown: 1.0 }, smoking_multipliers: { smoker: 1.3, non_smoker: 1.0, unknown: 1.0 }, notes: 'Uncommon in children' },
    { condition_id: id('Obstructive Sleep Apnea'), base_prevalence: COMMON, age_multipliers: AGE_ADULT({n:0.01,i:0.05,c:0.3,a:0.4,y:0.8,m:1.3,o:1.5}), sex_multipliers: { male: 1.5, female: 0.7, unknown: 1.0 }, smoking_multipliers: { smoker: 1.2, non_smoker: 1.0, unknown: 1.0 }, notes: 'Uncommon in children' },
    { condition_id: id('Deconditioning'), base_prevalence: VERY_COMMON, age_multipliers: AGE_ADULT({n:0.01,i:0.05,c:0.3,a:0.5,y:0.8,m:1.0,o:1.5}), sex_multipliers: SEX_NEUTRAL, smoking_multipliers: SMOKE_NEUTRAL, notes: 'Primarily adult diagnosis' },

    // ---- GI / ABDOMINAL PACK ----
    { condition_id: id('Appendicitis'), base_prevalence: UNCOMMON, age_multipliers: AGE_ADULT({n:0.01,i:0.05,c:0.5,a:1.5,y:1.3,m:0.8,o:0.5}), sex_multipliers: { male: 1.2, female: 0.9, unknown: 1.0 }, smoking_multipliers: SMOKE_NEUTRAL, notes: 'Peak 10-30y; use Pediatric Appendicitis for children' },
    { condition_id: id('Cholecystitis'), base_prevalence: UNCOMMON, age_multipliers: AGE_ADULT({n:0.01,i:0.01,c:0.05,a:0.2,y:0.8,m:1.3,o:1.5}), sex_multipliers: { male: 0.7, female: 1.4, unknown: 1.0 }, smoking_multipliers: SMOKE_NEUTRAL, notes: 'Female predominance; rare in children' },
    { condition_id: id('Pancreatitis'), base_prevalence: UNCOMMON, age_multipliers: AGE_ADULT({n:0.01,i:0.01,c:0.05,a:0.2,y:0.8,m:1.3,o:1.2}), sex_multipliers: { male: 1.2, female: 1.0, unknown: 1.0 }, smoking_multipliers: { smoker: 1.3, non_smoker: 1.0, unknown: 1.0 }, notes: 'Rare in children' },
    { condition_id: id('Small Bowel Obstruction'), base_prevalence: UNCOMMON, age_multipliers: AGE_ADULT({n:0.1,i:0.1,c:0.2,a:0.3,y:0.8,m:1.2,o:2.0}), sex_multipliers: SEX_NEUTRAL, smoking_multipliers: SMOKE_NEUTRAL, notes: 'Increases with age; rare in children without prior surgery' },
    { condition_id: id('Gastroenteritis'), base_prevalence: VERY_COMMON, age_multipliers: { neonate: 0.5, infant: 1.5, child: 1.5, adolescent: 1.2, '18-39': 1.0, '40-64': 0.8, '65+': 1.0 }, sex_multipliers: SEX_NEUTRAL, smoking_multipliers: SMOKE_NEUTRAL, notes: 'Common across all ages' },
    { condition_id: id('Diverticulitis'), base_prevalence: UNCOMMON, age_multipliers: AGE_ADULT({n:0.01,i:0.01,c:0.01,a:0.05,y:0.5,m:1.3,o:2.0}), sex_multipliers: SEX_NEUTRAL, smoking_multipliers: SMOKE_NEUTRAL, notes: 'Almost exclusively adult; increases with age' },
    { condition_id: id('Peptic Ulcer Disease'), base_prevalence: UNCOMMON, age_multipliers: AGE_ADULT({n:0.01,i:0.01,c:0.05,a:0.2,y:0.8,m:1.3,o:1.5}), sex_multipliers: { male: 1.3, female: 0.8, unknown: 1.0 }, smoking_multipliers: { smoker: 1.5, non_smoker: 1.0, unknown: 1.0 }, notes: 'Rare in children' },
    { condition_id: id('GI Bleed'), base_prevalence: UNCOMMON, age_multipliers: AGE_ADULT({n:0.1,i:0.1,c:0.2,a:0.3,y:0.7,m:1.2,o:2.0}), sex_multipliers: { male: 1.2, female: 0.9, unknown: 1.0 }, smoking_multipliers: SMOKE_NEUTRAL, notes: 'Increases with age' },
    { condition_id: id('Mesenteric Ischemia'), base_prevalence: VERY_RARE, age_multipliers: AGE_ADULT({n:0.01,i:0.01,c:0.01,a:0.05,y:0.3,m:1.0,o:3.0}), sex_multipliers: SEX_NEUTRAL, smoking_multipliers: { smoker: 1.5, non_smoker: 1.0, unknown: 1.0 }, notes: 'Primarily elderly' },
    { condition_id: id('Bowel Perforation'), base_prevalence: VERY_RARE, age_multipliers: AGE_ADULT({n:0.2,i:0.1,c:0.1,a:0.2,y:0.7,m:1.2,o:2.0}), sex_multipliers: SEX_NEUTRAL, smoking_multipliers: SMOKE_NEUTRAL, notes: 'Rare; increases with age' },
    { condition_id: id('Renal Colic'), base_prevalence: UNCOMMON, age_multipliers: AGE_ADULT({n:0.01,i:0.01,c:0.1,a:0.3,y:1.2,m:1.3,o:0.8}), sex_multipliers: { male: 1.5, female: 0.7, unknown: 1.0 }, smoking_multipliers: SMOKE_NEUTRAL, notes: 'Peak 20-50y; male predominance' },
    { condition_id: id('Pyelonephritis'), base_prevalence: UNCOMMON, age_multipliers: AGE_ADULT({n:0.3,i:0.5,c:0.5,a:0.7,y:1.2,m:1.0,o:1.3}), sex_multipliers: { male: 0.5, female: 1.5, unknown: 1.0 }, smoking_multipliers: SMOKE_NEUTRAL, notes: 'Female predominance' },
    { condition_id: id('UTI'), base_prevalence: COMMON, age_multipliers: AGE_ADULT({n:0.3,i:0.5,c:0.5,a:0.7,y:1.2,m:1.0,o:1.5}), sex_multipliers: { male: 0.3, female: 1.5, unknown: 1.0 }, smoking_multipliers: SMOKE_NEUTRAL, notes: 'Strong female predominance' },

    // ---- GYN PACK ----
    { condition_id: id('Ovarian Torsion'), base_prevalence: RARE, age_multipliers: AGE_ADULT({n:0.1,i:0.2,c:0.5,a:1.5,y:1.5,m:0.8,o:0.3}), sex_multipliers: { male: 0.01, female: 2.0, unknown: 1.0 }, smoking_multipliers: SMOKE_NEUTRAL, notes: 'Females only; peak reproductive age' },
    { condition_id: id('Ectopic Pregnancy'), base_prevalence: RARE, age_multipliers: AGE_ADULT({n:0.01,i:0.01,c:0.01,a:0.3,y:1.5,m:0.5,o:0.01}), sex_multipliers: { male: 0.01, female: 2.0, unknown: 1.0 }, smoking_multipliers: SMOKE_NEUTRAL, notes: 'Females of reproductive age only' },
    { condition_id: id('PID'), base_prevalence: UNCOMMON, age_multipliers: AGE_ADULT({n:0.01,i:0.01,c:0.05,a:0.8,y:1.5,m:0.8,o:0.2}), sex_multipliers: { male: 0.01, female: 2.0, unknown: 1.0 }, smoking_multipliers: SMOKE_NEUTRAL, notes: 'Females; peak in young adults' },
    { condition_id: id('Ruptured Ovarian Cyst'), base_prevalence: UNCOMMON, age_multipliers: AGE_ADULT({n:0.01,i:0.01,c:0.1,a:1.0,y:1.5,m:0.8,o:0.2}), sex_multipliers: { male: 0.01, female: 2.0, unknown: 1.0 }, smoking_multipliers: SMOKE_NEUTRAL, notes: 'Females of reproductive age' },
    { condition_id: id('Endometriosis'), base_prevalence: UNCOMMON, age_multipliers: AGE_ADULT({n:0.01,i:0.01,c:0.05,a:0.5,y:1.5,m:1.0,o:0.3}), sex_multipliers: { male: 0.01, female: 2.0, unknown: 1.0 }, smoking_multipliers: SMOKE_NEUTRAL, notes: 'Females; peak reproductive age' },

    // ---- SEPSIS ----
    { condition_id: id('Sepsis'), base_prevalence: UNCOMMON, age_multipliers: { neonate: 1.5, infant: 1.2, child: 0.8, adolescent: 0.6, '18-39': 0.8, '40-64': 1.2, '65+': 2.5 }, sex_multipliers: { male: 1.2, female: 0.9, unknown: 1.0 }, smoking_multipliers: SMOKE_NEUTRAL, notes: 'Bimodal: neonates and elderly' },

    // ---- PEDIATRIC CORE PACK ----
    { condition_id: id('Herpangina'), base_prevalence: COMMON, age_multipliers: AGE_PEDS({n:0.3,i:1.5,c:2.0,a:0.5,y:0.1,m:0.02,o:0.01}), sex_multipliers: SEX_NEUTRAL, smoking_multipliers: SMOKE_NEUTRAL, notes: 'Peak 1-7y' },
    { condition_id: id('Hand-Foot-Mouth Disease'), base_prevalence: COMMON, age_multipliers: AGE_PEDS({n:0.3,i:1.5,c:2.0,a:0.3,y:0.1,m:0.02,o:0.01}), sex_multipliers: SEX_NEUTRAL, smoking_multipliers: SMOKE_NEUTRAL, notes: 'Peak <5y' },
    { condition_id: id('Viral URI'), base_prevalence: VERY_COMMON, age_multipliers: AGE_PEDS({n:0.5,i:1.5,c:1.5,a:1.2,y:0.8,m:0.5,o:0.5}), sex_multipliers: SEX_NEUTRAL, smoking_multipliers: SMOKE_NEUTRAL, notes: 'Very common at all pediatric ages' },
    { condition_id: id('Influenza'), base_prevalence: COMMON, age_multipliers: { neonate: 0.5, infant: 1.0, child: 1.5, adolescent: 1.2, '18-39': 1.0, '40-64': 1.0, '65+': 1.5 }, sex_multipliers: SEX_NEUTRAL, smoking_multipliers: SMOKE_NEUTRAL, notes: 'All ages affected' },
    { condition_id: id('RSV Bronchiolitis'), base_prevalence: COMMON, age_multipliers: AGE_PEDS({n:1.0,i:2.5,c:1.0,a:0.1,y:0.02,m:0.01,o:0.01}), sex_multipliers: { male: 1.2, female: 0.9, unknown: 1.0 }, smoking_multipliers: SMOKE_NEUTRAL, notes: 'Peak <2y' },
    { condition_id: id('Adenovirus Infection'), base_prevalence: COMMON, age_multipliers: AGE_PEDS({n:0.5,i:1.5,c:1.5,a:0.8,y:0.2,m:0.05,o:0.05}), sex_multipliers: SEX_NEUTRAL, smoking_multipliers: SMOKE_NEUTRAL, notes: 'Common in young children' },
    { condition_id: id('Roseola'), base_prevalence: COMMON, age_multipliers: AGE_PEDS({n:0.1,i:2.5,c:0.5,a:0.05,y:0.01,m:0.01,o:0.01}), sex_multipliers: SEX_NEUTRAL, smoking_multipliers: SMOKE_NEUTRAL, notes: 'Peak 6m-2y' },
    { condition_id: id('Fifth Disease'), base_prevalence: UNCOMMON, age_multipliers: AGE_PEDS({n:0.05,i:0.5,c:2.0,a:1.0,y:0.3,m:0.05,o:0.05}), sex_multipliers: SEX_NEUTRAL, smoking_multipliers: SMOKE_NEUTRAL, notes: 'Peak 5-15y' },
    { condition_id: id('Croup'), base_prevalence: COMMON, age_multipliers: AGE_PEDS({n:0.1,i:1.5,c:2.0,a:0.2,y:0.02,m:0.01,o:0.01}), sex_multipliers: { male: 1.3, female: 0.8, unknown: 1.0 }, smoking_multipliers: SMOKE_NEUTRAL, notes: 'Peak 6m-3y; male predominance' },
    { condition_id: id('Pediatric Asthma Exacerbation'), base_prevalence: COMMON, age_multipliers: AGE_PEDS({n:0.1,i:0.5,c:2.0,a:1.5,y:0.1,m:0.05,o:0.05}), sex_multipliers: { male: 1.2, female: 0.9, unknown: 1.0 }, smoking_multipliers: SMOKE_NEUTRAL, notes: 'Peak 5-17y' },
    { condition_id: id('Pediatric Pneumonia'), base_prevalence: COMMON, age_multipliers: AGE_PEDS({n:0.5,i:1.2,c:1.5,a:1.0,y:0.1,m:0.05,o:0.05}), sex_multipliers: SEX_NEUTRAL, smoking_multipliers: SMOKE_NEUTRAL, notes: 'Common across pediatric ages' },
    { condition_id: id('Pertussis'), base_prevalence: RARE, age_multipliers: AGE_PEDS({n:2.0,i:2.0,c:1.5,a:0.8,y:0.3,m:0.1,o:0.1}), sex_multipliers: SEX_NEUTRAL, smoking_multipliers: SMOKE_NEUTRAL, notes: 'Most dangerous in neonates/infants' },
    { condition_id: id('Foreign Body Aspiration'), base_prevalence: RARE, age_multipliers: AGE_PEDS({n:0.3,i:2.0,c:2.0,a:0.3,y:0.1,m:0.05,o:0.05}), sex_multipliers: { male: 1.3, female: 0.8, unknown: 1.0 }, smoking_multipliers: SMOKE_NEUTRAL, notes: 'Peak 1-3y' },
    { condition_id: id('Epiglottitis'), base_prevalence: VERY_RARE, age_multipliers: AGE_PEDS({n:0.1,i:0.5,c:2.0,a:1.0,y:0.3,m:0.2,o:0.1}), sex_multipliers: { male: 1.2, female: 0.9, unknown: 1.0 }, smoking_multipliers: SMOKE_NEUTRAL, notes: 'Rare since Hib vaccine; peak 2-6y' },
    { condition_id: id('Acute Otitis Media'), base_prevalence: VERY_COMMON, age_multipliers: AGE_PEDS({n:0.3,i:2.0,c:2.0,a:0.5,y:0.1,m:0.05,o:0.05}), sex_multipliers: { male: 1.1, female: 0.9, unknown: 1.0 }, smoking_multipliers: SMOKE_NEUTRAL, notes: 'Peak 6m-3y' },
    { condition_id: id('Streptococcal Pharyngitis'), base_prevalence: COMMON, age_multipliers: AGE_PEDS({n:0.01,i:0.1,c:2.0,a:1.5,y:0.5,m:0.2,o:0.1}), sex_multipliers: SEX_NEUTRAL, smoking_multipliers: SMOKE_NEUTRAL, notes: 'Peak 5-15y; rare <3y' },
    { condition_id: id('Viral Pharyngitis'), base_prevalence: VERY_COMMON, age_multipliers: AGE_PEDS({n:0.2,i:1.0,c:1.5,a:1.5,y:0.8,m:0.5,o:0.3}), sex_multipliers: SEX_NEUTRAL, smoking_multipliers: SMOKE_NEUTRAL, notes: 'Very common' },
    { condition_id: id('Peritonsillar Abscess'), base_prevalence: RARE, age_multipliers: AGE_PEDS({n:0.01,i:0.05,c:0.5,a:2.0,y:1.5,m:0.3,o:0.1}), sex_multipliers: SEX_NEUTRAL, smoking_multipliers: SMOKE_NEUTRAL, notes: 'Peak in adolescents' },
    { condition_id: id('Retropharyngeal Abscess'), base_prevalence: VERY_RARE, age_multipliers: AGE_PEDS({n:0.5,i:1.5,c:2.0,a:0.5,y:0.1,m:0.05,o:0.05}), sex_multipliers: { male: 1.2, female: 0.9, unknown: 1.0 }, smoking_multipliers: SMOKE_NEUTRAL, notes: 'Peak <5y' },
    { condition_id: id('Viral Gastroenteritis'), base_prevalence: VERY_COMMON, age_multipliers: AGE_PEDS({n:0.5,i:2.0,c:1.5,a:1.0,y:0.5,m:0.3,o:0.3}), sex_multipliers: SEX_NEUTRAL, smoking_multipliers: SMOKE_NEUTRAL, notes: 'Very common in infants/toddlers' },
    { condition_id: id('Pediatric Constipation'), base_prevalence: VERY_COMMON, age_multipliers: AGE_PEDS({n:0.3,i:0.8,c:2.0,a:1.5,y:0.3,m:0.2,o:0.2}), sex_multipliers: SEX_NEUTRAL, smoking_multipliers: SMOKE_NEUTRAL, notes: 'Very common in school-age children' },
    { condition_id: id('Pediatric Appendicitis'), base_prevalence: UNCOMMON, age_multipliers: AGE_PEDS({n:0.01,i:0.05,c:1.5,a:2.0,y:0.3,m:0.1,o:0.05}), sex_multipliers: { male: 1.2, female: 0.9, unknown: 1.0 }, smoking_multipliers: SMOKE_NEUTRAL, notes: 'Peak 10-19y; rare <5y' },
    { condition_id: id('Intussusception'), base_prevalence: RARE, age_multipliers: AGE_PEDS({n:0.3,i:3.0,c:1.0,a:0.1,y:0.02,m:0.01,o:0.01}), sex_multipliers: { male: 1.5, female: 0.7, unknown: 1.0 }, smoking_multipliers: SMOKE_NEUTRAL, notes: 'Peak 3m-3y' },
    { condition_id: id('Pyloric Stenosis'), base_prevalence: RARE, age_multipliers: AGE_PEDS({n:1.0,i:3.0,c:0.01,a:0.01,y:0.01,m:0.01,o:0.01}), sex_multipliers: { male: 2.0, female: 0.5, unknown: 1.0 }, smoking_multipliers: SMOKE_NEUTRAL, notes: 'Typically 2-8 weeks; strong male predominance' },
    { condition_id: id('Malrotation with Volvulus'), base_prevalence: VERY_RARE, age_multipliers: AGE_PEDS({n:3.0,i:2.0,c:0.5,a:0.1,y:0.05,m:0.02,o:0.01}), sex_multipliers: { male: 1.3, female: 0.8, unknown: 1.0 }, smoking_multipliers: SMOKE_NEUTRAL, notes: 'Most present in first month of life' },
    { condition_id: id('Mesenteric Adenitis'), base_prevalence: UNCOMMON, age_multipliers: AGE_PEDS({n:0.1,i:0.5,c:2.0,a:1.5,y:0.3,m:0.1,o:0.05}), sex_multipliers: SEX_NEUTRAL, smoking_multipliers: SMOKE_NEUTRAL, notes: 'Common pediatric mimic of appendicitis' },
    { condition_id: id('IgA Vasculitis (HSP)'), base_prevalence: RARE, age_multipliers: AGE_PEDS({n:0.1,i:0.5,c:2.5,a:1.0,y:0.2,m:0.05,o:0.02}), sex_multipliers: { male: 1.2, female: 0.9, unknown: 1.0 }, smoking_multipliers: SMOKE_NEUTRAL, notes: 'Peak 3-10y' },
    { condition_id: id('Pediatric UTI'), base_prevalence: COMMON, age_multipliers: AGE_PEDS({n:1.0,i:1.5,c:1.5,a:1.0,y:0.2,m:0.1,o:0.1}), sex_multipliers: { male: 0.5, female: 1.5, unknown: 1.0 }, smoking_multipliers: SMOKE_NEUTRAL, notes: 'Female predominance after infancy' },
    { condition_id: id('Pediatric Pyelonephritis'), base_prevalence: UNCOMMON, age_multipliers: AGE_PEDS({n:0.8,i:1.5,c:1.5,a:1.0,y:0.2,m:0.1,o:0.1}), sex_multipliers: { male: 0.5, female: 1.5, unknown: 1.0 }, smoking_multipliers: SMOKE_NEUTRAL, notes: 'Follows UTI demographics' },
    { condition_id: id('Testicular Torsion'), base_prevalence: RARE, age_multipliers: AGE_PEDS({n:1.5,i:0.5,c:0.8,a:2.5,y:0.5,m:0.1,o:0.01}), sex_multipliers: { male: 10.0, female: 0.01, unknown: 1.0 }, smoking_multipliers: SMOKE_NEUTRAL, notes: 'Peak neonatal and adolescent; males only' },
    { condition_id: id('Febrile Seizure'), base_prevalence: COMMON, age_multipliers: AGE_PEDS({n:0.3,i:2.0,c:2.0,a:0.1,y:0.01,m:0.01,o:0.01}), sex_multipliers: { male: 1.1, female: 0.9, unknown: 1.0 }, smoking_multipliers: SMOKE_NEUTRAL, notes: 'Peak 6m-5y' },
    { condition_id: id('Pediatric Epilepsy'), base_prevalence: UNCOMMON, age_multipliers: AGE_PEDS({n:0.5,i:1.0,c:1.5,a:1.5,y:0.5,m:0.3,o:0.3}), sex_multipliers: SEX_NEUTRAL, smoking_multipliers: SMOKE_NEUTRAL, notes: 'Can present at any age' },
    { condition_id: id('Meningitis'), base_prevalence: RARE, age_multipliers: AGE_PEDS({n:3.0,i:2.0,c:1.5,a:1.0,y:0.5,m:0.3,o:0.3}), sex_multipliers: { male: 1.2, female: 0.9, unknown: 1.0 }, smoking_multipliers: SMOKE_NEUTRAL, notes: 'Highest in neonates; decreases with age' },
    { condition_id: id('Encephalitis'), base_prevalence: VERY_RARE, age_multipliers: AGE_PEDS({n:1.0,i:1.5,c:1.5,a:1.0,y:0.5,m:0.3,o:0.5}), sex_multipliers: SEX_NEUTRAL, smoking_multipliers: SMOKE_NEUTRAL, notes: 'Rare; can occur at any age' },
    { condition_id: id('Neonatal Sepsis'), base_prevalence: UNCOMMON, age_multipliers: AGE_PEDS({n:10.0,i:1.0,c:0.01,a:0.01,y:0.01,m:0.01,o:0.01}), sex_multipliers: { male: 1.2, female: 0.9, unknown: 1.0 }, smoking_multipliers: SMOKE_NEUTRAL, notes: 'Exclusively neonatal' },
    { condition_id: id('Hyperbilirubinemia'), base_prevalence: COMMON, age_multipliers: AGE_PEDS({n:10.0,i:2.0,c:0.01,a:0.01,y:0.01,m:0.01,o:0.01}), sex_multipliers: SEX_NEUTRAL, smoking_multipliers: SMOKE_NEUTRAL, notes: 'Primarily neonatal' },
    { condition_id: id('BRUE'), base_prevalence: UNCOMMON, age_multipliers: AGE_PEDS({n:2.0,i:3.0,c:0.1,a:0.01,y:0.01,m:0.01,o:0.01}), sex_multipliers: SEX_NEUTRAL, smoking_multipliers: SMOKE_NEUTRAL, notes: 'Primarily <1y' },
    { condition_id: id('Scarlet Fever'), base_prevalence: UNCOMMON, age_multipliers: AGE_PEDS({n:0.01,i:0.1,c:2.5,a:1.0,y:0.1,m:0.02,o:0.01}), sex_multipliers: SEX_NEUTRAL, smoking_multipliers: SMOKE_NEUTRAL, notes: 'Peak 5-15y' },
    { condition_id: id('Kawasaki Disease'), base_prevalence: RARE, age_multipliers: AGE_PEDS({n:0.3,i:2.0,c:2.5,a:0.3,y:0.02,m:0.01,o:0.01}), sex_multipliers: { male: 1.5, female: 0.7, unknown: 1.0 }, smoking_multipliers: SMOKE_NEUTRAL, notes: 'Peak <5y; male predominance' },
    { condition_id: id('MIS-C'), base_prevalence: VERY_RARE, age_multipliers: AGE_PEDS({n:0.2,i:0.8,c:2.0,a:2.0,y:0.1,m:0.02,o:0.01}), sex_multipliers: { male: 1.3, female: 0.8, unknown: 1.0 }, smoking_multipliers: SMOKE_NEUTRAL, notes: 'Peak 6-12y' },
  ];

  // Filter out rows with empty condition_id (condition not found)
  const validRows = rows.filter(r => r.condition_id !== '');
  savePriors(validRows);
  localStorage.setItem(PRIORS_SEEDED_KEY, 'true');
  console.log(`[DiffEx] Seeded ${validRows.length} prior rows`);
}
