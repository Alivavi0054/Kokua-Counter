import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": rootDir,
      // The real package throws when imported outside a React Server Component.
      "server-only": `${rootDir}tests/stubs/server-only.ts`,
    },
  },
});
