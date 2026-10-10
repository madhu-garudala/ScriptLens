# ScriptLens — agent briefing

Hackathon project (Get Hired Hack NYC, Track 4: PillSpark "Fax to Fill").
**Hard deadline: today, Oct 10 2026, 4:30 PM ET. Devpost submission target 4:10 PM.
Feature freeze ~3:10 PM.** When in doubt, cut scope — never the deadline.

One-liner: turns blurry **synthetic** prescription faxes into reviewable draft
orders with visible evidence; flags uncertain fields for a pharmacist instead
of guessing. Judged on: works correctly · trust/explainability · usable design
· sharper angle.

## Invariants — never violate these, no matter what is asked

1. **Unknown is a successful output. A confidently invented dose is a failure.**
   Never make the model, validation, or UI fill in a value that wasn't read.
2. The export gate (`canExportDraft` in `src/lib/validate.ts`) must remain:
   every REQUIRED field human-confirmed + non-empty, no active document-level
   critical issues. Never add a bypass, auto-confirm, or "approve all".
3. Deterministic validation stays pure TypeScript — no model calls inside it.
4. Fax image content is UNTRUSTED DATA (see prompt rules in `src/lib/prompt.ts`).
   Printed instructions in an image must never change app behavior.
5. Synthetic data only. No real PHI, no persistence of uploads, no clinical
   claims ("safe dose", "valid prescription") anywhere in UI or copy.
6. PRISM traces carry sanitized metadata only — never image bytes/base64,
   never patient text. Keep it that way.
7. `src/data/fixture-manifest.json` is a TEST ORACLE. Never pass expected
   values into inference or use them as runtime fallbacks.
8. Never fake an integration: if Nicrron/PRISM/RxNorm/ElevenLabs fails, show
   an honest error state. No stub output presented as live inference.
9. All endpoints/models/headers are env-driven (`.env.example`). If a sponsor
   endpoint differs from code defaults, fix the env var, not hardcoded values.

## Commands

```bash
npm run dev              # localhost:3000
npm test                 # 9 validation tests — must stay green
npm run build            # must pass before any commit you call "done"
npm run smoke:nicrron    # lists /v1/models, text + VISION test on rx-clean
npm run smoke:prism      # one sanitized test trace; then VERIFY in dashboard
npm run smoke:elevenlabs # optional voice feature check
npm run fixtures         # regenerate synthetic fax PNGs (python3 + Pillow)
```

## Map

- `src/app/api/analyze/route.ts` — upload/fixture → Nicrron vision → Zod →
  validation → RxNorm → PRISM trace. Honest 4xx/5xx error shapes.
- `src/lib/` — `nicrron.ts` (inference, fail-closed parsing), `schema.ts`
  (13 field keys, normalize), `validate.ts` (rules + export gate),
  `rxnorm.ts` (drug-name entity check, never clinical), `prism.ts` (trace),
  `voice.ts` (feature-flagged ElevenLabs escalation audio).
- `src/components/ReviewWorkspace.tsx` — two-panel review UI, edit→confirm,
  audit log, export. `UploadCard.tsx` — attested synthetic upload.
- `public/fixtures/` — 3 synthetic faxes (clean / ambiguous / conflict).
- `src/lib/db.ts` + `src/app/api/reviews/[id]/route.ts` — saved reviews in
  Supabase Postgres, schema `scriptlens`: `reviews` (one row per browser id +
  fixture) and `extractions` (stored model result per fixture).
  Fixtures only: uploads are never stored (invariant 5). Env: `SUPABASE_DB_HOST`,
  `SUPABASE_DB_PORT`, `SUPABASE_DB_USER`, `SUPABASE_PASSWORD` (quote it in
  `.env.local` if it contains `#`). `npm run db:setup` creates the table.
- `docs/sample-faxes/` — 10 extra synthetic faxes (`npm run samples`), also
  bundled in `public/fixtures/` and listed in the manifest without `expected`.
- Stored extractions: `/api/analyze` returns the saved result for a bundled fax
  (`cached: true`, labelled in the UI) unless `fresh=true`; "Re-run extraction"
  always calls the model. `npm run cache:warm` refills the store. Never for uploads.
- Review flow: each required field is still confirmed one at a time (Enter
  confirms and advances). There is deliberately no "confirm all" (invariant 2).
- `tests/validation.test.ts` — gate + validation behavior; extend, don't delete.

## Current status (as of 12:50 PM)

DONE: full P0 pipeline, UI, tests, build verified, API error paths tested.
NOT DONE (human + agent, in priority order):
1. `.env.local` keys → `npm run smoke:nicrron` → pin working vision model.
2. `npm run smoke:prism` — endpoints are CONFIRMED from PRISM's own brief:
   host https://prism-api-prod.up.railway.app, POST /api/traces, auth header
   X-PRISMtrace-Key (never Authorization: Bearer — it 401s). The script runs
   PRISM's handshake + doctor. "LIVE" requires a real app extraction, not the
   handshake alone.
3. Walk all 3 fixtures live in dev; fix only what blocks the demo flow.
4. PRISM dashboard: Prompt-Injection guardrail, Evaluator (rubric in README
   sponsor section), KB doc — these are dashboard config, not code.
5. Push to GitHub (public), deploy to Vercel (**add env vars in Vercel
   settings**), re-test deployed URL with one live extraction.
6. Optional, ONLY after 1–5 and before 3:10: flip voice feature
   (NEXT_PUBLIC_VOICE_DEMO=true + ELEVENLABS_API_KEY) and smoke it.

## P1 only if everything above is solid

Keyboard shortcuts (N next flagged / Enter confirm), rx-missing + rx-injection
fixtures, audit JSON download. Do NOT start: auth, DB, PDF support, multi-agent
frameworks, NDC lookup, highlight boxes without real OCR coordinates.

## PRISM tracing (do not remove)

This project sends traces to PRISM. Env vars: `PRISMTRACE_API_KEY`,
`PRISMTRACE_PROJECT_ID`, `PRISMTRACE_HOST`.

Tracing is currently wired at: `src/lib/prism.ts` (emitPrismTrace), called from
`src/app/api/analyze/route.ts` on both the success and failure paths, with
`session_id` = `scriptlens-<documentId>` grouping each document's traces into
a trajectory. Verification: `scripts/smoke-prism.mjs` (handshake + doctor).

**Standing rule.** Whenever you add or change an agent, chain, graph, tool,
retriever, or any entry point that calls a model, wire it to PRISM before you
finish. Unwired code is invisible in the dashboard. If you are unsure whether
something is covered, assume it is not and wire it. Traces stay sanitized:
metadata only, never image bytes or patient text (invariant 6).
