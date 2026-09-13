import { History, Plus, Minus } from 'lucide-react';
import type { ChangeLogEntry } from '@/types';

interface ChangeLogProps {
  entries: ChangeLogEntry[];
}

export function ChangeLog({ entries }: ChangeLogProps) {
  if (entries.length === 0) return null;

  return (
    <div className="bg-card border-t border-border px-6 py-4">
      <div className="flex items-start gap-3">
        <div className="flex items-center gap-2 shrink-0">
          <History className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">Why it changed</span>
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          {entries.slice(0, 5).map((entry) => (
            <div
              key={entry.id}
              className="flex items-start gap-2 bg-muted/50 rounded-lg px-3 py-2 animate-fade-in"
            >
              {entry.action === 'add' ? (
                <Plus className="w-3.5 h-3.5 text-success mt-0.5 shrink-0" />
              ) : (
                <Minus className="w-3.5 h-3.5 text-destructive mt-0.5 shrink-0" />
              )}
              <div>
                <span className="font-medium text-foreground">{entry.featureName}</span>
                {entry.topReasons.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-0.5">
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
