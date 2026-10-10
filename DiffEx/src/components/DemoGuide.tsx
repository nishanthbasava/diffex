import { useLayoutEffect, useRef, useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';

interface DemoGuideStep {
  title: string;
  body: string;
  /** Matches a [data-tour="…"] element to spotlight; null = centered card */
  target: string | null;
  nextLabel: string;
}

const DEMO_GUIDE_STEPS: DemoGuideStep[] = [
  {
    title: 'Sample case loaded',
    body: 'A 35-year-old smoker with progressive shortness of breath and exertional chest pain. This clinical note was pre-filled and processed into evidence — the banner at the top shows what was extracted.',
    target: 'clinical-note',
    nextLabel: 'Start tour',
  },
  {
    title: 'Read the differential',
    body: 'Conditions ranked by probability. The small track shows each baseline prior (tick) shifting to the posterior (dot). Click any row to see which findings support (+) or oppose (−) it, and check the Can\'t-Miss list below for dangerous conditions to rule out.',
    target: 'differential',
    nextLabel: 'Next',
  },
  {
    title: 'Answer a suggested question',
    body: 'These are the highest-yield questions right now. Answer any of them with Yes or No and watch the differential re-rank instantly. The tour continues automatically when you answer.',
    target: 'suggestions',
    nextLabel: 'Skip this',
  },
  {
    title: 'Reveal the next finding',
    body: 'Click this button to uncover the next clue from the case, the way findings trickle in during a real workup. The tour continues automatically when you do.',
    target: 'add-next-finding',
    nextLabel: 'Skip this',
  },
  {
    title: 'Explore on your own',
    body: 'Use the All toggle for the full ranked list, the search and priors controls, or the download menu to export the differential. The Optimizer tab on the right ranks next steps by information gained per cost. Enjoy!',
    target: 'differential-tools',
    nextLabel: 'Finish tour',
  },
];

const HOLE_PAD = 6;

interface Hole {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface DemoGuideProps {
  step: number;
  onNext: () => void;
  onSkip: () => void;
}

/**
 * Spotlight walkthrough: dims the app, cuts a hole over the element the
 * current step talks about, and floats an instruction card beside it. The
 * spotlit element stays fully interactive so action steps can auto-advance.
 */
export function DemoGuide({ step, onNext, onSkip }: DemoGuideProps) {
  const current = DEMO_GUIDE_STEPS[step] as DemoGuideStep | undefined;
  const [hole, setHole] = useState<Hole | null>(null);
  const [cardPos, setCardPos] = useState<{ top: number; left: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const measure = useCallback(() => {
    if (!current?.target) {
      setHole(null);
      return;
    }
    const el = document.querySelector(`[data-tour="${current.target}"]`);
    if (!el) {
      setHole(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setHole({
      top: Math.max(0, r.top - HOLE_PAD),
      left: Math.max(0, r.left - HOLE_PAD),
      width: Math.min(window.innerWidth, r.width + HOLE_PAD * 2),
      height: Math.min(window.innerHeight, r.height + HOLE_PAD * 2),
    });
  }, [current?.target]);

  // Find + measure the target when the step changes; keep tracking on
  // resize/scroll so the hole follows the element.
  useLayoutEffect(() => {
    if (!current) return;
    const el = current.target ? document.querySelector(`[data-tour="${current.target}"]`) : null;
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [current, measure]);

  // Position the card next to the hole (below → above → beside), clamped to
  // the viewport. Runs after render so the card's real size is known.
  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const cw = card.offsetWidth;
    const ch = card.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 10;

    if (!hole) {
      setCardPos({ top: Math.max(margin, (vh - ch) / 2), left: Math.max(margin, (vw - cw) / 2) });
      return;
    }

    let top = hole.top + hole.height + margin;            // below
    if (top + ch > vh - margin) top = hole.top - ch - margin;  // above
    let left = hole.left;
    if (top < margin) {
      // Neither above nor below fits — place beside, vertically centered
      top = Math.min(Math.max(margin, hole.top + hole.height / 2 - ch / 2), vh - ch - margin);
      left = hole.left + hole.width + margin;
      if (left + cw > vw - margin) left = hole.left - cw - margin;
    }
    left = Math.min(Math.max(margin, left), vw - cw - margin);
    setCardPos({ top, left });
  }, [hole, step]);

  // Focus the card each step so keyboard users land on the controls;
  // Escape ends the tour.
  useEffect(() => {
    cardRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSkip();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, onSkip]);

  if (!current) return null;
  const isLast = step === DEMO_GUIDE_STEPS.length - 1;

  const dim = 'fixed z-40';
  const dimStyle = { backgroundColor: 'hsl(220 20% 12% / 0.45)' };
  const masks = hole
    ? [
        // top / bottom / left / right of the hole
        { top: 0, left: 0, width: '100vw', height: hole.top },
        { top: hole.top + hole.height, left: 0, width: '100vw', height: `calc(100vh - ${hole.top + hole.height}px)` },
        { top: hole.top, left: 0, width: hole.left, height: hole.height },
        { top: hole.top, left: hole.left + hole.width, width: `calc(100vw - ${hole.left + hole.width}px)`, height: hole.height },
      ]
    : [{ top: 0, left: 0, width: '100vw', height: '100vh' }];

  return (
    <>
      {masks.map((m, i) => (
        <div key={i} className={dim} style={{ ...dimStyle, ...m }} aria-hidden />
      ))}

      {hole && (
        <div
          aria-hidden
          className="fixed z-40 pointer-events-none border-2 border-next-step rounded-sm"
          style={{ top: hole.top, left: hole.left, width: hole.width, height: hole.height }}
        />
      )}

      <div
        ref={cardRef}
        tabIndex={-1}
        role="dialog"
        aria-label={`Demo tour step ${step + 1} of ${DEMO_GUIDE_STEPS.length}: ${current.title}`}
        className="fixed z-50 w-80 max-w-[calc(100vw-20px)] bg-card border border-border border-l-2 border-l-next-step rounded-sm p-3 outline-none"
        style={cardPos ? { top: cardPos.top, left: cardPos.left } : { visibility: 'hidden' }}
      >
        <p className="num text-[10px] font-semibold uppercase tracking-wide text-next-step mb-1">
          Demo tour · {step + 1}/{DEMO_GUIDE_STEPS.length}
        </p>
        <p className="text-sm font-semibold text-foreground mb-1">{current.title}</p>
        <p className="text-xs leading-snug text-muted-foreground mb-2.5">{current.body}</p>
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs font-medium rounded-sm border border-[hsl(212,50%,78%)] bg-next-step-bg text-next-step hover:bg-next-step-bg hover:text-next-step hover:brightness-95"
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
    </>
  );
}
