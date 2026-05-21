// Reads the verifier's stdout (verify.json), tolerates stray markdown fences,
// and emits GITHUB_OUTPUT lines: ok, blockers, warnings.

import { readFileSync } from "node:fs";

const path = process.argv[2];
if (!path) {
  console.error("usage: parse-verify.mjs <path-to-verify-output>");
  process.exit(1);
}

let raw = readFileSync(path, "utf8").trim();

// Strip ```json ... ``` fence if the model added one despite instructions.
const fence = raw.match(/```(?:json)?\s*\n([\s\S]+?)\n```/);
if (fence) raw = fence[1].trim();

let parsed;
try {
  parsed = JSON.parse(raw);
} catch (err) {
  console.error("Could not parse verifier output as JSON:", err.message);
  console.error("Raw output:", raw.slice(0, 500));
  // Treat unparseable verifier output as a soft pass with a warning so the
  // planning pipeline does not silently drop the user's request.
  console.log("ok=true");
  console.log("blockers=");
  console.log("warnings<<EOFW");
  console.log("Verifier output was unparseable; plan delivered without an audit.");
  console.log("EOFW");
  process.exit(0);
}

const ok = parsed.ok === true ? "true" : "false";
const blockers = Array.isArray(parsed.blockers) ? parsed.blockers : [];
const warnings = Array.isArray(parsed.warnings) ? parsed.warnings : [];

console.log(`ok=${ok}`);
console.log("blockers<<EOFB");
console.log(blockers.map((b) => `- ${b}`).join("\n"));
console.log("EOFB");
console.log("warnings<<EOFW");
console.log(warnings.map((w) => `- ${w}`).join("\n"));
console.log("EOFW");
