// Next.js 16 ships eslint-config-next as native flat-config arrays, so they are
// spread directly here. (The previous FlatCompat wrapper is incompatible with
// Next 16 — it threw a circular-structure error during config validation, and
// `next lint` was removed, so the lint script now invokes the ESLint CLI.)
import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...coreWebVitals,
  ...typescript,
  {
    rules: {
      // Enforce explicit return types on exported functions
      "@typescript-eslint/explicit-module-boundary-types": "off",
      // Allow unused vars with underscore prefix (common pattern)
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // Disallow `any` — use `unknown` instead
      "@typescript-eslint/no-explicit-any": "error",
      // Ensure consistent imports
      "import/no-duplicates": "warn",
    },
  },
  {
    // Generated / vendored / data paths that should never be linted.
    ignores: [
      ".next/**",
      "node_modules/**",
      "drizzle/**",
      "evals/benchmarks/**/data/**",
      "evals/benchmarks/**/runs/**",
      "next-env.d.ts",
    ],
  },
];

export default eslintConfig;
