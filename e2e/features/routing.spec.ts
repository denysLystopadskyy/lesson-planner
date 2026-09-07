import { configureTest, expect } from "../ui/fixtures/test";
import { plannerState } from "../ui/support/planner-state";
import { buildGroup } from "../ui/support/test-data";
import { BrowseTheWeb } from "../ui/screenplay/abilities/browse-the-web";
import { openGroupCard } from "../ui/screenplay/tasks/group-tasks";

/**
 * Views have URLs.
 *
 * Before this batch the app was one address: whatever you were looking at, the
 * URL said `/lesson-planner/`. A dialog could not be linked to, the Back button
 * left the app, and a refresh lost your place.
 *
 * ISTQB technique: state transition testing, where the states are routes and
 * the transitions are a click, the Back button, the Forward button and a
 * reload.
 *
 * The routes are in the **hash** because this is a project GitHub Pages site
 * with no server to rewrite paths — `/lesson-planner/group/0` would be a 404 on
 * refresh, and a shared link would be dead.
 */

const twoGroups = () =>
  plannerState({
    groups: [
      buildGroup({ name: "Monday Beginners", price: 250, currency: "UAH" }),
      buildGroup({ name: "Wednesday Advanced", price: 300, currency: "UAH" }),
    ],
  });

const opening = configureTest({ plannerState: twoGroups() });

opening.describe("Routes — state transition testing", () => {
  opening("Opening a group puts it in the URL", async ({ actor, page }) => {
    const { groupModal } = actor.abilityTo(BrowseTheWeb);
    expect(new URL(page.url()).hash).toBe("");

    await actor.attemptsTo(openGroupCard("Wednesday Advanced"));

    await expect(groupModal.modal).toBeVisible();
    // Sorted display order is Monday, Wednesday; the index is the position in
    // the STORED array, which is insertion order — so Wednesday is 1 either
    // way here, and `group-name-partitions.spec.ts` pins the distinction.
    expect(new URL(page.url()).hash).toBe("#/group/1");
  });
});

const deepLink = configureTest({ plannerState: twoGroups() });

deepLink.describe("Routes — state transition testing", () => {
  deepLink(
    "A link straight to a group opens it",
    async ({ page, basePath, resolvedBaseURL, actor }) => {
      const { groupModal } = actor.abilityTo(BrowseTheWeb);

      await page.goto(
        new URL(`${basePath}#/group/0`, resolvedBaseURL).toString(),
      );

      await expect(groupModal.modal).toBeVisible();
      await expect(groupModal.nameDisplay).toHaveText("Monday Beginners");
    },
  );
});

const deepLinkTemplate = configureTest({ plannerState: twoGroups() });

deepLinkTemplate.describe("Routes — state transition testing", () => {
  deepLinkTemplate(
    "A link to the template editor opens it",
    async ({ page, basePath, resolvedBaseURL, actor }) => {
      const { templateModal } = actor.abilityTo(BrowseTheWeb);

      await page.goto(
        new URL(`${basePath}#/template`, resolvedBaseURL).toString(),
      );

      await expect(templateModal.modal).toBeVisible();
      await expect(templateModal.textarea).toBeFocused();
    },
  );
});

const unknownRoute = configureTest({ plannerState: twoGroups() });

unknownRoute.describe("Routes — equivalence partitioning", () => {
  unknownRoute(
    "A route nobody wrote shows the planner",
    async ({ page, basePath, resolvedBaseURL, actor }) => {
      const { planner, groupModal } = actor.abilityTo(BrowseTheWeb);

      // A stale bookmark, a truncated link, a hand-edited URL. Each should show
      // the planner rather than a blank page or an error.
      for (const hash of ["#/nope", "#/group/one", "#/group/-1", "#/group"]) {
        await page.goto(
          new URL(`${basePath}${hash}`, resolvedBaseURL).toString(),
        );
        await expect(planner.groupCard("Monday Beginners")).toBeVisible();
        await expect(groupModal.modal).toBeHidden();
      }
    },
  );
});

const backButton = configureTest({ plannerState: twoGroups() });

backButton.describe("Routes — state transition testing", () => {
  backButton(
    "Back closes the dialog and Forward reopens it",
    async ({ actor, page }) => {
      const { groupModal } = actor.abilityTo(BrowseTheWeb);
      await actor.attemptsTo(openGroupCard("Monday Beginners"));
      await expect(groupModal.modal).toBeVisible();

      await page.goBack();
      await expect(groupModal.modal).toBeHidden();
      expect(new URL(page.url()).hash).toBe("");

      await page.goForward();
      await expect(groupModal.modal).toBeVisible();
    },
  );
});

const closeButton = configureTest({ plannerState: twoGroups() });

closeButton.describe("Routes — state transition testing", () => {
  closeButton(
    "Escape leaves no entry to go back into",
    async ({ actor, page }) => {
      const { groupModal } = actor.abilityTo(BrowseTheWeb);
      await actor.attemptsTo(openGroupCard("Monday Beginners"));
      await page.keyboard.press("Escape");
      await expect(groupModal.modal).toBeHidden();

      // Closing goes back rather than pushing, so the history is where it was
      // before the dialog opened. Pushing `#/` instead would make Back reopen
      // the dialog, which is the behaviour that makes a routed modal annoying.
      await page.goForward();
      await expect(groupModal.modal).toBeVisible();
      await page.goBack();
      await expect(groupModal.modal).toBeHidden();
    },
  );
});

const deepLinkClose = configureTest({ plannerState: twoGroups() });

deepLinkClose.describe("Routes — state transition testing", () => {
  deepLinkClose(
    "Closing a deep-linked dialog stays in the app",
    async ({ page, basePath, resolvedBaseURL, actor }) => {
      const { planner, groupModal } = actor.abilityTo(BrowseTheWeb);
      await page.goto(
        new URL(`${basePath}#/group/0`, resolvedBaseURL).toString(),
      );
      await expect(groupModal.modal).toBeVisible();

      await page.keyboard.press("Escape");

      // The dialog WAS the entry point, so there is nothing of ours behind it.
      // Going back here would send someone who followed a shared link out of the
      // app entirely, so this case replaces the entry instead.
      await expect(groupModal.modal).toBeHidden();
      await expect(planner.groupCard("Monday Beginners")).toBeVisible();
      expect(new URL(page.url()).hash).toBe("#/");
    },
  );
});

const addFlow = configureTest({ plannerState: plannerState({ groups: [] }) });

addFlow.describe("Routes — state transition testing", () => {
  addFlow(
    "Saving a new group replaces the add route",
    async ({ actor, page }) => {
      const { planner, groupModal } = actor.abilityTo(BrowseTheWeb);

      await planner.openAddGroupModal();
      expect(new URL(page.url()).hash).toBe("#/group/new");
      await groupModal.groupNameInput.fill("First Group");
      await groupModal.saveGroup();

      // The dialog stays open on the saved group, and the add route is gone
      // rather than sitting behind it: Back should return to the list, not to an
      // empty form for a group that now exists.
      expect(new URL(page.url()).hash).toBe("#/group/0");
      await page.goBack();
      await expect(groupModal.modal).toBeHidden();
      await expect(planner.groupCard("First Group")).toBeVisible();
    },
  );
});

const reload = configureTest({ plannerState: twoGroups() });

reload.describe("Routes — state transition testing", () => {
  reload("A reload keeps you where you were", async ({ actor, page }) => {
    const { groupModal } = actor.abilityTo(BrowseTheWeb);
    await actor.attemptsTo(openGroupCard("Wednesday Advanced"));

    await page.reload();

    await expect(groupModal.modal).toBeVisible();
    await expect(groupModal.nameDisplay).toHaveText("Wednesday Advanced");
  });
});
