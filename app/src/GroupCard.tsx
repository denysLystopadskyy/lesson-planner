import { currencyOf, lessonCountOf } from "./storage";
import type { Group, Settings } from "./types";

/**
 * One group, as a card the teacher can click — and now reach with the keyboard.
 *
 * The outer element stays a `<div>` and keeps all three dataset hooks on one
 * node, because that is what the frozen contract and the page objects locate:
 * `planner.groupCard()` finds `[data-group-name]`, and the storage contract
 * asserts `data-currency` on the same element.
 *
 * What changed in batch 2b.2 is where the click lives. It was an `onClick` on
 * the div, which no keyboard can reach. It is now a real `<button>` inside the
 * existing `<h2>`, so the platform supplies Tab, Enter and Space, and the
 * heading keeps its own node in the accessibility tree — a teacher skimming the
 * page still hears a list of level-2 headings.
 *
 * Two traps, both worth knowing before editing this file:
 *
 * - **No `aria-label` on the button.** A heading's accessible name comes from
 *   its contents, so labelling this descendant would rename the heading too.
 * - **The whole-card click area is CSS, not a second handler.** A stretched
 *   `::after` on the button covers the card (see `styles.css`). Adding an
 *   `onClick` back onto the div would fire twice and would restore the very
 *   thing this batch removed.
 */

type Props = {
  group: Group;
  index: number;
  settings: Settings;
  onOpen: () => void;
};

export const GroupCard = ({ group, index, settings, onOpen }: Props) => {
  // The lesson count is beside the name for a sighted user; `aria-describedby`
  // is how a keyboard user hears it too, instead of just "Monday Beginners,
  // button".
  const lessonCountId = `group-card-info-${String(index)}`;

  return (
    <div
      className="group-card"
      data-group-name={group.name}
      data-group-index={String(index)}
      data-currency={currencyOf(group, settings)}
    >
      <h2 data-testid="group-card-name">
        <button type="button" aria-describedby={lessonCountId} onClick={onOpen}>
          {group.name}
        </button>
      </h2>
      <div
        className="group-card-info"
        id={lessonCountId}
        data-testid="group-card-lesson-count"
      >
        {lessonCountOf(group)} planned lessons
      </div>
    </div>
  );
};
