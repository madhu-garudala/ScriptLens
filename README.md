# ScriptLens — Evidence-First Prescription Intake

> **Get Hired Hack @ Columbia Startup Lab · Oct 10, 2026 · Track 4: PillSpark — Fax to Fill**
>
> ScriptLens turns blurry **synthetic** prescription faxes into reviewable draft orders,
> with visible source evidence, uncertainty flags, and mandatory human confirmation
> for every critical field. **Unknown is a successful output. A confidently invented
> dose is a failure.**

⚠️ Hackathon prototype. Synthetic data only. Nothing here transmits, fills,
approves, or clinically validates a prescription.

## Run it

```bash
npm install
cp .env.example .env.local   # fill in keys
npm run smoke:nicrron        # MUST pass before demoing (lists models, tests vision)
npm run smoke:prism          # verify trace ingest, then CHECK THE DASHBOARD
npm run dev                  # http://localhost:3000
npm test                     # 9 deterministic validation tests
```

## How it works

```
fax image ──▶ Nicrron vision model ──▶ Zod schema parse ──▶ deterministic validation ──▶ pharmacist review UI
                   (sponsor)            (fail closed)        + RxNorm name check          edit → confirm → gated export
                       │                                                                        │
                       └────────── sanitized metadata trace ──▶ Block Convey PRISM ◀────────────┘
```

- **Extraction** (`src/lib/nicrron.ts`): one multimodal call via the Nicrron
  OpenAI-compatible gateway. The prompt forbids inference of missing values;
  illegible fields come back `null` with a reason. Invalid JSON fails closed
  after one bounded retry — never fabricated fields.
- **Validation** (`src/lib/validate.ts`): pure TypeScript, no model involved.
  Missing/uncertain critical fields, visible contradictions, unit-less
  strengths, and RxNorm mismatches become blocking issues.
- **RxNorm check** (`src/lib/rxnorm.ts`): drug-name **entity verification**
  against the US National Library of Medicine's RxNorm API (free, keyless).
  Verifies the name exists in federal nomenclature — explicitly *not* a dose
  check or clinical judgment. Unreachable ⇒ "unverified", never "invalid".
- **Review** (`src/components/ReviewWorkspace.tsx`): fax left, draft right.
  Click a field → see the AI-cited source text (labeled as model-proposed,
  not verified OCR). Edit → "corrected, confirm pending" → confirm against
  source. Every action lands in the audit history. A new edit invalidates a
  prior confirmation.
- **Export gate**: draft JSON downloads only when every required field has a
  human-confirmed, non-empty value and no document-level critical issues
  remain. The export is labeled `SYNTHETIC_DEMO_ONLY`, `clinicalApproval:
  false`, `transmissionPerformed: false`.
- **PRISM** (`src/lib/prism.ts`): HTTP trace per inference (success *and*
  failure paths) with sanitized metadata only — no image bytes, no patient
  text. Guardrail / Evaluator / KB are configured in the PRISM dashboard
  (see sponsor checklist below).

## Demo fixtures (all synthetic, generated during the event)

| id | scenario | expected behavior |
|---|---|---|
| `rx-clean` | all fields legible | extracted; still requires human confirmation before export |
| `rx-ambiguous` | strength digits destroyed by toner dropout | strength = null + reason; export blocked until human enters it from source |
| `rx-conflict` | margin note contradicts the SIG | CONFLICT issue citing both statements; human adjudicates |

Ground truth lives in `src/data/fixture-manifest.json` (test oracle only —
never passed to inference). Regenerate with `npm run fixtures`.

## Sponsor integration — honest status

Fill before submission; claim nothing unverified.

- [ ] Nicrron vision inference live (`npm run smoke:nicrron` ✓✓, model pinned: ______)
- [ ] PRISM trace visible in dashboard under agent `scriptlens-extractor`
- [ ] PRISM Prompt-Injection Guardrail configured + synthetic test shown
- [ ] PRISM Evaluator "Prescription Extraction Faithfulness" saved with a real score
- [ ] PRISM Knowledge Base doc + demonstrated grounding check

## Limitations

- `sourceText` quotes are model-proposed evidence, not aligned OCR — the UI
  labels them accordingly and never draws fake highlight boxes.
- RxNorm match ≠ clinical appropriateness; absence ≠ invalid prescription.
- Metrics from 3 fixtures are labeled `synthetic evaluation (n=3)`, nothing more.
- No PHI, no persistence of uploads, no pharmacy-system integration.

## Stack

Next.js 14 · React · TypeScript · Tailwind · Zod · **NicrronNinoo** (Nicrron API)
· **Block Convey PRISM** · RxNorm (NLM) · Vercel
