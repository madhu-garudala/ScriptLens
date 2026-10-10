import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbPool, REVIEWS_TABLE } from "@/lib/db";
import manifest from "@/data/fixture-manifest.json";

export const runtime = "nodejs";

// Only the bundled synthetic fixtures are stored. Uploaded faxes are never persisted.
const FIXTURE_IDS = new Set(manifest.fixtures.map((f) => f.id));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BODY_CHARS = 300_000;

const SavedReviewSchema = z.object({
  result: z
    .object({
      documentId: z.string(),
      status: z.enum(["NEEDS_REVIEW", "UNSUPPORTED"]),
      extraction: z.object({ fields: z.array(z.unknown()) }).passthrough(),
      issues: z.array(z.unknown()),
    })
    .passthrough(),
  review: z.record(z.unknown()),
  audit: z.array(z.unknown()).max(1000),
  exported: z.boolean(),
});

function fail(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

function identify(req: NextRequest, id: string) {
  if (!FIXTURE_IDS.has(id)) {
    return { error: fail(400, "NOT_STORABLE", "Only the bundled synthetic fixtures are stored.") };
  }
  const clientId = req.headers.get("x-scriptlens-client") ?? "";
  if (!UUID.test(clientId)) {
    return { error: fail(400, "BAD_CLIENT", "Missing or invalid client id.") };
  }
  const pool = dbPool();
  if (!pool) {
    return { error: fail(503, "STORAGE_NOT_CONFIGURED", "Review storage is not configured.") };
  }
  return { clientId, pool };
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = identify(req, params.id);
  if ("error" in ctx) return ctx.error;
  try {
    const { rows } = await ctx.pool.query(
      `select result, review, audit, exported, updated_at from ${REVIEWS_TABLE}
       where client_id = $1 and document_id = $2`,
      [ctx.clientId, params.id],
    );
    if (!rows.length) return fail(404, "NOT_FOUND", "No saved review.");
    const r = rows[0];
    return NextResponse.json({
      result: r.result,
      review: r.review,
      audit: r.audit,
      exported: r.exported,
      updatedAt: r.updated_at,
    });
  } catch {
    return fail(502, "STORAGE_ERROR", "Could not read from review storage.");
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = identify(req, params.id);
  if ("error" in ctx) return ctx.error;

  const raw = await req.text();
  if (raw.length > MAX_BODY_CHARS) return fail(413, "TOO_LARGE", "Review is too large to store.");
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return fail(400, "BAD_JSON", "Body is not valid JSON.");
  }
  const parsed = SavedReviewSchema.safeParse(json);
  if (!parsed.success || parsed.data.result.documentId !== params.id) {
    return fail(400, "BAD_SHAPE", "Body is not a review for this document.");
  }
  const { result, review, audit, exported } = parsed.data;
  try {
    await ctx.pool.query(
      `insert into ${REVIEWS_TABLE} (client_id, document_id, result, review, audit, exported, updated_at)
       values ($1, $2, $3, $4, $5, $6, now())
       on conflict (client_id, document_id) do update
         set result = excluded.result, review = excluded.review, audit = excluded.audit,
             exported = excluded.exported, updated_at = now()`,
      [
        ctx.clientId,
        params.id,
        JSON.stringify(result),
        JSON.stringify(review),
        JSON.stringify(audit),
        exported,
      ],
    );
    return NextResponse.json({ ok: true });
  } catch {
    return fail(502, "STORAGE_ERROR", "Could not write to review storage.");
  }
}
