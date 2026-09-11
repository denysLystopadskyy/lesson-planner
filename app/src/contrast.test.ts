import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  WCAG_AA,
  contrastOf,
  contrastRatio,
  formatRatio,
  parseHex,
  relativeLuminance,
} from "./contrast";

/**
 * The colour tokens, checked against WCAG 2.2 AA — plan batch 3.6.
 *
 * ## Why the tokens are read from the stylesheet
 *
 * The batch asked for "computed ratios for all tokens recorded". Recording them
 * in a document produces a number that was true once. This reads
 * `styles.css` and computes them now, so changing `--accent` to something
 * illegible fails a build instead of a review.
 *
 * It runs under `npm run test:unit`, which CI already runs. That is deliberate:
 * a new npm script would have needed a workflow edit, and this session cannot
 * push one.
 *
 * ## What this cannot check
 *
 * Only pairs named below. A rule that puts an unnamed colour on an unnamed
 * ground is invisible here, which is why the axe scan in
 * `a11y.spec.ts` runs against the rendered page as well — it sees the pairs
 * that actually meet, including ones no token pair predicts.
 */

const STYLES = readFileSync(path.join(__dirname, "styles.css"), "utf-8");

/** Reads one `--name: value;` declaration out of the `:root` block. */
const token = (name: string): string => {
  const match = new RegExp(`--${name}:\\s*([^;]+);`).exec(STYLES);
  if (match?.[1] === undefined) {
    throw new Error(`No --${name} token in styles.css`);
  }
  return match[1].trim();
};

/**
 * Every pair that has to clear a threshold, and which one.
 *
 * The list is the record. A pair that is not here is not checked, so adding a
 * coloured rule means adding a row — and the axe scan is the backstop for the
 * ones nobody thinks to add.
 */
const PAIRS: {
  what: string;
  fg: string;
  bg: string;
  min: number;
  rule: string;
}[] = [
  // 1.4.3 — text.
  {
    what: "body text on the page",
    fg: token("text-strong"),
    bg: token("surface-page"),
    min: WCAG_AA.text,
    rule: "1.4.3",
  },
  {
    what: "body text on a panel",
    fg: token("text-strong"),
    bg: token("surface-panel"),
    min: WCAG_AA.text,
    rule: "1.4.3",
  },
  {
    what: "muted text on a panel",
    fg: token("text-muted"),
    bg: token("surface-panel"),
    min: WCAG_AA.text,
    rule: "1.4.3",
  },
  {
    what: "secondary text on the sunken surface",
    fg: token("text-secondary"),
    bg: token("surface-sunken"),
    min: WCAG_AA.text,
    rule: "1.4.3",
  },
  {
    what: "white on the accent (primary button, selected day) — DEF-024",
    fg: "#ffffff",
    bg: token("accent"),
    min: WCAG_AA.text,
    rule: "1.4.3",
  },
  {
    what: "white on the accent, hovered",
    fg: "#ffffff",
    bg: token("accent-hover"),
    min: WCAG_AA.text,
    rule: "1.4.3",
  },
  {
    what: "danger text on a panel",
    fg: token("danger"),
    bg: token("surface-panel"),
    min: WCAG_AA.text,
    rule: "1.4.3",
  },
  {
    what: "danger text on the page",
    fg: token("danger"),
    bg: token("surface-page"),
    min: WCAG_AA.text,
    rule: "1.4.3",
  },
  {
    what: "danger text on its own surface",
    fg: token("danger"),
    bg: token("danger-surface"),
    min: WCAG_AA.text,
    rule: "1.4.3",
  },
  {
    what: "warning text on its own surface",
    fg: token("warn"),
    bg: token("warn-surface"),
    min: WCAG_AA.text,
    rule: "1.4.3",
  },
  {
    what: "secondary text on a hovered row",
    fg: token("text-secondary"),
    bg: token("surface-sunken-hover"),
    min: WCAG_AA.text,
    rule: "1.4.3",
  },
  {
    what: "secondary text on the weekend tint",
    fg: token("text-secondary"),
    bg: token("surface-weekend"),
    min: WCAG_AA.text,
    rule: "1.4.3",
  },

  // 1.4.11 — boundaries that carry meaning.
  {
    what: "control border on a panel — DEF-025",
    fg: token("border-control"),
    bg: token("surface-panel"),
    min: WCAG_AA.nonText,
    rule: "1.4.11",
  },
  {
    what: "control border on the page — DEF-025",
    fg: token("border-control"),
    bg: token("surface-page"),
    min: WCAG_AA.nonText,
    rule: "1.4.11",
  },
  {
    what: "the accent fill against the sunken surface",
    fg: token("accent"),
    bg: token("surface-sunken"),
    min: WCAG_AA.nonText,
    rule: "1.4.11",
  },
  {
    what: "the focus ring on a panel",
    fg: token("focus"),
    bg: token("surface-panel"),
    min: WCAG_AA.nonText,
    rule: "1.4.11",
  },
  {
    what: "the focus ring on the accent, where a primary button takes focus",
    fg: token("focus"),
    bg: token("accent"),
    min: WCAG_AA.nonText,
    rule: "1.4.11",
  },
];

describe("Colour tokens against WCAG 2.2 AA", () => {
  for (const pair of PAIRS) {
    it(`${pair.rule}: ${pair.what}`, () => {
      const ratio = contrastOf(pair.fg, pair.bg);
      // The message carries the numbers, because a bare "expected 2.8 to be at
      // least 3" does not say which colours to change.
      expect(
        ratio,
        `${pair.fg} on ${pair.bg} is ${formatRatio(ratio)}, and ${pair.rule} asks for ${String(pair.min)}:1`,
      ).toBeGreaterThanOrEqual(pair.min);
    });
  }
});

/**
 * Colours that are in no pair above, and why that is correct.
 *
 * 1.4.11 covers a boundary that **carries meaning** — the edge that says where a
 * control ends. A rule drawn purely to separate two blocks of content carries
 * none: remove it and nothing becomes ambiguous, only plainer. Listing the
 * exemption rather than omitting the token is the point, because the next
 * reader needs to see that it was considered.
 */
const EXEMPT: { value: string; token: string; why: string }[] = [
  {
    value: token("border-subtle"),
    token: "--border-subtle",
    why: "a decorative divider between sections, not the edge of a control",
  },
];

describe("Colour tokens against WCAG 2.2 AA (continued)", () => {
  it("Checks every colour token that names a surface or a line", () => {
    // The completeness guard testing.md asks a frozen list to carry: collect
    // what is in the stylesheet, and fail on anything the list above forgot.
    // Without it a new token could be added, used, and never checked.
    const declared = [
      ...STYLES.matchAll(/--([a-z-]+):\s*(#[0-9a-fA-F]{3,6});/g),
    ]
      .map((match) => match[2])
      .filter((value): value is string => value !== undefined);
    const covered = new Set([
      ...PAIRS.flatMap((pair) => [pair.fg, pair.bg]),
      ...EXEMPT.map((entry) => entry.value),
    ]);

    const unchecked = declared.filter((value) => !covered.has(value));

    expect(
      unchecked,
      `these hex tokens are in no checked pair and no recorded exemption: ${unchecked.join(", ")}`,
    ).toEqual([]);
  });

  it("Records a reason for every exemption", () => {
    // An exemption list with a blank reason is a way to make this file pass
    // without thinking, which is the failure mode it exists to prevent.
    for (const entry of EXEMPT) {
      expect(entry.why.length, `${entry.token} needs a reason`).toBeGreaterThan(
        20,
      );
    }
  });
});

/**
 * The arithmetic itself. Technique: boundary value analysis on the two ends of
 * the scale, plus published values so a refactor cannot quietly change the
 * formula.
 */
describe("Contrast arithmetic — boundary value analysis", () => {
  it("Black on white is the maximum, 21:1", () => {
    expect(contrastOf("#000000", "#ffffff")).toBeCloseTo(21, 5);
  });

  it("A colour against itself is the minimum, 1:1", () => {
    expect(contrastOf("#2e7d32", "#2e7d32")).toBeCloseTo(1, 5);
  });

  it("Reads the same whichever way round the pair is written", () => {
    expect(contrastOf("#2e7d32", "#ffffff")).toBeCloseTo(
      contrastOf("#ffffff", "#2e7d32"),
      10,
    );
  });

  it("Agrees with the ratio batch 2b.7 recorded for the accent", () => {
    // 5.13:1, from that batch's own results table. A formula that drifts would
    // silently re-bless colours an earlier batch measured and fixed.
    expect(formatRatio(contrastOf("#ffffff", "#2e7d32"))).toBe("5.13:1");
  });

  it("Agrees with the ratios DEF-025 was registered with", () => {
    // #ccc measured 1.61:1 on a panel and 1.53:1 on the page. The registry and
    // batch 2b.7 both quote those, and they are what made the row worth having.
    expect(formatRatio(contrastOf("#cccccc", "#ffffff"))).toBe("1.61:1");
    expect(formatRatio(contrastOf("#cccccc", "#f8fafc"))).toBe("1.53:1");
  });

  it("Uses the linear segment below the sRGB threshold", () => {
    // Very dark channels take `c / 12.92`, not the power curve. A rewrite that
    // dropped the branch would be wrong only for near-black, which is exactly
    // where a focus ring lives.
    expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBe(0);
    expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 10);
  });
});

describe("Reading a hex colour — equivalence partitioning", () => {
  it("Reads the six-digit form", () => {
    expect(parseHex("#2e7d32")).toEqual({ r: 46, g: 125, b: 50 });
  });

  it("Reads the three-digit form by doubling each digit", () => {
    expect(parseHex("#ccc")).toEqual({ r: 204, g: 204, b: 204 });
  });

  it("Reads a value with no hash and surrounding space", () => {
    expect(parseHex("  fff  ")).toEqual({ r: 255, g: 255, b: 255 });
  });

  it("Refuses anything that is not hex", () => {
    // `--scrim` is `rgba(...)` and `transparent` appears in the reset. Neither
    // is a contrast pair, and both must fail loudly rather than parse to black.
    expect(parseHex("rgba(0, 0, 0, 0.4)")).toBeNull();
    expect(parseHex("transparent")).toBeNull();
    expect(parseHex("#12345")).toBeNull();
  });

  it("Says which colour it could not read", () => {
    expect(() => contrastOf("#fff", "transparent")).toThrow(/transparent/);
  });
});

describe("The contrast ratio of two colours", () => {
  it("Is computed from relative luminance, not from the hex values", () => {
    // Green is far brighter than blue at the same channel value: the
    // coefficients are the whole point of the formula.
    const green = contrastRatio({ r: 0, g: 255, b: 0 }, { r: 0, g: 0, b: 0 });
    const blue = contrastRatio({ r: 0, g: 0, b: 255 }, { r: 0, g: 0, b: 0 });

    expect(green).toBeGreaterThan(blue);
  });
});
