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
    <div className="border-b border-border border-l-2 border-l-next-step pl-2 pr-1 py-1.5 group">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm text-foreground mb-0.5 truncate group-hover:whitespace-normal group-hover:overflow-visible">{title}</h4>
          <p className="text-xs text-muted-foreground line-clamp-2 group-hover:line-clamp-none">{rationale}</p>
        </div>
        {mode === 'yesno' ? (
          <div className="flex gap-1 shrink-0">
            {answered ? (
              <span className={cn(
                "text-xs font-medium px-2 py-0.5 rounded-sm border",
                answered === 'yes'
                  ? "border-[hsl(152,40%,74%)] bg-evidence-for-bg text-evidence-for"
                  : "bg-muted text-muted-foreground border-border"
              )}>
                {answered === 'yes' ? 'Yes' : 'No'}
              </span>
            ) : (
              <>
                <Button
                  onClick={handleYes}
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-xs font-medium rounded-sm border border-[hsl(152,40%,74%)] bg-evidence-for-bg text-evidence-for hover:bg-evidence-for-bg hover:text-evidence-for hover:brightness-95"
                >
                  Yes
                </Button>
                <Button
                  onClick={handleNo}
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-xs font-medium rounded-sm border border-border bg-muted text-muted-foreground hover:bg-muted/80"
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
            className="shrink-0 h-6 w-6 p-0 rounded-sm hover:bg-next-step-bg hover:text-next-step"
          >
            +
          </Button>
        )}
      </div>
    </div>
  );
}
