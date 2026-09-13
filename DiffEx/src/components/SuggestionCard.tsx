import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SuggestionCardProps {
  title: string;
  rationale: string;
  onAdd: () => void;
  mode?: 'plus' | 'yesno';
  onNo?: () => void;
}

export function SuggestionCard({ title, rationale, onAdd, mode = 'plus', onNo }: SuggestionCardProps) {
  const [answered, setAnswered] = useState<'yes' | 'no' | null>(null);

  const handleYes = () => {
    setAnswered('yes');
    onAdd();
  };

  const handleNo = () => {
    setAnswered('no');
    onNo?.();
  };

  return (
    <div className="suggestion-card animate-slide-in group">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm text-foreground mb-1 truncate group-hover:whitespace-normal group-hover:overflow-visible">{title}</h4>
          <p className="text-xs text-muted-foreground line-clamp-2 group-hover:line-clamp-none">{rationale}</p>
        </div>
        {mode === 'yesno' ? (
          <div className="flex gap-1.5 shrink-0">
            {answered ? (
              <span className={cn(
                "text-xs font-medium px-2.5 py-1 rounded-full",
                answered === 'yes'
                  ? "bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]"
                  : "bg-muted text-muted-foreground"
              )}>
                {answered === 'yes' ? 'Yes' : 'No'}
              </span>
            ) : (
              <>
                <Button
                  onClick={handleYes}
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2.5 text-xs font-medium rounded-full bg-[hsl(var(--success))]/10 text-[hsl(var(--success))] hover:bg-[hsl(var(--success))]/20"
                >
                  Yes
                </Button>
                <Button
                  onClick={handleNo}
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2.5 text-xs font-medium rounded-full bg-muted text-muted-foreground hover:bg-muted/80"
                >
                  No
                </Button>
              </>
            )}
          </div>
        ) : (
          <Button
            onClick={onAdd}
            size="sm"
            variant="ghost"
            className="shrink-0 h-8 w-8 p-0 hover:bg-primary/10 hover:text-primary"
          >
            +
          </Button>
        )}
      </div>
    </div>
  );
}
