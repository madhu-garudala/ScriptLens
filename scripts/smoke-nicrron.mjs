#!/usr/bin/env node
/**
 * Nicrron smoke test. Run BEFORE building on any assumed endpoint/model.
 *   1. Lists models from GET /v1/models (confirms base URL + auth).
 *   2. Runs a text completion.
 *   3. Runs a VISION completion on public/fixtures/rx-clean.png.
 *
 * Usage:  NICRRON_API_KEY=... node scripts/smoke-nicrron.mjs
 * Reads .env.local if present.
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

const BASE = process.env.NICRRON_BASE_URL || "https://api.nicrron.ai/v1";
const KEY = process.env.NICRRON_API_KEY;
const MODEL = process.env.NICRRON_MODEL || "anthropic/claude-sonnet-5";

if (!KEY) {
  console.error("✗ NICRRON_API_KEY not set (put it in .env.local)");
  process.exit(1);
}

const headers = { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

console.log(`Base URL: ${BASE}\nModel:    ${MODEL}\n`);

// 1. Model list
try {
  const res = await fetch(`${BASE}/models`, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  const ids = (json.data ?? []).map((m) => m.id);
  console.log(`✓ /models OK — ${ids.length} models`);
  const visionish = ids.filter((id) =>
    /claude|gpt|gemini|vision|sonnet|opus|4o|5\.5|banana/i.test(id),
  );
  console.log(`  Likely vision-capable candidates:\n    ${visionish.slice(0, 12).join("\n    ")}`);
  if (!ids.includes(MODEL)) {
    console.warn(`  ⚠ Configured model "${MODEL}" NOT in the list — pick one from above and update .env.local`);
  }
} catch (e) {
  console.error(`✗ /models failed: ${e.message}`);
  console.error("  → Check base URL and key in the Nicrron console before anything else.");
  process.exit(1);
}

// 2. Text completion
try {
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content: "Reply with exactly: NICRRON TEXT OK" }],
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = await res.json();
  console.log(`✓ text completion OK — "${json.choices?.[0]?.message?.content?.slice(0, 60)}"`);
} catch (e) {
  console.error(`✗ text completion failed: ${e.message}`);
  process.exit(1);
}

// 3. Vision completion on rx-clean fixture
try {
  const img = readFileSync("public/fixtures/rx-clean.png").toString("base64");
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "What medication name is printed on this synthetic demo fax? One word." },
            { type: "image_url", image_url: { url: `data:image/png;base64,${img}` } },
          ],
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = await res.json();
  const answer = json.choices?.[0]?.message?.content ?? "";
  console.log(`✓ VISION completion OK — model read: "${answer.slice(0, 60)}"`);
  if (/lisinopril/i.test(answer)) console.log("✓✓ Model correctly read the fixture. You are GO for the build.");
  else console.warn("  ⚠ Model answered but didn't read 'Lisinopril' — check image support for this model.");
} catch (e) {
  console.error(`✗ vision completion failed: ${e.message}`);
  console.error("  → This model may not accept images through Nicrron. Pick another from the /models list.");
  process.exit(1);
}
