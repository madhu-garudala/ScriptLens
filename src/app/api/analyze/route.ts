import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { extractFromImage, InferenceError, NICRRON_MODEL } from "@/lib/nicrron";
import { checkDrugName } from "@/lib/rxnorm";
import { validateExtraction } from "@/lib/validate";
import { emitPrismTrace } from "@/lib/prism";
import type { AnalyzeResult } from "@/lib/types";
import manifest from "@/data/fixture-manifest.json";

export const runtime = "nodejs";
export const maxDuration = 60;

const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_BYTES = 5 * 1024 * 1024;

const FIXTURE_IDS = new Set(manifest.fixtures.map((f) => f.id));

async function loadFixture(id: string): Promise<{ dataUrl: string } | null> {
  if (!FIXTURE_IDS.has(id)) return null;
  const file = path.join(process.cwd(), "public", "fixtures", `${id}.png`);
  const buf = await fs.readFile(file);
  return { dataUrl: `data:image/png;base64,${buf.toString("base64")}` };
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const fixtureId = form.get("fixtureId");
  const file = form.get("file");

  let documentId: string;
  let dataUrl: string;

  if (typeof fixtureId === "string" && fixtureId) {
    const fx = await loadFixture(fixtureId);
    if (!fx) {
      return NextResponse.json(
        { error: { code: "UNKNOWN_FIXTURE", message: "Unknown fixture id.", safeToRetry: false } },
        { status: 400 },
      );
    }
    documentId = fixtureId;
    dataUrl = fx.dataUrl;
  } else if (file instanceof File) {
    if (form.get("syntheticAttested") !== "true") {
      return NextResponse.json(
        {
          error: {
            code: "ATTESTATION_REQUIRED",
            message: "Confirm the upload is synthetic and contains no real patient information.",
            safeToRetry: false,
          },
        },
        { status: 400 },
      );
    }
    if (!ALLOWED_MIME.has(file.type)) {
      return NextResponse.json(
        { error: { code: "UNSUPPORTED_TYPE", message: `Unsupported file type ${file.type}. Use PNG, JPEG, or WEBP.`, safeToRetry: false } },
        { status: 400 },
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: { code: "TOO_LARGE", message: "File exceeds the 5 MB demo limit.", safeToRetry: false } },
        { status: 400 },
      );
    }
    documentId = `upload-${Date.now().toString(36)}`;
    const buf = Buffer.from(await file.arrayBuffer());
    dataUrl = `data:${file.type};base64,${buf.toString("base64")}`;
  } else {
    return NextResponse.json(
      { error: { code: "NO_INPUT", message: "Provide a fixtureId or an image file.", safeToRetry: false } },
      { status: 400 },
    );
  }

  try {
    const { extraction, model, latencyMs } = await extractFromImage(dataUrl);

    // RxNorm entity verification (never clinical judgment); non-fatal.
    const medName =
      extraction.fields.find((f) => f.key === "medication_name")?.value ?? null;
    const rxnorm =
      extraction.documentType === "PRESCRIPTION"
        ? await checkDrugName(medName)
        : null;

    const issues = validateExtraction(extraction, rxnorm);
    const status =
      extraction.documentType === "PRESCRIPTION" ? "NEEDS_REVIEW" : "UNSUPPORTED";

    // Sanitized metadata trace only — no image bytes, no patient text.
    const prism = await emitPrismTrace({
      documentId,
      model,
      latencyMs,
      status,
      issueCount: issues.length,
    });

    const result: AnalyzeResult = {
      documentId,
      status,
      extraction,
      issues,
      rxnorm,
      model,
      latencyMs,
      prismStatus: prism.status,
    };
    return NextResponse.json(result);
  } catch (e: unknown) {
    const err =
      e instanceof InferenceError
        ? e
        : new InferenceError("API_ERROR", e instanceof Error ? e.message : "Unknown error", true);

    // Trace failures too (sanitized) — honesty includes the error path.
    const prism = await emitPrismTrace({
      documentId,
      model: NICRRON_MODEL(),
      latencyMs: 0,
      status: `FAILED:${err.code}`,
      issueCount: 0,
    });

    const result: AnalyzeResult = {
      documentId,
      status: "PROCESSING_FAILED",
      extraction: null,
      issues: [],
      rxnorm: null,
      model: NICRRON_MODEL(),
      latencyMs: 0,
      prismStatus: prism.status,
      error: { code: err.code, message: err.message, safeToRetry: err.safeToRetry },
    };
    return NextResponse.json(result, { status: err.code === "NOT_CONFIGURED" ? 503 : 502 });
  }
}
