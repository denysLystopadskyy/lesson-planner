/**
 * Component tests for the TDD evidence check (plan batch T.3).
 *
 * Only the pure functions are tested here: which files count as production
 * code, which files are batch pages, how a batch page's TDD log is read, where a
 * Red commit stands (this branch, the base, or neither), which commands may run,
 * what the check decides, and how a red run is judged. The git and process layer in
 * `main()` is exercised by the CI job itself, against this batch's own red
 * commit, and by the fault seeding recorded on the batch page.
 */
import { describe, expect, it } from "vitest";

import {
  decide,
  findBatchPages,
  isProductionPath,
  judgeGreenRun,
  judgeRedRun,
  parseCommand,
  parseTddLog,
  placeRedRow,
} from "./check-tdd-evidence.mjs";

describe("isProductionPath — equivalence partitioning", () => {
  it.each([
    "app/src/App.tsx",
    "app/src/storage.ts",
    "app/src/Dialog.module.css",
    "app/index.html",
    "api/[...all].ts",
    "db/schema.ts",
    "db/testing.ts",
    "scripts/serve.mjs",
    "scripts/check-tdd-evidence.mjs",
  ])("%s is production code", (path) => {
    expect(isProductionPath(path)).toBe(true);
  });

  it.each([
    "app/src/storage.test.ts",
    "api/health.test.ts",
    "scripts/check-tdd-evidence.test.mjs",
    "api/vitest.config.ts",
    "app/vite.config.ts",
    "scripts/vitest.config.mjs",
    "api/package.json",
    "app/tsconfig.json",
    "db/migrations/0001_init.sql",
    "db/migrations/meta/_journal.json",
    "e2e/features/sign-in.spec.ts",
    "e2e/ui/pages/planner-page.ts",
    "docs/plan/pt-03-tdd-evidence-check.md",
    ".github/workflows/ci.yml",
    "package.json",
    "vercel.json",
    "CLAUDE.md",
  ])("%s is not production code", (path) => {
    expect(isProductionPath(path)).toBe(false);
  });
});

describe("findBatchPages — equivalence partitioning", () => {
  it("keeps batch pages and drops the hub, the registers and the template", () => {
    expect(
      findBatchPages([
        "docs/plan/p5-10-dead-test-door.md",
        "docs/plan/pt-03-tdd-evidence-check.md",
        "docs/plan/README.md",
        "docs/plan/def-registry.md",
        "docs/plan/lessons-learned.md",
        "docs/plan/batch-template.md",
        "docs/research/README.md",
        "app/src/App.tsx",
      ]),
    ).toEqual([
      "docs/plan/p5-10-dead-test-door.md",
      "docs/plan/pt-03-tdd-evidence-check.md",
    ]);
  });

  it("finds no page when no batch page changed", () => {
    expect(findBatchPages(["app/src/App.tsx", "docs/plan/README.md"])).toEqual(
      [],
    );
  });

  // DEF-031: the follow-up batch for a defect is named after the defect.
  it("keeps a defect batch page: def-<number>-<name>.md", () => {
    expect(
      findBatchPages([
        "docs/plan/def-031-tdd-evidence-merged-pages.md",
        "docs/plan/def-registry.md",
      ]),
    ).toEqual(["docs/plan/def-031-tdd-evidence-merged-pages.md"]);
  });

  // One invalid value per test case, so one refusal cannot hide another.
  it.each([
    "docs/plan/def-registry.md",
    "docs/plan/def-notes-on-pages.md",
    "docs/plan/def-031.md",
    "docs/research/def-031-tdd-evidence-merged-pages.md",
  ])("%s is not a batch page", (file) => {
    expect(findBatchPages([file])).toEqual([]);
  });
});

/** A batch page with the given TDD log section between two other sections. */
const page = (/** @type {string} */ log) =>
  `# Batch X\n\n## Goal\n\nSomething.\n\n${log}\n\n## Exit criteria\n\n- [ ] CI green.\n`;

const header = [
  "## TDD log",
  "",
  "| Step  | Commit    | Command                                   | Result                               |",
  "| ----- | --------- | ----------------------------------------- | ------------------------------------ |",
];
const redRow =
  "| Red   | `abc1234` | `npm run test:unit -- scripts/x.test.mjs` | fails with: `Error: not implemented` |";
const greenRow =
  "| Green | `def5678` | `npm run test:unit -- scripts/x.test.mjs` | passes                               |";
const redLog = [...header, redRow, greenRow].join("\n");

const emptyTemplateTable = [
  "| Step     | Commit | Command | Result                             |",
  "| -------- | ------ | ------- | ---------------------------------- |",
  "| Red      |        |         | _fails with: <one to three lines>_ |",
  "| Green    |        |         | _passes_                           |",
].join("\n");

describe("parseTddLog — decision table on the TDD log section", () => {
  it("reads a red row: commit, command and failure message", () => {
    expect(parseTddLog(page(redLog))).toEqual({
      kind: "red",
      reds: [
        {
          sha: "abc1234",
          command: "npm run test:unit -- scripts/x.test.mjs",
          message: "Error: not implemented",
        },
      ],
      greens: [{ sha: "def5678" }],
    });
  });

  it("reads every red row when a batch has more than one cycle", () => {
    const second =
      "| Red   | `0123abc` | `npx vitest run app/src/route.test.ts`    | fails with: `expected 2 to be 3`     |";
    const log = [...header, redRow, greenRow, second, greenRow].join("\n");
    const result = parseTddLog(page(log));
    expect(result).toMatchObject({ kind: "red" });
    expect(result.kind === "red" && result.reds.map((r) => r.sha)).toEqual([
      "abc1234",
      "0123abc",
    ]);
  });

  it("reads an escaped pipe inside a failure message", () => {
    const row = redRow.replace(
      "`Error: not implemented`",
      "`expected a \\| b`      ",
    );
    const result = parseTddLog(page([...header, row, greenRow].join("\n")));
    expect(result.kind === "red" && result.reds[0]?.message).toBe(
      "expected a | b",
    );
  });

  it.each([
    ["docs only", "**Exception: docs only.**"],
    [
      "configuration only",
      "**Exception: configuration only.** The checks are above.",
    ],
    [
      "dead-code deletion",
      "**Exception: dead-code deletion.** The search found no reader.",
    ],
    [
      "tests for existing behaviour",
      "**Exception: tests for existing behaviour.**",
    ],
    [
      "tests for existing behaviour",
      "**Exception: tests for existing behavior.**",
    ],
  ])("reads the named exception %s", (exception, line) => {
    expect(parseTddLog(page(`## TDD log\n\n${line}`))).toEqual({
      kind: "exception",
      exception,
    });
  });

  it("reads an exception when the template's empty table was left in place", () => {
    const log = `## TDD log\n\n**Exception: docs only.**\n\n${emptyTemplateTable}`;
    expect(parseTddLog(page(log))).toEqual({
      kind: "exception",
      exception: "docs only",
    });
  });

  it("reads the exception from its own line, not from the template's note", () => {
    const note =
      "_Otherwise name the exception as `**Exception: <name>.**`: docs only, …_";
    const log = `## TDD log\n\n${note}\n\n**Exception: docs only.**`;
    expect(parseTddLog(page(log))).toEqual({
      kind: "exception",
      exception: "docs only",
    });
  });

  it("reports a page with no TDD log section", () => {
    expect(parseTddLog(page("## Tasks\n\n- [x] Done."))).toEqual({
      kind: "missing",
    });
  });

  it("ignores an exception written outside the TDD log section", () => {
    const text = `${page("## Tasks\n\n- [x] Done.")}\n## Results\n\n**Exception: docs only.**\n`;
    expect(parseTddLog(text)).toEqual({ kind: "missing" });
  });

  it("refuses an exception that is not on the list", () => {
    expect(
      parseTddLog(page("## TDD log\n\n**Exception: no time this week.**")),
    ).toMatchObject({ kind: "invalid" });
  });

  it("refuses the template's empty table with no exception", () => {
    expect(
      parseTddLog(page(`## TDD log\n\n${emptyTemplateTable}`)),
    ).toMatchObject({ kind: "invalid" });
  });

  // One missing cell per test case, so one refusal cannot hide another.
  it("refuses a red row with no commit", () => {
    const row = redRow.replace("`abc1234`", "         ");
    const log = [...header, row, greenRow].join("\n");
    expect(parseTddLog(page(log))).toMatchObject({ kind: "invalid" });
  });

  it("refuses a red row whose commit is not a SHA", () => {
    const row = redRow.replace("`abc1234`", "`HEAD~1`  ");
    const log = [...header, row, greenRow].join("\n");
    expect(parseTddLog(page(log))).toMatchObject({ kind: "invalid" });
  });

  it("refuses a red row with no command", () => {
    const row = redRow.replace(
      "`npm run test:unit -- scripts/x.test.mjs`",
      "                                         ",
    );
    const log = [...header, row, greenRow].join("\n");
    expect(parseTddLog(page(log))).toMatchObject({ kind: "invalid" });
  });

  it("refuses a red row with no failure message", () => {
    const row = redRow.replace(
      "fails with: `Error: not implemented`",
      "fails                               ",
    );
    const log = [...header, row, greenRow].join("\n");
    expect(parseTddLog(page(log))).toMatchObject({ kind: "invalid" });
  });

  it("refuses a red row with no green commit after it", () => {
    const log = [...header, redRow].join("\n");
    expect(parseTddLog(page(log))).toMatchObject({ kind: "invalid" });
  });
});

describe("placeRedRow — decision table", () => {
  /** The TDD log of a page that was merged with one Red row. */
  const mergedLog = /** @type {import("./check-tdd-evidence.mjs").TddLog} */ ({
    kind: "red",
    reds: [{ sha: "abc1234", command: "npm run test:unit", message: "x" }],
    greens: [{ sha: "def5678" }],
  });
  const unrecordedLog =
    /** @type {import("./check-tdd-evidence.mjs").TddLog} */ ({
      kind: "red",
      reds: [{ sha: "9999999", command: "npm run test:unit", message: "x" }],
      greens: [{ sha: "def5678" }],
    });

  // P1 to P4: every combination of the three conditions.
  it.each([
    [false, false, true, "branch"],
    [false, false, false, "neither"],
    [false, true, true, "base"],
    [false, true, false, "base"],
    [true, false, false, "base"],
    [true, false, true, "base"],
    [true, true, false, "base"],
    [true, true, true, "base"],
  ])(
    "page on the base records the row: %s, commit on the base: %s, commit on the branch: %s → %s",
    (recorded, onBase, onHead, place) => {
      expect(
        placeRedRow({
          sha: "abc1234",
          baseLog: recorded ? mergedLog : unrecordedLog,
          onHead,
          onBase,
        }),
      ).toBe(place);
    },
  );
});

describe("placeRedRow — equivalence partitioning on the page at the base", () => {
  const log = (/** @type {string} */ sha) =>
    /** @type {import("./check-tdd-evidence.mjs").TddLog} */ ({
      kind: "red",
      reds: [{ sha, command: "npm run test:unit", message: "x" }],
      greens: [{ sha: "def5678" }],
    });
  const full = "abc1234def5678901234567890abcdef12345678";
  // The commit is nowhere in git, so only the page can place the row.
  const nowhere = { onHead: false, onBase: false };

  it("a page that is new on the branch records nothing → neither", () => {
    expect(
      placeRedRow({ sha: "abc1234", baseLog: undefined, ...nowhere }),
    ).toBe("neither");
  });

  it("a page on the base that names an exception records nothing → neither", () => {
    expect(
      placeRedRow({
        sha: "abc1234",
        baseLog: { kind: "exception", exception: "docs only" },
        ...nowhere,
      }),
    ).toBe("neither");
  });

  it("a page on the base with other Red rows records nothing of this one → neither", () => {
    expect(
      placeRedRow({ sha: "abc1234", baseLog: log("abc1235"), ...nowhere }),
    ).toBe("neither");
  });

  it("the same SHA, written the same way → base", () => {
    expect(
      placeRedRow({ sha: "abc1234", baseLog: log("abc1234"), ...nowhere }),
    ).toBe("base");
  });

  it("the page wrote a short SHA and the row has the full one → base", () => {
    expect(
      placeRedRow({ sha: full, baseLog: log("abc1234"), ...nowhere }),
    ).toBe("base");
  });

  it("the page wrote the full SHA and the row has a short one → base", () => {
    expect(
      placeRedRow({ sha: "abc1234", baseLog: log(full), ...nowhere }),
    ).toBe("base");
  });
});

describe("parseCommand — equivalence partitioning and error guessing", () => {
  it.each([
    ["npm run test:unit", ["npm", "run", "test:unit"]],
    [
      "npm run test:unit -- scripts/check-tdd-evidence.test.mjs",
      ["npm", "run", "test:unit", "--", "scripts/check-tdd-evidence.test.mjs"],
    ],
    [
      "npx vitest run app/src/route.test.ts",
      ["npx", "vitest", "run", "app/src/route.test.ts"],
    ],
    [
      "npm run test:e2e -- e2e/features/routing.spec.ts",
      ["npm", "run", "test:e2e", "--", "e2e/features/routing.spec.ts"],
    ],
    [
      "npx playwright test e2e/features/routing.spec.ts --grep reload",
      [
        "npx",
        "playwright",
        "test",
        "e2e/features/routing.spec.ts",
        "--grep",
        "reload",
      ],
    ],
  ])("allows %s", (command, argv) => {
    expect(parseCommand(command)).toEqual(argv);
  });

  // One invalid value per test case, so one refusal cannot hide another.
  it.each([
    "rm -rf /",
    "npm run lint",
    "npm run test:unitx",
    "npm run test:unit; rm -rf /",
    "npm run test:unit && curl example.test",
    "npm run test:unit | tee out.txt",
    "npx vitest run $(whoami)",
    "npx vitest run `id`",
    "npm run test:unit > out.txt",
    'npx playwright test --grep "two words"',
    "",
  ])("refuses %j", (command) => {
    expect(() => parseCommand(command)).toThrow(/^command refused/);
  });
});

describe("decide — decision table", () => {
  const prod = ["app/src/route.ts"];
  /**
   * A page whose TDD log has one Red row per given place. `where` is what
   * `placeRedRow` returned for the row; `undefined` means it was not placed.
   *
   * @param {string} page
   * @param {...[string, import("./check-tdd-evidence.mjs").Placement | undefined]} rows
   */
  const pageWith = (page, ...rows) => ({
    page,
    log: /** @type {import("./check-tdd-evidence.mjs").TddLog} */ ({
      kind: "red",
      reds: rows.map(([sha, placement]) => ({
        sha,
        command: "npm run test:unit",
        message: "x",
        ...(placement === undefined ? {} : { placement }),
      })),
      greens: [{ sha: "def5678" }],
    }),
  });
  const red = pageWith("docs/plan/p6-01.md", ["abc1234", "branch"]);
  const exception = (/** @type {string} */ name) => ({
    page: "docs/plan/p6-01.md",
    log: /** @type {import("./check-tdd-evidence.mjs").TddLog} */ ({
      kind: "exception",
      exception: name,
    }),
  });

  it("R1: no production code changed → pass", () => {
    expect(decide({ production: [], pages: [] })).toMatchObject({
      status: "pass",
    });
  });

  it("R2: production code changed and no batch page changed → fail", () => {
    expect(decide({ production: prod, pages: [] })).toMatchObject({
      status: "fail",
    });
  });

  it("R3: production code changed and the page has no TDD log → fail", () => {
    expect(
      decide({
        production: prod,
        pages: [{ page: "docs/plan/p6-01.md", log: { kind: "missing" } }],
      }),
    ).toMatchObject({ status: "fail" });
  });

  it("R4: production code changed and the TDD log is invalid → fail", () => {
    expect(
      decide({
        production: prod,
        pages: [
          {
            page: "docs/plan/p6-01.md",
            log: { kind: "invalid", reason: "no command" },
          },
        ],
      }),
    ).toMatchObject({ status: "fail" });
  });

  it.each(["docs only", "configuration only"])(
    "R5: production code changed and the page says %s → fail",
    (name) => {
      expect(
        decide({ production: prod, pages: [exception(name)] }),
      ).toMatchObject({ status: "fail" });
    },
  );

  it.each(["dead-code deletion", "tests for existing behaviour"])(
    "R6: production code changed and the page names %s → review",
    (name) => {
      expect(
        decide({ production: prod, pages: [exception(name)] }),
      ).toMatchObject({ status: "review" });
    },
  );

  it("R7: production code changed and the page has a red row on the branch → run it", () => {
    expect(decide({ production: prod, pages: [red] })).toEqual({
      status: "run",
      runs: [
        {
          page: "docs/plan/p6-01.md",
          sha: "abc1234",
          command: "npm run test:unit",
          message: "x",
        },
      ],
      skipped: [],
    });
  });

  it("R7: a red row wins over an older page that says docs only", () => {
    expect(
      decide({ production: prod, pages: [exception("docs only"), red] }),
    ).toMatchObject({ status: "run" });
  });

  // DEF-031. A page of a merged batch has its Red rows on the base.
  const merged = pageWith("docs/plan/p6-01.md", ["abc1234", "base"]);
  const own = pageWith("docs/plan/def-031.md", ["fedcba9", "branch"]);
  const skippedMerged = [
    {
      page: "docs/plan/p6-01.md",
      sha: "abc1234",
      command: "npm run test:unit",
      message: "x",
    },
  ];

  it("R8: a red row on neither the branch nor the base → fail, and name it", () => {
    const result = decide({
      production: prod,
      pages: [pageWith("docs/plan/p6-01.md", ["abc1234", "neither"])],
    });
    expect(result).toMatchObject({ status: "fail" });
    expect(result).toMatchObject({
      reason: expect.stringContaining("abc1234"),
    });
  });

  it("R8: a red row that was not placed counts as on neither → fail", () => {
    expect(
      decide({
        production: prod,
        pages: [pageWith("docs/plan/p6-01.md", ["abc1234", undefined])],
      }),
    ).toMatchObject({ status: "fail" });
  });

  it("R8: a row on neither fails even when another page has a row to run", () => {
    expect(
      decide({
        production: prod,
        pages: [pageWith("docs/plan/p6-02.md", ["0123abc", "neither"]), own],
      }),
    ).toMatchObject({ status: "fail" });
  });

  it("R9: only red rows on the base and no other page → fail: no red row of its own", () => {
    const result = decide({ production: prod, pages: [merged] });
    expect(result).toMatchObject({ status: "fail", skipped: skippedMerged });
    expect(result).toMatchObject({
      reason: expect.stringContaining("no Red row of its own"),
    });
  });

  it("R9: only red rows on the base, and another page names a reviewed exception → review", () => {
    expect(
      decide({
        production: prod,
        pages: [
          merged,
          {
            page: "docs/plan/def-031.md",
            log: { kind: "exception", exception: "dead-code deletion" },
          },
        ],
      }),
    ).toMatchObject({ status: "review", skipped: skippedMerged });
  });

  it("R9: only red rows on the base, and another page says docs only → fail", () => {
    expect(
      decide({
        production: prod,
        pages: [
          merged,
          {
            page: "docs/plan/def-031.md",
            log: { kind: "exception", exception: "docs only" },
          },
        ],
      }),
    ).toMatchObject({ status: "fail", skipped: skippedMerged });
  });

  it("R10: a merged page and a page with a red row on the branch → run the branch row, report the base row", () => {
    expect(decide({ production: prod, pages: [merged, own] })).toEqual({
      status: "run",
      runs: [
        {
          page: "docs/plan/def-031.md",
          sha: "fedcba9",
          command: "npm run test:unit",
          message: "x",
        },
      ],
      skipped: skippedMerged,
    });
  });

  it("R10: one page with a row on the branch and a row on the base → run one, report one", () => {
    expect(
      decide({
        production: prod,
        pages: [
          pageWith(
            "docs/plan/p6-01.md",
            ["abc1234", "base"],
            ["fedcba9", "branch"],
          ),
        ],
      }),
    ).toMatchObject({
      status: "run",
      runs: [{ sha: "fedcba9" }],
      skipped: [{ sha: "abc1234" }],
    });
  });

  it("R1: no production code changed → pass, and nothing is skipped", () => {
    expect(decide({ production: [], pages: [merged] })).toMatchObject({
      status: "pass",
      skipped: [],
    });
  });
});

describe("judgeRedRun — decision table", () => {
  const expected = "Error: not implemented";

  it("a red run that exits 0 did not fail first → fail", () => {
    expect(
      judgeRedRun({
        exitCode: 0,
        output: "1 passed",
        expectedMessage: expected,
      }),
    ).toMatchObject({ ok: false });
  });

  it("a red run that fails with the stated message → ok", () => {
    expect(
      judgeRedRun({
        exitCode: 1,
        output: "FAIL scripts/x.test.mjs\n  Error: not implemented\n",
        expectedMessage: expected,
      }),
    ).toMatchObject({ ok: true });
  });

  it("a red run that fails for another reason → fail", () => {
    expect(
      judgeRedRun({
        exitCode: 1,
        output: "TypeError: x is not a function",
        expectedMessage: expected,
      }),
    ).toMatchObject({ ok: false });
  });

  it("colour codes and line breaks in the output do not hide the message", () => {
    expect(
      judgeRedRun({
        exitCode: 1,
        output: "\u001b[31mError:\u001b[39m   not\n implemented",
        expectedMessage: expected,
      }),
    ).toMatchObject({ ok: true });
  });

  it("'Cannot find module' is never an accepted red failure", () => {
    expect(
      judgeRedRun({
        exitCode: 1,
        output: "Error: Cannot find module './x.mjs'",
        expectedMessage: "Cannot find module",
      }),
    ).toMatchObject({ ok: false });
  });
});

describe("judgeGreenRun — equivalence partitioning", () => {
  it("exit 0 → ok", () => {
    expect(judgeGreenRun({ exitCode: 0 })).toMatchObject({ ok: true });
  });

  it("any other exit code → fail", () => {
    expect(judgeGreenRun({ exitCode: 1 })).toMatchObject({ ok: false });
  });
});
