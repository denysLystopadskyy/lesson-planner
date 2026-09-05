import { faker } from "@faker-js/faker";
import { configureTest, expect } from "../ui/fixtures/test";
import { plannerState } from "../ui/support/planner-state";
import { pickCurrency } from "../ui/support/test-data";
import {
  openTemplateEditor,
  saveTemplate,
  cancelTemplate,
} from "../ui/screenplay/tasks/template-tasks";
import { templateText } from "../ui/screenplay/questions/template-questions";
import { expectAriaSnapshot } from "../ui/support/aria-snapshot";
import { BrowseTheWeb } from "../ui/screenplay/abilities/browse-the-web";

/**
 * ISTQB technique: equivalence partitioning.
 *
 * Leaving the template editor has two equivalence classes and the partition is
 * the exit path, not the text typed: Save persists whatever is in the box,
 * Cancel discards it. One representative from each class is enough.
 *
 * Both tests seed their own template. That is a requirement, not a
 * convenience — see .claude/context/security-auth.md. With nothing seeded the
 * app falls back to its default template, which carries the owner's real IBAN
 * and tax id, and `playwright.config.ts` keeps traces, video and screenshots on
 * failure. An unseeded spec that fails would copy those values into CI
 * artifacts.
 */

const editSeed = 1111;
faker.seed(editSeed);
const editCurrency = pickCurrency();
const editStartingTemplate = `${faker.lorem.sentence()} {{month}} {{lessons}} {{total}}`;
const editTemplateTest = configureTest({
  plannerState: plannerState({
    groups: [],
    defaultCurrency: editCurrency,
    template: editStartingTemplate,
  }),
});

editTemplateTest.describe("Template editing — equivalence partitioning", () => {
  editTemplateTest("Save persists the edited template", async ({ actor }) => {
    const newTemplate = `${faker.lorem.sentence()} {{month}} ${faker.lorem.words(2)} {{lessons}} ${faker.lorem.word()} {{total}}`;

    // Given the template editor, opened
    await actor.attemptsTo(openTemplateEditor());

    // Its structure is checked once as an accessibility smoke check; the
    // assertion that carries this test's meaning is the value check below.
    const web = actor.abilityTo(BrowseTheWeb);
    await expectAriaSnapshot(
      web.templateModal.modal,
      `
- heading "Edit Payment Message Template" [level=3]
- paragraph: /You can use/
- textbox
- button "Cancel"
- button "Save"
`,
    );

    // When a new template is saved and the editor reopened
    await actor.attemptsTo(saveTemplate(newTemplate));
    await actor.attemptsTo(openTemplateEditor());

    // Then the new text is what comes back.
    await expect(await actor.asks(templateText())).toHaveValue(newTemplate);
  });
});

const cancelSeed = 1212;
faker.seed(cancelSeed);
const cancelCurrency = pickCurrency();
const originalTemplate = `${faker.lorem.sentence()} {{month}} ${faker.lorem.words(1)} {{lessons}} ${faker.lorem.word()} {{total}}`;
const cancelTemplateTest = configureTest({
  plannerState: plannerState({
    groups: [],
    defaultCurrency: cancelCurrency,
    template: originalTemplate,
  }),
});

cancelTemplateTest.describe(
  "Template editing — equivalence partitioning",
  () => {
    cancelTemplateTest("Cancel discards the edit", async ({ actor }) => {
      const attemptedTemplate = `${faker.lorem.sentence()} {{month}} ${faker.lorem.words(2)} {{lessons}} ${faker.lorem.word()} {{total}}`;

      // Given a saved template
      // When the user types a different one and cancels
      await actor.attemptsTo(
        openTemplateEditor(),
        cancelTemplate(attemptedTemplate),
      );
      await actor.attemptsTo(openTemplateEditor());

      // Then the original is untouched.
      await expect(await actor.asks(templateText())).toHaveValue(
        originalTemplate,
      );
    });
  },
);
