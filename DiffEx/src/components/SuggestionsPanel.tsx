import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SuggestionCard } from './SuggestionCard';
import { TestSuggestionCard } from './TestSuggestionCard';
import { OptimizerTab } from './OptimizerTab';
import type { SuggestedQuestion, SuggestedTest } from '@/types';
import type { OptimizerItem } from '@/lib/optimizer';

interface SuggestionsPanelProps {
  questions: SuggestedQuestion[];
  tests: SuggestedTest[];
  optimizerItems: OptimizerItem[];
  onAddQuestion: (featureId: string) => void;
  onAbsentQuestion: (featureId: string) => void;
  onAddTest: (testId: string) => void;
}

export function SuggestionsPanel({
  questions,
  tests,
  optimizerItems,
  onAddQuestion,
  onAbsentQuestion,
  onAddTest,
}: SuggestionsPanelProps) {
  return (
    <div className="panel h-full flex flex-col">
      <div className="panel-header flex items-center gap-2">
        <h2 className="font-semibold text-sm">Suggestions</h2>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        <Tabs defaultValue="questions" className="flex-1 flex flex-col">
          <div className="px-2 pt-2">
            <TabsList className="w-full grid grid-cols-3 h-7 rounded-sm">
              <TabsTrigger value="questions" className="text-xs rounded-sm">Questions</TabsTrigger>
              <TabsTrigger value="tests" className="text-xs rounded-sm">Tests</TabsTrigger>
              <TabsTrigger value="optimizer" className="text-xs rounded-sm">Optimizer</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="questions" className="flex-1 overflow-auto p-2 m-0">
            {questions.length === 0 ? (
              <div className="text-center text-muted-foreground py-6 text-sm">
                Add findings to get question suggestions
              </div>
            ) : (
              <div className="border-t border-border">
                {questions.map((q) => (
                  <SuggestionCard
                    key={q.id}
                    title={q.title}
                    rationale={q.rationale}
                    mode="yesno"
                    onAdd={() => onAddQuestion(q.featureId)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="tests" className="flex-1 overflow-auto p-2 m-0">
            {tests.length === 0 ? (
              <div className="text-center text-muted-foreground py-6 text-sm">
                Add findings to get test suggestions
              </div>
            ) : (
              <div className="border-t border-border">
                {tests.map((t) => (
                  <TestSuggestionCard
                    key={t.id}
                    title={t.title}
                    rationale={t.rationale}
                    onAdd={() => onAddTest(t.testId)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="optimizer" className="flex-1 overflow-auto p-2 m-0">
            <OptimizerTab
              items={optimizerItems}
              onAddQuestion={onAddQuestion}
              onAbsentQuestion={onAbsentQuestion}
              onAddTest={onAddTest}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}