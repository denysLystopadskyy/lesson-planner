import { configureTest, expect } from "../ui/fixtures/test";
import { plannerState } from "../ui/support/planner-state";
import { buildGroup } from "../ui/support/test-data";
import {
  addGroup,
  closeModalWithEscape,
  openGroupCard,
} from "../ui/screenplay/tasks/group-tasks";
import { groupCardLessonCount } from "../ui/screenplay/questions/group-questions";
import { emptyStateVisible } from "../ui/screenplay/assertions/planner-assertions";
import { BrowseTheWeb } from "../ui/screenplay/abilities/browse-the-web";

/**
 * Smoke suite. ISTQB technique: state transition testing.
 *
 * The states are: empty planner -> planner with one group, and modal closed ->
 * open -> closed. Each test drives one transition and asserts the state that
 * results from it.
 */

/** The five controls a user can reach when no dialog is open. */
const TOOLBAR_BUTTONS = [
  "+ Add Group",
  "🧾 Edit Template",
  "Load CSV",
  "Save CSV",
  "Clear All Data",
];

const emptyPlanner = configureTest({
  plannerState: plannerState({ groups: [] }),
});

emptyPlanner(
  "The planner opens on the empty state @ported",
  async ({ actor }) => {
    // Given a planner with no groups, When the page loads,
    // Then the empty state invites the user to add one.
    await actor.verifies(
      emptyStateVisible("the empty state should invite the first group"),
    );
  },
);

emptyPlanner(
  "A group can be added from the empty state @ported",
  async ({ actor }) => {
    // Given a planner with no groups
    // When the user adds a group
    await actor.attemptsTo(
      addGroup({ name: "Smoke Group", price: 250, currency: "UAH" }),
    );

    // Then its card appears, counting no lessons yet.
    await expect(
      await actor.asks(groupCardLessonCount("Smoke Group")),
    ).toHaveText("0 planned lessons");
  },
);

/**
 * Covers the behavior change landed in plan batch 1.2: closed modals carry
 * `hidden`, so they leave the tab order and the accessibility tree. Before that
 * change all three dialogs stayed reachable while invisible.
 *
 * The assertion is deliberately made through roles rather than through the
 * `hidden` attribute. `hidden` is the mechanism; what matters to a keyboard or
 * screen-reader user is that the controls are simply not there.
 */
const oneGroup = configureTest({
  plannerState: plannerState({
    groups: [buildGroup({ name: "Reachability Group" })],
  }),
});

oneGroup(
  "Closed modals stay out of the tab order and the accessibility tree @ported",
  async ({ actor }) => {
    const { page, planner, groupModal, templateModal, reviewModal } =
      actor.abilityTo(BrowseTheWeb);

    // Given the planner with every dialog closed
    // Then only the toolbar is reachable.
    await expect(planner.addGroupButton).toBeVisible();
    await expect(
      page.getByRole("button"),
      "no dialog control should be reachable while every dialog is closed",
    ).toHaveText(TOOLBAR_BUTTONS);

    for (const modal of [
      groupModal.modal,
      templateModal.modal,
      reviewModal.modal,
    ]) {
      await expect(modal).toBeHidden();
    }

    // When a dialog is opened, its controls join the accessibility tree.
    await actor.attemptsTo(openGroupCard("Reachability Group"));
    await expect(groupModal.modal).toBeVisible();
    await expect(
      page.getByRole("button"),
      "the open dialog should add controls beyond the toolbar",
    ).not.toHaveText(TOOLBAR_BUTTONS);

    // When it is closed again, Then they leave it.
    await actor.attemptsTo(closeModalWithEscape());
    await expect(groupModal.modal).toBeHidden();
    await expect(
      page.getByRole("button"),
      "closing the dialog should return the page to the toolbar alone",
    ).toHaveText(TOOLBAR_BUTTONS);
  },
);
