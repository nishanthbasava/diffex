import { useState, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { ScrollArea } from './ui/scroll-area';
import { RotateCcw, Search, Database, Loader2 } from 'lucide-react';
import { getConditions } from '@/lib/differentialStore';
import { getAllPriors, updatePrior, resetPriors, type PriorRow } from '@/lib/priorsStore';
import { populatePriorsFromWonder } from '@/lib/wonderPriors';
import { toast } from 'sonner';

interface PriorsEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPriorsChanged?: () => void;
}

const TIERS: Record<string, number> = {
  very_common: 0.10,
  common: 0.03,
  uncommon: 0.01,
  rare: 0.003,
  very_rare: 0.001,
};

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function parseSafe(v: string, fallback: number): number {
  const n = parseFloat(v);
  return isNaN(n) ? fallback : n;
}

type AgeBucket = 'neonate' | 'infant' | 'child' | 'adolescent' | '18-39' | '40-64' | '65+';
type SexBucket = 'male' | 'female' | 'unknown';
type SmokeBucket = 'smoker' | 'non_smoker' | 'unknown';

const AGE_KEYS: AgeBucket[] = ['neonate', 'infant', 'child', 'adolescent', '18-39', '40-64', '65+'];
const SEX_KEYS: SexBucket[] = ['male', 'female', 'unknown'];
const SMOKE_KEYS: SmokeBucket[] = ['smoker', 'non_smoker', 'unknown'];

export function PriorsEditorDialog({ open, onOpenChange, onPriorsChanged }: PriorsEditorDialogProps) {
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const currentYear = new Date().getFullYear();
  const [yearStart, setYearStart] = useState(currentYear - 5);
  const [yearEnd, setYearEnd] = useState(currentYear - 1);
  const [wonderLoading, setWonderLoading] = useState(false);

  const conditions = useMemo(() => getConditions(), [open, version]);
  const priors = useMemo(() => getAllPriors(), [open, version]);

  const priorsMap = useMemo(() => {
    const m = new Map<string, PriorRow>();
    for (const p of priors) m.set(p.condition_id, p);
    return m;
  }, [priors]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return conditions.filter(c => c.label.toLowerCase().includes(q));
  }, [conditions, search]);

  const handleSave = useCallback((row: PriorRow) => {
    // Validate and clamp
    const clamped: PriorRow = {
      ...row,
      base_prevalence: clamp(row.base_prevalence, 1e-6, 0.5),
      age_multipliers: Object.fromEntries(
        AGE_KEYS.map(k => [k, clamp(row.age_multipliers[k], 0.1, 10)])
      ) as PriorRow['age_multipliers'],
      sex_multipliers: Object.fromEntries(
        SEX_KEYS.map(k => [k, clamp(row.sex_multipliers[k], 0.1, 10)])
      ) as PriorRow['sex_multipliers'],
      smoking_multipliers: Object.fromEntries(
        SMOKE_KEYS.map(k => [k, clamp(row.smoking_multipliers[k], 0.1, 10)])
      ) as PriorRow['smoking_multipliers'],
    };
    updatePrior(clamped);
    setVersion(v => v + 1);
    setEditingId(null);
    onPriorsChanged?.();
    toast.success('Prior updated');
  }, [onPriorsChanged]);

  const handleResetAll = useCallback(() => {
    resetPriors();
    setVersion(v => v + 1);
    onPriorsChanged?.();
    toast.success('Priors reset to defaults');
  }, [onPriorsChanged]);

  const handlePopulateWonder = useCallback(async () => {
    setWonderLoading(true);
    try {
      const result = await populatePriorsFromWonder(yearStart, yearEnd);
      setVersion(v => v + 1);
      onPriorsChanged?.();
      toast.success(`Updated priors from CDC WONDER for ${result.updated} conditions (${result.source})`);
    } catch (err) {
      toast.error('CDC WONDER fetch failed — existing priors kept');
      console.error('[DiffEx] WONDER error:', err);
    } finally {
      setWonderLoading(false);
    }
  }, [yearStart, yearEnd, onPriorsChanged]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            Edit Priors
            <Button variant="ghost" size="sm" className="ml-auto text-xs text-muted-foreground" onClick={handleResetAll}>
              <RotateCcw className="w-3 h-3 mr-1" /> Reset All
            </Button>
          </DialogTitle>
        </DialogHeader>

        {/* CDC WONDER controls */}
        <div className="flex items-center gap-2 px-1 py-2 border border-border rounded-md bg-muted/30">
          <Database className="w-3.5 h-3.5 text-muted-foreground shrink-0 ml-2" />
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold shrink-0">CDC WONDER</span>
          <Input
            type="number"
            min={1999}
            max={yearEnd}
            value={yearStart}
            onChange={e => setYearStart(parseInt(e.target.value) || yearStart)}
            className="h-6 w-16 text-xs font-mono px-1.5"
          />
          <span className="text-xs text-muted-foreground">–</span>
          <Input
            type="number"
            min={yearStart}
            max={currentYear}
            value={yearEnd}
            onChange={e => setYearEnd(parseInt(e.target.value) || yearEnd)}
            className="h-6 w-16 text-xs font-mono px-1.5"
          />
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-[10px] px-2 ml-auto shrink-0"
            onClick={handlePopulateWonder}
            disabled={wonderLoading}
          >
            {wonderLoading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
            Populate from CDC WONDER (mortality proxy)
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search conditions..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-1">
            {filtered.map(cond => {
              const row = priorsMap.get(cond.id);
              if (!row) return null;
              const isEditing = editingId === cond.id;

              return (
                <PriorRowEditor
                  key={cond.id}
                  label={cond.label}
                  row={row}
                  isEditing={isEditing}
                  onToggleEdit={() => setEditingId(isEditing ? null : cond.id)}
                  onSave={handleSave}
                />
              );
            })}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// ---- Inline row editor ----

function PriorRowEditor({
  label,
  row,
  isEditing,
  onToggleEdit,
  onSave,
}: {
  label: string;
  row: PriorRow;
  isEditing: boolean;
  onToggleEdit: () => void;
  onSave: (row: PriorRow) => void;
}) {
  const [draft, setDraft] = useState<PriorRow>(row);

  // Reset draft when row changes externally
  const handleOpen = () => {
    setDraft({ ...row });
    onToggleEdit();
  };

  const tierLabel = useMemo(() => {
    const p = draft.base_prevalence;
    if (p >= 0.08) return 'very_common';
    if (p >= 0.02) return 'common';
    if (p >= 0.005) return 'uncommon';
    if (p >= 0.002) return 'rare';
    return 'very_rare';
  }, [draft.base_prevalence]);

  if (!isEditing) {
    return (
      <div
        className="flex flex-col py-1.5 px-2 rounded hover:bg-muted/50 cursor-pointer text-sm gap-0.5"
        onClick={handleOpen}
      >
        <div className="flex items-center justify-between">
          <span className="font-medium text-foreground">{label}</span>
          <span className="text-xs text-muted-foreground font-mono">
            {row.base_prevalence.toFixed(4)} ({tierLabel})
          </span>
        </div>
        {row.notes && (
          <span className="text-[10px] text-muted-foreground/70 truncate">{row.notes}</span>
        )}
      </div>
    );
  }

  return (
    <div className="border border-border rounded-md p-3 space-y-3 bg-muted/30">
      <div className="flex items-center justify-between">
        <span className="font-medium text-sm text-foreground">{label}</span>
        <div className="flex gap-1.5">
          <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={onToggleEdit}>Cancel</Button>
          <Button size="sm" className="h-6 text-xs" onClick={() => onSave(draft)}>Save</Button>
        </div>
      </div>

      {/* Tier + Base prevalence */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Tier</label>
          <Select
            value={tierLabel}
            onValueChange={v => setDraft(d => ({ ...d, base_prevalence: TIERS[v] ?? d.base_prevalence }))}
          >
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.keys(TIERS).map(t => (
                <SelectItem key={t} value={t} className="text-xs">{t} ({TIERS[t]})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-28">
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Base prev.</label>
          <Input
            type="number"
            step="0.001"
            min={0.000001}
            max={0.5}
            value={draft.base_prevalence}
            onChange={e => setDraft(d => ({ ...d, base_prevalence: parseSafe(e.target.value, d.base_prevalence) }))}
            className="h-7 text-xs font-mono"
          />
        </div>
      </div>

      {/* Age multipliers */}
      <div>
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Age multipliers</label>
        <div className="grid grid-cols-7 gap-1.5 mt-1">
          {AGE_KEYS.map(k => (
            <div key={k}>
              <span className="text-[9px] text-muted-foreground">{k}</span>
              <Input
                type="number"
                step="0.1"
                min={0.1}
                max={10}
                value={draft.age_multipliers[k]}
                onChange={e => setDraft(d => ({
                  ...d,
                  age_multipliers: { ...d.age_multipliers, [k]: parseSafe(e.target.value, d.age_multipliers[k]) }
                }))}
                className="h-6 text-xs font-mono"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Sex multipliers */}
      <div>
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Sex multipliers</label>
        <div className="grid grid-cols-3 gap-1.5 mt-1">
          {SEX_KEYS.map(k => (
            <div key={k}>
              <span className="text-[9px] text-muted-foreground">{k}</span>
              <Input
                type="number"
                step="0.1"
                min={0.1}
                max={10}
                value={draft.sex_multipliers[k]}
                onChange={e => setDraft(d => ({
                  ...d,
                  sex_multipliers: { ...d.sex_multipliers, [k]: parseSafe(e.target.value, d.sex_multipliers[k]) }
                }))}
                className="h-6 text-xs font-mono"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Smoking multipliers */}
      <div>
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Smoking multipliers</label>
        <div className="grid grid-cols-3 gap-1.5 mt-1">
          {SMOKE_KEYS.map(k => (
            <div key={k}>
              <span className="text-[9px] text-muted-foreground">{k.replace('_', ' ')}</span>
              <Input
                type="number"
                step="0.1"
                min={0.1}
                max={10}
                value={draft.smoking_multipliers[k]}
                onChange={e => setDraft(d => ({
                  ...d,
                  smoking_multipliers: { ...d.smoking_multipliers, [k]: parseSafe(e.target.value, d.smoking_multipliers[k]) }
                }))}
                className="h-6 text-xs font-mono"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
