import { z } from "zod";

/** The 13 prescription field keys ScriptLens tracks. */
export const FIELD_KEYS = [
  "patient_name",
  "patient_dob",
  "medication_name",
  "strength",
  "form",
  "dose",
  "route",
  "frequency",
  "duration",
  "quantity",
  "refills",
  "prescriber_name",
  "prescriber_contact",
] as const;

export const FieldKeySchema = z.enum(FIELD_KEYS);
export type FieldKey = z.infer<typeof FieldKeySchema>;

/** Fields that must be human-confirmed before a demo draft export. */
export const REQUIRED_FIELDS: FieldKey[] = [
  "patient_name",
  "medication_name",
  "strength",
  "dose",
  "route",
  "frequency",
  "prescriber_name",
];

export const FIELD_LABELS: Record<FieldKey, string> = {
  patient_name: "Patient",
  patient_dob: "Date of birth",
  medication_name: "Medication",
  strength: "Strength",
  form: "Form",
  dose: "Dose",
  route: "Route",
  frequency: "Frequency",
  duration: "Duration",
  quantity: "Quantity",
  refills: "Refills",
  prescriber_name: "Prescriber",
  prescriber_contact: "Prescriber contact",
};

export const ExtractedFieldSchema = z.object({
  key: FieldKeySchema,
  value: z.string().nullable(),
  /** Model-proposed quotation. NOT independently verified OCR. */
  sourceText: z.string().nullable(),
  page: z.number().int().positive().nullable().default(1),
  extractionStatus: z.enum(["EXTRACTED", "UNCERTAIN", "MISSING"]),
  uncertaintyReason: z.string().nullable(),
});
export type ExtractedField = z.infer<typeof ExtractedFieldSchema>;

export const ExtractionSchema = z.object({
  documentType: z.enum(["PRESCRIPTION", "OTHER", "UNKNOWN"]),
  fields: z.array(ExtractedFieldSchema),
  ambiguousStatements: z.array(z.string()).default([]),
  visibleContradictions: z
    .array(
      z.object({
        field: FieldKeySchema,
        statements: z.array(z.string()).min(2),
      }),
    )
    .default([]),
  extractionNotes: z.array(z.string()).default([]),
});
export type Extraction = z.infer<typeof ExtractionSchema>;

/**
 * Normalize model output into exactly one entry per schema key.
 * - Duplicate keys => fail closed (throw).
 * - Omitted keys => MISSING with null value (never invented defaults).
 * - A MISSING/UNCERTAIN status with a non-null value is contradictory =>
 *   keep the value visible but downgrade nothing silently; mark UNCERTAIN.
 */
export function normalizeExtraction(raw: Extraction): Extraction {
  const seen = new Map<FieldKey, ExtractedField>();
  for (const f of raw.fields) {
    if (seen.has(f.key)) {
      throw new Error(`Duplicate field key from model: ${f.key}`);
    }
    let field = { ...f };
    if (field.extractionStatus === "MISSING" && field.value !== null) {
      field = {
        ...field,
        extractionStatus: "UNCERTAIN",
        uncertaintyReason:
          field.uncertaintyReason ??
          "Model marked field missing but supplied a value; treat as uncertain.",
      };
    }
    if (field.value !== null && field.value.trim() === "") {
      field = { ...field, value: null, extractionStatus: "MISSING" };
    }
    seen.set(field.key, field);
  }
  const fields: ExtractedField[] = FIELD_KEYS.map(
    (key) =>
      seen.get(key) ?? {
        key,
        value: null,
        sourceText: null,
        page: 1,
        extractionStatus: "MISSING" as const,
        uncertaintyReason: "Not returned by extraction.",
      },
  );
  return { ...raw, fields };
}
