/**
 * Where the app is served and how its storage keys are named.
 *
 * Until the cutover in plan batch 2a.4 there were two apps and two projects:
 * the legacy page at `/` with unprefixed keys, and the React build at `/next/`
 * with `next:` keys. The prefix is what let staging share an origin with the
 * real app and not touch the teacher's data.
 *
 * There is one app now. These two values are what the surviving project sets,
 * and they are the defaults every fixture falls back to.
 *
 * **They stay per-project options rather than environment variables.** An early
 * version read them from `process.env`, which meant setting them for one
 * project also set them for the other — every legacy spec then navigated to a
 * 404 and the run took nine minutes to fail. Keeping the mechanism costs
 * nothing and it is what a second target would need again.
 */

export const APP_BASE_PATH = "/";
export const APP_STORAGE_PREFIX = "";
