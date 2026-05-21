/**
 * Convenience wrapper for `evals/run.mjs` against the Open RAG Benchmark.
 *
 * Wires three benchmark-specific defaults:
 *   --golden    → evals/benchmarks/open-ragbench/golden/golden-set.json
 *   --user-env  → OPEN_RAGBENCH_USER_ID (read from env, falls back to default)
 *   --runs-dir  → evals/benchmarks/open-ragbench/runs/
 *
 * Any extra CLI args are forwarded to run.mjs untouched, so you can still
 * do e.g. `pnpm eval:ragbench:run -- --label experiment-1 --concurrency 4`.
 *
 * The breakdown tables (per modality, per query type) are added automatically
 * by run.mjs whenever perQuestion[].benchmark is present.
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { OPEN_RAGBENCH_USER_ID } from "../../lib/env.mjs";

const __dir = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dir, "../../..");
const RUN_MJS = join(REPO_ROOT, "evals", "run.mjs");

// env.mjs already loaded .env.local and resolved the fallback chain; pass the
// concrete value to the subprocess so it doesn't depend on process.env in the
// child shell.
const passThrough = process.argv.slice(2);
const args = [
  RUN_MJS,
  "--golden", "evals/benchmarks/open-ragbench/golden/golden-set.json",
  "--user", OPEN_RAGBENCH_USER_ID,
  "--runs-dir", "evals/benchmarks/open-ragbench/runs",
];
if (!passThrough.includes("--label")) args.push("--label", "ragbench");
args.push(...passThrough);

const r = spawnSync("node", args, { stdio: "inherit", cwd: REPO_ROOT });
process.exit(r.status ?? 0);
