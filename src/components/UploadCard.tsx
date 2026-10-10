"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { addUpload } from "@/lib/sessionUploads";
import { Icon } from "./Icon";

export function UploadCard() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [attested, setAttested] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);

  function onFile(file: File) {
    setErr(null);
    if (!attested) { setErr("Confirm that your image contains synthetic data before uploading."); return; }
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) { setErr("Please choose a PNG, JPEG, or WEBP image."); return; }
    if (file.size > 5 * 1024 * 1024) { setErr("This file is too large. Choose an image smaller than 5 MB."); return; }
    setBusy(true);
    const reader = new FileReader();
    reader.onerror = () => { setBusy(false); setErr("This image could not be read. Please try another file."); };
    reader.onload = () => {
      try {
        const upload = addUpload(file.name, String(reader.result));
        router.push(`/review/upload?u=${upload.id}`);
      } catch {
        setBusy(false);
        setErr("This tab has no room for another upload. Remove an earlier upload and try again.");
      }
    };
    reader.readAsDataURL(file);
  }

  return <section className="upload-card">
    <div className="upload-card-heading"><h2>Upload a document</h2><span className="badge badge-ai">Image files</span></div>
    <label className={`attestation ${attested ? "checked" : ""}`}><input type="checkbox" checked={attested} onChange={(e) => setAttested(e.target.checked)} /><span>I confirm this is a synthetic image.<small>This document contains no real patient information.</small></span><Icon name="shield" size={21} /></label>
    <div className={`dropzone ${dragging ? "dragging" : ""}`} onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false); }} onDrop={(e) => { e.preventDefault(); setDragging(false); if (busy) return; if (e.dataTransfer.files.length > 1) { setErr("Please upload one image at a time."); return; } const file = e.dataTransfer.files[0]; if (file) onFile(file); }}>
      <span className="upload-symbol"><Icon name="upload" size={30} /></span><h3>{busy ? "Opening your document…" : dragging ? "Drop your image here" : "A fresh perspective starts here"}</h3><p>Drag and drop your fax image, or choose a file.</p><input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" aria-label="Choose fax image" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.currentTarget.value = ""; }} /><button className="btn btn-primary" disabled={!attested || busy} onClick={() => inputRef.current?.click()}><Icon name="upload" size={16} />{busy ? "Opening…" : "Choose image"}</button><small>PNG, JPG or WEBP · Up to 5 MB</small>{!attested && <span className="upload-hint">Confirm the synthetic-data checkbox above to get started.</span>}
    </div>
    {err && <div className="upload-error" role="alert"><Icon name="alert" size={18} />{err}</div>}
    <div className="upload-bottom"><Icon name="file" size={16} />You’ll preview the original before starting extraction.</div>
  </section>;
}
