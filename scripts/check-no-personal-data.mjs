#!/usr/bin/env node
/**
 * Fails the build when something that looks like a bank or tax identifier
 * appears in a tracked source file — plan batch 3.5, DEF-015.
 *
 * ## Why a shape check and not a value check
 *
 * The obvious script greps for the owner's actual IBAN. That script cannot be
 * committed: it would put the value back into the repository it exists to keep
 * it out of, in a file whose whole purpose advertises what it holds. So this
 * matches *shapes* instead, and the values it guards never appear here.
 *
 * The shapes are deliberately broad. A false positive costs one `ALLOWED` entry
 * with a reason beside it; a false negative costs a public IBAN.
 *
 * ## What it does not do
 *
 * It reads the working tree only. The values are still in git history — the
 * cutover in plan batch 2a.4 deleted the file that held them, which removes
 * them from every checkout and from none of the objects behind it. Cleaning
 * history needs a rewrite and a force push and is the owner's decision, not a
 * build step's. See .claude/context/security-auth.md.
 */

import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const PATTERNS = [
  {
    name: "IBAN-shaped string",
    // Two letters, two check digits, then 11–30 alphanumerics: the ISO 13616
    // shape, with no country-specific length table because being generous here
    // is the point.
    re: /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g,
  },
  {
    name: "long digit run",
    // Ten or more digits together. Tax identifiers, card numbers and account
    // numbers all live above this line; years, prices and RGB values do not.
    re: /\b\d{10,}\b/g,
  },
];

/**
 * Lines that match a shape and are known not to be personal data.
 *
 * Each entry is `file:substring`. Kept as an explicit list rather than a
 * cleverer regex so that adding one is a visible decision in a diff.
 */
const ALLOWED = [];

const SCANNED = ["app/src", "e2e", "scripts"];

/**
 * Proves the patterns still match what they are for — `--self-test`.
 *
 * A guard that has never failed is indistinguishable from one that cannot. This
 * check passes on a clean tree by design, so on its own it says nothing about
 * whether it still works; one bad edit to a regex and it would keep passing
 * forever while catching nothing.
 *
 * The positives are published test vectors and invented digits, never the
 * values this exists to keep out. The negatives are shapes the repository
 * really contains — a year, a price, a hex colour, a date — so a pattern that
 * grows too greedy fails here rather than in somebody's pull request.
 */
const SELF_TEST = {
  mustMatch: [
    ["GB29NWBK60161331926819", "the ISO 13616 example IBAN"],
    ["DE89370400440532013000", "a second country's shape"],
    ["1234567890", "ten digits, the lower bound"],
    ["12345678901234567", "a long run of digits"],
  ],
  mustNotMatch: [
    ["2026-09-11", "a date"],
    ["const price = 250;", "a price"],
    ["#2e7d32", "a hex colour"],
    ["123456789", "nine digits, just under the bound"],
    ["v1.63.0-noble", "the pinned image tag"],
    ["UAH 1 200.50", "a formatted amount"],
  ],
};

const runSelfTest = () => {
  const failures = [];
  const matches = (text) =>
    PATTERNS.some(({ re }) => {
      re.lastIndex = 0;
      return re.test(text);
    });

  for (const [text, why] of SELF_TEST.mustMatch) {
    if (!matches(text)) failures.push(`should have matched ${why}: ${text}`);
  }
  for (const [text, why] of SELF_TEST.mustNotMatch) {
    if (matches(text)) failures.push(`should not have matched ${why}: ${text}`);
  }

  if (failures.length > 0) {
    console.error("Personal data check SELF-TEST failed:\n");
    for (const failure of failures) console.error(`  ${failure}`);
    console.error("\nThe patterns no longer do what they are for.");
    process.exit(1);
  }
  console.log(
    `Personal data check self-test passed: ${String(SELF_TEST.mustMatch.length)} shapes caught, ` +
      `${String(SELF_TEST.mustNotMatch.length)} lookalikes ignored.`,
  );
};

if (process.argv.includes("--self-test")) {
  runSelfTest();
  process.exit(0);
}

runSelfTest();

const tracked = execFileSync("git", ["ls-files", "-z", ...SCANNED], {
  encoding: "utf-8",
})
  .split("\0")
  .filter((path) => path !== "" && !path.endsWith(".png"));

const findings = [];

for (const path of tracked) {
  // Never scan this file: its own patterns would match themselves.
  if (path === "scripts/check-no-personal-data.mjs") continue;
  const lines = readFileSync(path, "utf-8").split("\n");
  lines.forEach((line, index) => {
    for (const { name, re } of PATTERNS) {
      re.lastIndex = 0;
      const match = re.exec(line);
      if (match === null) continue;
      if (ALLOWED.some((allowed) => `${path}:${line}`.includes(allowed))) {
        continue;
      }
      findings.push({ path, line: index + 1, name, text: match[0] });
    }
  });
}

if (findings.length > 0) {
  console.error(
    "Personal data check failed. These look like bank or tax identifiers:\n",
  );
  for (const finding of findings) {
    console.error(`  ${finding.path}:${String(finding.line)}  ${finding.name}`);
    console.error(`    matched: ${finding.text}`);
  }
  console.error(
    "\nIf one of these is not personal data, add it to ALLOWED in" +
      " scripts/check-no-personal-data.mjs with a reason.",
  );
  process.exit(1);
}

console.log(
  `Personal data check passed: ${String(tracked.length)} tracked files, no bank or tax identifier shapes.`,
);
