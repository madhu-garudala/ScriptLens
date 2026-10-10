#!/usr/bin/env node
/** ElevenLabs smoke test — synthesizes one short clip to elevenlabs-test.mp3.
 *  Usage: node scripts/smoke-elevenlabs.mjs   (reads .env.local) */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
for (const f of [".env.local", ".env"]) if (existsSync(f))
  for (const l of readFileSync(f, "utf8").split("\n")) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
const key = process.env.ELEVENLABS_API_KEY;
if (!key) { console.error("✗ ELEVENLABS_API_KEY not set"); process.exit(1); }
const voice = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";
const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, {
  method: "POST",
  headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
  body: JSON.stringify({ text: "ScriptLens voice check. This is a simulated verification call.",
    model_id: process.env.ELEVENLABS_MODEL_ID || "eleven_turbo_v2_5" }),
});
if (!res.ok) { console.error(`✗ HTTP ${res.status}: ${(await res.text()).slice(0,300)}`); process.exit(1); }
writeFileSync("elevenlabs-test.mp3", Buffer.from(await res.arrayBuffer()));
console.log("✓ Voice OK — wrote elevenlabs-test.mp3. Play it, then set NEXT_PUBLIC_VOICE_DEMO=true to show the button.");
