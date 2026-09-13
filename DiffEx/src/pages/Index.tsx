import { useState, useMemo, useCallback, useEffect } from 'react';
import { DisclaimerBanner } from '@/components/DisclaimerBanner';
import { PatientPanel } from '@/components/PatientPanel';
import { DifferentialPanel } from '@/components/DifferentialPanel';
import { SuggestionsPanel } from '@/components/SuggestionsPanel';
import { EvidenceStrip } from '@/components/EvidenceStrip';
import { ChangeLog } from '@/components/ChangeLog';
import { computeScores, createLogEntry } from '@/lib/scoring';
import { getSuggestedQuestions, getSuggestedTests } from '@/lib/suggestions';
import { getOptimizerItems } from '@/lib/optimizer';
import { loadRegistry } from '@/lib/featureRegistry';
import { upsertFeature, upsertPatientEvidence, getPatientEvidence, incrementFeatureUsage, findFeatureByLabelOrSynonym, findFeatureById } from '@/lib/evidenceStore';
import { seedIfEmpty } from '@/lib/differentialStore';
import { seedPriorsIfEmpty } from '@/lib/priorsStore';
import { ensureSeedVersion, wipeSeedData } from '@/lib/seedManager';
import { refreshCacheForEvidence } from '@/lib/knowledgeCache';
import { seedSupabaseIfEmpty } from '@/lib/supabaseSeed';
import { computeDifferential } from '@/lib/computeDifferential';
import { demoPatient, demoFindings, features } from '@/data/knowledgeBase';
import type { PatientData, ChangeLogEntry, SuggestedQuestion, SuggestedTest } from '@/types';
import type { RegistryFeature } from '@/types/evidence';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Bug, RotateCcw } from 'lucide-react';

const emptyPatient: PatientData = {
  story: '',
  age: 0,
  sex: 'M',
};

export default function Index() {
  const [patientData, setPatientData] = useState<PatientData>(emptyPatient);
  const [selectedFeatureIds, setSelectedFeatureIds] = useState<string[]>([]);
  const [testResultIds, setTestResultIds] = useState<string[]>([]);
  const [changeLog, setChangeLog] = useState<ChangeLogEntry[]>([]);
  const [demoFindingIndex, setDemoFindingIndex] = useState(0);
  const [resetKey, setResetKey] = useState(0);
  const [registry, setRegistry] = useState<RegistryFeature[]>(() => loadRegistry());
  const [patientId] = useState(() => `patient_${Date.now()}`);
  const [evidenceVersion, setEvidenceVersion] = useState(0);
  // cacheVersion bumps after Supabase cache refreshes, triggering a re-compute
  // that uses the backend-sourced conditions/edges instead of localStorage.
  const [cacheVersion, setCacheVersion] = useState(0);

  // Seed conditions + edges on first load (with version check)
  useEffect(() => {
    const migrated = ensureSeedVersion(() => {
      seedIfEmpty();
      seedPriorsIfEmpty();
    });
    if (!migrated) {
      // No migration needed, but ensure seed exists
      seedIfEmpty();
      seedPriorsIfEmpty();
    }
    setEvidenceVersion(v => v + 1);
    // Push local seed data to Supabase (no-op if already seeded)
    seedSupabaseIfEmpty();
  }, []);

  // When evidence changes, refresh the Supabase-backed knowledge cache.
  // Pass feature labels (stable across sessions) not localStorage IDs (which
  // differ from Supabase IDs after seed remapping).
  useEffect(() => {
    if (evidenceVersion === 0) return;
    const evidence = getPatientEvidence(patientId);
    const featureLabels = evidence.map(e => e.canonical_label).filter(Boolean);
    refreshCacheForEvidence(featureLabels).then(() => {
      setCacheVersion(v => v + 1);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evidenceVersion, patientId]);

  // Compute evidence-based differential.
  // Depends on both evidenceVersion (immediate localStorage recompute)
  // and cacheVersion (recompute after Supabase cache is ready).
  const differentialOutput = useMemo(() => {
    return computeDifferential(patientId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, evidenceVersion, cacheVersion]);

  const differentialResults = differentialOutput.results;
  const coverageInfo = differentialOutput.coverage;

  // Compute old-style diagnoses (still used by suggestions/optimizer)
  const scoredDiagnoses = useMemo(() => {
    return computeScores(selectedFeatureIds, testResultIds);
  }, [selectedFeatureIds, testResultIds]);

  // Compute suggestions
  const suggestedQuestions = useMemo(() => {
    return getSuggestedQuestions(scoredDiagnoses, selectedFeatureIds);
  }, [scoredDiagnoses, selectedFeatureIds]);

  const suggestedTests = useMemo(() => {
    return getSuggestedTests(scoredDiagnoses, testResultIds);
  }, [scoredDiagnoses, testResultIds]);

  // Compute optimizer items (VOI-based)
  const optimizerItems = useMemo(() => {
    return getOptimizerItems(differentialResults, selectedFeatureIds, testResultIds);
  }, [differentialResults, selectedFeatureIds, testResultIds]);

  const handleEvidenceChanged = useCallback(() => {
    setEvidenceVersion(v => v + 1);
  }, []);

  // Handlers
  const addFeature = useCallback((featureId: string) => {
    if (!selectedFeatureIds.includes(featureId) && !testResultIds.includes(featureId)) {
      const feature = features.find(f => f.id === featureId);
      if (feature?.type === 'lab') {
        setTestResultIds(prev => [...prev, featureId]);
      } else {
        setSelectedFeatureIds(prev => [...prev, featureId]);
      }
      const logEntry = createLogEntry(featureId, 'add', selectedFeatureIds);
      setChangeLog(prev => [logEntry, ...prev].slice(0, 5));

      // Create evidence so the differential updates
      // featureId might be a registry ID (from optimizer) or a knowledgeBase ID
      const regFeature = findFeatureById(featureId)
        ?? findFeatureByLabelOrSynonym(featureId)
        ?? findFeatureByLabelOrSynonym(feature?.name ?? featureId);
      if (regFeature) {
        upsertPatientEvidence({
          patient_id: patientId,
          feature_id: regFeature.id,
          polarity: 'present',
          extracted_by: 'manual',
        });
        incrementFeatureUsage(regFeature.id);
        setEvidenceVersion(v => v + 1);
      } else if (feature) {
        const created = upsertFeature({
          canonical_label: feature.name,
          feature_type: feature.type === 'lab' ? 'lab' : 'symptom',
          value_type: 'boolean',
          synonyms: [feature.name.toLowerCase()],
        });
        upsertPatientEvidence({
          patient_id: patientId,
          feature_id: created.id,
          polarity: 'present',
          extracted_by: 'manual',
        });
        incrementFeatureUsage(created.id);
        setEvidenceVersion(v => v + 1);
      }
    }
  }, [selectedFeatureIds, testResultIds, patientId]);

  // Mark a feature as absent (e.g. "No" in optimizer)
  const addAbsentFeature = useCallback((featureId: string) => {
    const regFeature = findFeatureById(featureId)
      ?? findFeatureByLabelOrSynonym(featureId);
    if (regFeature) {
      upsertPatientEvidence({
        patient_id: patientId,
        feature_id: regFeature.id,
        polarity: 'absent',
        extracted_by: 'manual',
      });
      setEvidenceVersion(v => v + 1);
    }
  }, [patientId]);

  const removeFeature = useCallback((featureId: string) => {
    setSelectedFeatureIds(prev => prev.filter(id => id !== featureId));
    const logEntry = createLogEntry(featureId, 'remove', selectedFeatureIds);
    setChangeLog(prev => [logEntry, ...prev].slice(0, 5));
  }, [selectedFeatureIds]);

  const removeTestResult = useCallback((testId: string) => {
    setTestResultIds(prev => prev.filter(id => id !== testId));
    const logEntry = createLogEntry(testId, 'remove', selectedFeatureIds);
    setChangeLog(prev => [logEntry, ...prev].slice(0, 5));
  }, [selectedFeatureIds]);

  const addTest = useCallback((testId: string) => {
    const existingFeature = features.find(f => f.id === testId && f.type === 'lab');
    if (existingFeature) {
      if (!testResultIds.includes(testId)) {
        setTestResultIds(prev => [...prev, testId]);
        const logEntry = createLogEntry(testId, 'add', selectedFeatureIds);
        setChangeLog(prev => [logEntry, ...prev].slice(0, 5));
        // Create evidence for the differential
        const regFeature = findFeatureByLabelOrSynonym(existingFeature.name);
        if (regFeature) {
          upsertPatientEvidence({ patient_id: patientId, feature_id: regFeature.id, polarity: 'present', extracted_by: 'manual' });
          incrementFeatureUsage(regFeature.id);
          setEvidenceVersion(v => v + 1);
        }
      }
      return;
    }

    const testToFeature: Record<string, string> = {
      ddimer: 'elevated_ddimer',
      troponin: 'elevated_troponin',
      bnp: 'elevated_bnp',
      cbc: 'low_hgb',
    };
    const featureId = testToFeature[testId];
    if (featureId && !testResultIds.includes(featureId)) {
      setTestResultIds(prev => [...prev, featureId]);
      const logEntry = createLogEntry(featureId, 'add', selectedFeatureIds);
      setChangeLog(prev => [logEntry, ...prev].slice(0, 5));
      // Create evidence for the differential
      const regFeature = findFeatureByLabelOrSynonym(featureId);
      if (regFeature) {
        upsertPatientEvidence({ patient_id: patientId, feature_id: regFeature.id, polarity: 'present', extracted_by: 'manual' });
        incrementFeatureUsage(regFeature.id);
        setEvidenceVersion(v => v + 1);
      }
    }
  }, [testResultIds, selectedFeatureIds, patientId]);

  const loadDemo = useCallback(() => {
    setPatientData({
      story: demoPatient.story,
      age: demoPatient.age,
      sex: demoPatient.sex,
    });
    setSelectedFeatureIds(demoPatient.initialFeatures);
    setTestResultIds([]);
    setChangeLog([]);
    setDemoFindingIndex(0);
  }, []);

  const reset = useCallback(() => {
    // Wipe and reseed knowledge base
    wipeSeedData();
    seedIfEmpty();
    seedPriorsIfEmpty();
    // Reset patient state
    setPatientData(emptyPatient);
    setSelectedFeatureIds([]);
    setTestResultIds([]);
    setChangeLog([]);
    setDemoFindingIndex(0);
    setResetKey(k => k + 1);
    setEvidenceVersion(v => v + 1);
  }, []);

  const addNextFinding = useCallback(() => {
    if (demoFindingIndex < demoFindings.length) {
      const finding = demoFindings[demoFindingIndex];
      addFeature(finding.featureId);
      setDemoFindingIndex(prev => prev + 1);
    }
  }, [demoFindingIndex, addFeature]);

  const hasNextFinding = selectedFeatureIds.length > 0 && demoFindingIndex < demoFindings.length;

  const handleDebugEvidence = useCallback(() => {
    const debugPatientId = `patient_debug_${Date.now()}`;
    const ageFeat = upsertFeature({ canonical_label: 'Age', feature_type: 'history', value_type: 'numeric', synonyms: ['age', 'years old'] });
    const sexFeat = upsertFeature({ canonical_label: 'Sex', feature_type: 'history', value_type: 'categorical', synonyms: ['male', 'female', 'gender'] });
    incrementFeatureUsage(ageFeat.id);
    incrementFeatureUsage(sexFeat.id);
    upsertPatientEvidence({ patient_id: debugPatientId, feature_id: ageFeat.id, polarity: 'present', value_numeric: 63, extracted_by: 'manual' });
    upsertPatientEvidence({ patient_id: debugPatientId, feature_id: sexFeat.id, polarity: 'present', value_category: 'male', extracted_by: 'manual' });
    const saved = getPatientEvidence(debugPatientId);
    console.log('[DiffEx Debug] Saved evidence:', saved);
    setRegistry(loadRegistry());
    toast.success('Saved sample evidence — check console');
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <DisclaimerBanner />

      <header className="border-b border-border bg-card px-6 py-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-semibold text-sm">Dx</span>
          </div>
          <div>
            <h1 className="text-base font-semibold text-foreground leading-tight">DiffEx</h1>
            <p className="text-xs text-muted-foreground">Differential Expander</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={handleDebugEvidence}>
              <Bug className="w-3.5 h-3.5 mr-1" />
              Add Sample Evidence
            </Button>
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={reset}>
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              Reset
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 p-6 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_380px] gap-5 h-full min-h-[500px]">
          <PatientPanel
            patientData={patientData}
            selectedFeatureIds={selectedFeatureIds}
            testResultIds={testResultIds}
            patientId={patientId}
            onPatientDataChange={setPatientData}
            onRemoveFeature={removeFeature}
            onRemoveTestResult={removeTestResult}
            onLoadDemo={loadDemo}
            onReset={reset}
            onAddNextFinding={addNextFinding}
            hasNextFinding={hasNextFinding}
            onEvidenceChanged={handleEvidenceChanged}
          />

          <DifferentialPanel
            differentialResults={differentialResults}
            coverageInfo={coverageInfo}
            patientData={patientData}
            selectedFeatureIds={selectedFeatureIds}
            testResultIds={testResultIds}
            onPriorsChanged={handleEvidenceChanged}
          />

          <SuggestionsPanel
            key={resetKey}
            questions={suggestedQuestions}
            tests={suggestedTests}
            optimizerItems={optimizerItems}
            onAddQuestion={addFeature}
            onAbsentQuestion={addAbsentFeature}
            onAddTest={addTest}
          />
        </div>
      </main>

      {/* Bottom: Evidence Strip */}
      <div className="mt-auto">
        <EvidenceStrip
          selectedFeatureIds={selectedFeatureIds}
          testResultIds={testResultIds}
          onRemoveFeature={removeFeature}
          onRemoveTestResult={removeTestResult}
        />

        <ChangeLog entries={changeLog} />
      </div>
    </div>
  );
}
