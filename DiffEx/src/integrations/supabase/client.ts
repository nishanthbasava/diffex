import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";
//
// Supabase is optional: without env config (e.g. CI test runs, localStorage-only
// deployments) this exports null, and every call site must check
// isSupabaseConfigured (or VITE_SUPABASE_URL) before touching the client.
// The cast keeps call sites type-clean; the runtime guard is the contract.
export const supabase = (isSupabaseConfigured
  ? createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        storage: localStorage,
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null) as NonNullable<ReturnType<typeof createClient<Database>>>;
