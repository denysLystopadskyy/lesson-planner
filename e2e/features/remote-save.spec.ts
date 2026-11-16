import type { Dialog, Page, Request } from "@playwright/test";
import { configureTest, expect } from "../ui/fixtures/test";
import { plannerState } from "../ui/support/planner-state";
import { putServerDocument, readServer } from "../ui/support/server-state";
import { buildGroup } from "../ui/support/test-data";
import {
  addGroup,
  closeModalWithEscape,
  editGroupInfo,
  openGroupCard,
} from "../ui/screenplay/tasks/group-tasks";
import {
  openTemplateEditor,
  saveTemplate,
} from "../ui/screenplay/tasks/template-tasks";
import { clearAllData } from "../ui/screenplay/tasks/data-reset-tasks";

/**
 * Remote mode saves to her account — plan batch 6.2, test conditions C5, C6
 * and C7, and review focus items 1, 2, 3 and 5.
 *
 * Risk R4 is high: "a refused or broken write is not reported, so an edit is
 * lost". Every spec here ends by reading the **server**, through the API, so a
 * "Saved" on screen that the server does not back fails the spec.
 *
 * Waits key on signals (testing.md §2.5): the indicator's text, a request the
 * page sends, or the server's copy — never on elapsed time.
 */

/** A browser profile with nothing in it, so any planner key is remote mode's. */
const EMPTY_PROFILE = { cookies: [], origins: [] };

const PLANNER_KEYS = [
  "groupLessonPlannerData",
  "groupLessonPlannerSettings",
  "paymentTemplate",
  "groupLessonPlannerLastBackup",
];

/** Every key in this origin's `localStorage` that belongs to the planner. */
const plannerKeys = (page: Page, prefix: string): Promise<string[]> =>
  page.evaluate(
    ({ names, prefix }) =>
      Object.keys(window.localStorage).filter((key) =>
        names.some((name) => key.startsWith(`${prefix}${name}`)),
      ),
    { names: PLANNER_KEYS, prefix },
  );

const isDocumentPut = (request: Request) =>
  request.method() === "PUT" &&
  new URL(request.url()).pathname.startsWith("/api/documents/");

const indicator = (page: Page) => page.locator("#syncIndicator");

const SAVED = /^Saved \d\d:\d\d$/;
const RETRYING = "Not saved — retrying";

const oneGroupOnServer = () =>
  plannerState({
    groups: [
      buildGroup({ name: "Monday Beginners", price: 300, currency: "UAH" }),
    ],
    defaultCurrency: "UAH",
  });

const signedIn = configureTest({
  signedIn: true,
  serverState: oneGroupOnServer(),
  storageOverride: EMPTY_PROFILE,
});

signedIn.describe(
  "C5 Remote mode never writes localStorage — checklist",
  () => {
    signedIn(
      "An add, an edit, a template save and Clear All leave no planner key",
      async ({ actor, page, request, sessionToken, storagePrefix }) => {
        if (sessionToken === null) throw new Error("signed in without a token");
        const server = () => readServer(request, sessionToken);
        await expect(indicator(page)).toHaveText(SAVED);

        // Checklist item 1 — when she adds a group,
        await actor.attemptsTo(
          addGroup({ name: "Friday Juniors", price: 250, currency: "UAH" }),
          closeModalWithEscape(),
        );
        // then the server holds it, and this browser holds no planner key.
        await expect
          .poll(async () =>
            ((await server()).data?.body as { name: string }[]).map(
              (group) => group.name,
            ),
          )
          .toEqual(["Monday Beginners", "Friday Juniors"]);
        await expect(indicator(page)).toHaveText(SAVED);
        expect(await plannerKeys(page, storagePrefix)).toEqual([]);

        // Checklist item 2 — when she edits a price,
        await actor.attemptsTo(
          openGroupCard("Monday Beginners"),
          editGroupInfo({
            name: "Monday Beginners",
            price: 320,
            currency: "UAH",
          }),
          closeModalWithEscape(),
        );
        await expect
          .poll(
            async () =>
              ((await server()).data?.body as { price: number }[])[0]?.price,
          )
          .toBe(320);
        expect(await plannerKeys(page, storagePrefix)).toEqual([]);

        // Checklist item 3 — when she saves the template,
        await actor.attemptsTo(
          openTemplateEditor(),
          saveTemplate("Lessons in {{month}}: {{count}}"),
        );
        await expect
          .poll(async () => (await server()).template?.body)
          .toBe("Lessons in {{month}}: {{count}}");
        expect(await plannerKeys(page, storagePrefix)).toEqual([]);

        // Checklist item 4 — when she clears all data,
        page.once("dialog", (dialog) => {
          void dialog.accept();
        });
        await actor.attemptsTo(clearAllData());
        await expect.poll(async () => (await server()).data?.body).toEqual([]);
        await expect
          .poll(async () => (await server()).template?.body)
          .toBeNull();
        await expect(indicator(page)).toHaveText(SAVED);

        // then, after all four, still no planner key.
        expect(await plannerKeys(page, storagePrefix)).toEqual([]);
      },
    );

    signedIn(
      "Saving… shows while the server has not answered, and Saved only after",
      async ({ actor, page }) => {
        // Given the server holds its answer to the next save,
        let release: () => void = () => undefined;
        const held = new Promise<void>((resolve) => {
          release = resolve;
        });
        await page.route("**/api/documents/*", async (route) => {
          await held;
          await route.continue();
        });

        // When she adds a group,
        await actor.attemptsTo(
          addGroup({ name: "Friday Juniors", price: 250, currency: "UAH" }),
          closeModalWithEscape(),
        );

        // Then the indicator says it is saving, not saved,
        await expect(indicator(page)).toHaveText("Saving…");

        // and says Saved only once the server has answered.
        release();
        await expect(indicator(page)).toHaveText(SAVED);
      },
    );
  },
);

signedIn.describe(
  "C6 Offline keeps the edit (RP-09 AC 19) — state transition",
  () => {
    signedIn(
      "Offline: Not saved — retrying, no advance; back online: Saved",
      async ({ actor, context, page, request, sessionToken }) => {
        if (sessionToken === null) throw new Error("signed in without a token");
        await expect(indicator(page)).toHaveText(SAVED);

        // Given she goes offline,
        await context.setOffline(true);
        let failedPuts = 0;
        page.on("requestfailed", (failed) => {
          if (isDocumentPut(failed)) failedPuts += 1;
        });

        // When she adds a group,
        await actor.attemptsTo(
          addGroup({ name: "Friday Juniors", price: 250, currency: "UAH" }),
          closeModalWithEscape(),
        );

        // Then the indicator says the change is not saved,
        await expect(indicator(page)).toHaveText(RETRYING);
        // and after a retry has failed too, it still has not advanced,
        await expect.poll(() => failedPuts).toBeGreaterThanOrEqual(2);
        await expect(indicator(page)).toHaveText(RETRYING);
        // and the edit is still on screen.
        await expect(page.getByTestId("group-card-name")).toHaveText([
          "Monday Beginners",
          "Friday Juniors",
        ]);

        // When the network returns, Then the save goes through,
        await context.setOffline(false);
        await expect(indicator(page)).toHaveText(SAVED);
        // and the server holds it.
        const documents = await readServer(request, sessionToken);
        expect(
          (documents.data?.body as { name: string }[]).map(
            (group) => group.name,
          ),
        ).toEqual(["Monday Beginners", "Friday Juniors"]);
      },
    );
  },
);

signedIn.describe(
  "C7 Review focus 1 — the token expires — error guessing",
  () => {
    signedIn(
      "A 401 gets one fresh token and one retry, and the save goes through",
      async ({ actor, page, request, sessionToken }) => {
        if (sessionToken === null) throw new Error("signed in without a token");
        await expect(indicator(page)).toHaveText(SAVED);

        // Given the server refuses the next save's token once, as it does when
        // a 15-minute token has expired,
        let refusals = 1;
        let puts = 0;
        await page.route("**/api/documents/*", async (route) => {
          puts += 1;
          if (refusals > 0) {
            refusals -= 1;
            await route.fulfill({
              status: 401,
              contentType: "application/json",
              body: JSON.stringify({ error: "invalid token" }),
            });
            return;
          }
          await route.continue();
        });
        const sessionReads: string[] = [];
        page.on("request", (sent) => {
          if (
            /\/get-session(\?|$)/.test(
              new URL(sent.url()).pathname + new URL(sent.url()).search,
            )
          )
            sessionReads.push(sent.url());
        });

        // When she adds a group,
        await actor.attemptsTo(
          addGroup({ name: "Friday Juniors", price: 250, currency: "UAH" }),
          closeModalWithEscape(),
        );

        // Then the app asks the auth server for a fresh token, retries once,
        // and the save goes through without asking her anything.
        await expect(indicator(page)).toHaveText(SAVED);
        expect(sessionReads.length).toBeGreaterThanOrEqual(1);
        expect(puts).toBe(2);
        await expect(page.getByText("Sign in to save")).toHaveCount(0);
        const documents = await readServer(request, sessionToken);
        expect(documents.data?.body as unknown[]).toHaveLength(2);
      },
    );

    signedIn(
      "Review focus 5: refused again → Sign in to save, the edit stays, and it saves once the session is back",
      async ({ actor, page, request, sessionToken }) => {
        if (sessionToken === null) throw new Error("signed in without a token");
        await expect(indicator(page)).toHaveText(SAVED);

        // Given the session has ended elsewhere, so every token is refused,
        let refusing = true;
        let refusedPuts = 0;
        await page.route("**/api/documents/*", async (route) => {
          if (!refusing) {
            await route.continue();
            return;
          }
          refusedPuts += 1;
          await route.fulfill({
            status: 401,
            contentType: "application/json",
            body: JSON.stringify({ error: "invalid token" }),
          });
        });

        // When she adds a group,
        await actor.attemptsTo(
          addGroup({ name: "Friday Juniors", price: 250, currency: "UAH" }),
          closeModalWithEscape(),
        );

        // Then she is asked to sign in, the change is marked not saved, and the
        // edit stays on screen. One fresh token and one retry, not a loop: the
        // prompt can only appear once the second refusal has ended the attempt.
        await expect(page.getByText("Sign in to save")).toBeVisible();
        await expect(indicator(page)).toHaveText(RETRYING);
        expect(refusedPuts).toBeGreaterThanOrEqual(2);
        await expect(page.getByTestId("group-card-name")).toHaveText([
          "Monday Beginners",
          "Friday Juniors",
        ]);

        // When the session is good again (she signed in in another tab),
        refusing = false;

        // Then the next retry saves, and the prompt goes away.
        await expect(indicator(page)).toHaveText(SAVED);
        await expect(page.getByText("Sign in to save")).toHaveCount(0);
        const documents = await readServer(request, sessionToken);
        expect(documents.data?.body as unknown[]).toHaveLength(2);
      },
    );
  },
);

signedIn.describe("C7 Review focus 2 — two devices — error guessing", () => {
  /** Another device saves a second group, with the right base. */
  const otherDeviceSaves = async (
    request: Parameters<typeof readServer>[0],
    token: string,
  ) => {
    const before = await readServer(request, token);
    if (before.data === null) throw new Error("the account has no data row");
    await putServerDocument(
      request,
      token,
      "data",
      [
        ...(before.data.body as unknown[]),
        buildGroup({ name: "Added Elsewhere", dates: [] }),
      ],
      before.data.updatedAt,
    );
  };

  signedIn(
    "A 409 opens a dialog naming both sides; Keep this screen saves hers",
    async ({ actor, page, request, sessionToken }) => {
      if (sessionToken === null) throw new Error("signed in without a token");
      await expect(indicator(page)).toHaveText(SAVED);

      // Given the planner changed on another device after this one loaded,
      await otherDeviceSaves(request, sessionToken);

      // When she adds a group here,
      await actor.attemptsTo(
        addGroup({ name: "Friday Juniors", price: 250, currency: "UAH" }),
        closeModalWithEscape(),
      );

      // Then a dialog names both sides, and nothing is overwritten yet.
      const dialog = page.getByRole("dialog", {
        name: "Changed on another device",
      });
      await expect(dialog).toBeVisible();
      await expect(indicator(page)).toHaveText("Changed on another device");
      await expect(dialog).toContainText("This screen: 2 groups");
      await expect(dialog).toContainText(
        /Saved in your account at \d\d:\d\d: 2 groups/,
      );
      const during = await readServer(request, sessionToken);
      expect(
        (during.data?.body as { name: string }[]).map((group) => group.name),
      ).toEqual(["Monday Beginners", "Added Elsewhere"]);

      // When she keeps this screen,
      await dialog.getByRole("button", { name: "Keep this screen" }).click();

      // Then her version is saved over the other one, knowingly.
      await expect(indicator(page)).toHaveText(SAVED);
      const after = await readServer(request, sessionToken);
      expect(
        (after.data?.body as { name: string }[]).map((group) => group.name),
      ).toEqual(["Monday Beginners", "Friday Juniors"]);
    },
  );

  signedIn(
    "Use the saved version shows the other device's planner and saves nothing over it",
    async ({ actor, page, request, sessionToken }) => {
      if (sessionToken === null) throw new Error("signed in without a token");
      await expect(indicator(page)).toHaveText(SAVED);
      await otherDeviceSaves(request, sessionToken);

      await actor.attemptsTo(
        addGroup({ name: "Friday Juniors", price: 250, currency: "UAH" }),
        closeModalWithEscape(),
      );
      const dialog = page.getByRole("dialog", {
        name: "Changed on another device",
      });

      // When she uses the saved version,
      await dialog
        .getByRole("button", { name: "Use the saved version" })
        .click();

      // Then the screen shows the account's planner,
      await expect(page.getByTestId("group-card-name")).toHaveText([
        "Monday Beginners",
        "Added Elsewhere",
      ]);
      await expect(indicator(page)).toHaveText(SAVED);
      // and the server still holds the other device's version.
      const after = await readServer(request, sessionToken);
      expect(
        (after.data?.body as { name: string }[]).map((group) => group.name),
      ).toEqual(["Monday Beginners", "Added Elsewhere"]);
    },
  );
});

signedIn.describe(
  "C7 Review focus 3 — the tab closes before a save — error guessing",
  () => {
    /** Closes the page the way a person closes the tab, and reports any dialog. */
    const closeTab = async (page: Page): Promise<Dialog | null> => {
      let seen: Dialog | null = null;
      page.on("dialog", (dialog) => {
        seen = dialog;
        void dialog.accept();
      });
      const closed = page.waitForEvent("close");
      await page.close({ runBeforeUnload: true });
      await closed;
      return seen;
    };

    signedIn(
      "While a save is unanswered, closing the tab warns",
      async ({ actor, page }) => {
        await expect(indicator(page)).toHaveText(SAVED);
        // Given the next save never gets an answer,
        await page.route("**/api/documents/*", () => undefined);

        // When she adds a group and closes the tab,
        await actor.attemptsTo(
          addGroup({ name: "Friday Juniors", price: 250, currency: "UAH" }),
          closeModalWithEscape(),
        );
        const dialog = await closeTab(page);

        // Then the browser warns her.
        expect(dialog?.type()).toBe("beforeunload");
      },
    );

    signedIn(
      "While retrying, closing the tab warns",
      async ({ actor, page }) => {
        await expect(indicator(page)).toHaveText(SAVED);
        await page.route("**/api/documents/*", (route) => route.abort());

        await actor.attemptsTo(
          addGroup({ name: "Friday Juniors", price: 250, currency: "UAH" }),
          closeModalWithEscape(),
        );
        await expect(indicator(page)).toHaveText(RETRYING);
        const dialog = await closeTab(page);

        expect(dialog?.type()).toBe("beforeunload");
      },
    );

    signedIn(
      "Once everything is saved, closing the tab does not warn",
      async ({ actor, page }) => {
        await actor.attemptsTo(
          addGroup({ name: "Friday Juniors", price: 250, currency: "UAH" }),
          closeModalWithEscape(),
        );
        await expect(indicator(page)).toHaveText(SAVED);
        // The click above gave the page a user activation, so a warning would
        // be shown if the guard were on.
        const dialog = await closeTab(page);

        expect(dialog).toBeNull();
      },
    );
  },
);
