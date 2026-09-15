import { defineConfig } from "vitest/config";

/**
 * Unit tests for the backend. A project of the root `vitest.config.ts`, which
 * is what `npm run test:unit` runs.
 *
 * Separate from `app/vite.config.ts` because that file is the app's *build*
 * config — it is rooted at `app/` and carries the React plugin — and the
 * backend shares neither. Two projects under one command keeps `test:unit`
 * a single thing to run while letting each side pin what it needs.
 */
export default defineConfig({
  test: {
    name: "api",
    include: ["**/*.test.ts"],
    environment: "node",
  },
});
