/**
 * Builds a compact vocabulary string from the feature registry
 * for use in AI extraction prompts. This ensures the AI maps findings
 * to existing feature terms instead of inventing new ones.
 */
import { loadRegistry } from './featureRegistry';

export function buildVocabularyPrompt(): string {
  const registry = loadRegistry();
  if (registry.length === 0) return '';

  const lines = registry.map(f => {
    const syns = f.synonyms.filter(s => s.toLowerCase() !== f.canonical_label.toLowerCase());
    const synStr = syns.length > 0 ? ` (aka: ${syns.join(', ')})` : '';
    return `- ${f.canonical_label}${synStr}`;
  });

  return `\n\nIMPORTANT — Known clinical feature vocabulary. You MUST use these exact canonical terms when a finding matches. Do NOT invent new terms for concepts already covered below:\n${lines.join('\n')}`;
}
