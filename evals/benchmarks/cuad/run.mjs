/**
 * Convenience wrapper for `evals/run.mjs` against the CUAD enterprise benchmark.
 *
 * Wires CUAD-specific defaults:
 *   --golden    → evals/benchmarks/cuad/golden/golden-set.json
 *   --user      → CUAD_USER_ID (default user_cuad_eval)
 *   --runs-dir  → evals/benchmarks/cuad/runs/
 *
 * Extra args forward to run.mjs, e.g.:
 *   node evals/benchmarks/cuad/run.mjs --label cuad-xcheck --concurrency 4
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const __dir = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dir, "../../..");
const RUN_MJS = join(REPO_ROOT, "evals", "run.mjs");
const USER_ID = process.env.CUAD_USER_ID || "user_cuad_eval";

const passThrough = process.argv.slice(2);
const args = [
  RUN_MJS,
  "--golden", "evals/benchmarks/cuad/golden/golden-set.json",
  "--user", USER_ID,
  "--runs-dir", "evals/benchmarks/cuad/runs",
];
if (!passThrough.includes("--label")) args.push("--label", "cuad");
args.push(...passThrough);

const r = spawnSync("node", args, { stdio: "inherit", cwd: REPO_ROOT });
process.exit(r.status ?? 0);
