import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Lock } from 'lucide-react';

const PASSCODE = 'demo';
const SESSION_KEY = 'diffex_unlocked';
// When set, Index auto-loads the demo case after unlock.
export const DEMO_REQUEST_KEY = 'diffex_demo_request';

export function PasscodeGate({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState(
    () => sessionStorage.getItem(SESSION_KEY) === 'true'
  );
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);

  if (unlocked) return <>{children}</>;

  function handleTrySample() {
    sessionStorage.setItem(SESSION_KEY, 'true');
    sessionStorage.setItem(DEMO_REQUEST_KEY, 'true');
    setUnlocked(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (PASSCODE !== null && input === PASSCODE) {
      sessionStorage.setItem(SESSION_KEY, 'true');
      setUnlocked(true);
    } else {
      setError(true);
      setInput('');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 p-8 border border-border rounded-sm bg-card">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-sm bg-primary flex items-center justify-center">
            <Lock className="w-5 h-5 text-primary-foreground" />
          </div>
          <div className="text-center">
            <h1 className="text-lg font-semibold text-foreground">DiffEx</h1>
            <p className="text-sm text-muted-foreground">Enter passcode to continue</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            type="password"
            placeholder="Passcode"
            value={input}
            onChange={e => { setInput(e.target.value); setError(false); }}
            autoFocus
            className={error ? 'border-destructive focus-visible:ring-destructive' : ''}
          />
          {error && (
            <p className="text-xs text-destructive text-center">Incorrect passcode</p>
          )}
          <Button type="submit" className="w-full">Unlock</Button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-card px-2 text-muted-foreground">or</span>
          </div>
        </div>

        <Button type="button" variant="outline" className="w-full" onClick={handleTrySample}>
          Try a sample case
        </Button>
      </div>
    </div>
  );
}
