import { NextRequest, NextResponse } from "next/server";
import { buildVerificationScript, synthesizeSpeech } from "@/lib/voice";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Feature-flagged: returns 503 unless ELEVENLABS_API_KEY is configured. */
export async function POST(req: NextRequest) {
  if (!process.env.ELEVENLABS_API_KEY) {
    return NextResponse.json(
      { error: { code: "NOT_CONFIGURED", message: "Voice feature is not enabled." } },
      { status: 503 },
    );
  }
  const body = (await req.json()) as {
    prescriber?: string | null;
    patient?: string | null;
    medication?: string | null;
    fieldLabel?: string;
    reason?: string | null;
  };
  if (!body.fieldLabel) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "fieldLabel is required." } },
      { status: 400 },
    );
  }
  const script = buildVerificationScript({
    prescriber: body.prescriber ?? null,
    patient: body.patient ?? null,
    medication: body.medication ?? null,
    fieldLabel: body.fieldLabel,
    reason: body.reason ?? null,
  });
  try {
    const audio = await synthesizeSpeech(script);
    return new NextResponse(audio, {
      headers: { "Content-Type": "audio/mpeg", "X-Script-Text": encodeURIComponent(script) },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      {
        error: {
          code: "TTS_FAILED",
          message: e instanceof Error ? e.message : "Speech synthesis failed.",
        },
      },
      { status: 502 },
    );
  }
}
