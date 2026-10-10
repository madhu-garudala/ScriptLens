/**
 * Block Convey PRISM trace ingest (observability sponsor).
 * Endpoints + auth confirmed from PRISM's own onboarding brief (Oct 10 2026):
 *   host   https://prism-api-prod.up.railway.app
 *   ingest POST /api/traces
 *   auth   X-PRISMtrace-Key  (NOT Authorization: Bearer — that 401s)
 *   verify POST /api/setup-doctor/handshake, GET /api/setup-doctor
 * Env var names match PRISM's brief: PRISMTRACE_API_KEY / PRISMTRACE_PROJECT_ID / PRISMTRACE_HOST.
 *
 * PRIVACY: traces carry sanitized metadata only — never the image,
 * never base64, never extracted patient text.
 */
export type PrismStatus = "RECEIVED" | "FAILED" | "NOT_CONFIGURED";

export async function emitPrismTrace(args: {
  documentId: string;
  model: string;
  latencyMs: number;
  status: string;
  issueCount: number;
}): Promise<{ status: PrismStatus; detail?: string }> {
  const host = process.env.PRISMTRACE_HOST || "https://prism-api-prod.up.railway.app";
  const apiKey = process.env.PRISMTRACE_API_KEY;
  const projectId = process.env.PRISMTRACE_PROJECT_ID;
  if (!apiKey || !projectId) {
    return { status: "NOT_CONFIGURED", detail: "PRISMTRACE_API_KEY / PRISMTRACE_PROJECT_ID not set" };
  }
  try {
    const res = await fetch(`${host}/api/traces`, {
      method: "POST",
      signal: AbortSignal.timeout(6000),
      headers: { "Content-Type": "application/json", "X-PRISMtrace-Key": apiKey },
      body: JSON.stringify({
        project_id: projectId,
        model: args.model,
        input_messages: [
          { role: "user", content: `Synthetic document intake: ${args.documentId}` },
        ],
        output_message: `status=${args.status}; issue_count=${args.issueCount}`,
        latency_ms: args.latencyMs,
        // One session per reviewed document groups traces into a trajectory.
        session_id: `scriptlens-${args.documentId}`,
        agent_id: "scriptlens-extractor",
        agent_name: "ScriptLens Extractor",
        metadata: {
          environment: "hackathon-demo",
          synthetic_only: true,
          validation_status: args.status,
          issue_count: args.issueCount,
        },
      }),
    });
    if (!res.ok) {
      return { status: "FAILED", detail: `PRISM ingest HTTP ${res.status}` };
    }
    return { status: "RECEIVED" };
  } catch (e: unknown) {
    return {
      status: "FAILED",
      detail: e instanceof Error ? e.message : "network error",
    };
  }
}
