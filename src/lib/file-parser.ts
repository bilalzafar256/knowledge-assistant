/**
 * Server-side file text extraction.
 * Supports: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG, TXT, MD
 */

import { generateText } from "ai";
import { openai } from "./ai";

export type SupportedMimeType =
  | "application/pdf"
  | "application/msword"
  | "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  | "application/vnd.ms-excel"
  | "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  | "image/jpeg"
  | "image/png"
  | "text/plain"
  | "text/markdown"
  | "application/json";

export const ACCEPTED_MIME_TYPES: SupportedMimeType[] = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
  "text/plain",
  "text/markdown",
  "application/json",
];

export const ACCEPTED_EXTENSIONS = [
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".jpg",
  ".jpeg",
  ".png",
  ".txt",
  ".md",
  ".json",
];

export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export function isSupportedType(mimeType: string): mimeType is SupportedMimeType {
  return ACCEPTED_MIME_TYPES.includes(mimeType as SupportedMimeType);
}

/**
 * Extract plain text from a file buffer based on its MIME type.
 */
export async function extractText(
  buffer: Buffer,
  mimeType: string,
  filename: string
): Promise<string> {
  if (mimeType === "application/pdf") {
    return extractPdf(buffer);
  }

  if (
    mimeType === "application/msword" ||
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return extractWord(buffer);
  }

  if (
    mimeType === "application/vnd.ms-excel" ||
    mimeType ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) {
    return extractExcel(buffer);
  }

  if (mimeType === "image/jpeg" || mimeType === "image/png") {
    return extractImageText(buffer, mimeType, filename);
  }

  // Plain text types
  return buffer.toString("utf-8");
}

// ── PDF ──────────────────────────────────────────────────────────────────────

async function extractPdf(buffer: Buffer): Promise<string> {
  // Import the internal module directly to skip pdf-parse's self-test
  // which tries to open './test/data/05-versions-space.pdf' on require
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require("pdf-parse/lib/pdf-parse.js") as (
    buf: Buffer
  ) => Promise<{ text: string }>;
  const data = await pdfParse(buffer);
  const text = data.text.trim();
  if (!text) throw new Error("No text found in PDF. It may be a scanned image-only PDF.");
  return text;
}

// ── Word (DOC / DOCX) ────────────────────────────────────────────────────────

async function extractWord(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  const text = result.value.trim();
  if (!text) throw new Error("No text found in Word document.");
  return text;
}

// ── Excel (XLS / XLSX) ───────────────────────────────────────────────────────

async function extractExcel(buffer: Buffer): Promise<string> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(buffer, { type: "buffer" });

  const lines: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
    if (csv.trim()) {
      lines.push(`## Sheet: ${sheetName}\n${csv}`);
    }
  }

  const text = lines.join("\n\n").trim();
  if (!text) throw new Error("No content found in spreadsheet.");
  return text;
}

// ── Images (JPG / PNG) via OpenAI Vision ────────────────────────────────────

async function extractImageText(
  buffer: Buffer,
  mimeType: "image/jpeg" | "image/png",
  filename: string
): Promise<string> {
  // Pass raw bytes + explicit mediaType rather than a `data:` URL string.
  // The AI SDK's downloadAssets path coerces any string to `new URL(...)`,
  // which succeeds for data URLs and then fails SSRF validation
  // ("URL scheme must be http or https, got data:"). Uint8Array data
  // bypasses the download path entirely.
  const { text } = await generateText({
    model: openai("gpt-4o"),
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            image: new Uint8Array(buffer),
            mediaType: mimeType,
          },
          {
            type: "text",
            text: `Extract all text and content from this image (filename: ${filename}). If it contains a document, table, diagram, or chart, describe the structure and extract all readable text. Return only the extracted content — no commentary.`,
          },
        ],
      },
    ],
  });

  if (!text.trim()) throw new Error("No text could be extracted from the image.");
  return text.trim();
}
