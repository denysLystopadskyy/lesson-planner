import { defineConfig } from "vitest/config";

/**
 * What `npm run test:unit` runs: both unit-test projects, one command.
 *
 * Each project keeps its own config, because the two have different needs —
 * `app/vite.config.ts` is rooted at `app/` and pins `pool: "forks"` so a test
 * can move the process time zone, while the backend needs neither. Collecting
 * both from one root config here was the alternative; it would have meant
 * restating those pins, and a restated pin is one that drifts.
 *
 * Recorded in .claude/context/testing.md.
 */
export default defineConfig({
  test: {
    projects: ["app/vite.config.ts", "api/vitest.config.ts"],
  },
});
