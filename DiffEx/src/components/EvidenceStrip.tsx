import { FeatureChip } from './FeatureChip';
import { features } from '@/data/knowledgeBase';

interface EvidenceStripProps {
  selectedFeatureIds: string[];
  testResultIds: string[];
  onRemoveFeature: (id: string) => void;
  onRemoveTestResult: (id: string) => void;
}

const typeLabels: Record<string, string> = {
  symptom: 'Symptoms',
  vital: 'Vitals',
  history: 'History',
  lab: 'Labs',
  test: 'Tests',
};

export function EvidenceStrip({
  selectedFeatureIds,
  testResultIds,
  onRemoveFeature,
  onRemoveTestResult,
}: EvidenceStripProps) {
  const allIds = [...selectedFeatureIds, ...testResultIds];
  
  if (allIds.length === 0) return null;

  // Group features by type
  const grouped = allIds.reduce((acc, id) => {
    const feature = features.find(f => f.id === id);
    if (feature) {
      const type = feature.type;
      if (!acc[type]) acc[type] = [];
      acc[type].push(id);
    }
    return acc;
  }, {} as Record<string, string[]>);

  const handleRemove = (id: string) => {
    if (testResultIds.includes(id)) {
      onRemoveTestResult(id);
    } else {
      onRemoveFeature(id);
    }
  };

  return (
    <div className="bg-card border-t border-border px-4 py-1.5">
      <div className="flex items-start gap-4 overflow-x-auto">
        <span className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground shrink-0 pt-0.5">
          Active Evidence
        </span>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {Object.entries(grouped).map(([type, ids]) => (
            <div key={type} className="flex items-center gap-1.5">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                {typeLabels[type] || type}:
              </span>
              <div className="flex flex-wrap gap-1">
                {ids.map(id => (
                  <FeatureChip
                    key={id}
                    featureId={id}
                    onRemove={() => handleRemove(id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
