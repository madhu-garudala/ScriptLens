"use client";

import Link from "next/link";
import { Icon } from "./Icon";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FIELD_LABELS,
  REQUIRED_FIELDS,
  type ExtractedField,
  type FieldKey,
} from "@/lib/schema";
import type { AnalyzeResult, AuditEvent, ReviewEntry } from "@/lib/types";
import { activeCriticalIssues, canExportDraft } from "@/lib/validate";
import { getUpload, listUploads, readUploadReview, writeUploadReview } from "@/lib/sessionUploads";

type Props = {
  documentId: string;
  fixtureImage: string | null;
  fixtureTitle: string;
};

// Format examples only — shown as input hints, never filled in as values.
const FIELD_EXAMPLES: Record<FieldKey, string> = {
  patient_name: "Jordan Blake",
  patient_dob: "06/02/1985",
  medication_name: "Lisinopril",
  strength: "10 mg",
  form: "tablet",
  dose: "1 tablet",
  route: "by mouth",
  frequency: "once daily",
  duration: "10 days",
  quantity: "30",
  refills: "0",
  prescriber_name: "Dr. Riley Chen",
  prescriber_contact: "(555) 010-0199",
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
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [uploadKept, setUploadKept] = useState(true);
  const uploadReadyRef = useRef(false);
  const [zoom, setZoom] = useState(1);
  const [showReliability, setShowReliability] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const [confirmRerun, setConfirmRerun] = useState(false);
  const [exported, setExported] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [voiceNote, setVoiceNote] = useState<string | null>(null);
  const voiceEnabled = process.env.NEXT_PUBLIC_VOICE_DEMO === "true";
  // Saved-review storage. Bundled fixtures only — uploads are never persisted.
  const [saveState, setSaveState] = useState<"loading" | "idle" | "saving" | "saved" | "error">(
    isUpload ? "idle" : "loading",
  );
  const clientIdRef = useRef<string | null>(null);
  const storageReadyRef = useRef(false);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  // Uploads live in this tab only: load the image, and any review already started on it.
  useEffect(() => {
    if (!isUpload) return;
    const wanted = new URLSearchParams(window.location.search).get("u");
    const upload = wanted ? getUpload(wanted) : listUploads().at(-1) ?? null;
    if (upload) {
      setImageSrc(upload.dataUrl);
      setUploadName(upload.name);
      setUploadId(upload.id);
      const saved = readUploadReview(upload.id);
      if (saved) {
        for (const e of saved.audit) {
          const n = Number(e.id.replace("evt-", ""));
          if (Number.isFinite(n)) auditSeq = Math.max(auditSeq, n);
        }
        setResult(saved.result);
        setReview(saved.review);
        setAudit(saved.audit);
        setExported(saved.exported);
        setPhase("done");
      }
    }
    uploadReadyRef.current = true;
  }, [isUpload]);

  useEffect(() => {
    if (!isUpload || !uploadId || !uploadReadyRef.current) return;
    if (phase !== "done" || !result?.extraction) return;
    setUploadKept(writeUploadReview(uploadId, { result, review, audit, exported }));
  }, [isUpload, uploadId, phase, result, review, audit, exported]);

  // Restore this browser's saved review for the fixture, if there is one.
  useEffect(() => {
    if (isUpload) return;
    let cancelled = false;
    (async () => {
      try {
        let id = localStorage.getItem("scriptlens-client");
        if (!id) {
          id = crypto.randomUUID();
          localStorage.setItem("scriptlens-client", id);
        }
        clientIdRef.current = id;
        const res = await fetch(`/api/reviews/${documentId}`, {
          headers: { "x-scriptlens-client": id },
        });
        if (cancelled) return;
        if (res.status === 404) {
          setSaveState("idle");
        } else if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        } else {
          const saved = (await res.json()) as {
            result: AnalyzeResult;
            review: Partial<Record<FieldKey, ReviewEntry>>;
            audit: AuditEvent[];
            exported: boolean;
          };
          // Don't overwrite an extraction the reviewer started while this was loading.
          if (cancelled || phaseRef.current !== "idle") return;
          for (const e of saved.audit) {
            const n = Number(e.id.replace("evt-", ""));
            if (Number.isFinite(n)) auditSeq = Math.max(auditSeq, n);
          }
          setResult(saved.result);
          setReview(saved.review);
          setAudit(saved.audit);
          setExported(saved.exported);
          setPhase("done");
          setSaveState("saved");
        }
      } catch {
        if (!cancelled) setSaveState("error");
      } finally {
        storageReadyRef.current = true;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [documentId, isUpload]);

  // Save after every change to a completed extraction.
  useEffect(() => {
    if (isUpload || !storageReadyRef.current || !clientIdRef.current) return;
    if (phase !== "done" || !result?.extraction) return;
    const clientId = clientIdRef.current;
    setSaveState("saving");
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/reviews/${documentId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", "x-scriptlens-client": clientId },
          body: JSON.stringify({ result, review, audit, exported }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
    }, 600);
    return () => clearTimeout(t);
  }, [documentId, isUpload, phase, result, review, audit, exported]);

  const log = useCallback(
    (e: Omit<AuditEvent, "id" | "documentId" | "at">) => {
      setAudit((prev) => [
        ...prev,
        { ...e, id: nextAuditId(), documentId, at: new Date().toISOString() },
      ]);
    },
    [documentId],
  );

  const runExtraction = useCallback(async (fresh = false) => {
    setPhase("running");
    setResult(null);
    setReview({});
    setExported(false);
    setSelected(null);
    try {
      const fd = new FormData();
      if (isUpload) {
        if (!imageSrc) throw new Error("No staged upload found. Go back and choose an image.");
        fd.set("file", dataUrlToFile(imageSrc, uploadName));
        fd.set("syntheticAttested", "true");
      } else {
        fd.set("fixtureId", documentId);
        // A re-run always asks the model again instead of using the stored extraction.
        if (fresh) fd.set("fresh", "true");
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
  }, [documentId, isUpload, uploadName, imageSrc, log]);

  const fieldsByKey = useMemo(() => {
    const m = new Map<FieldKey, ExtractedField>();
    for (const f of result?.extraction?.fields ?? []) m.set(f.key, f);
    return m;
  }, [result]);

  const issues = result?.issues ?? [];
  const activeCrit = useMemo(() => activeCriticalIssues(issues, review), [issues, review]);
  const gate = useMemo(() => canExportDraft(issues, review), [issues, review]);

  const requiredDone = REQUIRED_FIELDS.filter(
    (k) => review[k]?.reviewed && review[k]?.currentValue?.trim(),
  ).length;

  const requiredLeft = REQUIRED_FIELDS.length - requiredDone;
  const exportLocked = !gate.ok && phase === "done" && result?.status === "NEEDS_REVIEW";

  const selectedField = selected ? fieldsByKey.get(selected) ?? null : null;
  const selectedReview = selected ? review[selected] ?? null : null;
  const selectedIssues = issues.filter((i) => i.field === selected);

  function selectField(key: FieldKey) {
    setSelected(key);
    // The value is always editable in place; start from what is currently recorded.
    setEditDraft(review[key]?.currentValue ?? "");
    // Bring the editing controls into view without moving the source on desktop.
    requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>("#field-editor")
        ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  }

  const draftValue = editDraft.trim();
  const draftChanged = !!selectedReview && draftValue !== (selectedReview.currentValue ?? "");
  const confirmedUnchanged = !!selectedReview?.reviewed && !draftChanged;
  const canConfirm = !!draftValue && !confirmedUnchanged;

  /**
   * One explicit human action: record the value in the box (if the reviewer
   * changed it) and confirm it against the fax. Never fires without a value.
   */
  function confirmField() {
    if (!selected || !selectedReview || !canConfirm) return;
    const before = selectedReview.currentValue;
    setReview((r) => ({
      ...r,
      [selected]: {
        ...selectedReview,
        currentValue: draftValue,
        correctedByHuman: draftChanged
          ? draftValue !== selectedReview.aiValue
          : selectedReview.correctedByHuman,
        reviewed: true,
        reviewedAt: new Date().toISOString(),
      },
    }));
    if (draftChanged) {
      setExported(false);
      log({ actor: "DEMO_PHARMACIST", action: "EDIT", field: selected, before, after: draftValue });
    }
    log({
      actor: "DEMO_PHARMACIST",
      action: "CONFIRM",
      field: selected,
      after: draftValue,
      reason: "Confirmed against original fax",
    });
    // Move on to the next required field that still needs a person's confirmation.
    const order = result?.extraction?.fields.map((f) => f.key) ?? [];
    const at = order.indexOf(selected);
    const next = [...order.slice(at + 1), ...order.slice(0, at)].find(
      (k) => REQUIRED_FIELDS.includes(k) && !review[k]?.reviewed,
    );
    if (next) selectField(next);
  }

  /** Optional fields only: remove a value that is not on the fax. */
  function clearValue() {
    if (!selected || !selectedReview?.currentValue || REQUIRED_FIELDS.includes(selected)) return;
    const before = selectedReview.currentValue;
    setReview((r) => ({
      ...r,
      [selected]: {
        ...selectedReview,
        currentValue: null,
        correctedByHuman: selectedReview.aiValue !== null,
        reviewed: false,
      },
    }));
    setEditDraft("");
    setExported(false);
    log({ actor: "DEMO_PHARMACIST", action: "EDIT", field: selected, before, after: null });
  }

  // Enter confirms the selected field (each field is still confirmed one at a time).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Enter" || !selected) return;
      const t = e.target as HTMLElement | null;
      if (t && t !== document.body && !t.closest?.("[data-field]")) return;
      e.preventDefault();
      confirmField();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

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

  const fieldGroups: { title: string; keys: FieldKey[] }[] = [
    { title: "Patient details", keys: ["patient_name", "patient_dob"] },
    { title: "Prescription", keys: ["medication_name", "strength", "form", "dose", "route", "frequency", "duration", "quantity", "refills"] },
    { title: "Prescriber", keys: ["prescriber_name", "prescriber_contact"] },
  ];

  return (
    <div className="review-workspace fade-up">
      <div className="review-toolbar">
        <div><div className="review-breadcrumb"><Link href={isUpload ? "/upload" : "/queue"}>{isUpload ? "Your uploads" : "Intake queue"}</Link><Icon name="chevron" size={12} /><span>Document review</span></div><h1>{isUpload ? uploadName : fixtureTitle}</h1></div>
        <div className="flex flex-wrap items-center gap-2">
          {phase === "done" && result && <button className="btn btn-ghost" aria-expanded={showReliability} onClick={() => setShowReliability((v) => !v)}><Icon name="shield" size={15} />Extraction details</button>}
          <button className="btn btn-primary" onClick={() => { if (phase === "done") setConfirmRerun(true); else void runExtraction(phase !== "idle"); }} disabled={phase === "running" || !imageSrc}><Icon name="spark" size={15} />{phase === "running" ? "Reading fax…" : phase === "idle" ? "Run extraction" : phase === "failed" ? "Retry extraction" : "Re-run extraction"}</button>
        </div>
      </div>

      {confirmRerun && <div className="review-callout" role="alert"><strong>Start a new extraction?</strong><p>This replaces the current extracted values and field confirmations with a fresh read.</p><div className="mt-3 flex gap-2"><button className="btn btn-primary" onClick={() => { setConfirmRerun(false); void runExtraction(true); }}>Re-run extraction</button><button className="btn btn-ghost" onClick={() => setConfirmRerun(false)}>Keep current review</button></div></div>}

      <div className="review-steps" aria-label="Review progress">
        <div className="review-step active"><span><Icon name="check" size={12} /></span>Document ready</div><Icon name="chevron" size={13} /><div className={`review-step ${phase === "done" ? "active" : ""}`}><span>{phase === "done" ? <Icon name="check" size={12} /> : "2"}</span>Extract &amp; review</div><Icon name="chevron" size={13} /><div className={`review-step ${exported ? "active" : ""}`}><span>{exported ? <Icon name="check" size={12} /> : "3"}</span>Export draft</div>
      </div>

      {showReliability && result && <section className="trust-panel" aria-label="Extraction details"><div className="trust-grid"><div><span className="eyebrow">Model</span><strong>{result.model}</strong></div><div><span className="eyebrow">Extraction time</span><strong>{result.latencyMs > 0 ? `${(result.latencyMs / 1000).toFixed(1)}s` : "—"}</strong></div><div><span className="eyebrow">PRISM trace</span><strong>{result.prismStatus}</strong></div><div><span className="eyebrow">RxNorm name check</span><strong>{result.rxnorm?.status ?? "—"}</strong></div></div>{result.rxnorm && <p>{result.rxnorm.note}</p>}{result.cached && <p>Stored extraction from {result.cachedAt ? new Date(result.cachedAt).toLocaleString() : "an earlier run"}. Timing and trace status refer to that run. Re-run extraction for a fresh read.</p>}<p>Drug-name matching is not a clinical approval. Source quotations are proposed by the model and must be checked against the original.</p></section>}

      <div className="review-grid">
        <section className="source-panel" aria-label="Original fax">
          <div className="panel-heading"><h2><Icon name="file" size={16} />Original document</h2><div className="flex items-center gap-1"><button className="btn btn-ghost h-7 w-7 !min-h-0 !p-0" aria-label="Zoom out" disabled={zoom <= .5} onClick={() => setZoom((z) => Math.max(.5, z - .25))}>−</button><button className="px-2 text-[10px] t-dim" onClick={() => setZoom(1)} title="Reset zoom" aria-label="Reset zoom to 100 percent">{Math.round(zoom * 100)}%</button><button className="btn btn-ghost h-7 w-7 !min-h-0 !p-0" aria-label="Zoom in" disabled={zoom >= 3} onClick={() => setZoom((z) => Math.min(3, z + .25))}>+</button></div></div>
          <div className="fax-stage">
            {imageSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageSrc} alt="Original synthetic prescription fax" style={{ width: `${zoom * 100}%` }} />
            ) : <div className="empty-state"><Icon name="file" size={28} /><h3>No image available</h3><p>This upload may have expired when its browser tab closed.</p><Link href="/upload" className="btn btn-primary">Choose an image</Link></div>}
          </div>
          <div className="evidence-panel" aria-live="polite"><div className="eyebrow">SOURCE EVIDENCE {selected ? `· ${FIELD_LABELS[selected]}` : ""}</div>{selectedField ? <>{selectedField.sourceText ? <blockquote>“{selectedField.sourceText}”</blockquote> : <p>No reliable quotation is available. Check the original image.</p>}<p>AI-cited text. Verify against the original document above.</p>{selectedField.uncertaintyReason && <p className="!text-amber dark:!text-amber-300">{selectedField.uncertaintyReason}</p>}</> : <p>Select a draft field to see the source text cited by the model.</p>}</div>
        </section>

        <section className="draft-panel" aria-label="Draft order">
          <div className="panel-heading"><h2><Icon name="lens" size={16} />Draft order</h2>{phase === "done" && result?.status === "NEEDS_REVIEW" ? <span className={`badge ${gate.ok ? "badge-confirmed" : "badge-review"}`}>{gate.ok ? "Ready to export" : "Review required"}</span> : <span className="badge badge-ai">{phase === "running" ? "Extracting" : phase === "failed" ? "Extraction failed" : result?.status === "UNSUPPORTED" ? "Unsupported" : "Awaiting extraction"}</span>}</div>

          {phase === "idle" && <div className="empty-state !py-16"><span className="empty-icon"><Icon name="spark" size={25} /></span><h3>Let’s bring the details into focus.</h3><p>Extract the fields from this fax, then check each value alongside the original. You make the final confirmation.</p><button className="btn btn-primary" onClick={() => void runExtraction()} disabled={!imageSrc}><Icon name="spark" size={16} />Run extraction</button></div>}
          {phase === "running" && <div className="p-6" role="status"><p className="mb-2 text-sm font-medium t-strong">Reading your document…</p><p className="mb-6 text-xs t-dim">Extracting fields and checking for uncertainty.</p>{Array.from({ length: 7 }, (_, i) => <div key={i} className="pulse-soft mb-3 h-12 rounded-lg panel-muted" style={{ animationDelay: `${i * 90}ms` }} />)}</div>}
          {phase === "failed" && <div className="empty-state" role="alert"><span className="empty-icon"><Icon name="alert" size={25} /></span><h3>We couldn’t read this document.</h3><p>{result?.error?.message ?? "Extraction did not return a usable draft."}</p><button className="btn btn-ghost" disabled={!imageSrc} onClick={() => void runExtraction(true)}>Try extraction again</button><p>No draft values have been filled in.</p></div>}
          {phase === "done" && result?.status === "UNSUPPORTED" && <div className="empty-state"><span className="empty-icon"><Icon name="file" size={25} /></span><h3>This isn’t a prescription.</h3><p>No draft order can be prepared from this document. You can return to the queue to review another fax.</p><Link href={isUpload ? "/upload" : "/queue"} className="btn btn-ghost">Back to {isUpload ? "uploads" : "queue"}<Icon name="arrow" size={15} /></Link></div>}

          {phase === "done" && result?.extraction && result.status === "NEEDS_REVIEW" && <>
            <div className="review-progress"><div><span>Required fields confirmed</span><strong>{requiredDone} / {REQUIRED_FIELDS.length}</strong></div><div className="progress-track" role="progressbar" aria-label="Required fields confirmed" aria-valuenow={requiredDone} aria-valuemin={0} aria-valuemax={REQUIRED_FIELDS.length}><span style={{ width: `${requiredDone / REQUIRED_FIELDS.length * 100}%` }} /></div></div>
            {activeCrit.length > 0 && <details className="review-callout"><summary className="cursor-pointer font-semibold">{activeCrit.length} issue{activeCrit.length > 1 ? "s" : ""} need attention before export</summary><ul>{activeCrit.map((issue) => <li key={issue.id}>{issue.message}{issue.field && <button className="ml-2 font-semibold underline" onClick={() => selectField(issue.field!)}>Review field</button>}</li>)}</ul></details>}
            {fieldGroups.map((group) => <div className="field-group" key={group.title}><h3>{group.title}</h3>{group.keys.map((key) => {
              const f = fieldsByKey.get(key);
              if (!f) return null;
              const r = review[key];
              return <button key={key} data-field={key} className={`field-row ${selected === key ? "selected" : ""}`} onClick={() => selectField(key)} aria-pressed={selected === key}><span className="min-w-0"><span className="field-label">{FIELD_LABELS[key]}{REQUIRED_FIELDS.includes(key) && <span className="ml-1" aria-label="required">*</span>}</span><span className="field-value">{r?.currentValue || <span className="font-normal italic t-faint">Not available</span>}</span></span>{statusBadge(f, r)}</button>;
            })}</div>)}

            {selected && selectedField && selectedReview ? <section className="field-editor" id="field-editor" aria-label="Confirm selected field"><h3>{FIELD_LABELS[selected]}</h3>{selectedField.sourceText && <p>Source text: “{selectedField.sourceText}”</p>}{selectedIssues.length > 0 && <ul className="mt-2 space-y-2 text-[10px] leading-relaxed text-amber dark:text-amber-300">{selectedIssues.map((issue) => <li key={issue.id}>{issue.message}{issue.evidence?.map((e, i) => <span className="block" key={i}>“{e}”</span>)}</li>)}</ul>}<label htmlFor="field-value">Check against the original, then confirm</label><input id="field-value" key={selected} value={editDraft} onChange={(e) => setEditDraft(e.target.value)} aria-label={`${FIELD_LABELS[selected]} value`} placeholder={`Enter the value shown on the fax, e.g. ${FIELD_EXAMPLES[selected]}`} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); confirmField(); } }} /><button className="btn btn-primary" onClick={confirmField} disabled={!canConfirm}><Icon name="check" size={16} />{confirmedUnchanged ? "Confirmed against fax" : "Confirm matches fax"}</button><p>Confirm only what you can verify. Enter confirms and moves to the next required field.</p><div className="mt-2 flex flex-wrap gap-3 text-[10px]">{!REQUIRED_FIELDS.includes(selected) && selectedReview.currentValue && <button className="text-link !text-[10px]" onClick={clearValue}>Clear optional value</button>}{voiceEnabled && selectedIssues.some((i) => i.severity === "CRITICAL") && <button className="text-link !text-[10px]" onClick={() => void playVerificationCall()} disabled={voiceBusy}>{voiceBusy ? "Preparing…" : "Play verification script"}</button>}</div>{voiceNote && <p role="status">{voiceNote}</p>}</section> : <p className="px-5 py-5 text-[11px] t-dim">Select any field above to check its evidence and confirm its value. * Required for export.</p>}
          </>}

          <div className="review-export"><button className="btn btn-primary" disabled={!gate.ok || phase !== "done" || result?.status !== "NEEDS_REVIEW"} onClick={exportDraft}><Icon name="download" size={16} />{exportLocked ? requiredLeft > 0 ? `Confirm ${requiredLeft} more field${requiredLeft > 1 ? "s" : ""} to export` : "Resolve issues to export" : "Export draft JSON"}</button>{!gate.ok && phase === "done" && result?.status === "NEEDS_REVIEW" && <p>{gate.blockers.slice(0, 3).join(" · ")}{gate.blockers.length > 3 ? ` · +${gate.blockers.length - 3} more` : ""}</p>}{exported && <p className="!text-teal dark:!text-teal-300" role="status">Draft exported for further verification. No prescription was transmitted.</p>}<div className="save-bar"><button onClick={() => setShowAudit((v) => !v)} aria-expanded={showAudit}><Icon name="history" size={13} />Review history ({audit.length})</button><span role="status">{isUpload ? phase !== "done" ? "Kept in this tab only" : uploadKept ? "Saved in this tab" : "Could not save in this tab" : saveState === "loading" ? "Checking saved review…" : saveState === "saving" ? "Saving…" : saveState === "saved" ? "All changes saved" : saveState === "error" ? "Storage unavailable · not saved" : ""}</span></div>{showAudit && <div className="audit-list">{audit.length === 0 && <div>No review events yet.</div>}{audit.map((e) => <div key={e.id}><time>{new Date(e.at).toLocaleTimeString()}</time><b>{e.actor === "SYSTEM" ? "System" : "Reviewer"}</b> {e.action.toLowerCase().replaceAll("_", " ")}{e.field ? ` · ${FIELD_LABELS[e.field]}` : ""}{e.before !== undefined || e.after !== undefined ? `: ${e.before ?? "∅"} → ${e.after ?? "∅"}` : e.reason ? ` — ${e.reason}` : ""}</div>)}</div>}</div>
        </section>
      </div>
    </div>
  );
}
