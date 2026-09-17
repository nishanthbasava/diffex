# DiffEx — Differential Expander

[![CI](https://github.com/nishanthbasava/diffex/actions/workflows/ci.yml/badge.svg)](https://github.com/nishanthbasava/diffex/actions/workflows/ci.yml)

Clinical decision-support tool that turns patient findings — typed, dictated, or extracted from uploaded notes (PDF / image OCR) — into a ranked, **explainable** differential diagnosis, and recommends the next most informative question or test.

> DiffEx is a decision-support prototype, not a substitute for clinical judgment.

## How it works

- **Scoring engine** — patient findings are scored against an 86-condition, 455-edge likelihood-ratio knowledge graph. Each condition's log-score combines a demographic-adjusted prior (age / sex / smoking multipliers, optionally populated from CDC WONDER mortality data), LR contributions normalized by √(matched edges), and a penalty for present findings the condition cannot explain. A safety net keeps can't-miss diagnoses (sepsis, MI/ACS, PE, aortic dissection, meningitis) in every candidate set.
- **Explainability** — every ranked diagnosis exposes its prior breakdown, top LR boosts and penalties, contributing findings, and ICD-10 codes.
- **Next-step optimizer** — value-of-information analysis (expected entropy reduction over the posterior) ranks unasked questions and unordered tests, penalized by cost, time, and invasiveness.
- **Evidence extraction** — a synonym/negation-aware rule extractor plus an optional LLM edge function (Supabase) that maps note text onto the controlled feature vocabulary.
- **Storage** — localStorage-first with an optional Supabase backend; the knowledge cache fetches only conditions relevant to current evidence, so the design scales past the seeded graph.

## Evaluation

Benchmarked on the 23 standardized patient vignettes from Semigran et al., *BMJ* 2015 (symptom-checker audit study) whose target diagnoses exist in the knowledge base (`npm run eval`):

| Metric | Engine | Prior-only baseline |
| --- | --- | --- |
| Top-1 accuracy | **60.9%** (14/23) | 0% |
| Top-3 accuracy | **78.3%** (18/23) | 21.7% |
| Median latency | ~5 ms | — |

For context, the same paper reports an average of 34% top-1 / 51% top-3 across 23 commercial symptom checkers on its full 45-vignette set.

## Development

The app lives in [`DiffEx/`](DiffEx/README.md) (Vite + React + TypeScript). Quick start:

```sh
cd DiffEx
npm ci
cp .env.example .env   # fill in passcode + optional Supabase creds
npm run dev            # http://localhost:8080
```

`npm test` runs the 55-test Vitest suite (engine, stores, seed integrity, ICD-10, vignette eval). CI runs lint → tests → build on every push and PR; merges to `main` deploy automatically and every PR gets a preview deployment via Vercel.
