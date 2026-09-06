import { configureTest, expect } from "../ui/fixtures/test";
import { BrowseTheWeb } from "../ui/screenplay/abilities/browse-the-web";
import { openGroupCard } from "../ui/screenplay/tasks/group-tasks";
import {
  STORAGE_KEYS,
  readRawFixture,
  readStorageFixture,
  storageStateFromFixture,
  storageStateWithCorruptKey,
} from "../ui/support/storage-fixtures";
import { storedGroups } from "../ui/support/planner-storage";

/**
 * The storage contract.
 *
 * These are the specs the React port runs unchanged. They say what the app must
 * read, what it must write back, and what it must do when the data is broken —
 * see .claude/context/storage-data-contract.md, which calls this the most
 * important invariant in the project.
 *
 * ISTQB technique: equivalence partitioning on the stored shape. A planner
 * starts from nothing, from a realistic dataset, from data written by an older
 * version of the app, or from something unreadable. Two of those four are
 * pinned defects — the app copes with a full dataset and with an empty one, and
 * fails on both edges.
 *
 * The fixtures live in `e2e/fixtures/storage/` so that batch 2a.3a can point
 * the ported app at the same files rather than re-describing the shapes.
 */

const BASE_URL = "http://localhost:4173";

const fromFixture = (name: string, prefix = "") =>
  storageStateFromFixture(BASE_URL, readStorageFixture(name), prefix);

/* ---------- Partition 1: nothing stored ---------- */

const emptyStorage = configureTest({
  storageOverride: fromFixture("empty"),
});

emptyStorage.describe("Storage contract — equivalence partitioning", () => {
  emptyStorage(
    "A planner with no stored keys starts empty",
    async ({ actor, page }) => {
      const { planner } = actor.abilityTo(BrowseTheWeb);

      await expect(planner.emptyState).toBeVisible();
      expect(await storedGroups(page)).toEqual([]);
      // Reading must not write. A first visit that has saved nothing should leave
      // storage untouched, so a later version can tell "never used" from "emptied".
      expect(
        await page.evaluate(
          (key) => localStorage.getItem(key),
          STORAGE_KEYS.data,
        ),
      ).toBeNull();
    },
  );
});

/* ---------- Partition 2: a realistic dataset ---------- */

const realistic = configureTest({ storageOverride: fromFixture("realistic") });

realistic.describe("Storage contract — equivalence partitioning", () => {
  realistic(
    "A realistic dataset is read back exactly as written",
    async ({ actor, page }) => {
      const { planner, monthlyOverrides } = actor.abilityTo(BrowseTheWeb);
      const fixture = readStorageFixture("realistic");

      // Every group renders, including the one with no lessons and the one whose
      // name carries a comma and Cyrillic text.
      await expect(planner.groupCard("Monday Beginners")).toBeVisible();
      await expect(planner.groupCard("Група, «А»")).toBeVisible();
      await expect(planner.groupCard("Wednesday Advanced")).toBeVisible();
      await expect(planner.groupCardLessonCount("Monday Beginners")).toHaveText(
        "3 planned lessons",
      );

      // Two months with different prices come through as stored.
      await actor.attemptsTo(openGroupCard("Monday Beginners"));
      await expect(monthlyOverrides.perLessonText("2026-07")).toContainText(
        "250.00",
      );
      await expect(monthlyOverrides.perLessonText("2026-08")).toContainText(
        "300.00",
      );

      // And nothing was rewritten just by looking at it.
      expect(await storedGroups(page)).toEqual(fixture.groupLessonPlannerData);
    },
  );
});

/* ---------- Partition 3: data from an older version ---------- */

const legacy = configureTest({ storageOverride: fromFixture("legacy") });

legacy.describe("Storage contract — equivalence partitioning", () => {
  legacy(
    "A group saved without a currency still opens",
    async ({ actor, page }) => {
      legacy.fixme(
        true,
        "DEF-003: a group whose currency is missing or not a currency code cannot be opened",
      );
      const { planner, groupModal } = actor.abilityTo(BrowseTheWeb);
      const errors: string[] = [];
      page.on("pageerror", (error) => {
        errors.push(error.message);
      });

      // The legacy fixture holds `{name, price, dates}` and nothing else — no
      // `currency`, no `monthlyOverrides`. The card itself is fine.
      await expect(planner.groupCard("Older Group")).toBeVisible();
      await expect(planner.groupCardLessonCount("Older Group")).toHaveText(
        "2 planned lessons",
      );

      // Then opening it works, with the default currency standing in.
      //
      // Today clicking the card throws `Currency code is required with currency
      // style.` and the dialog never opens, so the group is unreachable from
      // the UI — the group list shows it and nothing more can be done with it.
      // `renderGroupInfo` does guard the currency; `createMonthRow` calls
      // `formatCurrency(total, group.currency)` with no fallback, and that is
      // the line that throws. Fixed in plan batch 3.2.
      await actor.attemptsTo(openGroupCard("Older Group"));
      await expect(groupModal.modal).toBeVisible();
      await expect(groupModal.currencyDisplay).toHaveText("UAH");
      expect(errors).toEqual([]);
    },
  );
});

/* ---------- Write-back ---------- */

const writeBack = configureTest({ storageOverride: fromFixture("realistic") });

writeBack.describe("Storage contract — write-back", () => {
  writeBack(
    "A saved edit writes all three keys in their documented shapes",
    async ({ actor, page }) => {
      const { groupModal } = actor.abilityTo(BrowseTheWeb);

      await actor.attemptsTo(openGroupCard("Wednesday Advanced"));
      await groupModal.enterEditMode();
      await groupModal.groupPriceInput.fill("777");
      await groupModal.saveGroup();

      const keys = await page.evaluate(
        ([data, settings, template]) => ({
          data: localStorage.getItem(data ?? ""),
          settings: localStorage.getItem(settings ?? ""),
          template: localStorage.getItem(template ?? ""),
        }),
        [STORAGE_KEYS.data, STORAGE_KEYS.settings, STORAGE_KEYS.template],
      );

      // Data: an array of groups, edit applied, everything else untouched.
      const groups = JSON.parse(keys.data ?? "null") as {
        name: string;
        price: number;
      }[];
      expect(groups).toHaveLength(3);
      expect(groups.find((g) => g.name === "Wednesday Advanced")?.price).toBe(
        777,
      );
      expect(groups.find((g) => g.name === "Monday Beginners")?.price).toBe(
        250,
      );

      // Settings: an object with exactly the one documented field.
      expect(JSON.parse(keys.settings ?? "null")).toEqual({
        defaultCurrency: "UAH",
      });

      // Template: a raw string, never JSON-encoded.
      expect(keys.template).toBe(
        "Lessons for {{month}}: {{lessons}} at {{total}}.",
      );
      expect(keys.template?.startsWith('"')).toBe(false);
    },
  );
});

/* ---------- The staging prefix ---------- */

const prefixed = configureTest({
  storageOverride: fromFixture("realistic", "next:"),
});

prefixed.describe("Storage contract — staging prefix", () => {
  prefixed(
    "Prefixed keys are invisible to the app reading unprefixed ones",
    async ({ actor, page }) => {
      const { planner } = actor.abilityTo(BrowseTheWeb);

      // The whole point of the prefix, from batch 2a: a staging build can share
      // an origin with the real app and not see — or damage — its data. Here
      // the app reads the production keys, finds nothing, and shows the empty
      // state while the prefixed data sits beside it untouched.
      await expect(planner.emptyState).toBeVisible();
      expect(await storedGroups(page)).toEqual([]);

      const stillThere = await page.evaluate(
        (key) => localStorage.getItem(key),
        `next:${STORAGE_KEYS.data}`,
      );
      expect(JSON.parse(stillThere ?? "null")).toHaveLength(3);
    },
  );
});

/* ---------- Corrupt storage ---------- */

const corrupt = configureTest({
  storageOverride: storageStateWithCorruptKey(
    BASE_URL,
    "data",
    readRawFixture("corrupt.txt"),
  ),
});

corrupt.describe("Storage contract — corrupt data", () => {
  corrupt(
    "Unreadable stored data leaves a working app that says what happened",
    async ({ actor }) => {
      corrupt.fixme(
        true,
        "DEF-001: corrupt storage leaves the page inert with no message; fix in plan batch 3.1",
      );
      const { planner, groupModal } = actor.abilityTo(BrowseTheWeb);

      // Then the app still works — the clearest proof is that a control does
      // something — and it tells the user their data could not be read.
      //
      // Today the page *looks* fine and is inert. `storage.load()` calls
      // `JSON.parse` with no guard, the exception escapes `App.init()`, and
      // everything after it is skipped: no `bindEvents()`, no `render.groups()`.
      // The toolbar is static markup, so it is still on screen with no handlers
      // behind it. Clicking "+ Add Group" does nothing, the month dropdown has
      // no options, there is no empty-state message and no error. A blank page
      // would at least look broken.
      //
      // Note the error cannot be caught with `page.on("pageerror")` inside a
      // test: it is thrown while the inline script first runs, before any
      // listener attached in the test body exists. Asserting the app responds
      // is both more faithful to what the user sees and actually observable.
      await planner.openAddGroupModal();
      await expect(groupModal.modal).toBeVisible();
    },
  );
});
