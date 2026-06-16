/**
 * Download Vectara's Open RAG Benchmark from Hugging Face.
 *
 * Dataset: https://huggingface.co/datasets/vectara/open_ragbench
 * Layout (BEIR-style):
 *   official/pdf/arxiv/
 *   ├── queries.json   (3045 Q UUIDs → query text + type + source modality)
 *   ├── qrels.json     (Q UUID → { doc_id, section_id })
 *   ├── answers.json   (Q UUID → answer text)
 *   ├── pdf_urls.json  (1000 paper_id → arXiv URL)   ← used to enumerate corpus
 *   └── corpus/{paper_id}.json  (per-paper sections + tables + images)
 *
 * Writes to evals/benchmarks/open-ragbench/data/ (gitignored).
 *
 * Usage:
 *   node evals/benchmarks/open-ragbench/download.mjs              # download everything
 *   node evals/benchmarks/open-ragbench/download.mjs --limit 50   # first 50 papers only
 *   node evals/benchmarks/open-ragbench/download.mjs --positives  # only the ~400 papers with Q&A
 */
import { mkdirSync, existsSync, writeFileSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dir = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dir, "data");
const CORPUS_DIR = join(DATA_DIR, "corpus");

const HF_BASE =
  "https://huggingface.co/datasets/vectara/open_ragbench/resolve/main/pdf/arxiv";

// ── CLI args ──────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
function arg(name, def) {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? def : argv[i + 1];
}
const flag = (name) => argv.includes(`--${name}`);
const LIMIT = arg("limit", null) ? parseInt(arg("limit"), 10) : null;
const POSITIVES_ONLY = flag("positives");
const CONCURRENCY = parseInt(arg("concurrency", "8"), 10);

mkdirSync(CORPUS_DIR, { recursive: true });

async function fetchToFile(url, outPath) {
  if (existsSync(outPath) && statSync(outPath).size > 0) return "skip";
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 404) return "404";
    throw new Error(`HTTP ${res.status} fetching ${url}`);
  }
  const text = await res.text();
  writeFileSync(outPath, text);
  return "ok";
}

// ── Step 1: top-level files (required — fail loud on 404) ────────────────────
const topFiles = ["queries.json", "qrels.json", "answers.json", "pdf_urls.json"];
console.log("▸ Downloading top-level BEIR files…");
for (const name of topFiles) {
  const out = join(DATA_DIR, name);
  const r = await fetchToFile(`${HF_BASE}/${name}`, out);
  if (r === "404") {
    console.error(`  ✗ ${name}: 404 from HuggingFace — dataset layout may have changed`);
    process.exit(1);
  }
  console.log(`  ${r === "skip" ? "·" : "✓"} ${name}${r === "skip" ? " (cached)" : ""}`);
}

// ── Step 2: figure out which papers to download ──────────────────────────────
const pdfUrls = JSON.parse(readFileSync(join(DATA_DIR, "pdf_urls.json"), "utf8"));
const qrels = JSON.parse(readFileSync(join(DATA_DIR, "qrels.json"), "utf8"));

const positivePaperIds = new Set();
for (const q of Object.values(qrels)) {
  if (q?.doc_id) positivePaperIds.add(q.doc_id);
}

let paperIds = Object.keys(pdfUrls);
if (POSITIVES_ONLY) {
  paperIds = paperIds.filter((id) => positivePaperIds.has(id));
}
if (LIMIT) {
  // Always include some positives so smoke tests have ground-truth coverage.
  const pos = paperIds.filter((id) => positivePaperIds.has(id));
  const neg = paperIds.filter((id) => !positivePaperIds.has(id));
  const posTake = Math.min(pos.length, Math.ceil(LIMIT * 0.6));
  const negTake = Math.min(neg.length, LIMIT - posTake);
  paperIds = [...pos.slice(0, posTake), ...neg.slice(0, negTake)];
}

console.log(
  `▸ Downloading corpus: ${paperIds.length} papers ` +
    `(of ${Object.keys(pdfUrls).length} total · ${positivePaperIds.size} with Q&A)`
);

// ── Step 3: parallel corpus fetch ─────────────────────────────────────────────
let okCount = 0;
let skipCount = 0;
let missCount = 0;
let failCount = 0;
let cursor = 0;

async function worker(_id) {
  while (true) {
    const i = cursor++;
    if (i >= paperIds.length) return;
    const paperId = paperIds[i];
    const safe = paperId.replace(/[^a-zA-Z0-9._-]/g, "_");
    const out = join(CORPUS_DIR, `${safe}.json`);
    try {
      const r = await fetchToFile(`${HF_BASE}/corpus/${encodeURIComponent(paperId)}.json`, out);
      if (r === "ok") okCount++;
      else if (r === "skip") skipCount++;
      else if (r === "404") missCount++;
    } catch (e) {
      failCount++;
      console.warn(`  ✗ ${paperId}: ${e.message}`);
    }
    if ((i + 1) % 50 === 0 || i + 1 === paperIds.length) {
      process.stdout.write(
        `\r  [${i + 1}/${paperIds.length}] ok=${okCount} cached=${skipCount} missing=${missCount} fail=${failCount}   `
      );
    }
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => worker(i)));
console.log();
console.log(`✓ Done. ${okCount} downloaded, ${skipCount} cached, ${missCount} 404s, ${failCount} failed.`);
console.log(`  Data → ${DATA_DIR}`);
