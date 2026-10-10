import { Button } from '@/components/ui/button';

interface DemoGuideStep {
  title: string;
  body: string;
  /** Label for the advance button; auto-advancing steps keep it as a fallback */
  nextLabel: string;
}

const DEMO_GUIDE_STEPS: DemoGuideStep[] = [
  {
    title: 'Sample case loaded',
    body: 'A 35-year-old smoker with progressive shortness of breath and exertional chest pain. The clinical note on the left has been pre-filled and processed into evidence — the banner above shows what was extracted.',
    nextLabel: 'Start tour',
  },
  {
    title: 'Read the differential',
    body: 'Conditions are ranked by probability. The small track shows each baseline prior (tick) shifting to the posterior (dot). Click any row to see exactly which findings support (+) or oppose (−) it.',
    nextLabel: 'Next',
  },
  {
    title: 'Answer a suggested question',
    body: 'In the Suggestions panel on the right, answer any question with Yes or No — the differential re-ranks instantly. This advances automatically when you answer.',
    nextLabel: 'Skip this',
  },
  {
    title: 'Reveal the next finding',
    body: 'Click "Add Next Finding" in the Patient panel to uncover the next clue from the case, the way findings trickle in during a real workup. This advances automatically when you do.',
    nextLabel: 'Skip this',
  },
  {
    title: 'Explore on your own',
    body: 'Try the All toggle for the full ranked list, review the Can\'t-Miss rule-out checklist, open the Optimizer tab for the highest-yield next steps, or export the differential from the download menu.',
    nextLabel: 'Finish tour',
  },
];

interface DemoGuideProps {
  step: number;
  onNext: () => void;
  onSkip: () => void;
}

/** Dismissible step-by-step walkthrough strip, shown while the demo case tour is active. */
export function DemoGuide({ step, onNext, onSkip }: DemoGuideProps) {
  const current = DEMO_GUIDE_STEPS[step];
  if (!current) return null;
  const isLast = step === DEMO_GUIDE_STEPS.length - 1;

  return (
    <div
      role="status"
      aria-live="polite"
      className="border-b border-border border-l-2 border-l-next-step bg-next-step-bg px-4 py-1.5 flex items-start gap-3"
    >
      <span className="num shrink-0 text-[10px] font-semibold uppercase tracking-wide text-next-step pt-0.5">
        Demo {step + 1}/{DEMO_GUIDE_STEPS.length}
      </span>
      <div className="flex-1 min-w-0 text-xs leading-snug">
        <span className="font-semibold text-foreground">{current.title}.</span>{' '}
        <span className="text-muted-foreground">{current.body}</span>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-xs font-medium rounded-sm border border-[hsl(212,50%,78%)] bg-card text-next-step hover:bg-card hover:brightness-95"
          onClick={isLast ? onSkip : onNext}
        >
          {current.nextLabel}
        </Button>
        {!isLast && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs rounded-sm text-muted-foreground"
            onClick={onSkip}
          >
            End tour
          </Button>
        )}
      </div>
    </div>
  );
}
