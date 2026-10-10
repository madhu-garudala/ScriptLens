import type { RxNormCheck } from "./types";

/**
 * Drug-name verification against RxNorm (US National Library of Medicine).
 * Free, keyless, authoritative drug nomenclature. This is ENTITY
 * verification ("does this drug name exist in RxNorm?") — it is NOT a
 * clinical judgment, dose check, or statement about appropriateness.
 *
 * API: https://lillycoi.github.io/rxnav / https://rxnav.nlm.nih.gov/REST
 * approximateTerm returns ranked candidate concepts for a name.
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

    // RxNav's score is an unbounded relevance number, not a 0-100 similarity, so
    // it cannot be thresholded. A MATCH requires the transcribed name to equal an
    // RxNorm name for the top concept exactly (ignoring case and spacing); a
    // near-miss such as "Lisinopri" stays NO_MATCH with the closest candidate shown.
    const norm = (v: string) => v.trim().toLowerCase().replace(/\s+/g, " ");
    let display: string | null = null;
    let exact = false;
    if (best?.rxcui) {
      const names = candidates
        .filter((c) => c.rxcui === best.rxcui && c.name)
        .map((c) => c.name as string);
      display = names.find((n) => norm(n) === norm(query)) ?? names[0] ?? null;
      if (!display) {
        // Some sources omit the name; resolve the concept's RxNorm name instead.
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
      exact = display !== null && norm(display) === norm(query);
    }
    if (best?.rxcui && exact) {
      return {
        status: "MATCH",
        query,
        bestMatch: display,
        rxcui: best.rxcui,
        score,
        note: "Name matches an RxNorm concept exactly. This verifies the drug name exists in federal nomenclature — not that it is appropriate for any patient.",
      };
    }
    return {
      status: "NO_MATCH",
      query,
      bestMatch: display,
      rxcui: null,
      score,
      note: "No exact RxNorm match. The transcribed name may be misread — pharmacist should verify against the original.",
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
