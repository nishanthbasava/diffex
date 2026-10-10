import { Plus, Minus } from 'lucide-react';
import type { ChangeLogEntry } from '@/types';

interface ChangeLogProps {
  entries: ChangeLogEntry[];
}

export function ChangeLog({ entries }: ChangeLogProps) {
  if (entries.length === 0) return null;

  return (
    <div className="bg-card border-t border-border px-4 py-1.5">
      <div className="flex items-start gap-3">
        <span className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground shrink-0 pt-0.5">Why it changed</span>
        <div className="flex flex-wrap gap-2 text-sm">
          {entries.slice(0, 5).map((entry) => (
            <div
              key={entry.id}
              className="flex items-start gap-1.5 border border-border rounded-sm px-2 py-0.5"
            >
              {entry.action === 'add' ? (
                <Plus className="w-3 h-3 text-evidence-for mt-1 shrink-0" aria-label="Added" />
              ) : (
                <Minus className="w-3 h-3 text-evidence-against mt-1 shrink-0" aria-label="Removed" />
              )}
              <div>
                <span className="text-xs font-medium text-foreground">{entry.featureName}</span>
                {entry.topReasons.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {entry.topReasons.slice(0, 2).join(' • ')}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
