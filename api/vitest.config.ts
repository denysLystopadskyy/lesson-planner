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
    // Vitest's default is 5 seconds, and PGlite does not fit in it.
    //
    // Measured on 2026-09-17 (plan batch 5.1a): the first database in a process
    // costs 3794 ms, because PGlite is Postgres compiled to WebAssembly and the
    // module has to be compiled before anything can run. Every database after
    // it costs about 1500 ms. Those are not intermittent — the first test
    // failed and the rest passed, every time, which is the signature of a cold
    // start rather than a race.
    //
    // So this is a measurement, not a workaround for a flaky test. Two
    // consequences worth knowing before adding more: a PGlite test can never be
    // fast, and a test that needs two databases pays twice — share one unless
    // isolation is the thing under test.
    testTimeout: 30000,
  },
});
