import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "@next/next/no-img-element": "off",
      "react-hooks/purity": "off",
      "react-hooks/refs": "off",
      "react-hooks/immutability": "off",
    },
  },
  globalIgnores([".next/**", ".next-e2e-*/**", "out/**", "build/**", "next-env.d.ts", "tests/.pglite/**", "test-results/**", "playwright-report/**", "seed/**", "design/**"]),
]);

export default eslintConfig;
