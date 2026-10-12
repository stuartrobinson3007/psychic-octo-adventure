//  @ts-check

import { tanstackConfig } from "@tanstack/eslint-config"

export default [
  ...tanstackConfig,
  {
    rules: {
      "import/no-cycle": "off",
      "import/order": "off",
      "import/consistent-type-specifier-style": "off",
      "sort-imports": "off",
      "@typescript-eslint/array-type": "off",
      "@typescript-eslint/require-await": "off",
      "pnpm/json-enforce-catalog": "off",
    },
  },
  {
    // Preserve the original Pigeonfiles reviewer source as a vendored tool.
    ignores: [
      "eslint.config.js",
      ".prettierrc",
      "public/ux-review/**",
      "worker-configuration.d.ts",
      "dist-cloudflare/**",
    ],
  },
  {
    files: ["src/cloudflare.ts"],
    languageOptions: {
      parserOptions: { project: "./tsconfig.cloudflare.json" },
    },
  },
  {
    files: ["src/components/ui/**", "src/components/ai-elements/**"],
    // Registry code keeps defensive checks for browser and third-party APIs.
    // Preserve those checks; application code keeps the stricter defaults.
    rules: {
      "@typescript-eslint/no-unnecessary-condition": "off",
      "@typescript-eslint/no-unnecessary-type-assertion": "off",
      "no-shadow": "off",
    },
  },
]
