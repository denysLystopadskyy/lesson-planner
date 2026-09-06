import { defineConfig } from "vite";
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
});
