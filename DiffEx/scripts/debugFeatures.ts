import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf-8').split('\n').reduce((a: any, l: string) => {
  const m = l.match(/^([^=]+)=["']?([^"'\n]*)["']?/);
  if (m) a[m[1].trim()] = m[2].trim();
  return a;
}, {});

const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY);

async function main() {
  // 1. What features exist in Supabase related to throat/sore throat/cough
  const { data: throatFeatures } = await sb.from('features').select('id, canonical_label').ilike('canonical_label', '%throat%');
  console.log('\n=== Throat-related features in Supabase ===');
  console.log(throatFeatures);

  const { data: coughFeatures } = await sb.from('features').select('id, canonical_label').ilike('canonical_label', '%cough%');
  console.log('\n=== Cough-related features in Supabase ===');
  console.log(coughFeatures);

  const { data: exudateFeatures } = await sb.from('features').select('id, canonical_label').ilike('canonical_label', '%exudate%');
  const { data: tonsilFeatures } = await sb.from('features').select('id, canonical_label').ilike('canonical_label', '%tonsil%');
  console.log('\n=== Exudate/Tonsillar features in Supabase ===');
  console.log([...(exudateFeatures ?? []), ...(tonsilFeatures ?? [])]);

  // 2. What conditions have edges to throat features
  const throatIds = (throatFeatures ?? []).map((f: any) => f.id);
  if (throatIds.length > 0) {
    const { data: throatEdges } = await sb
      .from('condition_feature_edges')
      .select('condition_id, feature_id')
      .in('feature_id', throatIds);
    const condIds = [...new Set((throatEdges ?? []).map((e: any) => e.condition_id))];
    const { data: conds } = await sb.from('conditions').select('label').in('id', condIds);
    console.log('\n=== Conditions with sore throat edges ===');
    console.log(conds?.map((c: any) => c.label));
  }

  // 3. Total counts
  const { count: condCount } = await sb.from('conditions').select('*', { count: 'exact', head: true });
  const { count: featCount } = await sb.from('features').select('*', { count: 'exact', head: true });
  const { count: edgeCount } = await sb.from('condition_feature_edges').select('*', { count: 'exact', head: true });
  console.log(`\n=== Totals: ${condCount} conditions, ${featCount} features, ${edgeCount} edges ===`);
}

main().catch(console.error);
