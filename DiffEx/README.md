# DiffEx

DiffEx is a clinical differential-diagnosis assistant. Enter a patient's findings — symptoms, history, vitals, labs — by typing, dictating, or uploading notes (PDF/image OCR supported), and it produces a ranked differential with probabilities, explains which findings drove each ranking, and suggests the next most informative question or test using value-of-information analysis.

> DiffEx is a decision-support tool, not a substitute for clinical judgment.

## Getting started

Requirements: Node.js and npm.

```sh
# Install dependencies
npm i

# Start the development server (http://localhost:8080)
npm run dev
```

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server with hot reload |
| `npm run build` | Production build |
| `npm run preview` | Preview the production build |
| `npm run lint` | Run ESLint |
| `npm test` | Run tests once (Vitest) |
| `npm run test:watch` | Run tests in watch mode |

## Tech stack

- Vite + React 18 + TypeScript
- shadcn-ui (Radix primitives) + Tailwind CSS
- Supabase (knowledge base + `extract-clinical-terms` edge function)
- pdfjs-dist and tesseract.js for client-side document/OCR processing
- Vitest + Testing Library

## Configuration

Environment variables (see `.env`):

- `VITE_APP_PASSCODE` — passcode for the access gate
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_PROJECT_ID`, `VITE_SUPABASE_PUBLISHABLE_KEY` — Supabase connection

The `extract-clinical-terms` edge function (in `supabase/functions/`) requires a `GEMINI_API_KEY` secret in your Supabase project:

```sh
supabase secrets set GEMINI_API_KEY=your_key_here
supabase functions deploy extract-clinical-terms
```

The database schema lives in `supabase/migrations/` and can be applied with `supabase db push`. The app falls back to a localStorage-backed knowledge base when Supabase is unavailable.
