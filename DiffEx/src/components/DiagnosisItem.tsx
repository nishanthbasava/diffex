import { useState } from 'react';
import { ChevronDown, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ScoredDiagnosis } from '@/lib/scoring';
import type { FeatureContribution } from '@/lib/computeDifferential';
import type { PriorBreakdown } from '@/lib/priorsStore';

interface EvidenceCitation {
  title: string;
  journal: string;
  year: number;
  url: string;
  snippet: string;
}

export interface DiagnosisItemData extends ScoredDiagnosis {
  rationale_text?: string;
  evidence?: EvidenceCitation[];
  boosts?: FeatureContribution[];
  penalties?: FeatureContribution[];
  priorWeight?: number;
  priorBreakdown?: PriorBreakdown;
  icd10_codes?: string[];
  /** Prior-only baseline probability (%) — normalized priorWeight, UI-derived */
  priorPercent?: number;
}

interface DiagnosisItemProps {
  diagnosis: DiagnosisItemData;
  rank: number;
  debugMode?: boolean;
}

function formatPct(p: number): string {
  if (p >= 10) return p.toFixed(0);
  if (p >= 1) return p.toFixed(1);
  return p.toFixed(2);
}

/** Tick at the baseline prior, line to a dot at the posterior (sqrt scale). */
function PriorPosteriorTrack({ prior, posterior }: { prior: number; posterior: number }) {
  const W = 84;
  const H = 12;
  const x = (p: number) => 2 + Math.sqrt(Math.max(0, Math.min(p, 100)) / 100) * (W - 4);
  const px = x(prior);
  const qx = x(posterior);
  const shiftedUp = posterior >= prior;
  const shiftColor = shiftedUp ? 'hsl(var(--evidence-for))' : 'hsl(var(--evidence-against))';
  const label = `Prior ${formatPct(prior)}% → posterior ${formatPct(posterior)}%`;

  return (
    <svg
      width={W}
      height={H}
      role="img"
      aria-label={label}
      className="shrink-0"
    >
      <title>{label}</title>
      <line x1={2} y1={H / 2} x2={W - 2} y2={H / 2} stroke="hsl(var(--border))" strokeWidth={1} />
      <line x1={px} y1={H / 2} x2={qx} y2={H / 2} stroke={shiftColor} strokeWidth={2} />
      {/* prior tick */}
      <line x1={px} y1={1.5} x2={px} y2={H - 1.5} stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} />
      {/* posterior dot */}
      <circle cx={qx} cy={H / 2} r={3} fill={shiftColor} />
    </svg>
  );
}

/** Signed contribution chip: "Heartburn +5.0" */
export function ContributionChip({ c }: { c: FeatureContribution }) {
  const value = c.contributionLog;
  const supporting = value >= 0;
  return (
    <span
      className={cn('evidence-chip', supporting ? 'evidence-chip-for' : 'evidence-chip-against')}
      title={`${c.feature_label} (${c.polarity}) — LR ×${c.lr_used.toFixed(2)}`}
    >
      <span className="truncate max-w-[9rem]">{c.feature_label}</span>
      <span className="num">{supporting ? '+' : '−'}{Math.abs(value).toFixed(1)}</span>
    </span>
  );
}

export function DiagnosisItem({ diagnosis, rank, debugMode = false }: DiagnosisItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [showAllEvidence, setShowAllEvidence] = useState(false);
  const isHighAcuity = diagnosis.acuteness > 0.7;

  const contributions: FeatureContribution[] = [
    ...(diagnosis.boosts ?? []),
    ...(diagnosis.penalties ?? []),
  ].sort((a, b) => Math.abs(b.contributionLog) - Math.abs(a.contributionLog));

  const visibleEvidence = diagnosis.evidence
    ? showAllEvidence ? diagnosis.evidence : diagnosis.evidence.slice(0, 5)
    : [];

  return (
    <div className="border-b border-border last:border-b-0">
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        className="grid grid-cols-[1.75rem_minmax(9rem,16rem)_5.75rem_3.5rem_minmax(0,1fr)_1rem] items-center gap-x-2 py-1 px-1 cursor-pointer select-none hover:bg-muted/50"
        onClick={() => setExpanded(!expanded)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(!expanded); } }}
      >
        <span className="num text-xs text-muted-foreground text-right pr-1">{rank + 1}</span>

        <span className="min-w-0 flex items-center gap-1.5">
          <span className="text-sm text-foreground truncate" title={diagnosis.name}>{diagnosis.name}</span>
          {isHighAcuity && <span className="acuity-badge shrink-0">High acuity</span>}
        </span>

        {diagnosis.priorPercent != null ? (
          <PriorPosteriorTrack prior={diagnosis.priorPercent} posterior={diagnosis.probability} />
        ) : (
          <span />
        )}

        <span className="num text-sm font-medium text-foreground text-right">
          {formatPct(diagnosis.probability)}%
        </span>

        <span className="hidden xl:flex items-center gap-1 overflow-hidden min-w-0">
          {contributions.slice(0, 3).map((c, i) => (
            <ContributionChip key={i} c={c} />
          ))}
        </span>

        <ChevronDown
          aria-hidden
          className={cn('w-3.5 h-3.5 text-muted-foreground transition-transform', expanded && 'rotate-180')}
        />
      </div>

      {expanded && (
        <div className="pl-10 pr-3 pb-2 pt-1 space-y-2 text-xs border-t border-dashed border-border/60">
          {/* All contributing evidence as signed chips */}
          {contributions.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {contributions.map((c, i) => (
                <ContributionChip key={i} c={c} />
              ))}
            </div>
          )}

          {/* Prior → posterior numerically */}
          {diagnosis.priorPercent != null && (
            <p className="text-muted-foreground">
              Baseline prior <span className="num">{formatPct(diagnosis.priorPercent)}%</span>
              {' → '}posterior <span className="num">{formatPct(diagnosis.probability)}%</span>
            </p>
          )}

          {/* Prior breakdown */}
          {debugMode && diagnosis.priorBreakdown && (
            <div className="num text-[10px] text-muted-foreground leading-relaxed">
              <span className="text-muted-foreground/60">Prior:</span>{' '}
              base {diagnosis.priorBreakdown.base_prevalence.toFixed(4)}{' '}
              <span className="text-muted-foreground/50">({diagnosis.priorBreakdown.tier_label})</span>
              {` × age(${diagnosis.priorBreakdown.age_bucket}) `}
              {diagnosis.priorBreakdown.age_multiplier.toFixed(1)}
              {` × sex(${diagnosis.priorBreakdown.sex}) `}
              {diagnosis.priorBreakdown.sex_multiplier.toFixed(1)}
              {` × smoking(${diagnosis.priorBreakdown.smoker_status}) `}
              {diagnosis.priorBreakdown.smoking_multiplier.toFixed(1)}
              {' = '}
              <span className="text-foreground font-semibold">
                {diagnosis.priorBreakdown.prior_weight.toFixed(4)}
              </span>
            </div>
          )}

          {/* ICD-10 codes */}
          {diagnosis.icd10_codes && diagnosis.icd10_codes.length > 0 && (
            <div className="num text-[10px] text-muted-foreground">
              <span className="text-muted-foreground/60">ICD-10:</span>{' '}
              {diagnosis.icd10_codes.join(', ')}
            </div>
          )}

          {/* Clinical Rationale */}
          {diagnosis.rationale_text && (
            <p className="leading-relaxed text-muted-foreground">
              {diagnosis.rationale_text}
            </p>
          )}

          {/* Evidence Citations */}
          {visibleEvidence.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Evidence
              </span>
              {visibleEvidence.map((cite, i) => (
                <div key={i} className="space-y-0.5">
                  <a
                    href={cite.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-next-step hover:underline inline-flex items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {cite.title}
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                  <p className="text-muted-foreground/70">
                    {cite.journal} · {cite.year}
                  </p>
                  {cite.snippet && (
                    <p className="text-muted-foreground/60 italic">{cite.snippet}</p>
                  )}
                </div>
              ))}
              {diagnosis.evidence && diagnosis.evidence.length > 5 && !showAllEvidence && (
                <button
                  onClick={(e) => { e.stopPropagation(); setShowAllEvidence(true); }}
                  className="text-next-step hover:underline"
                >
                  Show {diagnosis.evidence.length - 5} more
                </button>
              )}
            </div>
          )}

          {contributions.length === 0 && !diagnosis.rationale_text && visibleEvidence.length === 0 && (
            <p className="text-muted-foreground italic">No rationale data available.</p>
          )}
        </div>
      )}
    </div>
  );
}
