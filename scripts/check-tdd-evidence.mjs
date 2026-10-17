/**
 * The TDD evidence check (plan batch T.3). Not implemented yet: this is the
 * stub that the red commit ships, so the tests fail on a missing behaviour and
 * not on a missing module (testing.md §1.5).
 */

/**
 * @param {string} _path
 * @returns {boolean}
 */
export function isProductionPath(_path) {
  throw new Error("not implemented");
}

/**
 * @param {string[]} _paths
 * @returns {string[]}
 */
export function findBatchPages(_paths) {
  throw new Error("not implemented");
}

/**
 * @typedef {{ sha: string, command: string, message: string }} RedRow
 * @typedef {{ kind: "missing" }
 *   | { kind: "invalid", reason: string }
 *   | { kind: "exception", exception: string }
 *   | { kind: "red", reds: RedRow[], greens: { sha: string }[] }} TddLog
 */

/**
 * @param {string} _markdown
 * @returns {TddLog}
 */
export function parseTddLog(_markdown) {
  throw new Error("not implemented");
}

/**
 * @param {string} _command
 * @returns {string[]}
 */
export function parseCommand(_command) {
  throw new Error("not implemented");
}

/**
 * @typedef {RedRow & { page: string }} Run
 * @typedef {{ status: "pass" | "fail" | "review", reason: string }
 *   | { status: "run", runs: Run[] }} Decision
 */

/**
 * @param {{ production: string[], pages: { page: string, log: TddLog }[] }} _input
 * @returns {Decision}
 */
export function decide(_input) {
  throw new Error("not implemented");
}

/**
 * @param {{ exitCode: number, output: string, expectedMessage: string }} _run
 * @returns {{ ok: boolean, reason: string }}
 */
export function judgeRedRun(_run) {
  throw new Error("not implemented");
}

/**
 * @param {{ exitCode: number }} _run
 * @returns {{ ok: boolean, reason: string }}
 */
export function judgeGreenRun(_run) {
  throw new Error("not implemented");
}
