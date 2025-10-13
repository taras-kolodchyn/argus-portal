import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import queryPlugin from "@tanstack/eslint-plugin-query";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["dist", "packages/world-map/dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
      reactHooks.configs["recommended-latest"],
      reactRefresh.configs.vite,
    ],
    plugins: {
      "@tanstack/query": queryPlugin,
    },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        project: ["./tsconfig.app.json", "./packages/world-map/tsconfig.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "@tanstack/query/exhaustive-deps": "warn",
      ...(queryPlugin.configs.recommended?.rules ?? {}),
      "react-refresh/only-export-components": [
        "error",
        { allowConstantExport: true },
      ],
    },
  },
  {
    files: ["**/*.config.{ts,js}", "./vite.config.ts"],
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.node.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
]);
