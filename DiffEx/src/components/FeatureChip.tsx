import { X } from 'lucide-react';
import { features } from '@/data/knowledgeBase';

interface FeatureChipProps {
  featureId: string;
  onRemove?: () => void;
  showRemove?: boolean;
}

const typeClasses: Record<string, string> = {
  symptom: 'chip-symptom',
  vital: 'chip-vital',
  history: 'chip-history',
  lab: 'chip-lab',
  test: 'chip-test',
};

export function FeatureChip({ featureId, onRemove, showRemove = true }: FeatureChipProps) {
  const feature = features.find(f => f.id === featureId);
  if (!feature) return null;

  const typeClass = typeClasses[feature.type] || 'chip-symptom';

  return (
    <span className={`chip ${typeClass} animate-fade-in`}>
      <span>{feature.name}</span>
      {showRemove && onRemove && (
        <button
          onClick={onRemove}
          className="ml-1 hover:opacity-70 transition-opacity"
          aria-label={`Remove ${feature.name}`}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </span>
  );
}
