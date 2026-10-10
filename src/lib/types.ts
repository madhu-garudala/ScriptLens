import type { Extraction, FieldKey } from "./schema";

export type IssueSeverity = "CRITICAL" | "WARNING" | "INFO";

export type IssueType =
  | "MISSING"
  | "UNCERTAIN"
  | "CONFLICT"
  | "FORMAT_INVALID"
  | "REFERENCE_MISMATCH"
  | "REFERENCE_UNAVAILABLE"
  | "UNSUPPORTED_DOCUMENT"
  | "PARSE_FAILURE";

export type ValidationIssue = {
  id: string;
  field: FieldKey | null;
  type: IssueType;
  severity: IssueSeverity;
  message: string;
  evidence?: string[];
};

export type RxNormCheck = {
  status: "MATCH" | "NO_MATCH" | "UNAVAILABLE" | "SKIPPED";
  query: string | null;
  bestMatch: string | null;
  rxcui: string | null;
  score: number | null;
  note: string;
};

export type AnalyzeResult = {
  documentId: string;
  status: "NEEDS_REVIEW" | "UNSUPPORTED" | "PROCESSING_FAILED";
  extraction: Extraction | null;
  issues: ValidationIssue[];
  rxnorm: RxNormCheck | null;
  model: string;
  latencyMs: number;
  prismStatus: "RECEIVED" | "FAILED" | "NOT_CONFIGURED";
  error?: { code: string; message: string; safeToRetry: boolean };
  /** True when this is a stored earlier extraction, not a model call made for this request. */
  cached?: boolean;
  cachedAt?: string;
};

export type ReviewEntry = {
  key: FieldKey;
  aiValue: string | null;
  currentValue: string | null;
  reviewed: boolean; // set ONLY by explicit human confirmation
  correctedByHuman: boolean;
  reviewedAt?: string;
};

export type AuditEvent = {
  id: string;
  documentId: string;
  at: string;
  actor: "DEMO_PHARMACIST" | "SYSTEM";
  action: "EXTRACT" | "FLAG" | "EDIT" | "CONFIRM" | "RESOLVE_ISSUE" | "EXPORT_DRAFT";
  field?: FieldKey;
  before?: string | null;
  after?: string | null;
  reason?: string;
};
