---
name: document-parsing
description: Multi-format text extraction for this repo — extractText() over PDF/DOCX/XLSX/images/text with gpt-4o vision OCR and a 50MB cap. Use when adding a file type or changing parsing.
---

# Document parsing (this repo)

## When to use
Adding a supported file type, or changing how uploaded files become text.

## `extractText()` (`src/lib/file-parser.ts`)
| Type | Library |
|---|---|
| PDF | pdf-parse |
| DOC/DOCX | mammoth |
| XLS/XLSX | xlsx |
| JPG/PNG | gpt-4o vision OCR |
| txt / md / json | direct |

- Enforces the **accepted-types allowlist** and a **50 MB cap** — keep both when adding a type.
- Output is later run through `sanitizeText()` (strips null bytes/control chars) before chunking — don't duplicate that here.

## Flow context
Parsing happens at `POST /api/documents/parse` (server-side extraction) and feeds the ingestion pipeline (see `inngest-ingestion`).

## Anchors
- `src/lib/file-parser.ts`, `src/app/api/documents/parse/route.ts`
- `chunkText()` / `sanitizeText()` in `src/lib/utils.ts`

## Gotchas
- Image OCR is a gpt-4o call — it costs tokens and adds latency; gate it to image types only.
