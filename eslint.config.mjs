import tseslint from "typescript-eslint";
import playwright from "eslint-plugin-playwright";
import prettier from "eslint-config-prettier";

/**
 * Official presets only, in the order they have to be applied. No hand-written
 * rules — see .claude/context/linting-formatting.md. A custom rule needs its
 * need recorded there first.
 */
export default tseslint.config(
  {
    ignores: [
      "node_modules/",
      "test-results/",
      "app/dist/",
      "playwright-report/",
      // The deployed page. Not TypeScript, and untouched until batch 2a.4.
      "index.html",
      // An archive, excluded from formatting for the same reason.
      "docs/research/",
      // Flat config itself is not in the tsconfig project, so type-aware rules
      // cannot resolve it.
      "eslint.config.mjs",
      // Build scripts, for the same reason: plain ESM outside every tsconfig,
      // so `projectService` cannot resolve them and every type-aware rule
      // errors on the file rather than on its contents (plan batch 3.5).
      // `check-no-personal-data.mjs` is covered instead by the `--self-test`
      // it runs on every invocation, in CI included — which checks the thing
      // that actually matters, that its patterns still match.
      "scripts/",
    ],
  },
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ["e2e/**/*.ts"],
    ...playwright.configs["flat/recommended"],
    rules: {
      // **The preset was not in effect until batch 3.7.** Spreading the config
      // above and then writing `rules:` replaces the preset's rules wholesale,
      // so one rule was active where the preset defines thirty-six
      // (`npx eslint --print-config` showed it). Spreading them back in is the
      // fix, and the line below is the reason it was not done sooner.
      ...playwright.configs["flat/recommended"].rules,

      // The one rule that cannot see through this suite's shape. Every spec
      // builds its own test function with `configureTest(...)`, so the plugin
      // has no way to recognise a test block and reports every `expect` inside
      // one as standalone: 201 errors, all false.
      //
      // The alternative is naming every alias in `globalAliases` below, which
      // is what the list there attempts — and Phase 3 is the argument against
      // it. This phase added about twelve new aliases across five new specs and
      // registered none of them, and nothing noticed, because the rule was
      // switched off by the very mistake this batch is fixing. A list that
      // silently falls behind is worse than an honest exemption.
      //
      // What is lost: an `expect` at module scope, outside any test, would
      // never run and would not be reported. What is kept: the other
      // thirty-five rules, which found two real problems the moment they were
      // switched on.
      "playwright/no-standalone-expect": "off",
      // A Screenplay test asserts through `actor.verifies(...)` or the aria
      // snapshot helper rather than a bare `expect`. Naming them keeps the rule
      // able to spot a test that really asserts nothing.
      "playwright/expect-expect": [
        "error",
        {
          assertFunctionNames: ["expectAriaSnapshot"],
          assertFunctionPatterns: ["verifies"],
        },
      ],
    },
    settings: {
      playwright: {
        // Every spec builds its own test object with `configureTest(...)`, so
        // the plugin cannot recognise a test block by name and reports every
        // `expect` inside one as standalone. Registering the names keeps
        // `no-standalone-expect` doing its real job — catching an `expect` at
        // module scope, which would silently never run.
        globalAliases: {
          test: [
            "addGroupTest",
            "cancelRevertsPrice",
            "deletable",
            "hookSubset",
            "corrupted",
            "legacyShaped",
            "prefixCheck",
            "corrupt",
            "emptyStorage",
            "legacy",
            "prefixed",
            "realistic",
            "writeBack",
            "templateLost",
            "balancedQuote",
            "bomTest",
            "confirmBeforeReplace",
            "exportContract",
            "rejectTest",
            "templateTest",
            "validImport",
            "roundTrip",
            "allThree",
            "copyFails",
            "copyWorks",
            "golden",
            "nothingToCopy",
            "oneMissing",
            "unknownPlaceholder",
            "bulkBoundary",
            "bulkScope",
            "cascade",
            "disabledUntilSelection",
            "emptyBulk",
            "noCascadeWithoutMatch",
            "rowStructure",
            "rowTotals",
            "singleMonthBulk",
            "allSelected",
            "backwardRollover",
            "cancelExit",
            "doneExit",
            "escapeExitDuringEdit",
            "forwardRollover",
            "gridStructure",
            "malformedYear",
            "noneSelected",
            "openEditor",
            "someSelected",
            "todayReturns",
            "cancelNameExit",
            "cancelPriceExit",
            "escapeExit",
            "noChangeExit",
            "overlayExit",
            "priceKeepsName",
            "saveExit",
            "duplicateName",
            "htmlName",
            "nameOnAdd",
            "nameOnEdit",
            "negativeTotal",
            "priceTest",
            "cancelResetTest",
            "cancelTemplateTest",
            "clearTemplateTest",
            "confirmResetTest",
            "contractTest",
            "copyMessageTest",
            "deleteGroupTest",
            "editGroupTest",
            "editMonthPriceTest",
            "editTemplateTest",
            "emptyMonthTest",
            "emptyPlanner",
            "exportEmptyTest",
            "exportWithGroupsTest",
            "generateMessageTest",
            "importInvalidTest",
            "importValidTest",
            "oneGroup",
            "persistedOverrideTest",
            "scheduleTest",
          ],
        },
      },
    },
  },
  // Last, so it can switch off everything Prettier already owns.
  prettier,
);
