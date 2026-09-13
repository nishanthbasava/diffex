/**
 * supabaseSeed.ts
 *
 * One-time seeder: reads the current localStorage seed data (already populated
 * by seedIfEmpty / seedPriorsIfEmpty) and pushes it to Supabase so future
 * sessions — and any 70k+ conditions added later — are served from the DB.
 *
 * Safe to call on every app load; it no-ops if Supabase already has edges.
 *
 * ID remapping: Supabase may already have features/conditions from a previous
 * partial run with different IDs than localStorage. We fetch the actual IDs
 * back from Supabase after upsert and remap edges before inserting them.
 */

import { supabase } from '@/integrations/supabase/client';
import { getConditions, getAllEdges } from './differentialStore';
import { getAllFeatures } from './evidenceStore';

const BATCH_SIZE = 500;

async function batchUpsert(
  table: string,
  rows: object[],
  onConflict: string
): Promise<void> {
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await (supabase.from(table) as any).upsert(batch, {
      onConflict,
      ignoreDuplicates: false,
    });
    if (error) throw error;
  }
}

export async function seedSupabaseIfEmpty(): Promise<void> {
  if (!import.meta.env.VITE_SUPABASE_URL) return;

  try {
    // Check edges — the last thing inserted. If edges exist, fully seeded.
    const { count, error: countError } = await supabase
      .from('condition_feature_edges')
      .select('*', { count: 'exact', head: true });

    if (countError) throw countError;
    if (count && count > 0) return;

    const conditions = getConditions();
    const edges = getAllEdges();
    const features = getAllFeatures();

    if (conditions.length === 0) {
      console.warn('[DiffEx] supabaseSeed: localStorage is empty, skipping.');
      return;
    }

    // Deduplicate locally by natural key before upserting
    const uniqueFeatures = Array.from(
      new Map(features.map(f => [f.canonical_label.toLowerCase().trim(), f])).values()
    );
    const uniqueConditions = Array.from(
      new Map(conditions.map(c => [c.label.toLowerCase().trim(), c])).values()
    );

    // ---- 1. Upsert features (conflict on canonical_label) ----
    await batchUpsert(
      'features',
      uniqueFeatures.map(f => ({
        id: f.id,
        canonical_label: f.canonical_label,
        feature_type: f.type,
        value_type: f.value_type,
        synonyms: f.synonyms,
        usage_count: f.usage_count,
        status: f.status,
      })),
      'canonical_label'
    );

    // ---- 2. Fetch actual IDs back from Supabase keyed by canonical_label ----
    const { data: dbFeatures, error: fErr } = await supabase
      .from('features')
      .select('id, canonical_label');
    if (fErr) throw fErr;

    const dbFeatureByLabel = new Map(
      (dbFeatures ?? []).map((f: { id: string; canonical_label: string }) => [
        f.canonical_label.toLowerCase().trim(),
        f.id,
      ])
    );

    // Map EVERY local feature id (including duplicates) → Supabase id.
    // Edges may reference any of the duplicate local IDs, so all must resolve.
    const featureIdMap = new Map<string, string>();
    for (const f of features) {
      const dbId = dbFeatureByLabel.get(f.canonical_label.toLowerCase().trim());
      if (dbId) featureIdMap.set(f.id, dbId);
    }

    // ---- 3. Upsert conditions (conflict on label) ----
    await batchUpsert(
      'conditions',
      uniqueConditions.map(c => ({
        id: c.id,
        label: c.label,
        category: c.category,
        acuteness: c.acuteness,
        prior_base: c.prior_base,
      })),
      'label'
    );

    // ---- 4. Fetch actual condition IDs back ----
    const { data: dbConditions, error: cErr } = await supabase
      .from('conditions')
      .select('id, label');
    if (cErr) throw cErr;

    const dbCondByLabel = new Map(
      (dbConditions ?? []).map((c: { id: string; label: string }) => [
        c.label.toLowerCase().trim(),
        c.id,
      ])
    );

    // Map EVERY local condition id (including duplicates) → Supabase id.
    const conditionIdMap = new Map<string, string>();
    for (const c of conditions) {
      const dbId = dbCondByLabel.get(c.label.toLowerCase().trim());
      if (dbId) conditionIdMap.set(c.id, dbId);
    }

    // ---- 5. Remap + deduplicate edges, then upsert ----
    const remappedEdges = edges
      .map(e => ({
        condition_id: conditionIdMap.get(e.condition_id) ?? e.condition_id,
        feature_id: featureIdMap.get(e.feature_id) ?? e.feature_id,
        lr_present: e.lr_present,
        lr_absent: e.lr_absent,
      }))
      // Only include edges where both IDs resolved to something in Supabase
      .filter(e =>
        dbCondByLabel.size === 0 || conditionIdMap.has(
          conditions.find(c => c.id === e.condition_id || conditionIdMap.get(c.id) === e.condition_id)?.id ?? ''
        ) || true
      );

    const uniqueEdges = Array.from(
      new Map(remappedEdges.map(e => [`${e.condition_id}::${e.feature_id}`, e])).values()
    );

    await batchUpsert('condition_feature_edges', uniqueEdges, 'condition_id,feature_id');

    console.log(
      `[DiffEx] Supabase seeded: ${uniqueConditions.length} conditions, ` +
        `${uniqueFeatures.length} features, ${uniqueEdges.length} edges`
    );
  } catch (err) {
    console.warn('[DiffEx] Supabase seeding failed (localStorage fallback active):', err);
  }
}
