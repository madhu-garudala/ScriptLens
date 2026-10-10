import { REQUIRED_FIELDS, FIELD_LABELS, type Extraction, type FieldKey } from "./schema";
import type { ReviewEntry, RxNormCheck, ValidationIssue } from "./types";

let seq = 0;
const iid = (p: string) => `${p}-${++seq}`;

/**
 * Deterministic validation. Pure code, no model calls, no network.
 * Produces blocking/non-blocking issues from the extraction + RxNorm result.
 */
export function validateExtraction(
  extraction: Extraction,
  rxnorm: RxNormCheck | null,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const byKey = new Map(extraction.fields.map((f) => [f.key, f]));

  if (extraction.documentType !== "PRESCRIPTION") {
    issues.push({
      id: iid("doc"),
      field: null,
      type: "UNSUPPORTED_DOCUMENT",
      severity: "CRITICAL",
      message:
        "This document was not identified as a prescription. No draft order can be prepared from it.",
    });
    return issues;
  }

  for (const key of REQUIRED_FIELDS) {
    const f = byKey.get(key);
    if (!f || f.value === null || f.extractionStatus === "MISSING") {
      issues.push({
        id: iid("missing"),
        field: key,
        type: "MISSING",
        severity: "CRITICAL",
        message: `${FIELD_LABELS[key]} is missing or not legible on the fax. Human entry from the original is required.`,
        evidence: f?.uncertaintyReason ? [f.uncertaintyReason] : undefined,
      });
    } else if (f.extractionStatus === "UNCERTAIN") {
      issues.push({
        id: iid("uncertain"),
        field: key,
        type: "UNCERTAIN",
        severity: "CRITICAL",
        message: `${FIELD_LABELS[key]} could not be read reliably. Verify against the original before use.`,
        evidence: [f.uncertaintyReason, f.sourceText].filter(Boolean) as string[],
      });
    }
  }

  for (const c of extraction.visibleContradictions) {
    issues.push({
      id: iid("conflict"),
      field: c.field,
      type: "CONFLICT",
      severity: "CRITICAL",
      message: `The fax contains contradictory statements about ${FIELD_LABELS[c.field].toLowerCase()}. A human must adjudicate; the system will not choose.`,
      evidence: c.statements,
    });
  }

  // Unit sanity: strength/dose strings present but with no visible unit/token.
  const strength = byKey.get("strength");
  if (
    strength?.value &&
    strength.extractionStatus === "EXTRACTED" &&
    !/[a-zA-Zµ%]/.test(strength.value)
  ) {
    issues.push({
      id: iid("unit"),
      field: "strength",
      type: "FORMAT_INVALID",
      severity: "CRITICAL",
      message:
        "Strength has a number but no visible unit. The unit must be confirmed from the original — it will not be inferred.",
      evidence: [strength.value],
    });
  }

  // RxNorm reference check (entity verification, not clinical judgment).
  if (rxnorm) {
    if (rxnorm.status === "NO_MATCH") {
      issues.push({
        id: iid("ref"),
        field: "medication_name",
        type: "REFERENCE_MISMATCH",
        severity: "CRITICAL",
        message: `"${rxnorm.query}" did not confidently match any RxNorm drug concept. The name may be misread — verify against the original.`,
        evidence: rxnorm.bestMatch ? [`Closest RxNorm candidate: ${rxnorm.bestMatch}`] : undefined,
      });
    } else if (rxnorm.status === "UNAVAILABLE") {
      issues.push({
        id: iid("ref"),
        field: "medication_name",
        type: "REFERENCE_UNAVAILABLE",
        severity: "WARNING",
        message: "RxNorm could not be reached; the drug name is unverified (not invalid).",
      });
    }
  }

  for (const note of extraction.ambiguousStatements) {
    issues.push({
      id: iid("amb"),
      field: null,
      type: "UNCERTAIN",
      severity: "WARNING",
      message: `Ambiguous statement on fax: ${note}`,
    });
  }

  return issues;
}

/**
 * Export gate. An issue tied to a field is considered RESOLVED once a human
 * has confirmed that field after the issue was raised (reviewed=true).
 * Document-level CRITICAL issues (null field) always block.
 */
export function activeCriticalIssues(
  issues: ValidationIssue[],
  review: Partial<Record<FieldKey, ReviewEntry>>,
): ValidationIssue[] {
  return issues.filter((i) => {
    if (i.severity !== "CRITICAL") return false;
    if (i.field === null) return true;
    const r = review[i.field];
    return !(r && r.reviewed && r.currentValue && r.currentValue.trim());
  });
}

export function canExportDraft(
  issues: ValidationIssue[],
  review: Partial<Record<FieldKey, ReviewEntry>>,
): { ok: boolean; blockers: string[] } {
  const blockers: string[] = [];
  for (const k of REQUIRED_FIELDS) {
    const r = review[k];
    if (!r || !r.currentValue || !r.currentValue.trim()) {
      blockers.push(`${FIELD_LABELS[k]} has no value`);
    } else if (!r.reviewed) {
      blockers.push(`${FIELD_LABELS[k]} not human-confirmed`);
    }
  }
  const act = activeCriticalIssues(issues, review);
  for (const i of act) {
    if (i.field === null) blockers.push(i.message);
  }
  return { ok: blockers.length === 0, blockers };
}
