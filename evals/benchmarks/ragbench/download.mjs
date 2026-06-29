/**
 * Download RAGBench (galileo-ai/ragbench) rows into local JSON, as the THIRD
 * eval surface — a multi-domain enterprise set (finance / IT-support / biomedical
 * / general / legal) alongside the arXiv Open RAG Benchmark and CUAD.
 *
 * RAGBench is already in RAG format: each example carries its own gold `documents`
 * (context passages), a reference `response`, and sentence-level relevance labels
 * (`all_relevant_sentence_keys` + `documents_sentences`). That single shape lets
 * one adapter cover all five domains — see docs/GO_LIVE_READINESS.md §3a.
 *
 * Source: galileo-ai/ragbench on HuggingFace (renamed from rungalileo/ragbench).
 * Public dataset — fetched via the no-auth datasets-server /rows API (100/page).
 *
 * Config → domain map (12 configs total):
 *   finance      tatqa, finqa
 *   IT-support   techqa, emanual, delucionqa
 *   biomedical   covidqa, pubmedqa
 *   general      hotpotqa, msmarco, expertqa, hagrid
 *   legal        cuad        ← excluded by default (we have a dedicated CUAD adapter)
 *
 * Usage:
 *   node evals/benchmarks/ragbench/download.mjs                 # default domain spread
 *   node evals/benchmarks/ragbench/download.mjs --configs tatqa,techqa --per-config 80
 *   node evals/benchmarks/ragbench/download.mjs --split validation
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dir = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dir, "data");

const DATASET = "galileo-ai/ragbench";
const PAGE = 100; // datasets-server hard cap on ?length=

// One representative config per enterprise domain → all 5 domains in one run.
// (cuad omitted: covered by evals/benchmarks/cuad/. Override with --configs.)
const DEFAULT_CONFIGS = ["tatqa", "techqa", "covidqa", "hotpotqa", "delucionqa"];

const argv = process.argv.slice(2);
function arg(name, def) {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? def : argv[i + 1];
}
const CONFIGS = (arg("configs", DEFAULT_CONFIGS.join(","))).split(",").map((s) => s.trim()).filter(Boolean);
const SPLIT = arg("split", "test");
const PER_CONFIG = parseInt(arg("per-config", "60"), 10);

// Keep only the fields the ingester + golden importer need; drop the heavy
// annotation columns (trulens/ragas/gpt3 scores) so the cache stays small.
const KEEP = [
  "id",
  "question",
  "documents",
  "response",
  "dataset_name",
  "documents_sentences",
  "all_relevant_sentence_keys",
];

async function fetchRows(config, split, limit) {
  const rows = [];
  for (let offset = 0; offset < limit; offset += PAGE) {
    const length = Math.min(PAGE, limit - offset);
    const url =
      `https://datasets-server.huggingface.co/rows?dataset=${encodeURIComponent(DATASET)}` +
      `&config=${config}&split=${split}&offset=${offset}&length=${length}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HF ${res.status} for ${config}/${split}@${offset}: ${await res.text()}`);
    const data = await res.json();
    if (data.error) throw new Error(`HF error for ${config}/${split}: ${data.error}`);
    const batch = data.rows ?? [];
    for (const r of batch) {
      const row = r.row;
      const slim = {};
      for (const k of KEEP) slim[k] = row[k];
      rows.push(slim);
    }
    if (batch.length < length) break; // ran out of rows
  }
  return rows;
}

mkdirSync(DATA_DIR, { recursive: true });
console.log(`▸ Downloading RAGBench (${DATASET}) — split=${SPLIT}, per-config=${PER_CONFIG}`);
console.log(`▸ Configs: ${CONFIGS.join(", ")}`);

let grandTotal = 0;
for (const config of CONFIGS) {
  process.stdout.write(`  · ${config} … `);
  const rows = await fetchRows(config, SPLIT, PER_CONFIG);
  const outPath = join(DATA_DIR, `${config}-${SPLIT}.json`);
  writeFileSync(outPath, JSON.stringify({ dataset: DATASET, config, split: SPLIT, count: rows.length, rows }, null, 2));
  grandTotal += rows.length;
  console.log(`${rows.length} rows → data/${config}-${SPLIT}.json`);
}
console.log(`✓ Downloaded ${grandTotal} examples across ${CONFIGS.length} configs`);
