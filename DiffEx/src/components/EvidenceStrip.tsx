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
    <div className="bg-card border-t border-border px-6 py-4">
      <div className="flex items-start gap-6 overflow-x-auto">
        <span className="text-sm font-medium text-muted-foreground shrink-0 pt-1">
          Active Evidence
        </span>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {Object.entries(grouped).map(([type, ids]) => (
            <div key={type} className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {typeLabels[type] || type}:
              </span>
              <div className="flex flex-wrap gap-1.5">
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
