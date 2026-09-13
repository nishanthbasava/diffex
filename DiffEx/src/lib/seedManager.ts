import { toast } from 'sonner';

const SEED_VERSION_KEY = 'diffex_seed_version';
const CURRENT_SEED_VERSION = 6;

// All localStorage keys managed by the seed system
const MANAGED_KEYS = [
  'diffex_conditions',
  'diffex_condition_feature_edges',
  'diffex_differential_seeded_v2',
  'diffex_differential_seeded_v3',
  'diffex_differential_seeded_v4',
  'diffex_differential_seeded_v5',
  'diffex_differential_seeded_v6',
  'diffex_priors',
  'diffex_priors_seeded_v1',
  'diffex_feature_registry',
  'diffex_patient_evidence',
];

function getStoredVersion(): number {
  try {
    const v = localStorage.getItem(SEED_VERSION_KEY);
    return v ? parseInt(v, 10) : 0;
  } catch {
    return 0;
  }
}

function setStoredVersion(v: number): void {
  localStorage.setItem(SEED_VERSION_KEY, String(v));
}

/** Wipe all seed-managed stores so they re-seed fresh. */
export function wipeSeedData(): void {
  for (const key of MANAGED_KEYS) {
    localStorage.removeItem(key);
  }
  localStorage.removeItem(SEED_VERSION_KEY);
}

/**
 * Call on app load. If seed version is outdated, wipes and re-seeds.
 * Returns true if a migration occurred.
 */
export function ensureSeedVersion(
  seedFn: () => void,
): boolean {
  const stored = getStoredVersion();
  if (stored >= CURRENT_SEED_VERSION) return false;

  // Wipe old data
  wipeSeedData();

  // Run seed functions
  seedFn();

  // Stamp version
  setStoredVersion(CURRENT_SEED_VERSION);

  if (stored > 0) {
    toast.info(`Updated knowledge base to v${CURRENT_SEED_VERSION} — now includes pediatric core conditions.`);
  }

  console.log(`[DiffEx] Seed migration: v${stored} → v${CURRENT_SEED_VERSION}`);
  return true;
}

export function getCurrentSeedVersion(): number {
  return CURRENT_SEED_VERSION;
}
