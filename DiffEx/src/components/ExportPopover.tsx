import { useState } from 'react';
import { Download, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import type { ScoredDiagnosis } from '@/lib/scoring';
import type { PatientData, SuggestedQuestion, SuggestedTest } from '@/types';
import { features } from '@/data/knowledgeBase';

interface ExportPopoverProps {
  diagnoses: ScoredDiagnosis[];
  patientData: PatientData;
  selectedFeatureIds: string[];
  testResultIds: string[];
  suggestedQuestions: SuggestedQuestion[];
  suggestedTests: SuggestedTest[];
}

export function ExportPopover({
  diagnoses,
  patientData,
  selectedFeatureIds,
  testResultIds,
  suggestedQuestions,
  suggestedTests,
}: ExportPopoverProps) {
  const [includePatientStory, setIncludePatientStory] = useState(false);
  const [includeSuggestions, setIncludeSuggestions] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  const generateExport = () => {
    const now = new Date();
    const timestamp = now.toISOString().replace('T', ' ').split('.')[0];
    const fileDate = now.toISOString().split('T')[0];
    const fileTime = now.toTimeString().slice(0, 5).replace(':', '');
    
    const lines: string[] = [];
    
    // Header
    lines.push('═══════════════════════════════════════════════════════');
    lines.push('                    DiffEx Export');
    lines.push('              Differential Expander');
    lines.push('═══════════════════════════════════════════════════════');
    lines.push('');
    
    // Timestamp
    lines.push(`Generated: ${timestamp}`);
    lines.push('');
    
    // Demographics
    lines.push('─── Patient Demographics ───');
    lines.push(`Age: ${patientData.age || 'Not specified'}`);
    lines.push(`Sex: ${patientData.sex === 'M' ? 'Male' : patientData.sex === 'F' ? 'Female' : patientData.sex}`);
    lines.push('');
    
    // Patient Story (optional)
    if (includePatientStory && patientData.story) {
      lines.push('─── Patient Story ───');
      lines.push(patientData.story);
      lines.push('');
    }
    
    // Active Findings
    if (selectedFeatureIds.length > 0) {
      lines.push('─── Active Findings ───');
      selectedFeatureIds.forEach(id => {
        const feature = features.find(f => f.id === id);
        if (feature) {
          lines.push(`• ${feature.name} [${feature.type}]`);
        }
      });
      lines.push('');
    }
    
    // Test Results
    if (testResultIds.length > 0) {
      lines.push('─── Test Results ───');
      testResultIds.forEach(id => {
        const feature = features.find(f => f.id === id);
        if (feature) {
          lines.push(`• ${feature.name}`);
        }
      });
      lines.push('');
    }
    
    // Differential Diagnosis
    lines.push('─── Differential Diagnosis (Ranked) ───');
    if (diagnoses.length === 0) {
      lines.push('No diagnoses to display. Add findings to generate differential.');
    } else {
      diagnoses.slice(0, 10).forEach((d, i) => {
        const acuityLabel = d.acuteness > 0.7 ? ' — High acuity' : '';
        lines.push(`${i + 1}. ${d.name} — ${(d.probability * 100).toFixed(1)}%${acuityLabel}`);
      });
    }
    lines.push('');
    
    // Suggestions (optional)
    if (includeSuggestions) {
      lines.push('─── Suggested Questions ───');
      if (suggestedQuestions.length === 0) {
        lines.push('No question suggestions available.');
      } else {
        suggestedQuestions.slice(0, 5).forEach((q, i) => {
          lines.push(`${i + 1}. ${q.title}`);
          lines.push(`   ${q.rationale}`);
        });
      }
      lines.push('');
      
      lines.push('─── Suggested Tests ───');
      if (suggestedTests.length === 0) {
        lines.push('No test suggestions available.');
      } else {
        suggestedTests.slice(0, 5).forEach((t, i) => {
          lines.push(`${i + 1}. ${t.title}`);
          lines.push(`   ${t.rationale}`);
        });
      }
      lines.push('');
    }
    
    // Footer
    lines.push('═══════════════════════════════════════════════════════');
    lines.push('  EDUCATIONAL USE ONLY. Not for clinical decision-making.');
    lines.push('═══════════════════════════════════════════════════════');
    
    const content = lines.join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `diffex_differential_${fileDate}_${fileTime}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 px-2 text-xs">
          <Download className="w-3 h-3 mr-1" />
          Export
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64" align="end">
        <div className="space-y-4">
          <div className="space-y-1">
            <h4 className="font-medium text-sm">Export Differential</h4>
            <p className="text-xs text-muted-foreground">Download as text file</p>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="format" className="text-sm">Format</Label>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <FileText className="w-3 h-3" />
                Text (.txt)
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="include-story" className="text-sm">Include patient story</Label>
              <Switch
                id="include-story"
                checked={includePatientStory}
                onCheckedChange={setIncludePatientStory}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="include-suggestions" className="text-sm">Include suggestions</Label>
              <Switch
                id="include-suggestions"
                checked={includeSuggestions}
                onCheckedChange={setIncludeSuggestions}
              />
            </div>
          </div>
          
          <Button onClick={generateExport} className="w-full" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Download
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
