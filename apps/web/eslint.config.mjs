import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  {
    files: [
      "app/**/*.tsx",
      "components/layout/**/*.tsx",
      "components/shared/**/*.tsx",
      "features/**/*.tsx",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "JSXOpeningElement[name.name=/^(button|input|textarea|select)$/]",
          message:
            "Reutilize components/ui. Adicione um primitive ao design system quando houver uma necessidade real.",
        },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    ".next-*/**",
    "node_modules/**",
    ".pnpm-store/**",
    "playwright-report/**",
    "test-results/**",
  ]),
]);
