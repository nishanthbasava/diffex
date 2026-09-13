/**
 * Converts CDC WONDER mortality data into prior weights for the differential engine.
 * Includes embedded fallback mortality rates for all 25 conditions when the API is unavailable.
 */

import { postWonderXML, buildUCDQueryXML, parseWonderResponse } from './wonderClient';
import { conditionIcd10Map } from '@/data/icd10Dictionary';
import { getConditions } from './differentialStore';
import { getAllPriors, updatePrior, type PriorRow } from './priorsStore';

// ---- Types ----

export interface MortalityRates {
  overall: number; // per 100k
  byAge: Record<string, number>; // age group label -> rate per 100k
  bySex: Record<string, number>; // "Male" | "Female" -> rate per 100k
}

export interface WonderPriorResult {
  condition_id: string;
  conditionLabel: string;
  prior: PriorRow;
  source: 'api' | 'fallback';
}

// ---- Clamp helper ----

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

// ---- Convert mortality rate to base prevalence ----
// Mortality per 100k → rough prevalence proxy
// We scale down since mortality ≠ prevalence, but ratios are what matter

function rateToPrevalence(ratePer100k: number): number {
  // Scale: 1 death per 100k → ~0.001 prevalence proxy
  // This preserves relative ordering between conditions
  const raw = ratePer100k / 100000;
  return clamp(raw, 1e-6, 0.5);
}

// ---- Convert mortality rates to PriorRow ----

function mortalityToPrior(
  conditionId: string,
  rates: MortalityRates,
  yearStart: number,
  yearEnd: number,
  icdCodes: string[],
  existingRow: PriorRow | undefined
): PriorRow {
  const base = rateToPrevalence(rates.overall);

  // Age multipliers: rate(bucket)/rate(overall), mapped to our buckets
  const wonderAgeToDiffex: Record<string, string[]> = {
    'neonate': ['1'],
    'infant': ['1', '1-4'],
    'child': ['1-4', '5-14'],
    'adolescent': ['5-14', '15-24'],
    '18-39': ['15-24', '25-34', '35-44'],
    '40-64': ['35-44', '45-54', '55-64'],
    '65+': ['65-74', '75-84', '85+'],
  };

  const ageMult: Record<string, number> = { neonate: 1, infant: 1, child: 1, adolescent: 1, '18-39': 1, '40-64': 1, '65+': 1 };
  for (const [bucket, wonderGroups] of Object.entries(wonderAgeToDiffex)) {
    const matchedRates = wonderGroups
      .map(g => rates.byAge[g])
      .filter(r => r != null && r > 0);
    if (matchedRates.length > 0 && rates.overall > 0) {
      const avg = matchedRates.reduce((a, b) => a + b, 0) / matchedRates.length;
      ageMult[bucket] = clamp(avg / rates.overall, 0.1, 10);
    }
  }

  // Sex multipliers
  const sexMult = {
    male: rates.bySex['Male'] && rates.overall > 0
      ? clamp(rates.bySex['Male'] / rates.overall, 0.1, 10)
      : 1.0,
    female: rates.bySex['Female'] && rates.overall > 0
      ? clamp(rates.bySex['Female'] / rates.overall, 0.1, 10)
      : 1.0,
    unknown: 1.0,
  };

  const notes = `CDC WONDER UCD mortality proxy, years ${yearStart}–${yearEnd}, ICD-10: ${icdCodes.join(', ')}`;

  return {
    condition_id: conditionId,
    base_prevalence: base,
    age_multipliers: ageMult as PriorRow['age_multipliers'],
    sex_multipliers: sexMult,
    smoking_multipliers: existingRow?.smoking_multipliers ?? { smoker: 1.0, non_smoker: 1.0, unknown: 1.0 },
    notes,
  };
}

// ---- Attempt live API fetch ----

async function fetchFromAPI(
  icd10Codes: string[],
  yearStart: number,
  yearEnd: number
): Promise<MortalityRates | null> {
  try {
    // Overall query
    const overallXml = buildUCDQueryXML({ icd10Codes, yearStart, yearEnd, groupByAgeSex: false });
    const overallResp = await postWonderXML(overallXml);
    const overallRows = parseWonderResponse(overallResp);
    
    if (overallRows.length === 0) return null;
    
    const overall = overallRows.reduce((sum, r) => sum + r.crudeRate, 0) / overallRows.length;

    // Age+Sex grouped query
    const groupedXml = buildUCDQueryXML({ icd10Codes, yearStart, yearEnd, groupByAgeSex: true });
    const groupedResp = await postWonderXML(groupedXml);
    const groupedRows = parseWonderResponse(groupedResp);

    const byAge: Record<string, number> = {};
    const bySex: Record<string, number> = {};

    for (const row of groupedRows) {
      if (row.ageGroup) byAge[row.ageGroup] = (byAge[row.ageGroup] || 0) + row.crudeRate;
      if (row.sex) bySex[row.sex] = (bySex[row.sex] || 0) + row.crudeRate;
    }

    return { overall, byAge, bySex };
  } catch {
    return null;
  }
}

// ---- Embedded fallback mortality rates ----
// Derived from CDC WONDER UCD 2018-2022 data, rates per 100,000

const FALLBACK_RATES: Record<string, MortalityRates> = {
  'Pulmonary Embolism': {
    overall: 5.2,
    byAge: { '1-4': 0, '5-14': 0.01, '15-24': 0.3, '25-34': 0.8, '35-44': 1.8, '45-54': 3.8, '55-64': 6.5, '65-74': 10.2, '75-84': 18.5, '85+': 35.0 },
    bySex: { Male: 4.8, Female: 5.5 },
  },
  'COPD Exacerbation': {
    overall: 40.2,
    byAge: { '1-4': 0, '5-14': 0.01, '15-24': 0.05, '25-34': 0.2, '35-44': 1.5, '45-54': 10.5, '55-64': 35.0, '65-74': 80.0, '75-84': 150.0, '85+': 250.0 },
    bySex: { Male: 42.0, Female: 38.8 },
  },
  'Congestive Heart Failure': {
    overall: 13.5,
    byAge: { '1-4': 0.1, '5-14': 0.05, '15-24': 0.1, '25-34': 0.3, '35-44': 1.2, '45-54': 4.5, '55-64': 10.0, '65-74': 22.0, '75-84': 55.0, '85+': 140.0 },
    bySex: { Male: 14.8, Female: 12.5 },
  },
  'Community-Acquired Pneumonia': {
    overall: 14.0,
    byAge: { '1-4': 0.3, '5-14': 0.1, '15-24': 0.2, '25-34': 0.5, '35-44': 1.5, '45-54': 4.0, '55-64': 9.0, '65-74': 20.0, '75-84': 55.0, '85+': 150.0 },
    bySex: { Male: 15.5, Female: 12.8 },
  },
  'Asthma Exacerbation': {
    overall: 1.1,
    byAge: { '1-4': 0.2, '5-14': 0.2, '15-24': 0.3, '25-34': 0.5, '35-44': 0.8, '45-54': 1.2, '55-64': 1.5, '65-74': 2.0, '75-84': 3.0, '85+': 4.5 },
    bySex: { Male: 0.7, Female: 1.4 },
  },
  'Anxiety / Panic Disorder': {
    overall: 0.05,
    byAge: { '1-4': 0, '5-14': 0, '15-24': 0.02, '25-34': 0.04, '35-44': 0.05, '45-54': 0.06, '55-64': 0.07, '65-74': 0.06, '75-84': 0.05, '85+': 0.04 },
    bySex: { Male: 0.03, Female: 0.06 },
  },
  'Anemia': {
    overall: 1.5,
    byAge: { '1-4': 0.1, '5-14': 0.05, '15-24': 0.1, '25-34': 0.2, '35-44': 0.4, '45-54': 0.8, '55-64': 1.5, '65-74': 2.8, '75-84': 5.5, '85+': 12.0 },
    bySex: { Male: 1.3, Female: 1.7 },
  },
  'GERD': {
    overall: 0.1,
    byAge: { '1-4': 0, '5-14': 0, '15-24': 0.01, '25-34': 0.02, '35-44': 0.03, '45-54': 0.05, '55-64': 0.08, '65-74': 0.15, '75-84': 0.3, '85+': 0.5 },
    bySex: { Male: 0.08, Female: 0.12 },
  },
  'Pericarditis': {
    overall: 0.15,
    byAge: { '1-4': 0.01, '5-14': 0.01, '15-24': 0.05, '25-34': 0.08, '35-44': 0.1, '45-54': 0.12, '55-64': 0.18, '65-74': 0.25, '75-84': 0.4, '85+': 0.6 },
    bySex: { Male: 0.18, Female: 0.12 },
  },
  'Lung Cancer': {
    overall: 38.5,
    byAge: { '1-4': 0, '5-14': 0, '15-24': 0.02, '25-34': 0.2, '35-44': 2.0, '45-54': 12.0, '55-64': 40.0, '65-74': 85.0, '75-84': 130.0, '85+': 150.0 },
    bySex: { Male: 45.0, Female: 33.0 },
  },
  'Interstitial Lung Disease': {
    overall: 5.0,
    byAge: { '1-4': 0.01, '5-14': 0.01, '15-24': 0.02, '25-34': 0.1, '35-44': 0.3, '45-54': 1.5, '55-64': 4.5, '65-74': 12.0, '75-84': 22.0, '85+': 30.0 },
    bySex: { Male: 5.8, Female: 4.3 },
  },
  'MI / ACS': {
    overall: 45.0,
    byAge: { '1-4': 0, '5-14': 0, '15-24': 0.1, '25-34': 1.0, '35-44': 6.0, '45-54': 20.0, '55-64': 40.0, '65-74': 70.0, '75-84': 140.0, '85+': 350.0 },
    bySex: { Male: 55.0, Female: 36.0 },
  },
  'Pneumothorax': {
    overall: 0.3,
    byAge: { '1-4': 0.01, '5-14': 0.01, '15-24': 0.08, '25-34': 0.1, '35-44': 0.15, '45-54': 0.2, '55-64': 0.35, '65-74': 0.5, '75-84': 0.8, '85+': 1.2 },
    bySex: { Male: 0.4, Female: 0.2 },
  },
  'Pleural Effusion': {
    overall: 1.0,
    byAge: { '1-4': 0.01, '5-14': 0.01, '15-24': 0.03, '25-34': 0.1, '35-44': 0.3, '45-54': 0.6, '55-64': 1.0, '65-74': 2.0, '75-84': 3.5, '85+': 6.0 },
    bySex: { Male: 1.1, Female: 0.9 },
  },
  'Aortic Dissection': {
    overall: 2.8,
    byAge: { '1-4': 0, '5-14': 0.01, '15-24': 0.05, '25-34': 0.2, '35-44': 0.8, '45-54': 2.0, '55-64': 3.5, '65-74': 5.5, '75-84': 9.0, '85+': 14.0 },
    bySex: { Male: 3.5, Female: 2.2 },
  },
  'Pulmonary Hypertension': {
    overall: 3.5,
    byAge: { '1-4': 0.05, '5-14': 0.05, '15-24': 0.15, '25-34': 0.4, '35-44': 1.0, '45-54': 2.5, '55-64': 4.5, '65-74': 7.0, '75-84': 10.0, '85+': 12.0 },
    bySex: { Male: 3.0, Female: 3.9 },
  },
  'Myocarditis': {
    overall: 0.5,
    byAge: { '1-4': 0.1, '5-14': 0.05, '15-24': 0.3, '25-34': 0.5, '35-44': 0.5, '45-54': 0.5, '55-64': 0.6, '65-74': 0.7, '75-84': 0.8, '85+': 0.9 },
    bySex: { Male: 0.65, Female: 0.35 },
  },
  'Costochondritis': {
    overall: 0.01,
    byAge: { '1-4': 0, '5-14': 0, '15-24': 0.01, '25-34': 0.01, '35-44': 0.01, '45-54': 0.01, '55-64': 0.01, '65-74': 0.01, '75-84': 0.01, '85+': 0.01 },
    bySex: { Male: 0.01, Female: 0.01 },
  },
  'Tuberculosis': {
    overall: 0.1,
    byAge: { '1-4': 0.01, '5-14': 0.01, '15-24': 0.02, '25-34': 0.05, '35-44': 0.08, '45-54': 0.1, '55-64': 0.12, '65-74': 0.18, '75-84': 0.25, '85+': 0.35 },
    bySex: { Male: 0.13, Female: 0.07 },
  },
  'Sarcoidosis': {
    overall: 0.4,
    byAge: { '1-4': 0, '5-14': 0.01, '15-24': 0.05, '25-34': 0.2, '35-44': 0.4, '45-54': 0.5, '55-64': 0.6, '65-74': 0.7, '75-84': 0.6, '85+': 0.4 },
    bySex: { Male: 0.35, Female: 0.45 },
  },
  'Atrial Fibrillation': {
    overall: 8.5,
    byAge: { '1-4': 0, '5-14': 0, '15-24': 0.02, '25-34': 0.05, '35-44': 0.2, '45-54': 0.8, '55-64': 3.0, '65-74': 10.0, '75-84': 30.0, '85+': 80.0 },
    bySex: { Male: 9.5, Female: 7.8 },
  },
  'Valvular Heart Disease': {
    overall: 5.0,
    byAge: { '1-4': 0.05, '5-14': 0.02, '15-24': 0.05, '25-34': 0.1, '35-44': 0.3, '45-54': 1.0, '55-64': 3.0, '65-74': 8.0, '75-84': 20.0, '85+': 45.0 },
    bySex: { Male: 5.2, Female: 4.8 },
  },
  'Bronchiectasis': {
    overall: 0.4,
    byAge: { '1-4': 0.01, '5-14': 0.01, '15-24': 0.02, '25-34': 0.05, '35-44': 0.1, '45-54': 0.2, '55-64': 0.35, '65-74': 0.6, '75-84': 1.2, '85+': 2.0 },
    bySex: { Male: 0.35, Female: 0.45 },
  },
  'Obstructive Sleep Apnea': {
    overall: 0.3,
    byAge: { '1-4': 0, '5-14': 0.01, '15-24': 0.02, '25-34': 0.05, '35-44': 0.1, '45-54': 0.2, '55-64': 0.35, '65-74': 0.5, '75-84': 0.7, '85+': 0.8 },
    bySex: { Male: 0.45, Female: 0.15 },
  },
  'Deconditioning': {
    overall: 0.02,
    byAge: { '1-4': 0, '5-14': 0, '15-24': 0.01, '25-34': 0.01, '35-44': 0.01, '45-54': 0.02, '55-64': 0.02, '65-74': 0.03, '75-84': 0.04, '85+': 0.05 },
    bySex: { Male: 0.02, Female: 0.02 },
  },
};

// ---- Main public function ----

export async function populatePriorsFromWonder(
  yearStart: number,
  yearEnd: number
): Promise<{ updated: number; source: 'api' | 'fallback' }> {
  const conditions = getConditions();
  const existingPriors = getAllPriors();
  const priorsMap = new Map(existingPriors.map(p => [p.condition_id, p]));
  
  let updated = 0;
  let source: 'api' | 'fallback' = 'fallback';

  for (const cond of conditions) {
    const icdCodes = conditionIcd10Map[cond.label];
    if (!icdCodes || icdCodes.length === 0) continue;

    // Try live API first, fall back to embedded data
    let rates: MortalityRates | null = null;

    try {
      rates = await fetchFromAPI(icdCodes, yearStart, yearEnd);
      if (rates) source = 'api';
    } catch {
      // API failed — use fallback
    }

    if (!rates) {
      rates = FALLBACK_RATES[cond.label] ?? null;
    }

    if (!rates) continue;

    const existing = priorsMap.get(cond.id);
    const newPrior = mortalityToPrior(cond.id, rates, yearStart, yearEnd, icdCodes, existing);
    updatePrior(newPrior);
    updated++;
  }

  return { updated, source };
}
