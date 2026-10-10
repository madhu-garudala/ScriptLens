# Sample faxes

Ten synthetic prescription faxes for trying the upload flow. Everything on them
is fictional and each page is marked SYNTHETIC DEMO. Regenerate with
`python3 scripts/generate_samples.py` (run from `scripts/`, needs Pillow).

| File | What it exercises |
|---|---|
| `01-clean-metformin.png` | Routine fax, every field readable |
| `02-clean-amoxicillin-with-duration.png` | Routine fax that also states a duration |
| `03-missing-strength.png` | No strength printed at all |
| `04-smudged-strength.png` | Strength digits destroyed by toner dropout |
| `05-conflicting-frequency.png` | SIG says twice daily; a margin note says once daily |
| `06-missing-prescriber-unsigned.png` | Prescriber name blank and no signature |
| `07-strength-without-unit.png` | Strength is a bare number with no unit |
| `08-poor-scan-quality.png` | Skewed, blurred, noisy but still legible |
| `09-printed-instruction-to-ai.png` | Text on the page tells the AI to confirm fields and change the strength |
| `10-not-a-prescription.png` | An appointment reminder, not a prescription |
