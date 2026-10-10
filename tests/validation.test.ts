import { describe, expect, it } from "vitest";
import { normalizeExtraction, type Extraction, type FieldKey } from "../src/lib/schema";
import { activeCriticalIssues, canExportDraft, validateExtraction } from "../src/lib/validate";
import type { ReviewEntry } from "../src/lib/types";

function makeExtraction(partial?: Partial<Record<FieldKey, string | null>>, extra?: Partial<Extraction>): Extraction {
  const base: Record<FieldKey, string | null> = {
    patient_name: "Avery Morgan",
    patient_dob: "1990-01-14",
    medication_name: "Lisinopril",
    strength: "10 mg",
    form: "tablet",
    dose: "1 tablet",
    route: "oral",
    frequency: "once daily",
    duration: null,
    quantity: "30",
    refills: "0",
    prescriber_name: "Dr. Riley Chen",
    prescriber_contact: null,
    ...partial,
  };
  return normalizeExtraction({
    documentType: "PRESCRIPTION",
    fields: (Object.keys(base) as FieldKey[]).map((key) => ({
      key,
      value: base[key],
      sourceText: base[key] ? `${key}: ${base[key]}` : null,
      page: 1,
      extractionStatus: base[key] === null ? "MISSING" : "EXTRACTED",
      uncertaintyReason: null,
    })),
    ambiguousStatements: [],
    visibleContradictions: [],
    extractionNotes: [],
    ...extra,
  });
}

function fullReview(ext: Extraction, reviewed = true): Partial<Record<FieldKey, ReviewEntry>> {
  const r: Partial<Record<FieldKey, ReviewEntry>> = {};
  for (const f of ext.fields) {
    r[f.key] = {
      key: f.key,
      aiValue: f.value,
      currentValue: f.value,
      reviewed,
      correctedByHuman: false,
    };
  }
  return r;
}

describe("deterministic validation + export gate", () => {
  it("missing/uncertain critical strength raises a CRITICAL issue and blocks export", () => {
    const ext = makeExtraction({ strength: null });
    const issues = validateExtraction(ext, null);
    expect(issues.some((i) => i.field === "strength" && i.severity === "CRITICAL")).toBe(true);
    const gate = canExportDraft(issues, fullReview(ext, true));
    expect(gate.ok).toBe(false); // strength has no value even though "reviewed"
  });

  it("a human correction without explicit confirmation still blocks export", () => {
    const ext = makeExtraction({ strength: null });
    const issues = validateExtraction(ext, null);
    const review = fullReview(ext, true);
    review.strength = {
      key: "strength",
      aiValue: null,
      currentValue: "10 mg",
      reviewed: false, // corrected but NOT confirmed
      correctedByHuman: true,
    };
    expect(canExportDraft(issues, review).ok).toBe(false);
  });

  it("all required fields confirmed with no active criticals enables export", () => {
    const ext = makeExtraction({ strength: null });
    const issues = validateExtraction(ext, null);
    const review = fullReview(ext, true);
    review.strength = {
      key: "strength",
      aiValue: null,
      currentValue: "10 mg",
      reviewed: true,
      correctedByHuman: true,
    };
    expect(activeCriticalIssues(issues, review)).toHaveLength(0);
    expect(canExportDraft(issues, review).ok).toBe(true);
  });

  it("visible contradictions stay flagged until the affected field is human-confirmed", () => {
    const ext = makeExtraction(undefined, {
      visibleContradictions: [
        { field: "frequency", statements: ["Take 1 tablet daily", "corrected: take 2 tablets daily"] },
      ],
    });
    const issues = validateExtraction(ext, null);
    const conflict = issues.find((i) => i.type === "CONFLICT");
    expect(conflict?.severity).toBe("CRITICAL");
    expect(conflict?.evidence).toHaveLength(2);
    const unconfirmed = fullReview(ext, false);
    expect(activeCriticalIssues(issues, unconfirmed).length).toBeGreaterThan(0);
  });

  it("non-prescription documents are rejected and always block", () => {
    const ext = makeExtraction(undefined, { documentType: "OTHER" });
    const issues = validateExtraction(ext, null);
    expect(issues.some((i) => i.type === "UNSUPPORTED_DOCUMENT" && i.severity === "CRITICAL")).toBe(true);
    expect(canExportDraft(issues, fullReview(ext, true)).ok).toBe(false);
  });

  it("duplicate field keys from the model fail closed", () => {
    expect(() =>
      normalizeExtraction({
        documentType: "PRESCRIPTION",
        fields: [
          { key: "strength", value: "10 mg", sourceText: null, page: 1, extractionStatus: "EXTRACTED", uncertaintyReason: null },
          { key: "strength", value: "40 mg", sourceText: null, page: 1, extractionStatus: "EXTRACTED", uncertaintyReason: null },
        ],
        ambiguousStatements: [],
        visibleContradictions: [],
        extractionNotes: [],
      }),
    ).toThrow(/Duplicate/);
  });

  it("MISSING status with a non-null value is downgraded to UNCERTAIN, never trusted", () => {
    const ext = normalizeExtraction({
      documentType: "PRESCRIPTION",
      fields: [
        { key: "strength", value: "10 mg", sourceText: null, page: 1, extractionStatus: "MISSING", uncertaintyReason: null },
      ],
      ambiguousStatements: [],
      visibleContradictions: [],
      extractionNotes: [],
    });
    const f = ext.fields.find((x) => x.key === "strength")!;
    expect(f.extractionStatus).toBe("UNCERTAIN");
  });

  it("strength with digits but no unit raises FORMAT_INVALID (unit never inferred)", () => {
    const ext = makeExtraction({ strength: "10" });
    const issues = validateExtraction(ext, null);
    expect(issues.some((i) => i.type === "FORMAT_INVALID" && i.field === "strength")).toBe(true);
  });

  it("RxNorm NO_MATCH flags the medication name; UNAVAILABLE warns without blocking by itself", () => {
    const ext = makeExtraction();
    const noMatch = validateExtraction(ext, {
      status: "NO_MATCH", query: "Lisinoprril", bestMatch: null, rxcui: null, score: 10, note: "",
    });
    expect(noMatch.some((i) => i.type === "REFERENCE_MISMATCH" && i.severity === "CRITICAL")).toBe(true);
    const unavailable = validateExtraction(ext, {
      status: "UNAVAILABLE", query: "Lisinopril", bestMatch: null, rxcui: null, score: null, note: "",
    });
    expect(unavailable.some((i) => i.type === "REFERENCE_UNAVAILABLE" && i.severity === "WARNING")).toBe(true);
    expect(canExportDraft(unavailable, fullReview(ext, true)).ok).toBe(true);
  });
});
