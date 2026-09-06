import { configureTest, expect } from "../ui/fixtures/test";
import { plannerState } from "../ui/support/planner-state";
import { buildGroup } from "../ui/support/test-data";
import { BrowseTheWeb } from "../ui/screenplay/abilities/browse-the-web";
import { openGroupCard } from "../ui/screenplay/tasks/group-tasks";
import {
  STORAGE_KEYS,
  readStorageFixture,
  storageStateFromFixture,
} from "../ui/support/storage-fixtures";
import { PORTED_STORAGE_PREFIX } from "../ui/support/environment";

/**
 * The React port, slice 1 — tagged `@ported`, so it runs only against the build
 * served at `/next/` and is skipped for the legacy page.
 *
 * These read the same fixtures batch 1.13 wrote for the legacy app. That is the
 * point: the port is correct when the contract specs' data produces the same
 * screen, not when it merely looks similar.
 */

const BASE_URL = "http://localhost:4174";

const realistic = configureTest({
  storageOverride: storageStateFromFixture(
    BASE_URL,
    readStorageFixture("realistic"),
    PORTED_STORAGE_PREFIX,
  ),
});

realistic.describe("Ported shell @ported @portedonly", () => {
  realistic(
    "Renders the stored groups with their lesson counts",
    async ({ actor }) => {
      const { planner } = actor.abilityTo(BrowseTheWeb);

      // The same three groups the legacy app renders from this fixture,
      // including the one with no lessons and the Cyrillic name with a comma.
      await expect(planner.groupCard("Monday Beginners")).toBeVisible();
      await expect(planner.groupCard("Група, «А»")).toBeVisible();
      await expect(planner.groupCard("Wednesday Advanced")).toBeVisible();

      await expect(planner.groupCardLessonCount("Monday Beginners")).toHaveText(
        "3 planned lessons",
      );
      await expect(planner.groupCardLessonCount("Група, «А»")).toHaveText(
        "1 planned lessons",
      );
      await expect(
        planner.groupCardLessonCount("Wednesday Advanced"),
      ).toHaveText("0 planned lessons");
    },
  );
});

const legacyShaped = configureTest({
  storageOverride: storageStateFromFixture(
    BASE_URL,
    readStorageFixture("legacy"),
    PORTED_STORAGE_PREFIX,
  ),
});

legacyShaped.describe("Ported shell @ported @portedonly", () => {
  legacyShaped(
    "Reads a group written without currency or overrides",
    async ({ actor, page }) => {
      const { planner } = actor.abilityTo(BrowseTheWeb);
      const errors: string[] = [];
      page.on("pageerror", (error) => {
        errors.push(error.message);
      });

      // This shape breaks the legacy app: opening such a group throws
      // `Currency code is required with currency style.` (DEF-003). The port
      // falls back to the default currency instead, so the same data renders.
      await expect(planner.groupCard("Older Group")).toBeVisible();
      await expect(planner.groupCardLessonCount("Older Group")).toHaveText(
        "2 planned lessons",
      );
      await expect(planner.groupCard("Older Group")).toHaveAttribute(
        "data-currency",
        "UAH",
      );
      expect(errors).toEqual([]);
    },
  );
});

const emptyPlanner = configureTest({
  storageOverride: storageStateFromFixture(
    BASE_URL,
    readStorageFixture("empty"),
    PORTED_STORAGE_PREFIX,
  ),
});

emptyPlanner.describe("Ported shell @ported @portedonly", () => {
  emptyPlanner(
    "Shows the empty state when nothing is stored",
    async ({ actor }) => {
      const { planner } = actor.abilityTo(BrowseTheWeb);
      await expect(planner.emptyState).toBeVisible();
    },
  );
});

const corrupted = configureTest({
  storageOverride: {
    cookies: [],
    origins: [
      {
        origin: BASE_URL,
        localStorage: [
          {
            name: `${PORTED_STORAGE_PREFIX}groupLessonPlannerData`,
            value: "not json at all {{{",
          },
        ],
      },
    ],
  },
});

corrupted.describe("Ported shell @ported @portedonly", () => {
  corrupted(
    "Says so when the stored data cannot be read, instead of going inert",
    async ({ actor, page }) => {
      const { planner } = actor.abilityTo(BrowseTheWeb);

      // DEF-001 in the legacy app leaves a page that looks normal and does
      // nothing. The port must not inherit that: the adapter reports a bad
      // value rather than throwing, so the shell still renders and says what
      // happened.
      await expect(page.getByRole("alert")).toContainText("could not be read");
      await expect(planner.addGroupButton).toBeVisible();
      await expect(planner.emptyState).toBeHidden();
    },
  );
});

/**
 * Write-back, against the port.
 *
 * `storage-contract.spec.ts` asserts this for the legacy app and stays
 * legacy-only, because its fixtures are bound to that origin. The read side is
 * covered above; this is the write side, and it is the half that matters for
 * the cutover in batch 2a.4 — after it the port writes the teacher's real keys.
 */
const writeBack = configureTest({
  plannerState: plannerState({
    groups: [
      buildGroup({ name: "Monday Beginners", price: 250, currency: "UAH" }),
      buildGroup({ name: "Wednesday Advanced", price: 300, currency: "UAH" }),
    ],
    defaultCurrency: "UAH",
    template: "Lessons for {{month}}: {{lessons}} at {{total}}.",
  }),
});

writeBack.describe("Ported shell @ported @portedonly", () => {
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
        [
          `${PORTED_STORAGE_PREFIX}${STORAGE_KEYS.data}`,
          `${PORTED_STORAGE_PREFIX}${STORAGE_KEYS.settings}`,
          `${PORTED_STORAGE_PREFIX}${STORAGE_KEYS.template}`,
        ],
      );

      // Data: an array of groups, the edit applied, the other group untouched.
      const groups = JSON.parse(keys.data ?? "null") as {
        name: string;
        price: number;
      }[];
      expect(groups).toHaveLength(2);
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

      // Template: a raw string, never JSON-encoded, and untouched by the edit.
      expect(keys.template).toBe(
        "Lessons for {{month}}: {{lessons}} at {{total}}.",
      );
      expect(keys.template?.startsWith('"')).toBe(false);
    },
  );
});

/**
 * The prefix is the whole safety argument for staging sharing an origin with
 * the real app, so it is asserted rather than assumed.
 */
const prefixCheck = configureTest({
  plannerState: plannerState({ groups: [] }),
});

prefixCheck.describe("Ported shell @ported @portedonly", () => {
  prefixCheck("Reads only prefixed keys", async ({ page }) => {
    const keys = await page.evaluate(() => Object.keys(localStorage));

    // Every key the suite seeded for this app carries the prefix, and the
    // build reads those. An unprefixed key would mean staging is looking at
    // production data.
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      expect(key.startsWith("next:")).toBe(true);
    }
  });
});
