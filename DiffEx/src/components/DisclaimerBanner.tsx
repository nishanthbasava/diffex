import { AlertTriangle } from 'lucide-react';

export function DisclaimerBanner() {
  return (
    <div className="disclaimer-banner flex items-center justify-center gap-2">
      <AlertTriangle className="w-4 h-4" />
      <span>Educational only. Not for diagnosis or treatment.</span>
    </div>
  );
}
