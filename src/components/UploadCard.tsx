"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

/**
 * Upload a synthetic fax. The file is kept in sessionStorage as a data URL
 * (demo-only, synthetic-only) so /review/upload can analyze + display it.
 */
export function UploadCard() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [attested, setAttested] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onFile(file: File) {
    setErr(null);
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setErr("Use a PNG, JPEG, or WEBP image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErr("File exceeds the 5 MB demo limit.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        sessionStorage.setItem("scriptlens-upload", String(reader.result));
        sessionStorage.setItem("scriptlens-upload-name", file.name);
        router.push("/review/upload");
      } catch {
        setErr("Could not stage the file in this browser (storage full?).");
      }
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="rounded-lg border border-dashed border-slate-300 panel p-5 dark:border-slate-700">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-sm font-semibold t-strong">Upload a synthetic fax</div>
          <label className="mt-2 flex items-start gap-2 text-xs t-body">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={attested}
              onChange={(e) => setAttested(e.target.checked)}
            />
            <span>
              This image is synthetic and contains <b>no real patient information</b>.
            </span>
          </label>
          {err && <div className="mt-2 text-xs font-medium text-danger">{err}</div>}
        </div>
        <div>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onFile(f);
              e.currentTarget.value = "";
            }}
          />
          <button
            className="btn btn-ghost"
            disabled={!attested}
            onClick={() => inputRef.current?.click()}
            title={attested ? "Choose an image" : "Confirm the synthetic-data attestation first"}
          >
            Choose image…
          </button>
        </div>
      </div>
    </div>
  );
}
