import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

/**
 * The React build. It produces `app/dist/`; the served page is still the legacy
 * `index.html` at the repository root until the cutover in plan batch 2a.4.
 *
 * Two things are deliberately absent from this file:
 *
 * - **`base`.** A project Pages site is served from a sub-path, and a wrong
 *   `base` makes every asset URL 404. It is passed per build with `--base`, so
 *   changing where the app is served is a one-line change in a workflow rather
 *   than an edit here.
 * - **The storage-key prefix.** Read from `VITE_STORAGE_PREFIX` at build time,
 *   so the staging build cannot touch the real keys.
 *
 * Both are recorded in .claude/context/react-migration.md.
 */
export default defineConfig({
  root: __dirname,
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  test: {
    // Unit tests for the pure modules only. The Playwright suite lives in
    // `e2e/` and must never be picked up here: both runners define `test` and
    // `expect`, and a Playwright spec collected by Vitest fails in a way that
    // looks like a broken test rather than a broken config.
    include: ["src/**/*.test.ts"],
    // Pure functions. No DOM, no jsdom — a module that needs one is a module
    // that belongs in a component test, which is Playwright's job here.
    environment: "node",
    // Processes, not worker threads. `message.test.ts` moves the machine's time
    // zone with `process.env.TZ` to prove the payment message names the right
    // month west of Greenwich, and a worker thread ignores that — the tests
    // would pass while reading this machine's own zone. The helper there
    // asserts the zone actually changed, so this pin and that guard fail
    // together rather than silently.
    pool: "forks",
  },
});
