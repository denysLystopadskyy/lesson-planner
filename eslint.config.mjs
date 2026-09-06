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
      "playwright-report/",
      // The deployed page. Not TypeScript, and untouched until batch 2a.4.
      "index.html",
      // An archive, excluded from formatting for the same reason.
      "docs/research/",
      // Flat config itself is not in the tsconfig project, so type-aware rules
      // cannot resolve it.
      "eslint.config.mjs",
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
