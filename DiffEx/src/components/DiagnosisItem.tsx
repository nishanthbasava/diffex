import { useState } from 'react';
import { AlertTriangle, ChevronDown, ExternalLink, TrendingUp, TrendingDown } from 'lucide-react';
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
}

interface DiagnosisItemProps {
  diagnosis: DiagnosisItemData;
  rank: number;
  debugMode?: boolean;
}

export function DiagnosisItem({ diagnosis, rank, debugMode = false }: DiagnosisItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [showAllEvidence, setShowAllEvidence] = useState(false);
  const isHighAcuity = diagnosis.acuteness > 0.7;
  const hasDrawerContent = debugMode || diagnosis.rationale_text || (diagnosis.evidence && diagnosis.evidence.length > 0);
  const hasDebugData = debugMode && ((diagnosis.boosts?.length ?? 0) > 0 || (diagnosis.penalties?.length ?? 0) > 0);

  const visibleEvidence = diagnosis.evidence
    ? showAllEvidence ? diagnosis.evidence : diagnosis.evidence.slice(0, 5)
    : [];

  return (
    <div className="animate-fade-in" style={{ animationDelay: `${rank * 50}ms` }}>
      <div
        className={cn(
          "flex items-start justify-between mb-2 cursor-pointer select-none",
          hasDrawerContent && "hover:opacity-80"
        )}
        onClick={() => hasDrawerContent && setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground w-5">
            {rank + 1}.
          </span>
          <span className="font-medium text-foreground">{diagnosis.name}</span>
          {isHighAcuity && (
            <span className="high-acuity-badge">
              <AlertTriangle className="w-3 h-3" />
              High acuity
            </span>
          )}
          {hasDrawerContent && (
            <button className="text-xs text-muted-foreground hover:text-primary transition-colors ml-1">
              <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-200", expanded && "rotate-180")} />
            </button>
          )}
        </div>
        <span className="text-sm font-semibold text-primary tabular-nums">
          {diagnosis.probability.toFixed(1)}%
        </span>
      </div>

      {/* Probability Bar */}
      <div className="ml-7 mb-1">
        <div className="h-2.5 bg-muted rounded-full overflow-hidden">
          <div
            className="probability-bar"
            style={{
              width: `${Math.min(diagnosis.probability, 100)}%`,
              opacity: 0.6 + (diagnosis.probability / 100) * 0.4
            }}
          />
        </div>
      </div>

      {/* Contributing Factors */}
      {diagnosis.contributingFactors.length > 0 && (
        <div className="ml-7 mt-1.5">
          <p className="text-xs text-muted-foreground">
            {diagnosis.contributingFactors.slice(0, 2).join(' • ')}
          </p>
        </div>
      )}

      {/* Expanded Drawer */}
      <div
        className={cn(
          "ml-7 overflow-hidden transition-all duration-300 ease-in-out",
          expanded ? "max-h-[600px] opacity-100 mt-3" : "max-h-0 opacity-0"
        )}
      >
        {expanded && (
          <div className="border-l-2 border-primary/20 pl-4 space-y-3">
            {/* Prior breakdown */}
            {debugMode && diagnosis.priorBreakdown && (
              <div className="text-[10px] text-muted-foreground font-mono leading-relaxed">
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
            {debugMode && diagnosis.icd10_codes && diagnosis.icd10_codes.length > 0 && (
              <div className="text-[10px] text-muted-foreground font-mono">
                <span className="text-muted-foreground/60">ICD-10:</span>{' '}
                {diagnosis.icd10_codes.join(', ')}
              </div>
            )}
            {/* Debug: Boosts & Penalties */}
            {hasDebugData && (
              <div className="space-y-2">
                {(diagnosis.boosts?.length ?? 0) > 0 && (
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
                      <TrendingUp className="w-3 h-3 text-green-500" /> Boosts
                    </span>
                    <div className="mt-1 space-y-0.5">
                      {diagnosis.boosts!.map((c, i) => (
                        <p key={i} className="text-xs text-muted-foreground font-mono">
                          • {c.feature_label} — {c.polarity} — LR x{c.lr_used.toFixed(2)}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
                {(diagnosis.penalties?.length ?? 0) > 0 && (
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
                      <TrendingDown className="w-3 h-3 text-red-500" /> Penalties
                    </span>
                    <div className="mt-1 space-y-0.5">
                      {diagnosis.penalties!.map((c, i) => (
                        <p key={i} className="text-xs text-muted-foreground font-mono">
                          • {c.feature_label} — {c.polarity} — LR x{c.lr_used.toFixed(2)}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Clinical Rationale */}
            {diagnosis.rationale_text && (
              <p className="text-xs leading-relaxed text-muted-foreground">
                {diagnosis.rationale_text}
              </p>
            )}

            {/* Evidence Citations */}
            {visibleEvidence.length > 0 && (
              <div className="space-y-2">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Evidence
                </span>
                {visibleEvidence.map((cite, i) => (
                  <div key={i} className="text-xs space-y-0.5">
                    <a
                      href={cite.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-1"
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
                    className="text-xs text-primary hover:underline"
                  >
                    Show {diagnosis.evidence.length - 5} more
                  </button>
                )}
              </div>
            )}

            {!hasDebugData && !diagnosis.rationale_text && visibleEvidence.length === 0 && (
              <p className="text-xs text-muted-foreground italic">No rationale data available.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
