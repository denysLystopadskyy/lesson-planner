/**
 * The app's icons, one component each.
 *
 * ADR 2 in plan batch 2b.1 decided the shape and this batch (2b.6) draws them.
 * The rules, and the reason for each:
 *
 * - **Inline SVG, no icon font and no external request.** The app is one static
 *   page holding one person's payment details; it makes no third-party request
 *   today and has to work offline between lessons. A font would add a request
 *   and a flash of missing glyphs, and would keep the OS-dependent rendering
 *   this batch exists to remove.
 * - **`fill="currentColor"`**, so an icon takes the colour of the text around
 *   it — including a disabled control's grey — without a rule per icon.
 * - **`1em` square**, so an icon scales with the button's font size.
 * - **`aria-hidden="true"`**, because the name belongs to the control. An icon
 *   beside a word would otherwise be read twice, and an icon-only button gets
 *   an `aria-label` at the call site.
 *
 * The paths are drawn here rather than lifted from a set, so there is no
 * licence to record and nothing to attribute.
 *
 * These replaced the calendar, receipt, clipboard and pencil emoji and the two
 * triangle glyphs on the month arrows. The emoji are named nowhere in this
 * file on purpose: batch 2b.6's acceptance is a grep for those code points over
 * `app/src`, and a comment quoting them would fail it for no reason.
 *
 * Emoji are drawn by the operating system, which is why the pixel baselines
 * needed one pinned container image to compare against. The same code now draws
 * the same pixels everywhere.
 */

type IconProps = {
  /** Overrides the 1em default where a control needs a larger glyph. */
  size?: string;
};

const base = (size: string | undefined) => ({
  width: size ?? "1em",
  height: size ?? "1em",
  viewBox: "0 0 24 24",
  fill: "currentColor",
  "aria-hidden": true as const,
  focusable: "false" as const,
  className: "icon",
});

/**
 * A wall calendar: the app's own mark, beside the title.
 *
 * Drawn for 16 px first. The first version had a ruled grid inside the frame
 * and turned to mush at that size — an icon has to survive the size it is
 * actually used at, which is what looking at the rendered screenshot showed.
 */
export const CalendarIcon = ({ size }: IconProps) => (
  <svg {...base(size)}>
    <path d="M7 1.5v2h10v-2h2v2h.5A2.5 2.5 0 0 1 22 6v13.5A2.5 2.5 0 0 1 19.5 22h-15A2.5 2.5 0 0 1 2 19.5V6a2.5 2.5 0 0 1 2.5-2.5H5v-2h2ZM20 10H4v9.5a.5.5 0 0 0 .5.5h15a.5.5 0 0 0 .5-.5V10Z" />
    <path d="M6.5 12.5h3.5v3.5H6.5zM14 12.5h3.5v3.5H14z" />
  </svg>
);

/** A document with lines: the payment-message template. */
export const TemplateIcon = ({ size }: IconProps) => (
  <svg {...base(size)}>
    <path d="M6 1.5h8.2L20 7.3V22.5H6A2.5 2.5 0 0 1 3.5 20V4A2.5 2.5 0 0 1 6 1.5Zm7 2H6a.5.5 0 0 0-.5.5v16a.5.5 0 0 0 .5.5h12V9h-5V3.5Zm2 .9V7h2.6L15 4.4Z" />
    <path d="M7 11h9v2H7zM7 15h9v2H7z" />
  </svg>
);

/** A clipboard: copying the payment message. */
export const ClipboardIcon = ({ size }: IconProps) => (
  <svg {...base(size)}>
    <path d="M9 2h6a1 1 0 0 1 1 1v1h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2V3a1 1 0 0 1 1-1Zm7 4v1a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V6H6v14h12V6h-2Zm-6-2v1.6h4V4h-4Z" />
  </svg>
);

/** A pencil: the two edit controls. */
export const PencilIcon = ({ size }: IconProps) => (
  <svg {...base(size)}>
    <path d="M20.7 5.6 18.4 3.3a1 1 0 0 0-1.4 0l-1.7 1.7 3.7 3.7 1.7-1.7a1 1 0 0 0 0-1.4ZM4 16.3V20h3.7l9.9-9.9-3.7-3.7L4 16.3Zm2 2v-1.2l8.6-8.6 1.2 1.2L7.2 18.3H6Z" />
  </svg>
);

/** Month navigation, back a month. */
export const ChevronLeftIcon = ({ size }: IconProps) => (
  <svg {...base(size)}>
    <path d="M15.3 4.7 8 12l7.3 7.3 1.4-1.4L10.8 12l5.9-5.9-1.4-1.4Z" />
  </svg>
);

/** Month navigation, on a month. */
export const ChevronRightIcon = ({ size }: IconProps) => (
  <svg {...base(size)}>
    <path d="M8.7 4.7 7.3 6.1l5.9 5.9-5.9 5.9 1.4 1.4L16 12 8.7 4.7Z" />
  </svg>
);
