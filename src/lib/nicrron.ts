import OpenAI from "openai";
import { ExtractionSchema, normalizeExtraction, type Extraction } from "./schema";
import { EXTRACTION_SYSTEM_PROMPT, EXTRACTION_USER_PROMPT } from "./prompt";

/**
 * Sponsor inference gateway (NicrronNinoo), OpenAI-compatible API.
 * Base URL / model are env-driven so console-verified values win over
 * anything assumed in planning docs.
 */
export function nicrronClient() {
  const apiKey = process.env.NICRRON_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({
    apiKey,
    baseURL: process.env.NICRRON_BASE_URL || "https://api.nicrron.ai/v1",
  });
}

// Default from the sponsor doc's model catalog (vision-capable family).
// Confirm against GET /v1/models (scripts/smoke-nicrron.mjs) and pin in .env.
export const NICRRON_MODEL = () => process.env.NICRRON_MODEL || "anthropic/claude-sonnet-5";

export class InferenceError extends Error {
  constructor(
    public code: "NOT_CONFIGURED" | "API_ERROR" | "BAD_JSON" | "SCHEMA_INVALID",
    message: string,
    public safeToRetry: boolean,
  ) {
    super(message);
  }
}

/** Strip optional markdown fences only; never repair content. */
function stripFences(raw: string): string {
  const t = raw.trim();
  const m = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return m ? m[1] : t;
}

export async function extractFromImage(
  dataUrl: string,
): Promise<{ extraction: Extraction; model: string; latencyMs: number }> {
  const client = nicrronClient();
  const model = NICRRON_MODEL();
  if (!client) {
    throw new InferenceError(
      "NOT_CONFIGURED",
      "NICRRON_API_KEY is not set. Inference unavailable.",
      false,
    );
  }
  const started = Date.now();

  async function callOnce(extraNudge?: string) {
    const completion = await client!.chat.completions.create({
      model,
      // No temperature: the routed model rejects it ("deprecated for this model").
      messages: [
        { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: extraNudge
                ? `${EXTRACTION_USER_PROMPT}\n\n${extraNudge}`
                : EXTRACTION_USER_PROMPT,
            },
            { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
          ],
        },
      ],
    });
    return completion.choices[0]?.message?.content ?? "";
  }

  let raw: string;
  try {
    raw = await callOnce();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new InferenceError("API_ERROR", `Nicrron inference failed: ${msg}`, true);
  }

  // One bounded formatting retry; never fabricate on failure.
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripFences(raw));
  } catch {
    try {
      raw = await callOnce(
        "Your previous response was not valid JSON. Return ONLY the JSON object.",
      );
      parsed = JSON.parse(stripFences(raw));
    } catch {
      throw new InferenceError(
        "BAD_JSON",
        "Model did not return parseable JSON after one retry.",
        true,
      );
    }
  }

  const result = ExtractionSchema.safeParse(parsed);
  if (!result.success) {
    throw new InferenceError(
      "SCHEMA_INVALID",
      `Model JSON failed schema validation: ${result.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
      true,
    );
  }

  let extraction: Extraction;
  try {
    extraction = normalizeExtraction(result.data);
  } catch (e: unknown) {
    throw new InferenceError(
      "SCHEMA_INVALID",
      e instanceof Error ? e.message : "Normalization failed",
      true,
    );
  }

  return { extraction, model, latencyMs: Date.now() - started };
}
