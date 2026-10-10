#!/usr/bin/env node
/**
 * Runs a live extraction for every bundled fixture so the result is stored and
 * later views open instantly. Needs the app running (npm run dev).
 *
 * Usage: node scripts/warm-cache.mjs [baseUrl]   (default http://localhost:3000)
 */
import { readFileSync } from "node:fs";

const base = process.argv[2] || "http://localhost:3000";
const { fixtures } = JSON.parse(readFileSync("src/data/fixture-manifest.json", "utf8"));

let failed = 0;
for (const f of fixtures) {
  const fd = new FormData();
  fd.set("fixtureId", f.id);
  fd.set("fresh", "true");
  try {
    const res = await fetch(`${base}/api/analyze`, { method: "POST", body: fd });
    const json = await res.json();
    if (!res.ok || !json.extraction) {
      failed++;
      console.log(`✗ ${f.id} — ${json.error?.code ?? `HTTP ${res.status}`}: ${json.error?.message ?? ""}`.slice(0, 200));
      continue;
    }
    const crit = json.issues.filter((i) => i.severity === "CRITICAL").length;
    console.log(`✓ ${f.id} — ${json.status}, ${crit} critical, ${(json.latencyMs / 1000).toFixed(1)}s`);
  } catch (e) {
    failed++;
    console.log(`✗ ${f.id} — ${e.message}`);
  }
}
process.exit(failed ? 1 : 0);
