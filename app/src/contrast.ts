/**
 * WCAG 2.2 contrast arithmetic — plan batch 3.6.
 *
 * ## Why this is code and not a table
 *
 * Batch [3.6](../../docs/plan/p3-06-a11y-verification.md) asked for "computed
 * ratios for all tokens recorded". A table in a markdown file is a record of
 * what someone measured once; it cannot notice a token changing underneath it,
 * and a stale contrast table is worse than none because it reads as a
 * guarantee. The ratios are therefore computed from `styles.css` itself, in a
 * unit test, so a colour that stops clearing its threshold fails a build.
 *
 * That also sidesteps a constraint: this repository's CI workflow cannot be
 * edited from the session that wrote this, so a new npm script would not gate
 * anything. `npm run test:unit` already runs in CI, and a test costs nothing to
 * wire in.
 *
 * ## The formulas
 *
 * Relative luminance and contrast ratio are WCAG 2.x definitions, unchanged in
 * 2.2. They are short enough to write out and worth having in one place that a
 * test can point at.
 */

/** One sRGB colour, 0–255 per channel. */
export type Rgb = { r: number; g: number; b: number };

/**
 * Reads `#rgb` or `#rrggbb`. Returns null for anything else — including the
 * `rgb()` and `rgba()` forms, which no token in this app uses for a colour that
 * needs a contrast check.
 */
export const parseHex = (value: string): Rgb | null => {
  const hex = value.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]+$/.test(hex)) return null;
  if (hex.length === 3) {
    // `slice` rather than an index or a spread: it returns a `string` where
    // both of those return `string | undefined` under
    // `noUncheckedIndexedAccess`, and the regex above has already proved the
    // length. No assertion needed to say what is already true.
    const doubled = (at: number): number =>
      parseInt(hex.slice(at, at + 1).repeat(2), 16);
    return { r: doubled(0), g: doubled(1), b: doubled(2) };
  }
  if (hex.length === 6) {
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
    };
  }
  return null;
};

const channelLuminance = (value: number): number => {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

/** WCAG relative luminance, 0 for black and 1 for white. */
export const relativeLuminance = ({ r, g, b }: Rgb): number =>
  0.2126 * channelLuminance(r) +
  0.7152 * channelLuminance(g) +
  0.0722 * channelLuminance(b);

/**
 * The contrast ratio between two colours, from 1 to 21.
 *
 * Order does not matter: the brighter colour is always the numerator, which is
 * why the same pair reads the same whichever way round it is written.
 */
export const contrastRatio = (foreground: Rgb, background: Rgb): number => {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const [lighter, darker] = a > b ? [a, b] : [b, a];
  return (lighter + 0.05) / (darker + 0.05);
};

/** The same, from two hex strings. Throws rather than guessing on bad input. */
export const contrastOf = (foreground: string, background: string): number => {
  const fg = parseHex(foreground);
  const bg = parseHex(background);
  if (fg === null || bg === null) {
    throw new Error(
      `Not a hex colour: ${fg === null ? foreground : background}`,
    );
  }
  return contrastRatio(fg, bg);
};

/**
 * The three thresholds this app has to clear.
 *
 * `largeText` is 18pt, or 14pt bold — 24px and 18.66px bold at this app's root
 * size. Nothing here relies on it, and it is present so that a future rule
 * claiming it has to name it.
 */
export const WCAG_AA = {
  /** 1.4.3 — body text. */
  text: 4.5,
  /** 1.4.3 — large text. */
  largeText: 3,
  /** 1.4.11 — a boundary that carries meaning, and UI component states. */
  nonText: 3,
} as const;

/**
 * Two decimals, rounded — the form RP-08 and batch 2b.7 quote.
 *
 * Rounded and not truncated, because those reports are the comparison: 2b.7
 * records white on the accent as 5.13:1 and the registry records `#ccc` on a
 * panel as 1.61:1, and truncation would print 5.12 and 1.60 and make every
 * cross-reference look like a discrepancy.
 */
export const formatRatio = (ratio: number): string => `${ratio.toFixed(2)}:1`;
