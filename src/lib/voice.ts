/**
 * Feature-flagged ElevenLabs escalation audio (OFF by default).
 *
 * Real pharmacy practice: when a fax is unreadable, someone CALLS the
 * prescriber's office. This generates the spoken verification script a
 * tech would read — clearly labeled SIMULATED. No call is placed.
 *
 * Enable with:
 *   ELEVENLABS_API_KEY=...            (server)
 *   NEXT_PUBLIC_VOICE_DEMO=true      (shows the button)
 *   ELEVENLABS_VOICE_ID=...          (optional; defaults to a stock voice)
 * Verify with: npm run smoke:elevenlabs
 */
export function buildVerificationScript(args: {
  prescriber: string | null;
  patient: string | null;
  medication: string | null;
  fieldLabel: string;
  reason: string | null;
}): string {
  const who = args.prescriber ? `the office of ${args.prescriber}` : "the prescriber's office";
  const pt = args.patient ?? "the patient named on the fax";
  const med = args.medication ?? "the prescribed medication";
  return (
    `Hello, this is Example Pharmacy calling ${who} to verify a faxed prescription ` +
    `for ${pt}. We received an order for ${med}, but the ${args.fieldLabel.toLowerCase()} ` +
    `is not legible on the fax${args.reason ? ` — ${args.reason.toLowerCase()}` : ""}. ` +
    `Could you please confirm the intended ${args.fieldLabel.toLowerCase()}? ` +
    `We will hold the order until it is confirmed. Thank you.`
  );
}

export async function synthesizeSpeech(text: string): Promise<ArrayBuffer> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error("ELEVENLABS_API_KEY not set");
  const voice = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, {
    method: "POST",
    signal: AbortSignal.timeout(20000),
    headers: {
      "xi-api-key": key,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: process.env.ELEVENLABS_MODEL_ID || "eleven_turbo_v2_5",
      voice_settings: { stability: 0.5, similarity_boost: 0.7 },
    }),
  });
  if (!res.ok) {
    throw new Error(`ElevenLabs HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  return res.arrayBuffer();
}
