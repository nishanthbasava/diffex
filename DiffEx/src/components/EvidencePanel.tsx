import { useState } from 'react';
import { ChevronDown, ChevronRight, Sparkles, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { ExtractionCandidate, PatientEvidence } from '@/types/evidence';
import type { RegistryFeature } from '@/types/evidence';

interface EvidencePanelProps {
  candidates: ExtractionCandidate[];
  evidence: PatientEvidence[];
  registry: RegistryFeature[];
  isExtracting: boolean;
  onRerun: () => void;
  onAddSynonym: (featureId: string, synonym: string) => void;
}

function PolarityDot({ polarity }: { polarity: string }) {
  if (polarity === 'present') {
    return <span className="inline-block w-2 h-2 rounded-full bg-[hsl(var(--success))]" title="Present" />;
  }
  if (polarity === 'absent') {
    return <span className="inline-block w-2 h-2 rounded-full bg-[hsl(var(--destructive))] opacity-60" title="Absent" />;
  }
  return <span className="inline-block w-2 h-2 rounded-full bg-[hsl(var(--muted-foreground))] opacity-40" title="Unknown" />;
}

function ConfidenceBadge({ confidence, isNew }: { confidence: number; isNew: boolean }) {
  if (isNew) {
    return (
      <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-[hsl(var(--warning))] text-[hsl(var(--warning))]">
        New
      </Badge>
    );
  }
  if (confidence < 0.7) {
    return (
      <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-[hsl(var(--warning))] text-[hsl(var(--warning))]">
        Review
      </Badge>
    );
  }
  return null;
}

function EvidenceRow({ candidate, evidenceItem, registryFeature }: {
  candidate: ExtractionCandidate;
  evidenceItem?: PatientEvidence;
  registryFeature?: RegistryFeature;
}) {
  const [expanded, setExpanded] = useState(false);
  const isNew = registryFeature?.status === 'pending_review';

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-accent/50 transition-colors text-sm"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" /> : <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />}
        <PolarityDot polarity={candidate.polarity} />
        <span className="flex-1 truncate font-medium text-foreground">{candidate.label}</span>
        {candidate.value !== null && candidate.value !== true && candidate.value !== false && (
          <span className="text-xs text-muted-foreground">{String(candidate.value)}</span>
        )}
        <ConfidenceBadge confidence={candidate.confidence} isNew={isNew || false} />
        <span className={`chip text-[10px] px-1.5 py-0 chip-${candidate.type === 'other' ? 'history' : candidate.type}`}>
          {candidate.type}
        </span>
      </button>

      {expanded && (
        <div className="px-3 pb-2 pl-8 space-y-1.5">
          {candidate.spans.map((span, i) => (
            <div key={i} className="text-xs">
              <span className="text-muted-foreground">From note: </span>
              <span className="bg-accent/70 px-1 py-0.5 rounded text-foreground font-mono">
                "{span.text}"
              </span>
            </div>
          ))}
          {candidate.raw_terms.length > 0 && (
            <div className="text-xs text-muted-foreground">
              Raw: {candidate.raw_terms.join(', ')}
            </div>
          )}
          {registryFeature && registryFeature.synonyms.length > 1 && (
            <div className="text-xs text-muted-foreground">
              Synonyms: {registryFeature.synonyms.slice(0, 5).join(', ')}
              {registryFeature.synonyms.length > 5 && ` +${registryFeature.synonyms.length - 5}`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function EvidencePanel({
  candidates,
  evidence,
  registry,
  isExtracting,
  onRerun,
}: EvidencePanelProps) {
  const [open, setOpen] = useState(false);

  const presentCount = candidates.filter(c => c.polarity === 'present').length;
  const absentCount = candidates.filter(c => c.polarity === 'absent').length;
  const newCount = candidates.filter(c => c.confidence < 0.6).length;

  if (candidates.length === 0 && !isExtracting) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border border-border rounded-md bg-card">
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-accent/30 transition-colors">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-foreground flex-1">
            Extracted Evidence
          </span>
          <span className="text-xs text-muted-foreground">
            {presentCount} present · {absentCount} absent
          </span>
          {newCount > 0 && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-[hsl(var(--warning))] text-[hsl(var(--warning))]">
              {newCount} new
            </Badge>
          )}
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="border-t border-border">
          <div className="flex items-center justify-between px-3 py-1.5 bg-panel-header">
            <span className="text-[11px] text-muted-foreground">{candidates.length} items extracted</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs px-2"
              onClick={(e) => { e.stopPropagation(); onRerun(); }}
              disabled={isExtracting}
            >
              <RefreshCw className={`w-3 h-3 mr-1 ${isExtracting ? 'animate-spin' : ''}`} />
              Re-run
            </Button>
          </div>

          <div className="max-h-[250px] overflow-y-auto">
            {candidates.map((candidate, i) => {
              const evidenceItem = evidence[i];
              const registryFeature = evidenceItem
                ? registry.find(f => f.id === evidenceItem.feature_id)
                : undefined;
              return (
                <EvidenceRow
                  key={`${candidate.label}-${candidate.polarity}-${i}`}
                  candidate={candidate}
                  evidenceItem={evidenceItem}
                  registryFeature={registryFeature}
                />
              );
            })}
          </div>

          {candidates.some(c => c.confidence < 0.6) && (
            <div className="flex items-center gap-1.5 px-3 py-2 bg-[hsl(var(--warning))]/5 border-t border-border">
              <AlertCircle className="w-3 h-3 text-[hsl(var(--warning))]" />
              <span className="text-[11px] text-muted-foreground">
                Items marked "New" were auto-created and may need review
              </span>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
