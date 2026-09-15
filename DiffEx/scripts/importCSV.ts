/**
 * importCSV.ts
 *
 * Imports diseases from a Google Sheets CSV export into Supabase.
 *
 * Expected CSV columns:
 *   TAG | ICD10 Code | Disease Name | OUTPUT (JSON)
 *
 * OUTPUT JSON shape:
 *   { acuity_score, acute_findings: [{ finding_name, finding_type, LR_positive, LR_negative }] }
 *
 * Usage:
 *   npx tsx scripts/importCSV.ts path/to/your-export.csv
 *
 * The script reads .env automatically for Supabase credentials.
 */

import fs from 'fs';
import path from 'path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// ---- Load .env manually (no dotenv needed) ----
function loadEnv(): Record<string, string> {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return {};
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  const env: Record<string, string> = {};
  for (const line of lines) {
    const match = line.match(/^([^=]+)=["']?([^"'\n]*)["']?/);
    if (match) env[match[1].trim()] = match[2].trim();
  }
  return env;
}

// ---- Robust CSV parser (handles JSON in quoted fields) ----
function parseCSV(raw: string): string[][] {
  const rows: string[][] = [];
  let col = '';
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    const next = raw[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') { col += '"'; i++; } // escaped quote
      else if (ch === '"') { inQuotes = false; }
      else { col += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { row.push(col); col = ''; }
      else if (ch === '\n' || (ch === '\r' && next === '\n')) {
        if (ch === '\r') i++;
        row.push(col); col = '';
        if (row.some(c => c.trim())) rows.push(row);
        row = [];
      } else { col += ch; }
    }
  }
  if (col || row.length) { row.push(col); if (row.some(c => c.trim())) rows.push(row); }
  return rows;
}

// ---- Prior base from TAG category + acuity score ----
// Base prevalence tier by category (how common this category of disease is
// in a typical presenting population).
const CATEGORY_BASE: Record<string, number> = {
  'respiratory & ent': 0.08,
  'respiratory':       0.07,
  'ent':               0.06,
  'gi':                0.05,
  'gastrointestinal':  0.05,
  'cardiac':           0.03,
  'cardiovascular':    0.03,
  'musculoskeletal':   0.04,
  'msk':               0.04,
  'neurological':      0.03,
  'neuro':             0.03,
  'infectious':        0.05,
  'dermatology':       0.04,
  'derm':              0.04,
  'endocrine':         0.02,
  'metabolic':         0.02,
  'renal':             0.02,
  'gu':                0.02,
  'urologic':          0.02,
  'psychiatric':       0.04,
  'psych':             0.04,
  'hematologic':       0.02,
  'oncologic':         0.01,
  'vascular':          0.02,
  'pediatric':         0.05,
  'gynecologic':       0.03,
  'gyn':               0.03,
};

// Acuity reduces prior: critical/rare emergencies are less common.
// acuity 1-3: common presentations → multiply ×1.0
// acuity 4-6: moderate             → multiply ×0.4
// acuity 7-8: severe               → multiply ×0.15
// acuity 9-10: critical            → multiply ×0.05
function acuityMultiplier(acuity: number): number {
  if (acuity <= 3) return 1.0;
  if (acuity <= 6) return 0.4;
  if (acuity <= 8) return 0.15;
  return 0.05;
}

function computePriorBase(tag: string | null, acuityScore: number): number {
  const key = (tag ?? '').toLowerCase().trim();
  let base = CATEGORY_BASE[key] ?? 0.03; // default: uncommon
  base *= acuityMultiplier(acuityScore);
  // Clamp to valid range
  return Math.min(0.15, Math.max(0.0005, base));
}

// ---- Feature type mapping ----
function mapFeatureType(findingType: string): string {
  const t = findingType.toLowerCase();
  if (t.includes('lab') || t.includes('blood') || t.includes('serum')) return 'lab';
  if (t.includes('test') || t.includes('imaging') || t.includes('scan') || t.includes('xray') || t.includes('x-ray')) return 'test';
  if (t.includes('history') || t.includes('risk factor')) return 'history';
  if (t.includes('vital') || t.includes('sign') && (t.includes('vital'))) return 'vital';
  // "Sign" and "Symptom" both map to symptom in our model
  return 'symptom';
}

// ---- Batch upsert helper ----
const BATCH_SIZE = 200;
async function batchUpsert(supabase: SupabaseClient, table: string, rows: object[], onConflict: string): Promise<void> {
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from(table).upsert(batch, { onConflict, ignoreDuplicates: false });
    if (error) throw new Error(`${table} upsert failed: ${JSON.stringify(error)}`);
    process.stdout.write('.');
  }
}

// ---- Main ----
async function main() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error('Usage: npx tsx scripts/importCSV.ts path/to/diseases.csv');
    process.exit(1);
  }

  const env = loadEnv();
  const supabaseUrl = env['VITE_SUPABASE_URL'];
  const supabaseKey = env['VITE_SUPABASE_PUBLISHABLE_KEY'];

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in .env');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const raw = fs.readFileSync(path.resolve(csvPath), 'utf-8');
  const rows = parseCSV(raw);
  if (rows.length < 2) { console.error('CSV appears empty.'); process.exit(1); }

  // Find column indexes from header row
  const header = rows[0].map(h => h.trim().toLowerCase());
  const tagIdx      = header.findIndex(h => h === 'tag');
  const icdIdx      = header.findIndex(h => h.includes('icd'));
  const nameIdx     = header.findIndex(h => h.includes('disease') || h === 'name');
  const outputIdx   = header.findIndex(h => h === 'output');

  if (nameIdx === -1 || outputIdx === -1) {
    console.error('Could not find required columns. Found headers:', header);
    process.exit(1);
  }

  console.log(`Parsed ${rows.length - 1} data rows.`);
  console.log(`Columns: tag=${tagIdx}, icd10=${icdIdx}, name=${nameIdx}, output=${outputIdx}\n`);

  // ---- Collect all unique features across all rows ----
  const featureMap = new Map<string, {
    canonical_label: string;
    feature_type: string;
    value_type: string;
    synonyms: string[];
  }>();

  const conditionRows: { id: string; label: string; category: string; acuteness: number; prior_base: number }[] = [];
  const edgeRows: { condition_label: string; feature_label: string; lr_present: number; lr_absent: number }[] = [];

  let skipped = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const name    = row[nameIdx]?.trim();
    const tag     = tagIdx >= 0 ? row[tagIdx]?.trim() : null;
    const icd10   = icdIdx >= 0 ? row[icdIdx]?.trim() : null;
    const rawJson = row[outputIdx]?.trim();

    if (!name || !rawJson) { skipped++; continue; }

    let output: {
      acuity_score?: number;
      acute_findings?: { finding_name?: string; finding_type?: string; LR_positive?: number; LR_negative?: number }[];
    };
    try {
      output = JSON.parse(rawJson);
    } catch {
      console.warn(`  [skip] Row ${i}: could not parse OUTPUT JSON for "${name}"`);
      skipped++;
      continue;
    }

    const acuityScore: number = output.acuity_score ?? 5;
    const acuteness = Math.min(1.0, Math.max(0.05, acuityScore / 10));
    const prior_base = computePriorBase(tag, acuityScore);

    conditionRows.push({
      id: `cond_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 50)}_${i}`,
      label: name,
      category: tag ?? 'Other',
      acuteness,
      prior_base,
    });

    const findings = output.acute_findings ?? [];
    for (const f of findings) {
      const label = f.finding_name?.trim();
      if (!label) continue;
      const key = label.toLowerCase().trim();

      if (!featureMap.has(key)) {
        featureMap.set(key, {
          canonical_label: label,
          feature_type: mapFeatureType(f.finding_type ?? 'symptom'),
          value_type: 'boolean',
          synonyms: [],
        });
      }

      edgeRows.push({
        condition_label: name,
        feature_label: label,
        lr_present: f.LR_positive ?? 2.0,
        lr_absent: f.LR_negative ?? 0.6,
      });
    }
  }

  console.log(`Conditions to import: ${conditionRows.length} (skipped ${skipped})`);
  console.log(`Unique features: ${featureMap.size}`);
  console.log(`Edges: ${edgeRows.length}\n`);

  // ---- Deduplicate conditions by label ----
  const uniqueConditions = Array.from(
    new Map(conditionRows.map(c => [c.label.toLowerCase(), c])).values()
  );

  // ---- Upsert features ----
  // Fetch features already in Supabase so we only insert new ones.
  // This avoids FK violations from trying to update IDs that edges reference.
  const { data: existingFeatures, error: exFErr } = await supabase.from('features').select('canonical_label');
  if (exFErr) throw new Error('Failed to fetch existing features: ' + JSON.stringify(exFErr));
  const existingFeatureLabels = new Set(
    (existingFeatures ?? []).map((f: { canonical_label: string }) => f.canonical_label.toLowerCase().trim())
  );

  process.stdout.write('Upserting features ');
  const featureRows = Array.from(featureMap.values())
    .filter(f => !existingFeatureLabels.has(f.canonical_label.toLowerCase().trim()))
    .map((f, idx) => ({
      id: `feat_import_${f.canonical_label.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 50)}_${idx}`,
      ...f,
      usage_count: 0,
      status: 'active',
    }));
  if (featureRows.length > 0) {
    await batchUpsert(supabase, 'features', featureRows, 'canonical_label');
  }
  console.log(` done (${featureRows.length} new, ${existingFeatureLabels.size} already existed)`);

  // ---- Fetch back Supabase feature IDs keyed by canonical_label ----
  const { data: dbFeatures, error: fErr } = await supabase.from('features').select('id, canonical_label');
  if (fErr) throw fErr;
  const featureLabelToId = new Map<string, string>(
    (dbFeatures ?? []).map((f: { canonical_label: string; id: string }) => [f.canonical_label.toLowerCase().trim(), f.id])
  );

  // ---- Upsert conditions (insert new, update prior_base/acuteness/category on existing) ----
  // Always upsert so that re-running the script refreshes prior_base values.
  process.stdout.write('Upserting conditions ');
  await batchUpsert(supabase, 'conditions', uniqueConditions, 'label');
  console.log(` done (${uniqueConditions.length} conditions upserted)`);

  // ---- Fetch back Supabase condition IDs keyed by label ----
  const { data: dbConditions, error: cErr } = await supabase.from('conditions').select('id, label');
  if (cErr) throw cErr;
  const condLabelToId = new Map<string, string>(
    (dbConditions ?? []).map((c: { label: string; id: string }) => [c.label.toLowerCase().trim(), c.id])
  );

  // ---- Build and upsert edges ----
  const resolvedEdges = edgeRows
    .map(e => ({
      condition_id: condLabelToId.get(e.condition_label.toLowerCase().trim()),
      feature_id: featureLabelToId.get(e.feature_label.toLowerCase().trim()),
      lr_present: e.lr_present,
      lr_absent: e.lr_absent,
    }))
    .filter(e => e.condition_id && e.feature_id);

  const uniqueEdges = Array.from(
    new Map(resolvedEdges.map(e => [`${e.condition_id}::${e.feature_id}`, e])).values()
  );

  process.stdout.write('Upserting edges ');
  await batchUpsert(supabase, 'condition_feature_edges', uniqueEdges, 'condition_id,feature_id');
  console.log(' done\n');

  console.log(`✅ Import complete!`);
  console.log(`   ${uniqueConditions.length} conditions`);
  console.log(`   ${featureRows.length} features`);
  console.log(`   ${uniqueEdges.length} edges`);
}

main().catch(err => {
  console.error('\n❌ Import failed:', err.message ?? err);
  process.exit(1);
});
