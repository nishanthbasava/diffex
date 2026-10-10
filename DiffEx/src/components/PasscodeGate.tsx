import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Lock } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';

const PASSCODE = 'demo';
const SESSION_KEY = 'diffex_unlocked';
// When set, Index auto-loads the demo case after unlock.
export const DEMO_REQUEST_KEY = 'diffex_demo_request';

/** Google's "G" mark, per their sign-in branding guidelines. */
function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" className="w-4 h-4" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

export function PasscodeGate({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState(
    () => sessionStorage.getItem(SESSION_KEY) === 'true'
  );
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Google sign-in unlocks the gate whenever a Supabase session exists —
  // covers both an already-signed-in visitor and the redirect back from Google.
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        sessionStorage.setItem(SESSION_KEY, 'true');
        setUnlocked(true);
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        sessionStorage.setItem(SESSION_KEY, 'true');
        setUnlocked(true);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (unlocked) return <>{children}</>;

  async function handleGoogleSignIn() {
    setSigningIn(true);
    setAuthError(null);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    // On success the browser navigates to Google; we only land here on failure.
    if (oauthError) {
      setAuthError(oauthError.message);
      setSigningIn(false);
    }
  }

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

        {isSupabaseConfigured && (
          <div className="space-y-2">
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2"
              onClick={handleGoogleSignIn}
              disabled={signingIn}
            >
              <GoogleLogo />
              {signingIn ? 'Redirecting…' : 'Sign in with Google'}
            </Button>
            {authError && (
              <p className="text-xs text-destructive text-center">{authError}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
