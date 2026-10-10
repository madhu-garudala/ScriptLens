import { NextRequest, NextResponse } from "next/server";
import { dbPool, REVIEWS_TABLE } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Status of every saved review for this browser — drives the intake queue. */
export async function GET(req: NextRequest) {
  const clientId = req.headers.get("x-scriptlens-client") ?? "";
  if (!UUID.test(clientId)) {
    return NextResponse.json(
      { error: { code: "BAD_CLIENT", message: "Missing or invalid client id." } },
      { status: 400 },
    );
  }
  const pool = dbPool();
  if (!pool) {
    return NextResponse.json(
      { error: { code: "STORAGE_NOT_CONFIGURED", message: "Review storage is not configured." } },
      { status: 503 },
    );
  }
  try {
    const { rows } = await pool.query(
      `select document_id, exported, result->>'status' as status, updated_at
       from ${REVIEWS_TABLE} where client_id = $1`,
      [clientId],
    );
    return NextResponse.json({
      reviews: rows.map((r) => ({
        documentId: r.document_id as string,
        exported: r.exported as boolean,
        status: r.status as string,
        updatedAt: r.updated_at as string,
      })),
    });
  } catch {
    return NextResponse.json(
      { error: { code: "STORAGE_ERROR", message: "Could not read from review storage." } },
      { status: 502 },
    );
  }
}
