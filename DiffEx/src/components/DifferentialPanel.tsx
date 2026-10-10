import { useMemo, useState } from 'react';
import { Bug, Settings, Search } from 'lucide-react';
import { DiagnosisItem } from './DiagnosisItem';
import { DownloadDropdown } from './DownloadDropdown';
import { PriorsEditorDialog } from './PriorsEditorDialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import type { DifferentialResult, CoverageInfo } from '@/lib/computeDifferential';
import type { PatientData } from '@/types';
import { looksLikeIcd10, findConditionsByIcd10 } from '@/data/icd10Dictionary';
import { getAllEdges } from '@/lib/differentialStore';
import { findFeatureById } from '@/lib/evidenceStore';

interface DifferentialPanelProps {
  differentialResults: DifferentialResult[];
  coverageInfo: CoverageInfo;
  patientData: PatientData;
  selectedFeatureIds: string[];
  testResultIds: string[];
  onPriorsChanged?: () => void;
}

function formatPct(p: number): string {
  if (p >= 10) return p.toFixed(0);
  if (p >= 1) return p.toFixed(1);
  return p.toFixed(2);
}

export function DifferentialPanel({
  differentialResults,
  coverageInfo,
  patientData,
  selectedFeatureIds,
  testResultIds,
  onPriorsChanged,
}: DifferentialPanelProps) {
  const [debugMode, setDebugMode] = useState(false);
  const [priorsOpen, setPriorsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [focusedView, setFocusedView] = useState(true);

  // Prior-only baseline: normalize priorWeight across the candidate set so
  // it is comparable to the posterior percentage. Display-only derivation —
  // the engine's math is untouched.
  const priorWeightSum = useMemo(
    () => differentialResults.reduce((s, r) => s + (r.priorWeight || 0), 0),
    [differentialResults]
  );

  // Filter by ICD-10 code if search looks like one
  const icd10MatchLabels = searchQuery && looksLikeIcd10(searchQuery)
    ? findConditionsByIcd10(searchQuery)
    : [];

  const mappedDiagnoses = differentialResults
    .filter(r => {
      if (!searchQuery.trim()) return true;
      if (icd10MatchLabels.length > 0) return icd10MatchLabels.includes(r.label);
      return r.label.toLowerCase().includes(searchQuery.toLowerCase());
    })
    .map(r => ({
      id: r.id,
      name: r.label,
      baseWeight: 1,
      acuteness: r.acuteness,
      score: 0,
      probability: r.probabilityPercent,
      contributingFactors: r.contributingFeatures,
      boosts: r.boosts,
      penalties: r.penalties,
      priorWeight: r.priorWeight,
      priorBreakdown: r.priorBreakdown,
      icd10_codes: r.icd10_codes,
      priorPercent: priorWeightSum > 0 ? (r.priorWeight / priorWeightSum) * 100 : undefined,
    }))
    .slice(0, 30);

  // Focused view derived data
  const topCandidates = mappedDiagnoses.slice(0, 3);
  const topCandidateIds = new Set(topCandidates.map(d => d.id));
  const acuteConditions = mappedDiagnoses.filter(d => d.acuteness > 0.7 && !topCandidateIds.has(d.id));

  // For each can't-miss condition: the strongest KB finding not yet observed,
  // i.e. the edge with the highest LR whose feature isn't in this patient's
  // matched evidence. Checking it moves the posterior the most.
  const ruleOutChecks = useMemo(() => {
    const checks = new Map<string, string>();
    if (acuteConditions.length === 0) return checks;
    const edges = getAllEdges();
    for (const cond of acuteConditions) {
      const observed = new Set([
        ...(cond.boosts ?? []).map(b => b.feature_id),
        ...(cond.penalties ?? []).map(p => p.feature_id),
      ]);
      const candidates = edges
        .filter(e => e.condition_id === cond.id && !observed.has(e.feature_id) && e.lr_present > 1)
        .sort((a, b) => b.lr_present - a.lr_present);
      for (const edge of candidates) {
        const label = findFeatureById(edge.feature_id)?.canonical_label;
        if (label) {
          checks.set(cond.id, label);
          break;
        }
      }
    }
    return checks;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [differentialResults, searchQuery]);

  const tableHeader = (
    <div className="grid grid-cols-[1.75rem_minmax(9rem,16rem)_5.75rem_3.5rem_minmax(0,1fr)_1rem] gap-x-2 px-1 pb-1 border-b border-border text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
      <span className="text-right pr-1">#</span>
      <span>Condition</span>
      <span>Prior → Post</span>
      <span className="text-right">P%</span>
      <span className="hidden xl:block">Key Evidence</span>
      <span />
    </div>
  );

  return (
    <div className="panel h-full flex flex-col">
      <div className="panel-header flex items-center gap-2">
        <h2 className="font-semibold text-sm">Differential</h2>
        <span className="ml-auto" />

        {/* Focused / Show All segmented toggle */}
        <div className="flex items-center rounded-sm border border-border bg-muted/60 p-px text-xs gap-px">
          <button
            onClick={() => setFocusedView(true)}
            className={`px-2 py-0.5 rounded-sm ${
              focusedView
                ? 'bg-background text-foreground font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Focused
          </button>
          <button
            onClick={() => setFocusedView(false)}
            className={`px-2 py-0.5 rounded-sm ${
              !focusedView
                ? 'bg-background text-foreground font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            All
          </button>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className={`h-6 w-6 p-0 ${showSearch ? 'text-foreground' : 'text-muted-foreground'}`}
          onClick={() => { setShowSearch(s => !s); if (showSearch) setSearchQuery(''); }}
          title="Search conditions / ICD-10"
        >
          <Search className="w-3.5 h-3.5" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className={`h-6 w-6 p-0 ${debugMode ? 'text-foreground' : 'text-muted-foreground'}`}
          onClick={() => setDebugMode(d => !d)}
          title="Toggle debug breakdown"
        >
         <Bug className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-muted-foreground"
          onClick={() => setPriorsOpen(true)}
          title="Edit priors"
        >
          <Settings className="w-3.5 h-3.5" />
        </Button>
        <DownloadDropdown
          diagnoses={mappedDiagnoses}
          patientData={patientData}
          selectedFeatureIds={selectedFeatureIds}
          testResultIds={testResultIds}
        />
      </div>

      <PriorsEditorDialog
        open={priorsOpen}
        onOpenChange={setPriorsOpen}
        onPriorsChanged={onPriorsChanged}
      />
      {showSearch && (
        <div className="px-3 py-1.5 border-b border-border">
          <Input
            placeholder="Search by name or ICD-10 (e.g. I26.99)…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="h-6 text-xs"
          />
        </div>
      )}

      {coverageInfo.lowCoverage && coverageInfo.evidenceCount > 0 && (
        <div className="px-3 py-1.5 border-b border-[hsl(35,70%,80%)] bg-[hsl(35,85%,95%)] text-xs text-warning">
          Low knowledge-base coverage for this case — results may be unreliable. Consider adding a condition pack.
        </div>
      )}

      <div className="panel-content flex-1 overflow-auto !p-2">
        {mappedDiagnoses.length === 0 ? (
          <div className="text-center text-muted-foreground py-8 text-sm">
            <p>Add patient findings to see the differential</p>
          </div>
        ) : focusedView ? (
          <div className="space-y-3">

            {/* ── Top Candidates ── */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 px-1">
                Top Candidates
              </p>
              {tableHeader}
              <div>
                {topCandidates.map((diagnosis, index) => (
                  <DiagnosisItem
                    key={diagnosis.id}
                    diagnosis={diagnosis}
                    rank={index}
                    debugMode={debugMode}
                  />
                ))}
              </div>
            </div>

            {/* ── Can't-miss checklist ── */}
            {acuteConditions.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-acuity mb-1 px-1">
                  Can't-Miss — Rule Out
                </p>
                <div className="border-t border-border">
                  {acuteConditions.map((diagnosis) => (
                    <div
                      key={diagnosis.id}
                      className="grid grid-cols-[minmax(9rem,15rem)_3.5rem_minmax(0,1fr)] items-baseline gap-x-2 py-1 px-1 border-b border-border text-sm"
                    >
                      <span className="truncate text-foreground" title={diagnosis.name}>{diagnosis.name}</span>
                      <span className="num text-right text-foreground">{formatPct(diagnosis.probability)}%</span>
                      <span className="text-xs text-muted-foreground truncate">
                        {ruleOutChecks.get(diagnosis.id)
                          ? <>Check: <span className="text-foreground">{ruleOutChecks.get(diagnosis.id)}</span></>
                          : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        ) : (
          /* ── Show All ── */
          <div>
            {tableHeader}
            {mappedDiagnoses.map((diagnosis, index) => (
              <DiagnosisItem key={diagnosis.id} diagnosis={diagnosis} rank={index} debugMode={debugMode} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
