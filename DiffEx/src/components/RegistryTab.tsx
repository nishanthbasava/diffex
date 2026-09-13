import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, ChevronRight, ChevronDown } from 'lucide-react';
import type { RegistryFeature } from '@/types/evidence';

interface RegistryTabProps {
  registry: RegistryFeature[];
}

function RegistryRow({ feature }: { feature: RegistryFeature }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-accent/50 transition-colors text-sm"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded
          ? <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
          : <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />}
        <span className={`chip text-[10px] px-1.5 py-0 chip-${feature.type === 'other' ? 'history' : feature.type}`}>
          {feature.type}
        </span>
        <span className="flex-1 truncate font-medium text-foreground">{feature.canonical_label}</span>
        <span className="text-xs text-muted-foreground">{feature.usage_count}×</span>
        {feature.status === 'pending_review' && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-[hsl(var(--warning))] text-[hsl(var(--warning))]">
            New
          </Badge>
        )}
      </button>
      {expanded && (
        <div className="px-3 pb-2 pl-8 space-y-1">
          <div className="text-xs text-muted-foreground">
            Value type: <span className="text-foreground">{feature.value_type}</span>
          </div>
          {feature.synonyms.length > 0 && (
            <div className="text-xs text-muted-foreground">
              Synonyms: <span className="text-foreground">{feature.synonyms.join(', ')}</span>
            </div>
          )}
          <div className="text-xs text-muted-foreground">
            Status: <span className="text-foreground">{feature.status}</span>
            {feature.kb_feature_id && <span> · KB: {feature.kb_feature_id}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

export function RegistryTab({ registry }: RegistryTabProps) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const active = registry.filter(f => f.status !== 'merged');
    if (!search) return active;
    const q = search.toLowerCase();
    return active.filter(f =>
      f.canonical_label.toLowerCase().includes(q) ||
      f.type.includes(q) ||
      f.synonyms.some(s => s.toLowerCase().includes(q))
    );
  }, [registry, search]);

  const grouped = useMemo(() => {
    const groups: Record<string, RegistryFeature[]> = {};
    for (const f of filtered) {
      const t = f.type;
      if (!groups[t]) groups[t] = [];
      groups[t].push(f);
    }
    return groups;
  }, [filtered]);

  const typeOrder = ['symptom', 'vital', 'history', 'lab', 'test', 'other'];

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          placeholder="Filter features..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-8 h-8 text-xs"
        />
      </div>

      <div className="text-xs text-muted-foreground">
        {filtered.length} features · {registry.filter(f => f.status === 'pending_review').length} pending review
      </div>

      <div className="space-y-2">
        {typeOrder.map(type => {
          const items = grouped[type];
          if (!items || items.length === 0) return null;
          return (
            <div key={type}>
              <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
                {type} ({items.length})
              </div>
              <div className="border border-border rounded-md bg-card">
                {items.map(f => (
                  <RegistryRow key={f.id} feature={f} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center text-muted-foreground py-6 text-sm">
          No features found
        </div>
      )}
    </div>
  );
}
