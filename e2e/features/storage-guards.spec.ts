import type { Page } from "@playwright/test";
import { configureTest, expect } from "../ui/fixtures/test";
import { APP_STORAGE_PREFIX } from "../ui/support/environment";
import { BrowseTheWeb } from "../ui/screenplay/abilities/browse-the-web";
import { addGroup, openGroupCard } from "../ui/screenplay/tasks/group-tasks";

/**
 * Storage guards — batch 3.1.
 *
 * Three ways stored data can be wrong, and what the user is told about each.
 * The unit tests in `storage.test.ts` prove the adapter returns the right
 * values; these prove the screen says something, which is the half of DEF-021
 * and DEF-022 a unit test structurally cannot reach. A returned error nobody
 * renders is the same silence as no error at all.
 *
 * Technique: equivalence partitioning over the state of the stored value —
 * unreadable, readable but misshapen, and unwritable.
 *
 * Each test was run against the pre-batch code first. Five fail there, for the
 * reason they name: no backup key, a dialog that never opens, no repair notice,
 * no save-failure alert, and a group that never reaches the screen. **Two pass
 * both before and after** — "Leaves the original value alone" and "Still shows
 * the group's real data" — and are recorded here as guards rather than proofs.
 * The first pins the no-write-on-mount property this batch must not break; the
 * second pins the repair rule against a future validator that drops data
 * instead of mending it. Saying which is which is the point: a test that cannot
 * fail for the defect it names is worth having only if nobody mistakes it for
 * one that can.
 */

/**
 * The origin the seeded storage state is attached to. It must match the origin
 * the app is served from, or the browser hands the app an empty localStorage.
 */
const BASE_URL = process.env.PW_BASE_URL ?? "http://localhost:4173";

const DATA_KEY = `${APP_STORAGE_PREFIX}groupLessonPlannerData`;

/** Seeds one raw string under the data key. */
const seedData = (value: string) => ({
  cookies: [],
  origins: [{ origin: BASE_URL, localStorage: [{ name: DATA_KEY, value }] }],
});

/* ---------------------------------------------------------------------------
 * Partition 1: the value cannot be read at all.
 * ------------------------------------------------------------------------- */

const unreadable = configureTest({
  storageOverride: seedData("not json at all {{{"),
});

unreadable.describe("Storage guards — an unreadable value", () => {
  unreadable(
    "Keeps the unreadable text under a backup key",
    async ({ actor, page }) => {
      // Given storage holding text that is not JSON
      // When the app loads
      const { planner } = actor.abilityTo(BrowseTheWeb);
      await expect(planner.addGroupButton).toBeVisible();

      // Then the bytes still exist somewhere the user can be pointed at. The
      // banner has always promised "nothing has been changed or deleted"; this
      // is the batch that makes that promise recoverable rather than merely
      // true-by-inaction.
      const backup = await page.evaluate(
        (key: string) => window.localStorage.getItem(`${key}.corrupt.backup`),
        DATA_KEY,
      );

      expect(backup).toBe("not json at all {{{");
    },
  );

  unreadable("Leaves the original value alone", async ({ page }) => {
    // The other half of the promise. A mount-time write would replace the
    // corrupt value with an empty planner and destroy what the user came to
    // recover — `pending` starting at "none" is what prevents it.
    const original = await page.evaluate(
      (key: string) => window.localStorage.getItem(key),
      DATA_KEY,
    );

    expect(original).toBe("not json at all {{{");
  });
});

/* ---------------------------------------------------------------------------
 * Partition 2: the value reads, but its shape is wrong — DEF-021.
 * ------------------------------------------------------------------------- */

/**
 * A group whose June override has a price and no `dates` array. This is valid
 * JSON, so `JSON.parse` accepts it and the old `as Group[]` cast waved it
 * through; `monthsToRender` then read `.length` of the missing array **during a
 * render**, and the group dialog died instead of opening.
 */
const misshapen = configureTest({
  storageOverride: seedData(
    JSON.stringify([
      {
        name: "Monday Beginners",
        price: 250,
        currency: "UAH",
        dates: ["2026-06-01"],
        monthlyOverrides: { "2026-06": { price: 100 } },
      },
    ]),
  ),
});

misshapen.describe("Storage guards — a value of the wrong shape", () => {
  misshapen("Opens the group instead of crashing", async ({ actor }) => {
    // Given a stored override with no dates array
    // When the user opens that group
    const { groupModal } = actor.abilityTo(BrowseTheWeb);
    await actor.attemptsTo(openGroupCard("Monday Beginners"));

    // Then the dialog opens. This is the whole of DEF-021 from the user's side.
    await expect(groupModal.modal).toBeVisible();
    await expect(groupModal.nameDisplay).toHaveText("Monday Beginners");
  });

  misshapen("Says what it had to repair", async ({ page }) => {
    // Quietly rewriting stored data is the same sin as quietly failing to
    // store it, so the mend is reported. `role="status"` and not `alert`:
    // nothing is broken and nothing is waiting on the user.
    const notice = page.getByRole("status");

    await expect(notice).toContainText("had to be repaired");
    await expect(notice).toContainText("2026-06");
  });

  misshapen("Still shows the group's real data", async ({ actor }) => {
    // The repair rule is "never drop what the user can still use". The lesson
    // this group has is the reason it exists, so it survives the mend.
    const { planner } = actor.abilityTo(BrowseTheWeb);

    await expect(planner.groupCardLessonCount("Monday Beginners")).toHaveText(
      "1 planned lessons",
    );
  });
});

/**
 * Makes the browser refuse to store one key, from the next navigation on.
 *
 * It shadows `window.localStorage` with a stand-in that delegates every call to
 * the real store, rather than patching `Storage.prototype`. Two reasons: only
 * the key under test is affected, so a failure here cannot be a broken origin
 * in disguise; and every call below is an instance call, so nothing hands an
 * unbound DOM method around.
 */
const refuseWritesTo = async (page: Page, key: string): Promise<void> => {
  await page.addInitScript((refused: string) => {
    const real = window.localStorage;
    const standIn: Storage = {
      get length(): number {
        return real.length;
      },
      clear: (): void => {
        real.clear();
      },
      getItem: (name: string): string | null => real.getItem(name),
      key: (index: number): string | null => real.key(index),
      removeItem: (name: string): void => {
        real.removeItem(name);
      },
      setItem: (name: string, value: string): void => {
        if (name === refused) {
          const error = new Error("The quota has been exceeded.");
          error.name = "QuotaExceededError";
          throw error;
        }
        real.setItem(name, value);
      },
    };
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get: () => standIn,
    });
  }, key);
  await page.reload();
};

/* ---------------------------------------------------------------------------
 * Partition 3: the value cannot be written — DEF-022.
 * ------------------------------------------------------------------------- */

const writable = configureTest({});

writable.describe("Storage guards — a write the browser refuses", () => {
  writable(
    "Tells the user their change was not saved",
    async ({ actor, page }) => {
      // Given a browser that refuses to store the groups key
      await refuseWritesTo(page, DATA_KEY);

      // When the user adds a group
      await actor.attemptsTo(
        addGroup({ name: "Thursday Group", price: 300, currency: "UAH" }),
      );

      // Then they are told, in the terms that matter: it is on screen, it is
      // not stored, and closing the tab would lose it. Before this batch the
      // write threw out of the effect and the user was told nothing at all.
      const alert = page.getByRole("alert");
      await expect(alert).toContainText("could not be saved");
      await expect(alert).toContainText("not stored");
    },
  );

  writable("Keeps the change on screen", async ({ actor, page }) => {
    // The other half of honest failure. Reverting the edit would be a second
    // surprise on top of the first, and there is no server to reconcile with —
    // the user's own retype is the only recovery, so what they typed must stay.
    await refuseWritesTo(page, DATA_KEY);

    const { planner } = actor.abilityTo(BrowseTheWeb);
    await actor.attemptsTo(
      addGroup({ name: "Thursday Group", price: 300, currency: "UAH" }),
    );

    await expect(planner.groupCard("Thursday Group")).toBeVisible();
  });
});
