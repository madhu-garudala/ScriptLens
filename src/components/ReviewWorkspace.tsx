"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FIELD_LABELS,
  REQUIRED_FIELDS,
  type ExtractedField,
  type FieldKey,
} from "@/lib/schema";
import type { AnalyzeResult, AuditEvent, ReviewEntry } from "@/lib/types";
import { activeCriticalIssues, canExportDraft } from "@/lib/validate";

type Props = {
  documentId: string;
  fixtureImage: string | null;
  fixtureTitle: string;
};

let auditSeq = 0;
const nextAuditId = () => `evt-${++auditSeq}`;

function dataUrlToFile(dataUrl: string, name: string): File {
  const [head, b64] = dataUrl.split(",");
  const mime = head.match(/data:(.*?);/)?.[1] ?? "image/png";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], name, { type: mime });
}

export function ReviewWorkspace({ documentId, fixtureImage, fixtureTitle }: Props) {
  const isUpload = documentId === "upload";
  const [imageSrc, setImageSrc] = useState<string | null>(fixtureImage);
  const [uploadName, setUploadName] = useState<string>("uploaded image");
  const [phase, setPhase] = useState<"idle" | "running" | "done" | "failed">("idle");
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [review, setReview] = useState<Partial<Record<FieldKey, ReviewEntry>>>({});
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [selected, setSelected] = useState<FieldKey | null>(null);
  const [editDraft, setEditDraft] = useState<string>("");
  const [editing, setEditing] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [showReliability, setShowReliability] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const [exported, setExported] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [voiceNote, setVoiceNote] = useState<string | null>(null);
  const voiceEnabled = process.env.NEXT_PUBLIC_VOICE_DEMO === "true";

  useEffect(() => {
    if (isUpload) {
      const d = sessionStorage.getItem("scriptlens-upload");
      const n = sessionStorage.getItem("scriptlens-upload-name");
      if (d) setImageSrc(d);
      if (n) setUploadName(n);
    }
  }, [isUpload]);

  const log = useCallback(
    (e: Omit<AuditEvent, "id" | "documentId" | "at">) => {
      setAudit((prev) => [
        ...prev,
        { ...e, id: nextAuditId(), documentId, at: new Date().toISOString() },
      ]);
    },
    [documentId],
  );

  const runExtraction = useCallback(async () => {
    setPhase("running");
    setResult(null);
    setReview({});
    setExported(false);
    setSelected(null);
    try {
      const fd = new FormData();
      if (isUpload) {
        const d = sessionStorage.getItem("scriptlens-upload");
        if (!d) throw new Error("No staged upload found. Go back and choose an image.");
        fd.set("file", dataUrlToFile(d, uploadName));
        fd.set("syntheticAttested", "true");
      } else {
        fd.set("fixtureId", documentId);
      }
      const res = await fetch("/api/analyze", { method: "POST", body: fd });
      const json = (await res.json()) as AnalyzeResult;
      setResult(json);
      if (json.status === "PROCESSING_FAILED" || !json.extraction) {
        setPhase("failed");
        log({ actor: "SYSTEM", action: "EXTRACT", reason: json.error?.message ?? "failed" });
        return;
      }
      const entries: Partial<Record<FieldKey, ReviewEntry>> = {};
      for (const f of json.extraction.fields) {
        entries[f.key] = {
          key: f.key,
          aiValue: f.value,
          currentValue: f.value,
          reviewed: false,
          correctedByHuman: false,
        };
      }
      setReview(entries);
      setPhase("done");
      log({ actor: "SYSTEM", action: "EXTRACT", reason: `model=${json.model}` });
      for (const i of json.issues.filter((x) => x.severity === "CRITICAL")) {
        log({ actor: "SYSTEM", action: "FLAG", field: i.field ?? undefined, reason: i.message });
      }
    } catch (e: unknown) {
      setPhase("failed");
      setResult({
        documentId,
        status: "PROCESSING_FAILED",
        extraction: null,
        issues: [],
        rxnorm: null,
        model: "unknown",
        latencyMs: 0,
        prismStatus: "FAILED",
        error: {
          code: "CLIENT_ERROR",
          message: e instanceof Error ? e.message : "Request failed",
          safeToRetry: true,
        },
      });
    }
  }, [documentId, isUpload, uploadName, log]);

  const fieldsByKey = useMemo(() => {
    const m = new Map<FieldKey, ExtractedField>();
    for (const f of result?.extraction?.fields ?? []) m.set(f.key, f);
    return m;
  }, [result]);

  const issues = result?.issues ?? [];
  const activeCrit = useMemo(() => activeCriticalIssues(issues, review), [issues, review]);
  const gate = useMemo(() => canExportDraft(issues, review), [issues, review]);

  const selectedField = selected ? fieldsByKey.get(selected) ?? null : null;
  const selectedReview = selected ? review[selected] ?? null : null;
  const selectedIssues = issues.filter((i) => i.field === selected);

  function startEdit() {
    if (!selected || !selectedReview) return;
    setEditDraft(selectedReview.currentValue ?? "");
    setEditing(true);
  }

  function saveCorrection() {
    if (!selected || !selectedReview) return;
    const before = selectedReview.currentValue;
    const after = editDraft.trim() || null;
    setReview((r) => ({
      ...r,
      [selected]: {
        ...selectedReview,
        currentValue: after,
        correctedByHuman: after !== selectedReview.aiValue,
        reviewed: false, // a new value invalidates any earlier confirmation
      },
    }));
    setEditing(false);
    setExported(false);
    log({ actor: "DEMO_PHARMACIST", action: "EDIT", field: selected, before, after });
  }

  function confirmField() {
    if (!selected || !selectedReview) return;
    if (!selectedReview.currentValue?.trim()) return;
    setReview((r) => ({
      ...r,
      [selected]: { ...selectedReview, reviewed: true, reviewedAt: new Date().toISOString() },
    }));
    log({
      actor: "DEMO_PHARMACIST",
      action: "CONFIRM",
      field: selected,
      after: selectedReview.currentValue,
      reason: "Confirmed against original fax",
    });
  }

  async function playVerificationCall() {
    if (!selected || !selectedField) return;
    setVoiceBusy(true);
    setVoiceNote(null);
    try {
      const res = await fetch("/api/verification-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prescriber: review.prescriber_name?.currentValue ?? null,
          patient: review.patient_name?.currentValue ?? null,
          medication: review.medication_name?.currentValue ?? null,
          fieldLabel: FIELD_LABELS[selected],
          reason: selectedField.uncertaintyReason,
        }),
      });
      if (!res.ok) {
        const j = (await res.json()) as { error?: { message?: string } };
        throw new Error(j.error?.message ?? `HTTP ${res.status}`);
      }
      const buf = await res.arrayBuffer();
      const url = URL.createObjectURL(new Blob([buf], { type: "audio/mpeg" }));
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      await audio.play();
      setVoiceNote("Simulated verification call script — no call was placed.");
      log({
        actor: "DEMO_PHARMACIST",
        action: "FLAG",
        field: selected,
        reason: "Prepared simulated prescriber verification call",
      });
    } catch (e: unknown) {
      setVoiceNote(`Voice unavailable: ${e instanceof Error ? e.message : "error"}`);
    } finally {
      setVoiceBusy(false);
    }
  }

  function exportDraft() {
    if (!gate.ok || !result?.extraction) return;
    const fields: Record<string, string | null> = {};
    for (const k of Object.keys(review) as FieldKey[]) {
      fields[k] = review[k]?.currentValue ?? null;
    }
    const payload = {
      format: "scriptlens.synthetic-draft.v1",
      documentId,
      dataClassification: "SYNTHETIC_DEMO_ONLY",
      status: "DRAFT_FOR_NORMAL_PHARMACY_VERIFICATION",
      fields,
      fieldProvenance: Object.fromEntries(
        (Object.keys(review) as FieldKey[]).map((k) => [
          k,
          {
            aiValue: review[k]?.aiValue ?? null,
            humanCorrected: review[k]?.correctedByHuman ?? false,
            humanConfirmed: review[k]?.reviewed ?? false,
          },
        ]),
      ),
      rxnormCheck: result.rxnorm,
      reviewedBy: "DEMO_PHARMACIST",
      clinicalApproval: false,
      transmissionPerformed: false,
      audit,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${documentId}-draft.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExported(true);
    log({ actor: "DEMO_PHARMACIST", action: "EXPORT_DRAFT", reason: "Draft JSON downloaded" });
  }

  const statusBadge = (f: ExtractedField, r: ReviewEntry | undefined) => {
    if (r?.reviewed) return <span className="badge badge-confirmed">Human confirmed</span>;
    if (r?.correctedByHuman)
      return <span className="badge badge-corrected">Corrected · confirm pending</span>;
    if (f.extractionStatus === "MISSING")
      return <span className="badge badge-missing">Not available</span>;
    if (f.extractionStatus === "UNCERTAIN" || issues.some((i) => i.field === f.key && i.severity === "CRITICAL"))
      return <span className="badge badge-review">Needs review</span>;
    return <span className="badge badge-ai">AI extracted</span>;
  };

  return (
    <div className="flex h-[calc(100vh-49px)] min-h-0 flex-col">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 border-b bordered panel px-4 py-2.5 lg:px-6">
        <Link href="/" className="text-sm t-dim hover:text-slate-800 dark:hover:text-slate-100">
          ← Intake
        </Link>
        <div className="font-mono text-xs t-dim">{documentId}</div>
        <div className="text-sm font-semibold t-strong">{fixtureTitle}</div>
        <div className="ml-auto flex items-center gap-2">
          {phase === "done" && result && (
            <button className="btn btn-ghost" onClick={() => setShowReliability((v) => !v)}>
              Trust &amp; evaluation
            </button>
          )}
          <button
            className="btn btn-primary"
            onClick={() => void runExtraction()}
            disabled={phase === "running" || !imageSrc}
          >
            {phase === "running"
              ? "Reading fax…"
              : phase === "idle"
                ? "Run extraction"
                : "Re-run extraction"}
          </button>
        </div>
      </div>

      {/* Reliability drawer */}
      {showReliability && result && (
        <div className="border-b bordered panel-muted px-4 py-3 text-xs lg:px-6">
          <div className="grid gap-x-8 gap-y-1 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <span className="t-dim">Inference · </span>
              <span className="font-medium">Nicrron — {result.model}</span>
            </div>
            <div>
              <span className="t-dim">Latency · </span>
              <span className="font-medium">
                {result.latencyMs > 0 ? `${(result.latencyMs / 1000).toFixed(1)}s` : "—"}
              </span>
            </div>
            <div>
              <span className="t-dim">PRISM trace · </span>
              <span
                className={
                  result.prismStatus === "RECEIVED"
                    ? "font-medium text-teal"
                    : "font-medium text-amber"
                }
              >
                {result.prismStatus}
              </span>
            </div>
            <div>
              <span className="t-dim">RxNorm check · </span>
              <span className="font-medium">
                {result.rxnorm ? result.rxnorm.status : "—"}
              </span>
            </div>
          </div>
          {result.rxnorm && (
            <p className="mt-1.5 max-w-3xl t-dim">{result.rxnorm.note}</p>
          )}
          <p className="mt-1.5 max-w-3xl t-faint">
            Deterministic validation runs in application code, independent of the model.
            Traces carry sanitized metadata only — never the image or patient text.
          </p>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {/* Fax panel */}
        <div className="flex min-w-0 flex-1 flex-col border-r bordered bg-slate-100 dark:bg-slate-900/60">
          <div className="flex items-center justify-between border-b bordered panel px-4 py-2 text-xs t-dim">
            <span>Incoming fax {isUpload ? `· ${uploadName}` : ""}</span>
            <span className="flex items-center gap-1.5">
              <button className="btn btn-ghost !px-2 !py-0.5" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}>−</button>
              <span className="w-10 text-center">{Math.round(zoom * 100)}%</span>
              <button className="btn btn-ghost !px-2 !py-0.5" onClick={() => setZoom((z) => Math.min(3, z + 0.25))}>+</button>
            </span>
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-4">
            {imageSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageSrc}
                alt="Synthetic prescription fax"
                style={{ width: `${zoom * 100}%` }}
                className="mx-auto max-w-none rounded border border-slate-300 bg-white shadow-sm dark:border-slate-600"
              />
            ) : (
              <div className="p-8 text-center text-sm t-dim">
                No staged image. Go back to the queue and upload one.
              </div>
            )}
          </div>
          {/* Evidence strip */}
          <div className="border-t bordered panel px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide t-faint">
              Selected evidence
            </div>
            {selectedField ? (
              <div className="mt-1 text-sm">
                {selectedField.sourceText ? (
                  <>
                    <span className="rounded bg-amber-soft px-1.5 py-0.5 font-mono text-[13px] text-slate-800 dark:bg-amber-900/50 dark:text-amber-100">
                      “{selectedField.sourceText}”
                    </span>
                    <span className="ml-2 text-xs t-faint">
                      AI-cited text — verify against the original above
                    </span>
                  </>
                ) : (
                  <span className="text-xs t-dim">
                    No reliable quotation available for {selected && FIELD_LABELS[selected]} —
                    inspect the fax directly.
                  </span>
                )}
                {selectedField.uncertaintyReason && (
                  <div className="mt-1 text-xs text-amber dark:text-amber-400">{selectedField.uncertaintyReason}</div>
                )}
              </div>
            ) : (
              <div className="mt-1 text-xs t-faint">
                Select a field on the right to see what the model read.
              </div>
            )}
          </div>
        </div>

        {/* Draft order panel */}
        <div className="flex w-[30rem] shrink-0 flex-col panel">
          <div className="flex items-center justify-between border-b bordered px-4 py-2.5">
            <div className="text-sm font-semibold t-strong">Draft order</div>
            {phase === "done" && (
              <span
                className={`badge ${activeCrit.length ? "badge-review" : "badge-confirmed"}`}
              >
                {activeCrit.length
                  ? `Needs review · ${activeCrit.length} critical`
                  : "Ready for export gate"}
              </span>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-auto">
            {phase === "idle" && (
              <div className="p-6 text-sm t-dim">
                Run extraction to read this fax with the Nicrron vision model. Nothing is
                extracted, stored, or sent until you do.
              </div>
            )}
            {phase === "running" && (
              <div className="space-y-2 p-6">
                {[...Array(7)].map((_, i) => (
                  <div key={i} className="pulse-soft h-9 rounded bg-slate-100 dark:bg-slate-800" />
                ))}
              </div>
            )}
            {phase === "failed" && result?.error && (
              <div className="m-4 rounded-md border callout-danger p-4 text-sm">
                <div className="font-semibold text-danger dark:text-red-300">
                  Could not extract ({result.error.code})
                </div>
                <p className="mt-1 t-body">{result.error.message}</p>
                <p className="mt-2 text-xs t-dim">
                  No fields were fabricated. {result.error.safeToRetry ? "You can retry, or review manually from the original." : "Fix the input and try again."}
                </p>
              </div>
            )}

            {phase === "done" && result?.status === "UNSUPPORTED" && (
              <div className="m-4 rounded-md border callout-amber p-4 text-sm">
                <div className="font-semibold text-amber dark:text-amber-300">Not identified as a prescription</div>
                <p className="mt-1 t-body">
                  No draft order can be prepared from this document.
                </p>
              </div>
            )}

            {phase === "done" && result?.extraction && result.status === "NEEDS_REVIEW" && (
              <>
                {activeCrit.length > 0 && (
                  <div className="m-4 rounded-md border callout-amber p-3 text-xs t-body">
                    <div className="font-semibold text-amber dark:text-amber-300">
                      {activeCrit.length} issue{activeCrit.length > 1 ? "s" : ""} blocking export
                    </div>
                    <ul className="mt-1 list-disc space-y-0.5 pl-4">
                      {activeCrit.slice(0, 4).map((i) => (
                        <li key={i.id}>{i.message}</li>
                      ))}
                      {activeCrit.length > 4 && <li>…and {activeCrit.length - 4} more</li>}
                    </ul>
                  </div>
                )}

                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {result.extraction.fields.map((f) => {
                    const r = review[f.key];
                    const required = REQUIRED_FIELDS.includes(f.key);
                    const isSel = selected === f.key;
                    return (
                      <button
                        key={f.key}
                        onClick={() => {
                          setSelected(f.key);
                          setEditing(false);
                        }}
                        className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors ${
                          isSel ? "bg-teal-soft/40 dark:bg-teal-900/30" : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="text-[11px] uppercase tracking-wide t-faint">
                            {FIELD_LABELS[f.key]}
                            {required && <span className="ml-1 text-danger">*</span>}
                          </div>
                          <div
                            className={`truncate text-sm ${
                              r?.currentValue ? "font-medium t-strong" : "italic t-faint"
                            }`}
                          >
                            {r?.currentValue ?? "— not read —"}
                          </div>
                        </div>
                        {statusBadge(f, r)}
                      </button>
                    );
                  })}
                </div>

                {/* Field action panel */}
                {selected && selectedField && selectedReview && (
                  <div className="sticky bottom-0 border-t bordered panel-muted p-4">
                    <div className="text-xs font-semibold t-body">
                      {FIELD_LABELS[selected]}
                    </div>
                    {selectedIssues.length > 0 && (
                      <ul className="mt-1 space-y-1 text-xs text-amber dark:text-amber-400">
                        {selectedIssues.map((i) => (
                          <li key={i.id}>
                            {i.message}
                            {i.evidence?.length ? (
                              <span className="block t-dim">
                                {i.evidence.map((ev, idx) => (
                                  <span key={idx} className="block">“{ev}”</span>
                                ))}
                              </span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}
                    {editing ? (
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          autoFocus
                          value={editDraft}
                          onChange={(e) => setEditDraft(e.target.value)}
                          placeholder="Type the value exactly as seen on the fax"
                          className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                          onKeyDown={(e) => e.key === "Enter" && saveCorrection()}
                        />
                        <button className="btn btn-primary" onClick={saveCorrection}>
                          Save
                        </button>
                        <button className="btn btn-ghost" onClick={() => setEditing(false)}>
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="mt-2 flex items-center gap-2">
                        <button className="btn btn-ghost" onClick={startEdit}>
                          Edit
                        </button>
                        <button
                          className="btn btn-primary"
                          onClick={confirmField}
                          disabled={!selectedReview.currentValue?.trim() || selectedReview.reviewed}
                          title={
                            !selectedReview.currentValue?.trim()
                              ? "Enter a value first — nothing is inferred for you"
                              : selectedReview.reviewed
                                ? "Already confirmed"
                                : "Confirm this value against the original"
                          }
                        >
                          {selectedReview.reviewed ? "Confirmed ✓" : "Confirm from source"}
                        </button>
                        {voiceEnabled && selectedIssues.some((i) => i.severity === "CRITICAL") && (
                          <button
                            className="btn btn-ghost"
                            onClick={() => void playVerificationCall()}
                            disabled={voiceBusy}
                            title="Generate the spoken script a tech would use to verify this field with the prescriber's office. Simulated — no call is placed."
                          >
                            {voiceBusy ? "Preparing…" : "▶ Verification call"}
                          </button>
                        )}
                      </div>
                    )}
                    {voiceNote && (
                      <p className="mt-1.5 text-[11px] t-dim">{voiceNote}</p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Export footer */}
          <div className="border-t bordered p-4">
            <button
              className="btn btn-primary w-full"
              disabled={!gate.ok || phase !== "done"}
              onClick={exportDraft}
              title={gate.ok ? "Download draft JSON" : gate.blockers.slice(0, 3).join(" · ")}
            >
              Export draft JSON
            </button>
            {!gate.ok && phase === "done" && result?.status === "NEEDS_REVIEW" && (
              <p className="mt-2 text-[11px] leading-snug t-dim">
                Blocked: {gate.blockers.slice(0, 3).join(" · ")}
                {gate.blockers.length > 3 ? ` · +${gate.blockers.length - 3} more` : ""}
              </p>
            )}
            {exported && (
              <p className="mt-2 text-[11px] font-medium text-teal dark:text-teal-300">
                Draft exported for further verification. No prescription was transmitted.
              </p>
            )}
            <button
              className="mt-2 text-[11px] t-faint underline-offset-2 hover:underline"
              onClick={() => setShowAudit((v) => !v)}
            >
              Review history ({audit.length})
            </button>
            {showAudit && (
              <div className="mt-2 max-h-36 space-y-1 overflow-auto rounded border bordered panel-muted p-2 text-[11px] t-body">
                {audit.length === 0 && <div>No events yet.</div>}
                {audit.map((e) => (
                  <div key={e.id}>
                    <span className="font-mono t-faint">
                      {new Date(e.at).toLocaleTimeString()}
                    </span>{" "}
                    <b>{e.actor === "SYSTEM" ? "system" : "pharmacist"}</b> {e.action.toLowerCase()}
                    {e.field ? ` ${FIELD_LABELS[e.field]}` : ""}
                    {e.before !== undefined || e.after !== undefined
                      ? `: ${e.before ?? "∅"} → ${e.after ?? "∅"}`
                      : e.reason
                        ? ` — ${e.reason}`
                        : ""}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
