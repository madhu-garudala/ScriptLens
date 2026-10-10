import type { FieldKey } from "./schema";
import type { AnalyzeResult, AuditEvent, ReviewEntry } from "./types";

/**
 * Uploaded faxes are kept in this browser tab only (sessionStorage): they
 * survive moving between pages and are gone when the tab closes. Nothing here
 * is ever sent to review storage — uploads are not persisted server-side.
 */
export type SessionUpload = { id: string; name: string; dataUrl: string; addedAt: string };
export type UploadReviewState = {
  result: AnalyzeResult;
  review: Partial<Record<FieldKey, ReviewEntry>>;
  audit: AuditEvent[];
  exported: boolean;
};

const LIST_KEY = "scriptlens-uploads";
const reviewKey = (id: string) => `scriptlens-upload-review-${id}`;

export function listUploads(): SessionUpload[] {
  try {
    const raw = sessionStorage.getItem(LIST_KEY);
    return raw ? (JSON.parse(raw) as SessionUpload[]) : [];
  } catch {
    return [];
  }
}

export function getUpload(id: string): SessionUpload | null {
  return listUploads().find((u) => u.id === id) ?? null;
}

/** Throws if the tab's storage is full. */
export function addUpload(name: string, dataUrl: string): SessionUpload {
  const upload: SessionUpload = {
    id: crypto.randomUUID().slice(0, 8),
    name,
    dataUrl,
    addedAt: new Date().toISOString(),
  };
  sessionStorage.setItem(LIST_KEY, JSON.stringify([...listUploads(), upload]));
  return upload;
}

export function removeUpload(id: string): void {
  try {
    sessionStorage.setItem(LIST_KEY, JSON.stringify(listUploads().filter((u) => u.id !== id)));
    sessionStorage.removeItem(reviewKey(id));
  } catch {
    /* non-fatal */
  }
}

export function readUploadReview(id: string): UploadReviewState | null {
  try {
    const raw = sessionStorage.getItem(reviewKey(id));
    return raw ? (JSON.parse(raw) as UploadReviewState) : null;
  } catch {
    return null;
  }
}

/** Returns false if the state could not be kept (storage full or unavailable). */
export function writeUploadReview(id: string, state: UploadReviewState): boolean {
  try {
    sessionStorage.setItem(reviewKey(id), JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
