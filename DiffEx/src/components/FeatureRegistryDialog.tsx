import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Settings2, Search, Merge, Trash2 } from 'lucide-react';
import type { RegistryFeature } from '@/types/evidence';
import { mergeFeatures, updateRegistryFeature } from '@/lib/featureRegistry';

interface FeatureRegistryDialogProps {
  registry: RegistryFeature[];
  onRegistryChange: () => void;
}

export function FeatureRegistryDialog({ registry, onRegistryChange }: FeatureRegistryDialogProps) {
  const [search, setSearch] = useState('');
  const [mergeSource, setMergeSource] = useState<string | null>(null);

  const activeFeatures = useMemo(() => {
    return registry
      .filter(f => f.status !== 'merged')
      .filter(f => {
        if (!search) return true;
        const q = search.toLowerCase();
        return f.canonical_label.toLowerCase().includes(q) ||
          f.synonyms.some(s => s.toLowerCase().includes(q));
      })
      .sort((a, b) => b.usage_count - a.usage_count);
  }, [registry, search]);

  const handleMerge = (targetId: string) => {
    if (!mergeSource || mergeSource === targetId) return;
    mergeFeatures(mergeSource, targetId);
    setMergeSource(null);
    onRegistryChange();
  };

  const handleStatusToggle = (id: string, current: RegistryFeature['status']) => {
    updateRegistryFeature(id, { status: current === 'pending_review' ? 'active' : 'pending_review' });
    onRegistryChange();
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 text-xs px-2 text-muted-foreground">
          <Settings2 className="w-3.5 h-3.5 mr-1" />
          Manage Labels
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">Feature Registry</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search labels or synonyms..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>

        {mergeSource && (
          <div className="flex items-center gap-2 px-3 py-2 bg-accent/50 rounded text-xs">
            <Merge className="w-3.5 h-3.5" />
            <span>Click a target to merge into. </span>
            <Button variant="ghost" size="sm" className="h-5 text-xs px-1.5" onClick={() => setMergeSource(null)}>
              Cancel
            </Button>
          </div>
        )}

        <ScrollArea className="h-[350px]">
          <div className="space-y-0.5">
            {activeFeatures.map(f => (
              <div
                key={f.id}
                className={`flex items-center gap-2 px-3 py-2 rounded text-sm hover:bg-accent/30 transition-colors ${
                  mergeSource === f.id ? 'bg-accent/50 ring-1 ring-primary' : ''
                } ${mergeSource && mergeSource !== f.id ? 'cursor-pointer' : ''}`}
                onClick={() => mergeSource && mergeSource !== f.id ? handleMerge(f.id) : undefined}
              >
                <span className={`chip text-[10px] px-1.5 py-0 chip-${f.type === 'other' ? 'history' : f.type}`}>
                  {f.type}
                </span>
                <span className="flex-1 font-medium truncate">{f.canonical_label}</span>
                <span className="text-xs text-muted-foreground">{f.usage_count}×</span>
                {f.status === 'pending_review' && (
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 border-[hsl(var(--warning))] text-[hsl(var(--warning))] cursor-pointer"
                    onClick={(e) => { e.stopPropagation(); handleStatusToggle(f.id, f.status); }}
                  >
                    Approve
                  </Badge>
                )}
                {!mergeSource && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0"
                    onClick={(e) => { e.stopPropagation(); setMergeSource(f.id); }}
                    title="Merge into another"
                  >
                    <Merge className="w-3 h-3" />
                  </Button>
                )}
              </div>
            ))}
            {activeFeatures.length === 0 && (
              <div className="text-center py-8 text-sm text-muted-foreground">
                No features found
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="text-xs text-muted-foreground text-center">
          {registry.filter(f => f.status !== 'merged').length} active features ·
          {' '}{registry.filter(f => f.status === 'pending_review').length} pending review
        </div>
      </DialogContent>
    </Dialog>
  );
}
