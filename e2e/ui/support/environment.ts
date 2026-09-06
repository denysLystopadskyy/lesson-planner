/**
 * Which app the suite is pointed at.
 *
 * The legacy page and the React port are the same product, so the same specs
 * should be able to run against either. Two values say which:
 *
 * - `basePath` — the path the app is served under. `/` for the legacy page,
 *   `/next/` for the port, matching where the deploy workflow puts it.
 * - `storagePrefix` — the prefix on the three storage keys. Empty for the
 *   legacy page, `next:` for the port, which is what keeps a staging build from
 *   touching the teacher's data.
 *
 * **They are per-project options, not environment variables.** An earlier
 * version read them from `process.env`, which meant setting them for the ported
 * project also pointed the legacy project at `/next/` — every legacy spec then
 * navigated to a 404 and the run took nine minutes to fail. A value that
 * differs per project has to live on the project.
 *
 * The defaults are the legacy values, so a spec that asks for neither behaves
 * exactly as it did before the port existed.
 */

export const LEGACY_BASE_PATH = "/";
export const LEGACY_STORAGE_PREFIX = "";

export const PORTED_BASE_PATH = "/next/";
export const PORTED_STORAGE_PREFIX = "next:";
