import { useMemo } from 'react';
import { getPatientEvidence } from '@/lib/evidenceStore';
import type { PatientData } from '@/types';

interface PatientBannerProps {
  patientData: PatientData;
  patientId: string;
  /** Bump to re-read the evidence store */
  evidenceVersion: number;
}

/**
 * Persistent demographics strip under the app header: age, sex, and key
 * history pulled from the extracted evidence, falling back to the typed
 * patient fields when no evidence exists yet.
 */
export function PatientBanner({ patientData, patientId, evidenceVersion }: PatientBannerProps) {
  const { age, sex, smoking, history } = useMemo(() => {
    const evidence = getPatientEvidence(patientId);

    let age: number | null = patientData.age > 0 ? patientData.age : null;
    let sex: string | null = null;
    let smoking: string | null = null;
    const history: string[] = [];

    for (const ev of evidence) {
      const label = ev.canonical_label.toLowerCase();
      if (label === 'age' && ev.value_numeric != null) {
        age = ev.value_numeric;
        continue;
      }
      if (label === 'sex' && ev.value_category) {
        const v = ev.value_category.toLowerCase();
        sex = v === 'male' || v === 'm' ? 'M' : v === 'female' || v === 'f' ? 'F' : ev.value_category;
        continue;
      }
      if (label.includes('smoking') || label.includes('smoker')) {
        smoking = ev.polarity === 'present' ? 'Smoker' : ev.polarity === 'absent' ? 'Non-smoker' : null;
        continue;
      }
      if (ev.feature_type === 'history' && ev.polarity === 'present') {
        history.push(ev.canonical_label);
      }
    }

    if (!sex && (patientData.sex === 'M' || patientData.sex === 'F')) {
      // Only trust the typed field once a case exists; the blank default is 'M'
      if (patientData.story.trim() || patientData.age > 0) sex = patientData.sex;
    }

    return { age, sex, smoking, history };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, patientData, evidenceVersion]);

  return (
    <div className="border-b border-border bg-card px-4 py-1 flex items-center gap-x-5 gap-y-0.5 flex-wrap text-xs">
      <span className="flex items-baseline gap-1.5">
        <span className="uppercase tracking-wide text-[10px] font-semibold text-muted-foreground">Age</span>
        <span className="num font-medium text-foreground">{age != null ? age : '—'}</span>
      </span>
      <span className="flex items-baseline gap-1.5">
        <span className="uppercase tracking-wide text-[10px] font-semibold text-muted-foreground">Sex</span>
        <span className="font-medium text-foreground">{sex ?? '—'}</span>
      </span>
      <span className="flex items-baseline gap-1.5">
        <span className="uppercase tracking-wide text-[10px] font-semibold text-muted-foreground">Smoking</span>
        <span className="font-medium text-foreground">{smoking ?? '—'}</span>
      </span>
      <span className="flex items-baseline gap-1.5 min-w-0">
        <span className="uppercase tracking-wide text-[10px] font-semibold text-muted-foreground">Hx</span>
        <span className="font-medium text-foreground truncate">
          {history.length > 0 ? history.join(', ') : '—'}
        </span>
      </span>
    </div>
  );
}
