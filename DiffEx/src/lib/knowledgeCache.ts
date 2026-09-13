1/**
 * knowledgeCache.ts
 *
 * Supabase-backed in-memory cache for conditions and edges.
 * Designed for 70k+ conditions: instead of loading everything, we fetch only
 * the conditions/edges relevant to the current patient's evidence features,
 * plus a fixed set of safety-net conditions that are always considered.
 *
 * Falls back silently to localStorage data if Supabase is unavailable.
 */

import { supabase } from '@/integrations/supabase/client';

// Must match Condition / ConditionFeatureEdge in differentialStore.ts
export interface CachedCondition {
  id: string;
  label: string;
  category: string | null;
  acuteness: number;
  prior_base: number;
}

export interface CachedEdge {
  condition_id: string;
  feature_id: string;
  lr_present: number;
  lr_absent: number;
}

// Safety-net conditions always included regardless of evidence
const ALWAYS_INCLUDE_LABELS = [
  'Sepsis',
  'MI / ACS',
  'Pulmonary Embolism',
  'Aortic Dissection',
  'Meningitis',
  'Neonatal Sepsis',
];

// Module-level cache — reset on each refresh
let _conditions: CachedCondition[] = [];
let _edges: CachedEdge[] = [];
// Maps canonical_label (lowercase) → Supabase feature id
let _featureLabelToId = new Map<string, string>();
let _ready = false;

export function getCachedConditions(): CachedCondition[] {
  return _conditions;
}

export function getCachedEdges(): CachedEdge[] {
  return _edges;
}

/** Returns Supabase feature id for a given canonical_label, or null. */
export function getSupabaseFeatureId(label: string): string | null {
  return _featureLabelToId.get(label.toLowerCase().trim()) ?? null;
}

export function isCacheReady(): boolean {
  return _ready;
}

export function invalidateCache(): void {
  _conditions = [];
  _edges = [];
  _featureLabelToId = new Map();
  _ready = false;
}

/**
 * Refresh the in-memory cache for the given set of evidence feature labels.
 *
 * Query strategy:
 * 1. Resolve labels → Supabase feature IDs.
 * 2. Find all condition_ids with an edge touching any of those feature IDs.
 * 3. Add safety-net condition IDs.
 * 4. Fetch full condition rows + all their edges.
 *
 * Using labels (not localStorage IDs) ensures correctness even when
 * localStorage IDs differ from the IDs stored in Supabase.
 */
export async function refreshCacheForEvidence(featureLabels: string[]): Promise<void> {
  // Skip if Supabase is not configured
  if (!import.meta.env.VITE_SUPABASE_URL) return;

  try {
    const conditionIds = new Set<string>();

    // Step 1: resolve labels → Supabase feature IDs, then find candidates
    if (featureLabels.length > 0) {
      const { data: matchedFeatures, error: fErr } = await supabase
        .from('features')
        .select('id')
        .in('canonical_label', featureLabels);

      if (fErr) throw fErr;
      const resolvedFeatureIds = (matchedFeatures ?? []).map((f: { id: string }) => f.id);

      if (resolvedFeatureIds.length > 0) {
        const { data: matchingEdges, error } = await supabase
          .from('condition_feature_edges')
          .select('condition_id')
          .in('feature_id', resolvedFeatureIds);

        if (error) throw error;
        (matchingEdges ?? []).forEach((e: { condition_id: string }) =>
          conditionIds.add(e.condition_id)
        );
      }
    }

    // Step 2: always include safety nets
    const { data: safetyNets, error: safetyError } = await supabase
      .from('conditions')
      .select('id')
      .in('label', ALWAYS_INCLUDE_LABELS);

    if (safetyError) throw safetyError;
    (safetyNets ?? []).forEach((c: { id: string }) => conditionIds.add(c.id));

    if (conditionIds.size === 0) return;

    const ids = Array.from(conditionIds);

    // Step 3: fetch full condition rows
    const { data: conditions, error: condError } = await supabase
      .from('conditions')
      .select('id, label, category, acuteness, prior_base')
      .in('id', ids);

    if (condError) throw condError;
    if (!conditions || conditions.length === 0) return;

    // Step 4: fetch all edges for these conditions
    const { data: edges, error: edgeError } = await supabase
      .from('condition_feature_edges')
      .select('condition_id, feature_id, lr_present, lr_absent')
      .in('condition_id', ids);

    if (edgeError) throw edgeError;

    // Fetch feature labels for all edge feature IDs so computeDifferential
    // can match patient evidence (localStorage IDs) to edges (Supabase IDs)
    // by label instead of ID.
    const edgeFeatureIds = [...new Set((edges ?? []).map((e: { feature_id: string }) => e.feature_id))];
    let featureLabelMap = new Map<string, string>();
    if (edgeFeatureIds.length > 0) {
      const { data: featRows, error: featErr } = await supabase
        .from('features')
        .select('id, canonical_label')
        .in('id', edgeFeatureIds);
      if (!featErr && featRows) {
        for (const f of featRows as { id: string; canonical_label: string }[]) {
          featureLabelMap.set(f.canonical_label.toLowerCase().trim(), f.id);
        }
      }
    }

    _conditions = conditions as CachedCondition[];
    _edges = (edges ?? []) as CachedEdge[];
    _featureLabelToId = featureLabelMap;
    _ready = true;

    console.log(
      `[DiffEx] Cache refreshed: ${_conditions.length} conditions, ${_edges.length} edges from Supabase`
    );
  } catch (err) {
    // Non-fatal — differentialStore falls back to localStorage
    console.warn('[DiffEx] Supabase cache refresh failed, using localStorage fallback:', err);
  }
}
