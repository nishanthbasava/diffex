import { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

import { FeatureChip } from './FeatureChip';
import { FileUploadArea } from './FileUploadArea';
import { EvidencePanel } from './EvidencePanel';
import { FeatureRegistryDialog } from './FeatureRegistryDialog';
import { DictationButton } from './DictationButton';
import { User, RotateCcw, PlayCircle, Plus, Zap } from 'lucide-react';
import type { PatientData } from '@/types';
import type { ExtractionCandidate, PatientEvidence, RegistryFeature } from '@/types/evidence';
import { features } from '@/data/knowledgeBase';
import { extractEvidenceFromNote } from '@/lib/noteExtractor';
import { extractWithAI, processAIFindings } from '@/lib/aiExtractor';
import { loadRegistry } from '@/lib/featureRegistry';

interface PatientPanelProps {
  patientData: PatientData;
  selectedFeatureIds: string[];
  testResultIds: string[];
  patientId: string;
  onPatientDataChange: (data: PatientData) => void;
  onRemoveFeature: (id: string) => void;
  onRemoveTestResult: (id: string) => void;
  onLoadDemo: () => void;
  onReset: () => void;
  onAddNextFinding: () => void;
  hasNextFinding: boolean;
  onEvidenceChanged?: () => void;
}

export function PatientPanel({
  patientData,
  selectedFeatureIds,
  testResultIds,
  patientId,
  onPatientDataChange,
  onRemoveFeature,
  onRemoveTestResult,
  onLoadDemo,
  onReset,
  onAddNextFinding,
  hasNextFinding,
  onEvidenceChanged,
}: PatientPanelProps) {
  const [autoAppend, setAutoAppend] = useState(true);
  const [isExtracting, setIsExtracting] = useState(false);
  const [candidates, setCandidates] = useState<ExtractionCandidate[]>([]);
  const [evidence, setEvidence] = useState<PatientEvidence[]>([]);
  const [registry, setRegistry] = useState<RegistryFeature[]>(() => loadRegistry());
  const extractionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastExtractedText = useRef('');

  const selectedFeatures = selectedFeatureIds
    .map(id => features.find(f => f.id === id))
    .filter(Boolean);

  const testResults = testResultIds
    .map(id => features.find(f => f.id === id))
    .filter(Boolean);

  const handleTextExtracted = useCallback((text: string, filename: string) => {
    const importedContent = `\n\n--- Imported from ${filename} ---\n${text}`;
    onPatientDataChange({
      ...patientData,
      story: patientData.story + importedContent,
    });
  }, [patientData, onPatientDataChange]);

  const [extractionCount, setExtractionCount] = useState<number | null>(null);

  const runExtraction = useCallback((text: string) => {
    if (!text.trim()) {
      setCandidates([]);
      setEvidence([]);
      setExtractionCount(null);
      lastExtractedText.current = '';
      return;
    }
    setIsExtracting(true);
    // Step 1: Rule-based extraction (instant)
    const ruleResult = extractEvidenceFromNote(text, patientId);
    setCandidates(ruleResult.candidates);
    setEvidence(ruleResult.evidence);
    setExtractionCount(ruleResult.evidence.length);
    setRegistry(loadRegistry());
    lastExtractedText.current = text;

    // Step 2: AI extraction (async) — fills gaps the rule-based system missed
    extractWithAI(text).then(aiFindings => {
      if (aiFindings.length === 0) {
        setIsExtracting(false);
        onEvidenceChanged?.();
        return;
      }
      const { candidates: aiCandidates, evidence: aiEvidence } = processAIFindings(aiFindings, patientId);

      // Merge: add AI findings not already found by rules
      const existingLabels = new Set(ruleResult.candidates.map(c => c.label.toLowerCase()));
      const newCandidates = aiCandidates.filter(c => !existingLabels.has(c.label.toLowerCase()));
      const newEvidence = aiEvidence.filter(e => 
        !ruleResult.evidence.some(re => re.feature_id === e.feature_id)
      );

      if (newCandidates.length > 0) {
        setCandidates(prev => [...prev, ...newCandidates]);
        setEvidence(prev => [...prev, ...newEvidence]);
        setExtractionCount(prev => (prev ?? 0) + newEvidence.length);
        setRegistry(loadRegistry());
        console.log(`[DiffEx AI] Added ${newCandidates.length} new AI-extracted findings`);
      }
      setIsExtracting(false);
      onEvidenceChanged?.();
    }).catch(err => {
      console.error('[DiffEx AI] Extraction failed:', err);
      setIsExtracting(false);
      onEvidenceChanged?.();
    });
  }, [patientId, onEvidenceChanged]);

  // Auto-extract on note change (debounced)
  useEffect(() => {
    if (patientData.story === lastExtractedText.current) return;
    if (extractionTimer.current) clearTimeout(extractionTimer.current);
    extractionTimer.current = setTimeout(() => {
      runExtraction(patientData.story);
    }, 800);
    return () => {
      if (extractionTimer.current) clearTimeout(extractionTimer.current);
    };
  }, [patientData.story, runExtraction]);

  const handleRerun = useCallback(() => {
    lastExtractedText.current = ''; // Force re-run
    runExtraction(patientData.story);
  }, [patientData.story, runExtraction]);

  const handleAddSynonym = useCallback((featureId: string, synonym: string) => {
    // This is handled inside the registry
    setRegistry(loadRegistry());
  }, []);

  const handleRegistryChange = useCallback(() => {
    setRegistry(loadRegistry());
  }, []);

  return (
    <div className="panel h-full flex flex-col">
      <div className="panel-header flex items-center gap-2">
        <User className="w-5 h-5 text-primary" />
        <h2 className="font-semibold text-lg flex-1">Patient</h2>
        <FeatureRegistryDialog registry={registry} onRegistryChange={handleRegistryChange} />
      </div>

      <div className="panel-content flex-1 flex flex-col gap-5 overflow-auto">
        {/* Patient Story */}
        <div className="space-y-1.5 flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between">
            <Label htmlFor="story" className="text-sm text-muted-foreground">Patient Story</Label>
            <DictationButton onTranscript={(text) => onPatientDataChange({ ...patientData, story: patientData.story + (patientData.story ? ' ' : '') + text })} />
          </div>
          <Textarea
            id="story"
            value={patientData.story}
            onChange={(e) => onPatientDataChange({ ...patientData, story: e.target.value })}
            placeholder="Enter patient presentation, history, symptoms..."
            className="flex-1 min-h-[100px] resize-none text-sm"
          />
        </div>

        {/* File Upload / OCR Section */}
        <FileUploadArea
          onTextExtracted={handleTextExtracted}
          autoAppend={autoAppend}
          onAutoAppendChange={setAutoAppend}
        />

        {/* Process Button */}
        <Button
          onClick={handleRerun}
          variant="default"
          size="sm"
          className="w-full"
          disabled={isExtracting || !patientData.story.trim()}
        >
          <Zap className={`w-4 h-4 mr-1.5 ${isExtracting ? 'animate-spin' : ''}`} />
          {isExtracting ? 'Processing…' : 'Process Note'}
        </Button>

        {extractionCount !== null && !isExtracting && (
          <p className="text-xs text-muted-foreground text-center">
            Extracted {extractionCount} evidence item{extractionCount !== 1 ? 's' : ''}
          </p>
        )}

        {/* Extracted Evidence (collapsed by default) */}
        <EvidencePanel
          candidates={candidates}
          evidence={evidence}
          registry={registry}
          isExtracting={isExtracting}
          onRerun={handleRerun}
          onAddSynonym={handleAddSynonym}
        />

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button onClick={onLoadDemo} variant="secondary" size="sm" className="flex-1">
            <PlayCircle className="w-4 h-4 mr-1.5" />
            Load Demo
          </Button>
          <Button onClick={onReset} variant="outline" size="sm" className="flex-1">
            <RotateCcw className="w-4 h-4 mr-1.5" />
            Reset
          </Button>
        </div>

        {hasNextFinding && (
          <Button onClick={onAddNextFinding} variant="default" size="sm" className="w-full">
            <Plus className="w-4 h-4 mr-1.5" />
            Add Next Finding
          </Button>
        )}

        {/* Selected Findings */}
        {selectedFeatures.length > 0 && (
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Selected Findings</Label>
            <div className="flex flex-wrap gap-2">
              {selectedFeatureIds.map(id => (
                <FeatureChip
                  key={id}
                  featureId={id}
                  onRemove={() => onRemoveFeature(id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Test Results */}
        {testResults.length > 0 && (
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Test Results</Label>
            <div className="flex flex-wrap gap-2">
              {testResultIds.map(id => (
                <FeatureChip
                  key={id}
                  featureId={id}
                  onRemove={() => onRemoveTestResult(id)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
