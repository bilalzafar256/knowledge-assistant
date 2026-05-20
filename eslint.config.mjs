import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
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
];

export default eslintConfig;
