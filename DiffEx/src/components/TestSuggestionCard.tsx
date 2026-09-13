import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Import, X, Check } from 'lucide-react';
import { processFile } from '@/lib/fileProcessing';

interface TestSuggestionCardProps {
  title: string;
  rationale: string;
  onAdd: () => void;
}

export function TestSuggestionCard({ title, rationale, onAdd }: TestSuggestionCardProps) {
  const [importedFile, setImportedFile] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      await processFile(file);
      setImportedFile(file.name);
      onAdd();
    } catch {
      setImportedFile(null);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="suggestion-card animate-slide-in group">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm text-foreground mb-1 truncate group-hover:whitespace-normal group-hover:overflow-visible">{title}</h4>
          <p className="text-xs text-muted-foreground line-clamp-2 group-hover:line-clamp-none">{rationale}</p>
          {importedFile && (
            <div className="flex items-center gap-1.5 mt-1.5 text-xs text-[hsl(var(--success))]">
              <Check className="w-3 h-3" />
              <span>Result imported</span>
              <button
                onClick={() => setImportedFile(null)}
                className="text-muted-foreground hover:text-destructive ml-1"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            className="hidden"
            onChange={handleImport}
          />
          <Button
            onClick={() => fileRef.current?.click()}
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 opacity-60 hover:opacity-100 hover:text-primary"
            disabled={importing}
          >
            <Import className="w-3.5 h-3.5" />
          </Button>
          <Button
            onClick={onAdd}
            size="sm"
            variant="ghost"
            className="shrink-0 h-8 w-8 p-0 hover:bg-primary/10 hover:text-primary"
          >
            +
          </Button>
        </div>
      </div>
    </div>
  );
}
