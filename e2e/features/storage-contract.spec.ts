import { configureTest, expect } from "../ui/fixtures/test";
import { plannerState } from "../ui/support/planner-state";
import { APP_STORAGE_PREFIX } from "../ui/support/environment";
import { buildGroup } from "../ui/support/test-data";
import { BrowseTheWeb } from "../ui/screenplay/abilities/browse-the-web";
import { addGroup, openGroupCard } from "../ui/screenplay/tasks/group-tasks";
import {
  STORAGE_KEYS,
  readStorageFixture,
  storageStateFromFixture,
} from "../ui/support/storage-fixtures";

/**
 * The storage contract: what the app must read, what it must write back, and
 * what it must do when the data is broken. See
 * .claude/context/storage-data-contract.md, which calls this the most important
 * invariant in the project.
 *
 * These read the fixtures batch 1.13 wrote for the legacy page, which is the
 * point — the port is correct when that data produces the same screen. The
 * legacy-page version of this file was deleted with the page in batch 2a.4;
 * this one, written against the port in 2a.3a, took its name.
 *
 * Two of its partitions were pinned defects against the legacy page and are not
 * defects here: DEF-001 (corrupt storage left the page inert) and DEF-003 (a
 * group with no currency could not be opened). They are asserted, unpinned, so
 * a regression fails loudly.
 */

/**
 * The origin the seeded storage state is attached to. It must match the origin
 * the app is served from, or the browser hands the app an empty localStorage
 * and every partition below reads as "nothing stored".
 *
 * Overridable because batch 2a.4 has to run this suite against the deployed
 * site as well as the local build, and the deployed origin is not localhost.
 */
const BASE_URL = process.env.PW_BASE_URL ?? "http://localhost:4173";

const realistic = configureTest({
  storageOverride: storageStateFromFixture(
    BASE_URL,
    readStorageFixture("realistic"),
    APP_STORAGE_PREFIX,
  ),
});

realistic.describe("Storage contract", () => {
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
    APP_STORAGE_PREFIX,
  ),
});

legacyShaped.describe("Storage contract", () => {
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
    APP_STORAGE_PREFIX,
  ),
});

emptyPlanner.describe("Storage contract", () => {
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
            name: `${APP_STORAGE_PREFIX}groupLessonPlannerData`,
            value: "not json at all {{{",
          },
        ],
      },
    ],
  },
});

corrupted.describe("Storage contract", () => {
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

writeBack.describe("Storage contract", () => {
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
          `${APP_STORAGE_PREFIX}${STORAGE_KEYS.data}`,
          `${APP_STORAGE_PREFIX}${STORAGE_KEYS.settings}`,
          `${APP_STORAGE_PREFIX}${STORAGE_KEYS.template}`,
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
 * The mirror image of the check this file carried before the cutover.
 *
 * While the port was staging, the assertion was that every key it touched
 * carried the `next:` prefix, because that was the whole safety argument for
 * sharing an origin with the live page. Now the app **is** the live page, and
 * the thing worth proving is the opposite: it reads the teacher's real keys and
 * a stray prefixed build cannot be what shipped.
 */
const prefixCheck = configureTest({
  plannerState: plannerState({ groups: [] }),
});

prefixCheck.describe("Storage contract", () => {
  prefixCheck("Reads the real, unprefixed keys", async ({ page }) => {
    const keys = await page.evaluate(() => Object.keys(localStorage));

    // A `next:` key here would mean the staging build shipped, and the teacher
    // would open the app to an empty planner with her data sitting beside it
    // under names nothing reads.
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      expect(key.startsWith("next:")).toBe(false);
      expect(
        key.startsWith("groupLessonPlanner") || key === "paymentTemplate",
      ).toBe(true);
    }
  });
});

/**
 * The golden shape, deep-equal.
 *
 * The write-back test above asserts field by field, which is the wrong shape of
 * assertion for one specific risk: a field that should not be there at all. The
 * store keeps bookkeeping on its state — `pending`, which tells the persistence
 * subscriber what to do, and `loadError` — and a subscriber that serialised the
 * state object instead of the three slices would write those into the
 * teacher's data. Every per-field assertion in this file would still pass.
 *
 * So this one reads all three keys and compares them with the fixture it was
 * seeded from, plus the single edit it made. Anything extra, anywhere, fails.
 * Added in batch 2b.10 alongside the store; the describes above are unchanged.
 */
const goldenShape = configureTest({
  storageOverride: storageStateFromFixture(
    BASE_URL,
    readStorageFixture("realistic"),
    APP_STORAGE_PREFIX,
  ),
});

goldenShape.describe("Storage contract — golden shape", () => {
  goldenShape(
    "One edit writes the three keys and adds nothing of its own",
    async ({ actor, page }) => {
      const { groupModal } = actor.abilityTo(BrowseTheWeb);
      const fixture = readStorageFixture("realistic");

      // Given the realistic fixture, when the price of the group with no
      // lessons and no overrides changes — the group whose edit ripples the
      // least, so anything else that moves is the store's doing.
      await actor.attemptsTo(openGroupCard("Wednesday Advanced"));
      await groupModal.enterEditMode();
      await groupModal.groupPriceInput.fill("777");
      await groupModal.saveGroup();

      // Read out as raw strings and parsed here, so the parsed values are
      // typed rather than `any` crossing the browser boundary.
      const raw = await page.evaluate(
        ([data, settings, template]) => ({
          data: localStorage.getItem(data ?? ""),
          settings: localStorage.getItem(settings ?? ""),
          template: localStorage.getItem(template ?? ""),
        }),
        [
          `${APP_STORAGE_PREFIX}${STORAGE_KEYS.data}`,
          `${APP_STORAGE_PREFIX}${STORAGE_KEYS.settings}`,
          `${APP_STORAGE_PREFIX}${STORAGE_KEYS.template}`,
        ],
      );

      const written = {
        data: JSON.parse(raw.data ?? "null") as unknown,
        settings: JSON.parse(raw.settings ?? "null") as unknown,
        template: raw.template,
      };

      const expected = structuredClone(fixture.groupLessonPlannerData) as {
        name: string;
        price: number;
      }[];
      const edited = expected.find((g) => g.name === "Wednesday Advanced");
      expect(edited).toBeDefined();
      if (edited !== undefined) edited.price = 777;

      // Then the data key is that array and nothing else: no wrapper object, no
      // `pending`, no field added to a group, and the two groups nobody touched
      // still carry their dates and overrides exactly as they were.
      expect(written.data).toEqual(expected);
      expect(written.template).toBe(fixture.paymentTemplate);

      // The settings key is the one thing that legitimately differs from the
      // fixture, and not because of the store: saving a group's info sets the
      // app-wide default currency to **that group's** currency, whether or not
      // the select was touched. The fixture's default is PLN and this group is
      // UAH, so the edit flips it. The legacy app does the same thing on the
      // same line as its save (`App.state.defaultCurrency =
      // groupCurrencyInput.value`), so the port is faithful — and it is
      // DEF-026, registered when this assertion measured it. Asserted as
      // current behaviour so the fix in batch 3.4a has to change it
      // deliberately.
      expect(written.settings).toEqual({ defaultCurrency: "UAH" });
    },
  );
});

/**
 * The one thing a persistence subscriber must not do.
 *
 * A subscriber that wrote on mount — or that reconciled state with storage,
 * which after a load failure means writing an empty planner over the value it
 * failed to read — would destroy the data the user came to recover. The
 * corrupt-storage test above would still pass: it asserts the alert and a
 * visible button, both of which are true either way.
 *
 * The store makes this a state transition instead of a hope: `pending` starts
 * at "none" and only an action moves it, which `app/src/store.test.ts` asserts
 * directly. This is the browser half — and the second case proves the rule is
 * "write when the user changes something", not "never write".
 */
corrupted.describe("Storage contract — no write on mount", () => {
  corrupted(
    "An unreadable value is left alone until the user changes something",
    async ({ actor, page }) => {
      const dataKey = `${APP_STORAGE_PREFIX}${STORAGE_KEYS.data}`;
      const read = () =>
        page.evaluate((key) => localStorage.getItem(key), dataKey);

      // Given a corrupt value and a loaded app, nothing has been written over
      // it — the user can still copy it out of devtools.
      await expect(page.getByRole("alert")).toContainText("could not be read");
      expect(await read()).toBe("not json at all {{{");

      // When the user adds a group, the write happens and replaces it. That is
      // the same as before the store: a mutation is a mutation, whatever the
      // stored value was.
      await actor.attemptsTo(
        addGroup({ name: "Fresh Start", price: 120, currency: "UAH" }),
      );

      await expect
        .poll(async () => JSON.parse((await read()) ?? "null") as unknown)
        .toEqual([
          expect.objectContaining({ name: "Fresh Start", price: 120 }),
        ]);
    },
  );
});
