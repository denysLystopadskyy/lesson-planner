import { configureTest, expect } from "../ui/fixtures/test";
import { plannerState } from "../ui/support/planner-state";
import { buildGroup } from "../ui/support/test-data";
import { BrowseTheWeb } from "../ui/screenplay/abilities/browse-the-web";
import { expectAriaSnapshot } from "../ui/support/aria-snapshot";
import { storedGroupNames } from "../ui/support/planner-storage";

/**
 * Reaching a group without a mouse.
 *
 * Until batch 2b.2 a card was a `<div>` with an `onClick`. It worked for
 * everyone with a pointer and for nobody else: no tab stop, no Enter, nothing
 * for a screen reader to activate. The card is still a `<div>` — it carries the
 * frozen dataset hooks — but the group name inside its `<h2>` is now a real
 * button, so the platform supplies the keyboard behaviour and the heading keeps
 * its own node in the accessibility tree.
 *
 * ISTQB technique: state transition testing over focus. The states are nothing
 * focused, a toolbar control focused, a card focused, and the dialog open; the
 * transitions are Tab, Enter, Space and a click.
 *
 * One rule for anyone editing this file: focus must arrive by **Tab**, never by
 * `locator.focus()`. Chromium does not match `:focus-visible` on programmatic
 * focus, so the ring assertions would fail against a correct implementation.
 */

const twoGroups = () =>
  plannerState({
    groups: [
      buildGroup({ name: "Monday Beginners", price: 250, currency: "UAH" }),
      buildGroup({ name: "Wednesday Advanced", price: 300, currency: "UAH" }),
    ],
  });

const tabOrder = configureTest({ plannerState: twoGroups() });

tabOrder.describe(
  "Group card keyboard access — state transition testing",
  () => {
    tabOrder(
      "Tab reaches every card, after the toolbar and in the order they are shown",
      async ({ actor }) => {
        const { planner } = actor.abilityTo(BrowseTheWeb);

        // The list is exhaustive on purpose: it pins that the hidden file input
        // stays out of the tab order, and that a control added to the toolbar
        // fails here with a readable diff rather than an off-by-one.
        expect(await planner.tabOrderNames()).toEqual([
          "+ Add Group",
          "Edit Template",
          "Load CSV",
          "Save CSV",
          "Clear All Data",
          "Monday Beginners",
          "Wednesday Advanced",
        ]);
      },
    );
  },
);

const focusRing = configureTest({ plannerState: twoGroups() });

focusRing.describe(
  "Group card keyboard access — state transition testing",
  () => {
    focusRing(
      "The focused card shows a ring, and its neighbour does not",
      async ({ actor }) => {
        const { planner } = actor.abilityTo(BrowseTheWeb);

        await planner.tabToGroupCard("Monday Beginners");

        // WCAG 2.2 AA 2.4.7. The negative half is what makes this a real check —
        // a rule that put a ring on every card would pass the first assertion.
        expect(await planner.cardOutline("Monday Beginners")).toEqual({
          style: "solid",
          width: "2px",
        });
        expect((await planner.cardOutline("Wednesday Advanced")).style).toBe(
          "none",
        );
      },
    );
  },
);

const focusOnly = configureTest({ plannerState: twoGroups() });

focusOnly.describe(
  "Group card keyboard access — state transition testing",
  () => {
    focusOnly("Focus alone does not open the group", async ({ actor }) => {
      const { planner, groupModal } = actor.abilityTo(BrowseTheWeb);

      await planner.tabToGroupCard("Monday Beginners");

      await expect(groupModal.modal).toBeHidden();
    });
  },
);

for (const key of ["Enter", "Space"]) {
  const activate = configureTest({ plannerState: twoGroups() });

  activate.describe(
    "Group card keyboard access — state transition testing",
    () => {
      activate(
        `${key} on a focused card opens that group`,
        async ({ actor, page }) => {
          const { planner, groupModal } = actor.abilityTo(BrowseTheWeb);
          await planner.tabToGroupCard("Wednesday Advanced");

          await page.keyboard.press(key);

          await expect(groupModal.modal).toBeVisible();
          await expect(groupModal.nameDisplay).toHaveText("Wednesday Advanced");
          // Space on a button must not scroll the page. It is the reason a button
          // is used here rather than a div with a keydown handler, which has to
          // call preventDefault by hand and usually forgets.
          expect(await page.evaluate(() => window.scrollY)).toBe(0);
        },
      );
    },
  );
}

const pointerTarget = configureTest({ plannerState: twoGroups() });

pointerTarget.describe(
  "Group card pointer target — boundary value analysis",
  () => {
    pointerTarget(
      "A click below the name, near the card's corner, still opens the group",
      async ({ actor, page }) => {
        const { planner, groupModal } = actor.abilityTo(BrowseTheWeb);
        const card = planner.groupCard("Monday Beginners");
        const box = await card.boundingBox();
        expect(box).not.toBeNull();
        if (box === null) return;

        // The bottom-right corner is below the heading and outside the name text.
        // Before 2b.2 the whole card was clickable because the div carried the
        // handler; now it is clickable because the button's `::after` is
        // stretched over the card. This is the assertion that would fail if that
        // rule were dropped as decoration — and with it, WCAG 2.2 AA 2.5.8, since
        // the target would shrink to the width of the name.
        await page.mouse.click(box.x + box.width - 4, box.y + box.height - 4);

        await expect(groupModal.modal).toBeVisible();
        await expect(groupModal.nameDisplay).toHaveText("Monday Beginners");
      },
    );
  },
);

const mouseLeavesNoRing = configureTest({ plannerState: twoGroups() });

mouseLeavesNoRing.describe(
  "Group card pointer target — boundary value analysis",
  () => {
    mouseLeavesNoRing(
      "A click leaves no focus ring behind the open dialog",
      async ({ actor }) => {
        const { planner, groupModal } = actor.abilityTo(BrowseTheWeb);

        await planner.groupCard("Monday Beginners").click();
        await expect(groupModal.modal).toBeVisible();

        // Why the stylesheet uses `:has(:focus-visible)` and not
        // `:focus-within`. With the latter the ring would survive the click and
        // show through the modal overlay, moving screenshot baselines on two
        // platforms for a state no keyboard user is in.
        //
        // Checked here, with the dialog open and no key pressed yet, because
        // that is the state the baselines capture. Deliberately not checked
        // after an Escape: pressing any key makes Chromium re-evaluate
        // `:focus-visible` and the ring appears — correctly, because the user
        // has just shown they are using the keyboard.
        expect((await planner.cardOutline("Monday Beginners")).style).toBe(
          "none",
        );
      },
    );
  },
);

const listStructure = configureTest({ plannerState: twoGroups() });

listStructure.describe("Group list structure", () => {
  listStructure("The grid is a set of headed cards", async ({ actor }) => {
    const { page } = actor.abilityTo(BrowseTheWeb);

    // Each card keeps its own level-2 heading, and the button inside it is what
    // opens the group. A card-wide `<button>` or `role="button"` would nest the
    // heading under a button node instead; this is the snapshot that says which
    // shape shipped.
    await expectAriaSnapshot(
      page.locator("#groupList"),
      `
- heading "Monday Beginners" [level=2]:
  - button "Monday Beginners"
- text: 0 planned lessons
- heading "Wednesday Advanced" [level=2]:
  - button "Wednesday Advanced"
- text: 0 planned lessons
`,
    );
  });
});

const focusTrap = configureTest({ plannerState: twoGroups() });

focusTrap.describe(
  "Group card keyboard access — state transition testing",
  () => {
    focusTrap(
      "Opening a group moves focus into the dialog and keeps it there",
      async ({ actor, page }) => {
        const { planner, groupModal } = actor.abilityTo(BrowseTheWeb);
        await planner.tabToGroupCard("Monday Beginners");
        await page.keyboard.press("Enter");
        await expect(groupModal.modal).toBeVisible();

        // Focus should be inside the dialog the moment it opens.
        expect(
          await page.evaluate(
            () => document.activeElement?.closest("#groupModal") !== null,
          ),
        ).toBe(true);

        // And Tab cycles within it. The dialog's own controls, then one stop
        // on <body> where Chromium resets the scope, then back to the first —
        // never a control behind the overlay, which is what DEF-023 was.
        //
        // The body stop is allowed on purpose rather than asserted away: it is
        // not focusable content, nothing is announced there, and the next Tab
        // returns. Demanding every stop be inside the dialog fails against a
        // correct implementation.
        const outsideControls: string[] = [];
        for (let step = 0; step < 8; step += 1) {
          await page.keyboard.press("Tab");
          const stop = await page.evaluate(() => {
            const el = document.activeElement;
            if (el === null || el === document.body) return null;
            return el.closest("#groupModal") === null
              ? `${el.tagName.toLowerCase()} "${el.textContent.trim()}"`
              : null;
          });
          if (stop !== null) outsideControls.push(stop);
        }

        expect(
          outsideControls,
          "Tab reached a control behind the modal overlay",
        ).toEqual([]);
      },
    );
  },
);

/**
 * The whole job, without a mouse.
 *
 * Batch 2b.3's acceptance criterion, and the reason the dialog moved to the
 * native `<dialog>` element: open a group, rename it, save, leave. Every step
 * is a key, and the assertions are about the stored data rather than the
 * screen, because what the teacher cares about is that the rename stuck.
 *
 * ISTQB technique: state transition testing — closed, open, editing, saved,
 * closed again.
 */
const keyboardJourney = configureTest({ plannerState: twoGroups() });

keyboardJourney.describe(
  "Renaming a group with the keyboard alone — state transition testing",
  () => {
    keyboardJourney(
      "Open, rename, save and close, without a mouse",
      async ({ actor, page, storagePrefix }) => {
        const { planner, groupModal } = actor.abilityTo(BrowseTheWeb);

        // Given the planner, and a keyboard
        await planner.tabToGroupCard("Monday Beginners");
        await page.keyboard.press("Enter");
        await expect(groupModal.modal).toBeVisible();

        // The dialog opens with focus on its first control, which is the
        // pencil, so Enter starts the edit without a single Tab.
        await expect(groupModal.editInfoButton).toBeFocused();
        await page.keyboard.press("Enter");

        // The name field takes focus when the form appears — the port does that
        // synchronously, which is what made the legacy app's 100 ms timeout a
        // suite-wide flake in batch 1.10.
        await expect(groupModal.groupNameInput).toBeFocused();
        await page.keyboard.press("ControlOrMeta+a");
        await page.keyboard.type("Monday Improvers");

        // Tab to Save. The order through the form is name, price, currency,
        // Cancel, Save — asserted as a list rather than counted, so a field
        // added between them fails with a readable diff instead of landing the
        // Enter on Cancel and discarding the edit. Which is the failure this
        // test exists to catch: my first draft counted three tabs and pressed
        // Enter on the currency select.
        const stops: string[] = [];
        for (let step = 0; step < 4; step += 1) {
          await page.keyboard.press("Tab");
          stops.push(
            await page.evaluate(() => document.activeElement?.id ?? ""),
          );
        }
        expect(stops).toEqual([
          "groupPriceInput",
          "groupCurrencyInput",
          "cancelGroupBtn",
          "saveGroupBtn",
        ]);

        await page.keyboard.press("Enter");

        // Then the rename is stored, and Escape leaves.
        await expect(groupModal.nameDisplay).toHaveText("Monday Improvers");
        expect(await storedGroupNames(page, storagePrefix)).toEqual([
          "Monday Improvers",
          "Wednesday Advanced",
        ]);

        await page.keyboard.press("Escape");
        await expect(groupModal.modal).toBeHidden();

        // And focus is back on the card that opened it, renamed with it, so the
        // next Tab continues from where the user was rather than at the top of
        // the page.
        await expect(
          planner.groupCardOpenButton("Monday Improvers"),
        ).toBeFocused();
      },
    );
  },
);
