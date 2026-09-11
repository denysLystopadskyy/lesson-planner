import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { configureTest, expect } from "../ui/fixtures/test";
import { plannerState } from "../ui/support/planner-state";
import { buildGroup } from "../ui/support/test-data";
import { BrowseTheWeb } from "../ui/screenplay/abilities/browse-the-web";
import { openGroupCard } from "../ui/screenplay/tasks/group-tasks";
import { openScheduleEditor } from "../ui/screenplay/tasks/schedule-tasks";
import { openPaymentMessageForMonth } from "../ui/screenplay/tasks/payment-tasks";
import { openTemplateEditor } from "../ui/screenplay/tasks/template-tasks";

/**
 * Automated accessibility scans — plan batch 3.6.
 *
 * ## What a scan is worth, and what it is not
 *
 * axe finds a definite subset of WCAG failures and is silent about the rest.
 * Running it on every view is worth doing because the failures it does find are
 * unambiguous and cheap to fix; treating a green scan as conformance is not.
 * **AA is never claimed by automation alone** — the manual checklist on the
 * batch page is the other half, and it names what a scan structurally cannot
 * reach.
 *
 * ## Why the whole page, dialogs included
 *
 * Each scan runs against the document rather than a subtree. A modal `<dialog>`
 * puts its panel in the top layer and marks everything behind it inert, and
 * that relationship is part of what is being checked — scanning only the panel
 * would miss a background that is still reachable.
 *
 * ## The tag
 *
 * Every test here carries `@a11y`, which is what
 * `npx playwright test --grep @a11y` selects. Tags rather than titles, so the
 * faker seed — derived from the test title — does not move when a tag is added
 * to an existing spec.
 */

const MONTH = "2026-06";

const populated = () =>
  plannerState({
    groups: [
      buildGroup({
        name: "Monday Beginners",
        price: 250,
        currency: "UAH",
        monthlyOverrides: {
          [MONTH]: { price: 250, dates: ["2026-06-01", "2026-06-08"] },
        },
      }),
      buildGroup({ name: "Wednesday Advanced", price: 300, currency: "UAH" }),
    ],
    template: "For {{month}}: {{lessons}} lessons, {{total}}.",
  });

/**
 * Scans the page and returns the violations, most serious first.
 *
 * Pinned to the WCAG 2.2 AA tags. Without them axe also reports its
 * best-practice rules, which are advice rather than the standard this app
 * committed to — mixing the two would make the gate mean something nobody
 * agreed to.
 */
const violationsOn = async (page: Page) => {
  // Fonts first. axe's contrast rule reads computed colours off rendered text,
  // and text rendered before its face has loaded can report a different colour
  // than the same text a frame later — which showed up here as one scan
  // failing in a full run and passing on its own. `document.fonts.ready` is a
  // signal the page emits, not a sleep.
  await page.waitForFunction(() => document.fonts.status === "loaded");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  return results.violations;
};

/**
 * A readable failure.
 *
 * Asserted as a string rather than `toEqual([])` on the raw violations: an axe
 * violation object carries every matched node with its full HTML, and a deep
 * diff of one buries the sentence that says what is wrong under two hundred
 * lines of dump. The summary is the thing a person needs.
 */
const summarise = (
  violations: Awaited<ReturnType<typeof violationsOn>>,
): string =>
  violations
    .map(
      (violation) =>
        `${violation.id} (${violation.impact ?? "unknown"}): ${violation.help}\n` +
        violation.nodes
          .slice(0, 3)
          .map((node) => {
            // axe's own measurements, where it has any — the contrast rule
            // reports the two colours and the ratio it computed, which is the
            // difference between "fix the contrast" and knowing what to change.
            const data = node.any
              .map((check) => JSON.stringify(check.data))
              .filter((value) => value !== "null")
              .join(" ");
            return (
              `    ${node.target.join(" ")}\n      ${node.html.slice(0, 120)}` +
              (data === "" ? "" : `\n      ${data.slice(0, 300)}`)
            );
          })
          .join("\n"),
    )
    .join("\n");

const main = configureTest({ plannerState: populated() });

main.describe("Accessibility", () => {
  main(
    "The main screen has no axe violations",
    { tag: "@a11y" },
    async ({ page }) => {
      const violations = await violationsOn(page);

      expect(summarise(violations)).toBe("");
    },
  );

  main(
    "The group dialog has no axe violations",
    { tag: "@a11y" },
    async ({ actor, page }) => {
      await actor.attemptsTo(openGroupCard("Monday Beginners"));

      const violations = await violationsOn(page);

      expect(summarise(violations)).toBe("");
    },
  );

  main(
    "The group edit form has no axe violations",
    { tag: "@a11y" },
    async ({ actor, page }) => {
      // The form is where the label-to-control relationships live, so it is the
      // view a scan has most to say about.
      const { groupModal } = actor.abilityTo(BrowseTheWeb);
      await actor.attemptsTo(openGroupCard("Monday Beginners"));
      await groupModal.editInfoButton.click();

      const violations = await violationsOn(page);

      expect(summarise(violations)).toBe("");
    },
  );

  main(
    "The calendar editor has no axe violations",
    { tag: "@a11y" },
    async ({ actor, page }) => {
      await actor.attemptsTo(
        openGroupCard("Monday Beginners"),
        openScheduleEditor(),
      );

      const violations = await violationsOn(page);

      expect(summarise(violations)).toBe("");
    },
  );

  main(
    "The template editor has no axe violations",
    { tag: "@a11y" },
    async ({ actor, page }) => {
      await actor.attemptsTo(openTemplateEditor());

      const violations = await violationsOn(page);

      expect(summarise(violations)).toBe("");
    },
  );

  main(
    "The review dialog has no axe violations",
    { tag: "@a11y" },
    async ({ actor, page }) => {
      await actor.attemptsTo(
        openGroupCard("Monday Beginners"),
        openPaymentMessageForMonth(MONTH),
      );

      const violations = await violationsOn(page);

      expect(summarise(violations)).toBe("");
    },
  );
});

const empty = configureTest({ plannerState: plannerState({ groups: [] }) });

empty.describe("Accessibility", () => {
  empty(
    "The empty state has no axe violations",
    { tag: "@a11y" },
    async ({ page }) => {
      // A separate scan because the empty state is a different tree, not a
      // smaller one: the grid is gone and a prompt is in its place.
      const violations = await violationsOn(page);

      expect(summarise(violations)).toBe("");
    },
  );
});

/**
 * Keyboard-only reachability, at the level a scan cannot see.
 *
 * axe reads the tree; it cannot press Tab. These drive the two journeys the
 * teacher cannot complete with a mouse alone if they break — reaching a group,
 * and getting a payment message out.
 */
const keyboard = configureTest({ plannerState: populated() });

keyboard.describe("Accessibility", () => {
  keyboard(
    "A group can be opened with the keyboard alone",
    { tag: "@a11y" },
    async ({ actor, page }) => {
      const { planner, groupModal } = actor.abilityTo(BrowseTheWeb);

      // Focus must arrive by Tab, never `locator.focus()`: Chromium does not
      // match `:focus-visible` on programmatic focus, so a ring assertion after
      // one would pass for the wrong reason (testing.md).
      await page.keyboard.press("Tab");
      await expect(planner.addGroupButton).toBeFocused();

      // Then on through the toolbar to the first card.
      for (let press = 0; press < 7; press += 1) {
        await page.keyboard.press("Tab");
      }
      await page.keyboard.press("Enter");

      await expect(groupModal.modal).toBeVisible();
    },
  );

  keyboard(
    "Escape returns focus to the control that opened the dialog",
    { tag: "@a11y" },
    async ({ actor, page }) => {
      // 2.4.3. Losing the caret to the top of the page after every dialog is
      // the difference between a usable keyboard journey and a maddening one.
      const { planner, groupModal } = actor.abilityTo(BrowseTheWeb);
      await actor.attemptsTo(openGroupCard("Monday Beginners"));
      await expect(groupModal.modal).toBeVisible();

      await page.keyboard.press("Escape");

      await expect(groupModal.modal).toBeHidden();
      await expect(
        planner.groupCardOpenButton("Monday Beginners"),
      ).toBeFocused();
    },
  );

  keyboard(
    "Tab never reaches a control behind an open dialog",
    { tag: "@a11y" },
    async ({ actor, page }) => {
      // `aria-modal="true"` says everything behind the dialog is unavailable.
      // A Tab that reached the toolbar would make that a lie — DEF-023's shape,
      // closed by the native `<dialog>` in batch 2b.3 and pinned here so it
      // stays closed.
      //
      // The assertion is "no background control", not "always inside the
      // dialog". Chromium parks focus on `BODY` when tabbing past the last
      // element in a modal dialog — its stop at the browser-UI boundary — and
      // the next Tab returns into the dialog. `BODY` is not a control and
      // reaching it is not a leak, so a test demanding focus never leave the
      // subtree would fail on correct behaviour. Measured, not assumed: the
      // first version of this test failed on `BODY#` after four tabs.
      const { groupModal } = actor.abilityTo(BrowseTheWeb);
      await actor.attemptsTo(openGroupCard("Monday Beginners"));

      const seen: string[] = [];
      for (let press = 0; press < 25; press += 1) {
        await page.keyboard.press("Tab");
        const focused = await groupModal.modal.evaluate((dialog) => {
          const active = document.activeElement;
          return {
            inside: dialog.contains(active),
            isBody: active === document.body,
            id: active?.id ?? "",
            tag: active?.tagName ?? "none",
          };
        });
        seen.push(`${focused.tag}#${focused.id}`);

        expect(
          focused.inside || focused.isBody,
          `after ${String(press + 1)} tabs focus was on ${focused.tag}#${focused.id}, which is behind the dialog. Path: ${seen.join(" -> ")}`,
        ).toBe(true);
      }

      // And it really does come back: a run that only ever saw `BODY` would
      // satisfy the check above while proving nothing.
      expect(
        seen.filter((entry) => !entry.startsWith("BODY")).length,
        `focus never returned into the dialog. Path: ${seen.join(" -> ")}`,
      ).toBeGreaterThan(15);
    },
  );
});
