/**
 * Convenience wrapper for `evals/run.mjs` against the RAGBench multi-domain
 * benchmark (galileo-ai/ragbench — finance / IT-support / biomedical / general).
 *
 * Wires RAGBench-specific defaults:
 *   --golden    → evals/benchmarks/ragbench/golden/golden-set.json
 *   --user      → RAGBENCH_USER_ID (default user_ragbench_eval)
 *   --runs-dir  → evals/benchmarks/ragbench/runs/
 *
 * Corpus-wide by default (each question finds its passages among cross-domain
 * distractors). Add --scope-doc to scope retrieval to each question's gold doc.
 *
 * Extra args forward to run.mjs, e.g.:
 *   node evals/benchmarks/ragbench/run.mjs --label rb-xcheck --concurrency 1
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const __dir = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dir, "../../..");
const RUN_MJS = join(REPO_ROOT, "evals", "run.mjs");
const USER_ID = process.env.RAGBENCH_USER_ID || "user_ragbench_eval";

const passThrough = process.argv.slice(2);
const args = [
  RUN_MJS,
  "--golden", "evals/benchmarks/ragbench/golden/golden-set.json",
  "--user", USER_ID,
  "--runs-dir", "evals/benchmarks/ragbench/runs",
];
if (!passThrough.includes("--label")) args.push("--label", "ragbench");
args.push(...passThrough);

const r = spawnSync("node", args, { stdio: "inherit", cwd: REPO_ROOT });
process.exit(r.status ?? 0);
