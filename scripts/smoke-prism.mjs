#!/usr/bin/env node
/**
 * Block Convey PRISM verification — follows PRISM's own setup brief.
 *   Step 1: POST /api/setup-doctor/handshake  (proves credential, sends test trace)
 *   Step 2: GET  /api/setup-doctor            (checks live_connected / blocked_step)
 * Auth is X-PRISMtrace-Key — NEVER Authorization: Bearer (that 401s).
 *
 * Usage: node scripts/smoke-prism.mjs   (reads .env.local)
 */
import { readFileSync, existsSync } from "node:fs";

for (const envFile of [".env.local", ".env"]) {
  if (existsSync(envFile)) {
    for (const line of readFileSync(envFile, "utf8").split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  }
}

const HOST = process.env.PRISMTRACE_HOST || "https://prism-api-prod.up.railway.app";
const KEY = process.env.PRISMTRACE_API_KEY;
const PROJECT = process.env.PRISMTRACE_PROJECT_ID;

if (!KEY || !PROJECT) {
  console.error("✗ Set PRISMTRACE_API_KEY and PRISMTRACE_PROJECT_ID in .env.local first.");
  process.exit(1);
}
console.log(`Host: ${HOST}\nProject: ${PROJECT}\n`);

// Step 1 — handshake
try {
  const res = await fetch(`${HOST}/api/setup-doctor/handshake`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-PRISMtrace-Key": KEY },
    body: JSON.stringify({ project_id: PROJECT, send_test_trace: true, client: "scriptlens" }),
  });
  const body = await res.text();
  if (!res.ok) {
    console.error(`✗ CREDENTIAL FAIL — handshake HTTP ${res.status}\n${body.slice(0, 400)}`);
    console.error("\nRead the detail field: wrong key value, revoked/expired key, or");
    console.error("project_id not matching the key's project. Fix per the message; don't loop.");
    process.exit(1);
  }
  console.log(`✓ CREDENTIAL OK — handshake 200, test trace stored.\n${body.slice(0, 200)}\n`);
} catch (e) {
  console.error(`✗ Handshake request failed: ${e.message}`);
  process.exit(1);
}

// Step 3 (app-shaped ingest) — one sanitized trace exactly like the app sends
try {
  const res = await fetch(`${HOST}/api/traces`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-PRISMtrace-Key": KEY },
    body: JSON.stringify({
      project_id: PROJECT,
      model: "smoke-test",
      input_messages: [{ role: "user", content: "ScriptLens smoke trace (synthetic)" }],
      output_message: "status=SMOKE_OK",
      latency_ms: 1,
      session_id: "scriptlens-smoke",
      agent_id: "scriptlens-extractor",
      agent_name: "ScriptLens Extractor",
      metadata: { environment: "hackathon-demo", synthetic_only: true },
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  console.log("✓ /api/traces ingest OK (app-shaped trace accepted).\n");
} catch (e) {
  console.error(`✗ /api/traces ingest failed: ${e.message}`);
}

// Step 2 — doctor
try {
  const res = await fetch(`${HOST}/api/setup-doctor?project_id=${PROJECT}`, {
    headers: { "X-PRISMtrace-Key": KEY },
  });
  const body = await res.text();
  console.log(`Doctor (HTTP ${res.status}): ${body.slice(0, 400)}\n`);
  if (/"live_connected"\s*:\s*true/.test(body)) {
    console.log("✓ LIVE CONNECTED — PRISM is receiving live traces.");
  } else {
    console.log("→ Not LIVE yet. Run a real extraction in the app (npm run dev, open a");
    console.log("  fixture, Run extraction), then re-run this script. Handshake/smoke");
    console.log("  traces alone do NOT count as live. Also verify in the dashboard that");
    console.log("  traces appear under agent 'ScriptLens Extractor'.");
  }
} catch (e) {
  console.error(`✗ Doctor check failed: ${e.message}`);
}
