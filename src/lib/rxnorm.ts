import type { RxNormCheck } from "./types";

/**
 * Drug-name verification against RxNorm (US National Library of Medicine).
 * Free, keyless, authoritative drug nomenclature. This is ENTITY
 * verification ("does this drug name exist in RxNorm?") — it is NOT a
 * clinical judgment, dose check, or statement about appropriateness.
 *
 * API: https://lillycoi.github.io/rxnav / https://rxnav.nlm.nih.gov/REST
 * approximateTerm returns candidate matches with a similarity score.
 */
export async function checkDrugName(name: string | null): Promise<RxNormCheck> {
  if (!name || !name.trim()) {
    return {
      status: "SKIPPED",
      query: null,
      bestMatch: null,
      rxcui: null,
      score: null,
      note: "No medication name extracted; nothing to verify.",
    };
  }
  const base = process.env.RXNORM_BASE_URL || "https://rxnav.nlm.nih.gov/REST";
  const query = name.trim();
  try {
    const url = `${base}/approximateTerm.json?term=${encodeURIComponent(query)}&maxEntries=3`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(6000),
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`RxNorm HTTP ${res.status}`);
    const json = (await res.json()) as {
      approximateGroup?: {
        candidate?: Array<{ rxcui?: string; score?: string; name?: string }>;
      };
    };
    const candidates = json.approximateGroup?.candidate ?? [];
    const best = candidates[0];
    const score = best?.score ? Number(best.score) : null;
    if (best?.rxcui && score !== null && score >= 50) {
      // Resolve the candidate's display name when absent.
      let display = best.name ?? null;
      if (!display) {
        try {
          const nameRes = await fetch(`${base}/rxcui/${best.rxcui}/property.json?propName=RxNorm%20Name`, {
            signal: AbortSignal.timeout(5000),
          });
          if (nameRes.ok) {
            const nameJson = (await nameRes.json()) as {
              propConceptGroup?: { propConcept?: Array<{ propValue?: string }> };
            };
            display = nameJson.propConceptGroup?.propConcept?.[0]?.propValue ?? null;
          }
        } catch {
          /* name lookup is best-effort */
        }
      }
      return {
        status: "MATCH",
        query,
        bestMatch: display ?? `RxCUI ${best.rxcui}`,
        rxcui: best.rxcui,
        score,
        note: `Name matches an RxNorm concept (similarity ${score}). This verifies the drug name exists in federal nomenclature — not that it is appropriate for any patient.`,
      };
    }
    return {
      status: "NO_MATCH",
      query,
      bestMatch: best?.name ?? null,
      rxcui: null,
      score,
      note: "No confident RxNorm match. The transcribed name may be misread — pharmacist should verify against the original.",
    };
  } catch (e: unknown) {
    return {
      status: "UNAVAILABLE",
      query,
      bestMatch: null,
      rxcui: null,
      score: null,
      note: `RxNorm lookup unavailable (${e instanceof Error ? e.message : "network error"}). Name is UNVERIFIED, not invalid.`,
    };
  }
}
