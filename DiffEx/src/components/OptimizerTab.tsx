import { useState, useRef } from 'react';
import { Import, X, Check, ChevronDown, DollarSign, Clock, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { OptimizerItem } from '@/lib/optimizer';
import { features } from '@/data/knowledgeBase';
import { processFile } from '@/lib/fileProcessing';

interface OptimizerTabProps {
  items: OptimizerItem[];
  onAddQuestion: (featureId: string) => void;
  onAbsentQuestion: (featureId: string) => void;
  onAddTest: (testId: string) => void;
}

const testToLabResults: Record<string, string[]> = {
  ddimer: ['elevated_ddimer'],
  troponin: ['elevated_troponin'],
  bnp: ['elevated_bnp'],
  cbc: ['low_hgb', 'elevated_wbc'],
};


export function OptimizerTab({ items, onAddQuestion, onAbsentQuestion, onAddTest }: OptimizerTabProps) {
  const [resultPickerOpen, setResultPickerOpen] = useState(false);
  const [selectedTest, setSelectedTest] = useState<OptimizerItem | null>(null);
  const [selectedResult, setSelectedResult] = useState<string>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [answeredQuestions, setAnsweredQuestions] = useState<Record<string, 'yes' | 'no'>>({});
  const [importedTests, setImportedTests] = useState<Record<string, string>>({});
  const [importingId, setImportingId] = useState<string | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const handleTestClick = (item: OptimizerItem) => {
    const labResults = testToLabResults[item.actionId];
    if (labResults && labResults.length > 0) {
      setSelectedTest(item);
      setSelectedResult(labResults[0]);
      setResultPickerOpen(true);
    } else {
      onAddTest(item.actionId);
    }
  };

  const handleAddTestResult = () => {
    if (selectedResult) {
      onAddTest(selectedResult);
      setResultPickerOpen(false);
      setSelectedTest(null);
      setSelectedResult('');
    }
  };

  const handleImport = async (item: OptimizerItem, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportingId(item.id);
    try {
      await processFile(file);
      setImportedTests(prev => ({ ...prev, [item.id]: file.name }));
      handleTestClick(item);
    } catch {
      // ignore
    } finally {
      setImportingId(null);
    }
  };

  const getLabResultOptions = (testId: string) => {
    const labIds = testToLabResults[testId] || [];
    return labIds.map(id => features.find(f => f.id === id)).filter(Boolean);
  };

  if (items.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-6 text-sm">
        Add findings to see optimization suggestions
      </div>
    );
  }

  return (
    <>
      <div className="border-t border-border">
        {items.map(item => {
          const isExpanded = expandedId === item.id;
          const isQuestion = item.type === 'question';
          const answered = answeredQuestions[item.id];
          const imported = importedTests[item.id];

          return (
            <div
              key={item.id}
              className="border-b border-border border-l-2 border-l-next-step pl-2 pr-1 py-1.5 group"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <Badge
                      variant={isQuestion ? 'secondary' : 'outline'}
                      className="text-[10px] px-1 py-0 rounded-sm shrink-0"
                    >
                      {isQuestion ? 'Q' : 'T'}
                    </Badge>
                    <h4 className="font-medium text-sm text-foreground truncate group-hover:whitespace-normal group-hover:overflow-visible">{item.title}</h4>
                  </div>
                  <div className="flex items-center gap-3 text-xs mt-0.5 text-muted-foreground">
                    <span>
                      Differential cut <span className="num font-medium text-foreground">{item.cutdownPercent}%</span>
                    </span>
                    <span>
                      Priority <span className="num font-medium text-foreground">{item.priorityScore}%</span>
                    </span>
                  </div>
                  {imported && (
                    <div className="flex items-center gap-1.5 mt-1 text-xs text-evidence-for">
                      <Check className="w-3 h-3" />
                      <span>Result imported</span>
                      <button
                        onClick={() => setImportedTests(prev => { const n = { ...prev }; delete n[item.id]; return n; })}
                        className="text-muted-foreground hover:text-destructive ml-1"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {isQuestion ? (
                    // Yes/No buttons like SuggestionCard
                    answered ? (
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
                          onClick={() => {
                            setAnsweredQuestions(prev => ({ ...prev, [item.id]: 'yes' }));
                            onAddQuestion(item.actionId);
                          }}
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-xs font-medium rounded-sm border border-[hsl(152,40%,74%)] bg-evidence-for-bg text-evidence-for hover:bg-evidence-for-bg hover:text-evidence-for hover:brightness-95"
                        >
                          Yes
                        </Button>
                        <Button
                          onClick={() => {
                            setAnsweredQuestions(prev => ({ ...prev, [item.id]: 'no' }));
                            onAbsentQuestion(item.actionId);
                          }}
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-xs font-medium rounded-sm border border-border bg-muted text-muted-foreground hover:bg-muted/80"
                        >
                          No
                        </Button>
                      </>
                    )
                  ) : (
                    // Import + Add buttons like TestSuggestionCard
                    <>
                      <input
                        ref={el => { fileRefs.current[item.id] = el; }}
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg"
                        className="hidden"
                        onChange={(e) => handleImport(item, e)}
                      />
                      <Button
                        onClick={() => fileRefs.current[item.id]?.click()}
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 rounded-sm opacity-60 hover:opacity-100 hover:text-next-step"
                        disabled={importingId === item.id}
                        title="Import result file"
                      >
                        <Import className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        onClick={() => handleTestClick(item)}
                        size="sm"
                        variant="ghost"
                        className="shrink-0 h-6 w-6 p-0 rounded-sm hover:bg-next-step-bg hover:text-next-step"
                      >
                        +
                      </Button>
                    </>
                  )}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-200", isExpanded && "rotate-180")} />
                  </button>
                </div>
              </div>

              {/* Expandable detail */}
              <div className={cn(
                "overflow-hidden transition-all duration-200 ease-in-out",
                isExpanded ? "max-h-40 opacity-100" : "max-h-0 opacity-0"
              )}>
                {isExpanded && (
                  <div className="pt-2 mt-2 text-xs text-muted-foreground space-y-1.5 border-t border-border/50">
                    {isQuestion && item.impactDiagnoses.length > 0 && (
                      <p>Most impacts: {item.impactDiagnoses.join(', ')}</p>
                    )}
                    {!isQuestion && (
                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                        {item.metadata.cost && (
                          <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />{item.metadata.cost}</span>
                        )}
                        {item.metadata.time && (
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{item.metadata.time}</span>
                        )}
                        {item.metadata.invasiveness && (
                          <span className="flex items-center gap-1"><Shield className="w-3 h-3" />{item.metadata.invasiveness}</span>
                        )}
                        {item.metadata.rulesOut && item.metadata.rulesOut.length > 0 && (
                          <span className="w-full">Rules out: {item.metadata.rulesOut.join(', ')}</span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={resultPickerOpen} onOpenChange={setResultPickerOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Select Test Result</DialogTitle>
            <DialogDescription>
              Choose the result for {selectedTest?.title.replace('Test: ', '')}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <RadioGroup value={selectedResult} onValueChange={setSelectedResult}>
              {selectedTest && getLabResultOptions(selectedTest.actionId).map(feature => (
                <div key={feature!.id} className="flex items-center space-x-2 py-2">
                  <RadioGroupItem value={feature!.id} id={feature!.id} />
                  <Label htmlFor={feature!.id} className="cursor-pointer">
                    {feature!.name}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setResultPickerOpen(false)}>Cancel</Button>
            <Button onClick={handleAddTestResult}>Add Result</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}