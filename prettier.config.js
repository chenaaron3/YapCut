/** @type {import('prettier').Config & import('@ianvs/prettier-plugin-sort-imports').PluginConfig & import('prettier-plugin-tailwindcss').PluginOptions} */
export default {
  plugins: [
    "@ianvs/prettier-plugin-sort-imports",
    "prettier-plugin-tailwindcss",
  ],
  // Keep separate `import type` lines (do not merge into inline `type` modifiers).
  importOrderTypeScriptVersion: "4.4.0",
  importOrder: [
    "<BUILTIN_MODULES>",
    "<THIRD_PARTY_MODULES>",
    "",
    "^~/",
    "^@/",
    "",
    "^[./]",
    "",
    "<TYPES>",
  ],
};
