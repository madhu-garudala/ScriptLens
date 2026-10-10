"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listUploads, readUploadReview, removeUpload, type SessionUpload } from "@/lib/sessionUploads";

/** Faxes uploaded in this tab, so a review can be left and picked up again. */
export function SessionUploads() {
  const [uploads, setUploads] = useState<SessionUpload[] | null>(null);

  useEffect(() => {
    setUploads(listUploads());
  }, []);

  if (!uploads || uploads.length === 0) return null;

  function status(id: string): { label: string; badge: string } {
    const saved = readUploadReview(id);
    if (!saved) return { label: "Not processed", badge: "badge-ai" };
    if (saved.result.status === "UNSUPPORTED") return { label: "Not a prescription", badge: "badge-ai" };
    if (saved.exported) return { label: "Draft exported", badge: "badge-confirmed" };
    return { label: "In review", badge: "badge-review" };
  }

  return (
    <section className="mt-8">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold t-strong">Your uploads</h2>
        <span className="text-xs t-faint">Kept in this tab only · cleared when the tab closes</span>
      </div>
      <ul className="mt-2 divide-y divide-slate-100 rounded-xl border bordered panel dark:divide-white/5">
        {[...uploads].reverse().map((u) => {
          const s = status(u.id);
          return (
            <li key={u.id} className="session-upload-row flex items-center gap-3 px-3 py-2.5 text-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u.dataUrl} alt="" className="h-12 w-9 shrink-0 rounded border bordered bg-white object-cover object-top" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium t-strong">{u.name}</div>
                <div className="text-[11px] t-faint">Added {new Date(u.addedAt).toLocaleTimeString()}</div>
              </div>
              <span className={`badge ${s.badge}`}>{s.label}</span>
              <Link href={`/review/upload?u=${u.id}`} className="text-xs font-medium text-teal hover:underline dark:text-teal-400">
                Open
              </Link>
              <button
                className="text-xs t-faint hover:text-danger"
                onClick={() => {
                  removeUpload(u.id);
                  setUploads(listUploads());
                }}
              >
                Remove
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
