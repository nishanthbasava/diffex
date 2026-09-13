import { useState } from 'react';
import { Activity, Bug, Settings, Search, AlertTriangle } from 'lucide-react';
import { DiagnosisItem } from './DiagnosisItem';
import { DownloadDropdown } from './DownloadDropdown';
import { PriorsEditorDialog } from './PriorsEditorDialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import type { DifferentialResult, CoverageInfo } from '@/lib/computeDifferential';
import type { PatientData } from '@/types';
import { looksLikeIcd10, findConditionsByIcd10 } from '@/data/icd10Dictionary';

interface DifferentialPanelProps {
  differentialResults: DifferentialResult[];
  coverageInfo: CoverageInfo;
  patientData: PatientData;
  selectedFeatureIds: string[];
  testResultIds: string[];
  onPriorsChanged?: () => void;
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
    }))
    .slice(0, 30);

  // Focused view derived data
  const topCandidates = mappedDiagnoses.slice(0, 3);
  const topCandidateIds = new Set(topCandidates.map(d => d.id));
  const acuteConditions = mappedDiagnoses.filter(d => d.acuteness > 0.7 && !topCandidateIds.has(d.id));

  return (
    <div className="panel h-full flex flex-col">
      <div className="panel-header flex items-center gap-2">
        <Activity className="w-5 h-5 text-primary" />
        <h2 className="font-semibold text-lg">Differential</h2>
        <span className="ml-auto" />

        {/* Focused / Show All segmented toggle */}
        <div className="flex items-center rounded-md border border-border bg-muted/60 p-0.5 text-xs gap-0.5">
          <button
            onClick={() => setFocusedView(true)}
            className={`px-2.5 py-0.5 rounded transition-all duration-150 ${
              focusedView
                ? 'bg-background text-foreground shadow-sm font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Focused
          </button>
          <button
            onClick={() => setFocusedView(false)}
            className={`px-2.5 py-0.5 rounded transition-all duration-150 ${
              !focusedView
                ? 'bg-background text-foreground shadow-sm font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            All
          </button>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className={`h-7 w-7 p-0 ${showSearch ? 'text-primary' : 'text-muted-foreground'}`}
          onClick={() => { setShowSearch(s => !s); if (showSearch) setSearchQuery(''); }}
          title="Search conditions / ICD-10"
        >
          <Search className="w-3.5 h-3.5" />
        </Button>
        <Button
          size="sm"
          className={`h-7 w-7 p-0 ${debugMode ? 'text-primary' : 'text-muted-foreground'}`}
          onClick={() => setDebugMode(d => !d)}
          title="Toggle debug breakdown"
        >
         <Bug className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-muted-foreground"
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
        <div className="px-4 pb-2">
          <Input
            placeholder="Search by name or ICD-10 (e.g. I26.99)…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="h-7 text-xs"
          />
        </div>
      )}

      {coverageInfo.lowCoverage && coverageInfo.evidenceCount > 0 && (
        <div className="mx-4 mb-2 flex items-start gap-2 rounded border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-700 dark:text-yellow-400">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>Low knowledge-base coverage for this case — results may be unreliable. Consider adding a condition pack.</span>
        </div>
      )}

      <div className="panel-content flex-1 overflow-auto">
        {mappedDiagnoses.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <p>Add patient findings to see the differential</p>
          </div>
        ) : focusedView ? (
          <div className="space-y-5">

            {/* ── Top Candidates ── */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-0.5">
                Top Candidates
              </p>
              <div className="rounded-lg border border-primary/25 bg-primary/[0.04] px-4 py-4 shadow-sm space-y-5">
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

            {/* ── Rule-Out: High Acuity Conditions ── */}
            {acuteConditions.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-destructive/70 mb-2 px-0.5 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Rule-Out: High Acuity Conditions
                </p>
                <div className="rounded-lg border border-destructive/20 bg-destructive/[0.03] px-4 py-4 space-y-5">
                  {acuteConditions.map((diagnosis) => {
                    const originalRank = mappedDiagnoses.findIndex(d => d.id === diagnosis.id);
                    return (
                      <DiagnosisItem
                        key={diagnosis.id}
                        diagnosis={diagnosis}
                        rank={originalRank}
                        debugMode={debugMode}
                      />
                    );
                  })}
                </div>
              </div>
            )}

          </div>
        ) : (
          /* ── Show All ── */
          <div className="space-y-5">
            {mappedDiagnoses.map((diagnosis, index) => (
              <DiagnosisItem key={diagnosis.id} diagnosis={diagnosis} rank={index} debugMode={debugMode} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
