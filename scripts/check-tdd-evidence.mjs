#!/usr/bin/env node
/**
 * Checks the TDD evidence of a pull request — plan batch T.3.
 *
 * The rule is in .claude/context/testing.md §1.5: a branch that changes
 * production code has a `Red:` commit whose tests fail for a stated reason,
 * before the `Green:` commit, and the batch page records both in its TDD log.
 * Or the page names one of the four exceptions.
 *
 * ## What it does
 *
 * 1. Lists the files the branch changed since it left the base.
 * 2. If none is production code, it passes.
 * 3. Reads the TDD log of every batch page the branch changed.
 * 4. For each Red row: checks out that commit in a temporary worktree, runs
 *    `npm ci` there and then the stated command, and expects the command to
 *    fail with the stated message. Then it runs the same command here, at the
 *    head of the branch, and expects it to pass.
 *
 * ## What it does not do
 *
 * A named exception is a record that a person reviews at merge. The check
 * reports it and passes; it does not claim to verify it. For "docs only" and
 * "configuration only" it can say more, because production code must not
 * change at all, so those fail when it does.
 *
 * Run it from a clean checkout of the head commit:
 *
 *   BASE_SHA=<base> HEAD_SHA=<head> node scripts/check-tdd-evidence.mjs
 */

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

// ---------------------------------------------------------------------------
// Which files count
// ---------------------------------------------------------------------------

const PRODUCTION_ROOTS = ["app/", "api/", "db/", "scripts/"];

/**
 * Production code is every file under the four production folders, except
 * tests, configuration, JSON, Markdown, and the migrations that drizzle-kit
 * generates from the schema. The schema itself is production code.
 *
 * @param {string} file
 * @returns {boolean}
 */
export function isProductionPath(file) {
  if (!PRODUCTION_ROOTS.some((root) => file.startsWith(root))) return false;
  if (file.startsWith("db/migrations/")) return false;
  const name = path.posix.basename(file);
  if (/\.(test|spec|config)\./.test(name)) return false;
  return !/\.(json|md)$/.test(name);
}

/**
 * Batch pages are `docs/plan/p<phase>-<n>-<name>.md`. The hub, the two
 * registers and the template are not batch pages.
 *
 * @param {string[]} files
 * @returns {string[]}
 */
export function findBatchPages(files) {
  return files.filter((file) =>
    /^docs\/plan\/p(?:\d+[a-z]?|t)-[^/]+\.md$/.test(file),
  );
}

// ---------------------------------------------------------------------------
// Reading the TDD log
// ---------------------------------------------------------------------------

/**
 * @typedef {{ sha: string, command: string, message: string }} RedRow
 * @typedef {{ kind: "missing" }
 *   | { kind: "invalid", reason: string }
 *   | { kind: "exception", exception: string }
 *   | { kind: "red", reds: RedRow[], greens: { sha: string }[] }} TddLog
 */

/** The four exceptions of testing.md §1.5, by every accepted spelling. */
const EXCEPTIONS = new Map([
  ["docs only", "docs only"],
  ["configuration only", "configuration only"],
  ["dead-code deletion", "dead-code deletion"],
  ["tests for existing behaviour", "tests for existing behaviour"],
  ["tests for existing behavior", "tests for existing behaviour"],
]);

const SHA = /^[0-9a-f]{7,40}$/;

/**
 * The text between `## TDD log` and the next heading of level one or two.
 *
 * @param {string} markdown
 * @returns {string | undefined}
 */
function tddLogSection(markdown) {
  const lines = markdown.split("\n");
  const start = lines.findIndex((line) => /^##\s+TDD log\s*$/i.test(line));
  if (start === -1) return undefined;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^#{1,2}\s/.test(line));
  return (end === -1 ? rest : rest.slice(0, end)).join("\n");
}

/**
 * The cells of one table row. A `\|` inside a cell is a literal pipe.
 *
 * @param {string} line
 * @returns {string[]}
 */
function cells(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/(?<!\\)\|$/, "")
    .split(/(?<!\\)\|/)
    .map((cell) => cell.trim().replace(/\\\|/g, "|"));
}

/**
 * The content of the first code span in a cell, or the bare text when the
 * cell has none.
 *
 * @param {string | undefined} cell
 * @returns {string}
 */
function unquote(cell) {
  if (cell === undefined) return "";
  const span = /`([^`]*)`/.exec(cell);
  return (span ? (span[1] ?? "") : cell).trim();
}

/**
 * Reads one Red row. Returns undefined for the template's empty row.
 *
 * @param {string[]} row
 * @returns {RedRow | { reason: string } | undefined}
 */
function readRedRow(row) {
  const sha = unquote(row[1]);
  const command = unquote(row[2]);
  const span = /`([^`]*)`/.exec(row[3] ?? "");
  const message = (span?.[1] ?? "").trim();
  if (sha === "" && command === "") return undefined;
  if (sha === "") return { reason: "a Red row has no commit" };
  if (!SHA.test(sha)) return { reason: `"${sha}" is not a commit SHA` };
  if (command === "") return { reason: `the Red row ${sha} has no command` };
  if (message === "") {
    return {
      reason: `the Red row ${sha} has no failure message in a code span`,
    };
  }
  return { sha, command, message };
}

/**
 * Reads the TDD log section of a batch page. A decision table:
 *
 * | Red rows filled | Red row partly filled | Green commit | Named exception | Result    |
 * | --------------- | --------------------- | ------------ | --------------- | --------- |
 * | –               | yes                   | –            | –               | invalid   |
 * | yes             | no                    | yes          | –               | red       |
 * | yes             | no                    | no           | –               | invalid   |
 * | no              | no                    | –            | on the list     | exception |
 * | no              | no                    | –            | not on the list | invalid   |
 * | no              | no                    | –            | none            | invalid   |
 *
 * @param {string} markdown
 * @returns {TddLog}
 */
export function parseTddLog(markdown) {
  const section = tddLogSection(markdown);
  if (section === undefined) return { kind: "missing" };

  const rows = section
    .split("\n")
    .filter((line) => line.trim().startsWith("|"))
    .map(cells);

  /** @type {RedRow[]} */
  const reds = [];
  for (const row of rows.filter((r) => /^red$/i.test(r[0] ?? ""))) {
    const red = readRedRow(row);
    if (red === undefined) continue;
    if ("reason" in red) return { kind: "invalid", reason: red.reason };
    reds.push(red);
  }

  const greens = rows
    .filter((row) => /^green$/i.test(row[0] ?? ""))
    .map((row) => ({ sha: unquote(row[1]) }))
    .filter((green) => SHA.test(green.sha));

  if (reds.length > 0) {
    if (greens.length === 0) {
      return { kind: "invalid", reason: "no Green row has a commit SHA" };
    }
    return { kind: "red", reds, greens };
  }

  const named = /\*\*Exception:\s*(.+?)\.?\*\*/i.exec(section);
  if (named) {
    const exception = EXCEPTIONS.get((named[1] ?? "").trim().toLowerCase());
    if (exception === undefined) {
      return {
        kind: "invalid",
        reason: `"${named[1] ?? ""}" is not one of the exceptions in testing.md §1.5`,
      };
    }
    return { kind: "exception", exception };
  }

  return {
    kind: "invalid",
    reason: "the TDD log has no Red row and names no exception",
  };
}

// ---------------------------------------------------------------------------
// Which commands may run
// ---------------------------------------------------------------------------

/** The command must start with one of these. */
const ALLOWED_PREFIXES = [
  ["npm", "run", "test:unit"],
  ["npm", "run", "test:e2e"],
  ["npx", "vitest", "run"],
  ["npx", "playwright", "test"],
];

/** Plain words only: no quotes, no `$`, no `;`, `|`, `&`, `<`, `>`, `` ` ``. */
const PLAIN_WORD = /^[\w@%+=:,./-]+$/;

/**
 * Turns the command on a batch page into an argument list for `spawnSync`,
 * which runs it without a shell. A page is text that anyone can edit in a pull
 * request, so the list of what may run is short and exact.
 *
 * @param {string} command
 * @returns {string[]}
 */
export function parseCommand(command) {
  const argv = command.trim().split(/\s+/).filter(Boolean);
  const unsafe = argv.find((word) => !PLAIN_WORD.test(word));
  if (unsafe !== undefined) {
    throw new Error(`command refused: "${unsafe}" is not a plain word`);
  }
  const allowed = ALLOWED_PREFIXES.some((prefix) =>
    prefix.every((word, i) => argv[i] === word),
  );
  if (!allowed) {
    const list = ALLOWED_PREFIXES.map((p) => p.join(" ")).join(", ");
    throw new Error(`command refused: it must start with one of: ${list}`);
  }
  return argv;
}

// ---------------------------------------------------------------------------
// The decision
// ---------------------------------------------------------------------------

/**
 * @typedef {RedRow & { page: string }} Run
 * @typedef {{ status: "pass" | "fail" | "review", reason: string }
 *   | { status: "run", runs: Run[] }} Decision
 */

/** Exceptions that allow production code to change; a person checks them. */
const REVIEWED_EXCEPTIONS = new Set([
  "dead-code deletion",
  "tests for existing behaviour",
]);

/**
 * A decision table. Rules R1 to R7 are the test cases in
 * `check-tdd-evidence.test.mjs`.
 *
 * | Rule | Production code changed | Batch page changed | Best TDD log on the pages      | Result |
 * | ---- | ----------------------- | ------------------ | ------------------------------ | ------ |
 * | R1   | no                      | –                  | –                              | pass   |
 * | R2   | yes                     | no                 | –                              | fail   |
 * | R3   | yes                     | yes                | missing                        | fail   |
 * | R4   | yes                     | yes                | invalid                        | fail   |
 * | R5   | yes                     | yes                | docs only / configuration only | fail   |
 * | R6   | yes                     | yes                | dead-code / existing behaviour | review |
 * | R7   | yes                     | yes                | Red rows                       | run    |
 *
 * "Best" because a pull request may also touch older pages, to fix a link for
 * example. Red rows win over everything, then a reviewed exception.
 *
 * @param {{ production: string[], pages: { page: string, log: TddLog }[] }} input
 * @returns {Decision}
 */
export function decide({ production, pages }) {
  if (production.length === 0) {
    return { status: "pass", reason: "No production code changed." };
  }
  const changed = `Production code changed: ${production.join(", ")}.`;

  if (pages.length === 0) {
    return {
      status: "fail",
      reason: `${changed} No batch page changed, so there is no TDD log to check. Fill the TDD log on the batch page (docs/plan/batch-template.md).`,
    };
  }

  const runs = pages.flatMap(({ page, log }) =>
    log.kind === "red" ? log.reds.map((red) => ({ page, ...red })) : [],
  );
  if (runs.length > 0) return { status: "run", runs };

  for (const { page, log } of pages) {
    if (log.kind === "exception" && REVIEWED_EXCEPTIONS.has(log.exception)) {
      return {
        status: "review",
        reason: `${changed} ${page} names the exception "${log.exception}". The check cannot verify it; a person reviews the evidence on the page at merge.`,
      };
    }
  }

  const problems = pages.map(({ page, log }) => {
    if (log.kind === "missing") return `${page} has no "## TDD log" section.`;
    if (log.kind === "invalid") return `${page}: ${log.reason}.`;
    if (log.kind === "exception") {
      return `${page} names the exception "${log.exception}", which does not allow production code to change.`;
    }
    return `${page} has no Red row.`;
  });
  return { status: "fail", reason: [changed, ...problems].join("\n") };
}

// ---------------------------------------------------------------------------
// Judging the runs
// ---------------------------------------------------------------------------

// The escape character, written as a code so the source holds no control byte.
const COLOUR_CODE = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");

/** @param {string} text */
const normalise = (text) =>
  text.replace(COLOUR_CODE, "").replace(/\s+/g, " ").trim();

/**
 * The red run must fail, and fail for the stated reason. "Cannot find module"
 * is never that reason: a red commit ships a stub (testing.md §1.5).
 *
 * @param {{ exitCode: number, output: string, expectedMessage: string }} run
 * @returns {{ ok: boolean, reason: string }}
 */
export function judgeRedRun({ exitCode, output, expectedMessage }) {
  if (/cannot find module/i.test(expectedMessage)) {
    return {
      ok: false,
      reason:
        '"Cannot find module" is not an accepted red failure. The red commit must add a stub that throws (testing.md §1.5).',
    };
  }
  if (exitCode === 0) {
    return {
      ok: false,
      reason: "The command passed at the red commit. A red commit must fail.",
    };
  }
  if (!normalise(output).includes(normalise(expectedMessage))) {
    return {
      ok: false,
      reason: `The command failed at the red commit, but its output does not contain the stated message: "${expectedMessage}".`,
    };
  }
  return {
    ok: true,
    reason: "The command fails at the red commit with the stated message.",
  };
}

/**
 * @param {{ exitCode: number }} run
 * @returns {{ ok: boolean, reason: string }}
 */
export function judgeGreenRun({ exitCode }) {
  return exitCode === 0
    ? { ok: true, reason: "The same command passes at the head commit." }
    : {
        ok: false,
        reason: `The same command fails at the head commit (exit ${exitCode}).`,
      };
}

// ---------------------------------------------------------------------------
// Git and processes — exercised by CI and by the fault seeding on the batch
// page, not by the component tests.
// ---------------------------------------------------------------------------

/**
 * @param {string[]} args
 * @param {string} [cwd]
 */
function run(args, cwd) {
  const [command = "", ...rest] = args;
  const result = spawnSync(command, rest, {
    cwd,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, CI: "true", FORCE_COLOR: "0" },
  });
  return {
    exitCode: result.status ?? 1,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`,
  };
}

/** @param {string[]} args */
function git(args) {
  const result = run(["git", ...args]);
  if (result.exitCode !== 0) {
    throw new Error(`git ${args.join(" ")} failed:\n${result.output}`);
  }
  return result.output.trim();
}

/**
 * Checks one Red row: the commit belongs to this branch, the command fails
 * there with the stated message, and the same command passes here.
 *
 * @param {Run} red
 * @param {string} base
 * @param {string} head
 * @returns {boolean}
 */
function verify(red, base, head) {
  const label = `${red.page} Red ${red.sha}`;
  /** @param {string} reason */
  const fail = (reason) => {
    console.log(`✘ ${label}: ${reason}`);
    return false;
  };

  /** @type {string[]} */
  let argv;
  try {
    argv = parseCommand(red.command);
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }

  const found = run(["git", "rev-parse", "--verify", `${red.sha}^{commit}`]);
  if (found.exitCode !== 0) return fail("no such commit in this clone");
  const sha = found.output.trim();
  if (run(["git", "merge-base", "--is-ancestor", sha, head]).exitCode !== 0) {
    return fail("the commit is not on this branch");
  }
  if (run(["git", "merge-base", "--is-ancestor", sha, base]).exitCode === 0) {
    return fail("the commit is already on the base branch, not new here");
  }

  const dir = mkdtempSync(path.join(tmpdir(), "tdd-red-"));
  try {
    git(["worktree", "add", "--detach", dir, sha]);
    const install = run(["npm", "ci", "--no-audit", "--no-fund"], dir);
    if (install.exitCode !== 0) {
      console.log(install.output);
      return fail("npm ci failed at the red commit");
    }
    const redRun = run(argv, dir);
    const verdict = judgeRedRun({
      exitCode: redRun.exitCode,
      output: redRun.output,
      expectedMessage: red.message,
    });
    if (!verdict.ok) {
      console.log(redRun.output);
      return fail(verdict.reason);
    }
    console.log(`✔ ${label}: ${verdict.reason}`);
  } finally {
    run(["git", "worktree", "remove", "--force", dir]);
    rmSync(dir, { recursive: true, force: true });
  }

  const greenRun = run(argv);
  const verdict = judgeGreenRun({ exitCode: greenRun.exitCode });
  if (!verdict.ok) {
    console.log(greenRun.output);
    return fail(verdict.reason);
  }
  console.log(`✔ ${label}: ${verdict.reason}`);
  return true;
}

function main() {
  const base = process.env.BASE_SHA;
  const head = git(["rev-parse", "--verify", process.env.HEAD_SHA ?? "HEAD"]);
  if (!base) {
    console.error(
      "Usage: BASE_SHA=<base> HEAD_SHA=<head> node scripts/check-tdd-evidence.mjs",
    );
    process.exit(2);
  }
  // The green run uses this working tree, so it must be the head commit.
  if (git(["rev-parse", "HEAD"]) !== head) {
    console.error(`Run this from a checkout of ${head}.`);
    process.exit(2);
  }

  const changed = git(["diff", "--name-only", `${base}...${head}`])
    .split("\n")
    .filter(Boolean);
  const production = changed.filter(isProductionPath);
  // A page the branch deleted has no log to read, so it is left out.
  const pages = findBatchPages(changed).flatMap((page) => {
    const shown = run(["git", "show", `${head}:${page}`]);
    return shown.exitCode === 0
      ? [{ page, log: parseTddLog(shown.output) }]
      : [];
  });

  const decision = decide({ production, pages });
  if (decision.status !== "run") {
    const mark = decision.status === "fail" ? "✘" : "✔";
    console.log(`${mark} ${decision.status}: ${decision.reason}`);
    process.exit(decision.status === "fail" ? 1 : 0);
  }

  let ok = true;
  for (const red of decision.runs) ok = verify(red, base, head) && ok;
  process.exit(ok ? 0 : 1);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
