import js from "@eslint/js";
import importPlugin from "eslint-plugin-import";
import globals from "globals";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: ["dist"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,js}"],
    plugins: {
      import: importPlugin,
    },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.node,
    },
    rules: {
      // catch{}を許可
      "no-empty": ["error", { allowEmptyCatch: true }],

      // anyを許可
      "@typescript-eslint/no-explicit-any": "off",

      // インポートの重複を検出
      "import/no-duplicates": "warn",

      // インポートをグループでソート
      "import/order": [
        "warn",
        {
          groups: ["builtin", "external", "parent", "sibling", "index", "object", "type"],
          alphabetize: {
            order: "asc",
          },
          "newlines-between": "never",
        },
      ],
    },
  },
];
