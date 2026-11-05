import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Every panel sets its loading flag at the top of a fetch effect, which this
      // rule flags. The extra render is the intended "is booting" state, so keep it
      // visible as a warning instead of failing the lint run repo-wide.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Local scratch tooling that is not part of the app bundle.
    ".tmp/**",
  ]),
]);

export default eslintConfig;
