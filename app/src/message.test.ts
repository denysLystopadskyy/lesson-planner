import { describe, expect, it } from "vitest";
import { DEFAULT_TEMPLATE, generateMonthlyPaymentMessage } from "./message";
import type { MonthKey, MonthOverride } from "./types";

/**
 * The payment message is the one output of this app that reaches another
 * person, so these tests compare whole strings rather than fragments.
 *
 * `format.test.ts` writes the non-breaking space as a literal byte. Here it is
 * the named constant below. Both assert the same character (U+00A0); the escape
 * is used because a test that fails on an invisible byte should at least show
 * that byte in its own source. `e2e/fixtures/golden-payment-message.txt` holds
 * the literal byte, as a golden file must.
 */
const NBSP = "\u00A0";

const JULY: MonthKey = "2026-07";
const JULY_DATES = ["2026-07-06", "2026-07-13", "2026-07-20", "2026-07-27"];
const JULY_PRICE = 250;
/** 4 lessons at 250 = 1000. */
const JULY_TOTAL = `UAH${NBSP}1,000.00`;

const overridesWith = (
  monthKey: MonthKey,
  override: MonthOverride,
): Record<MonthKey, MonthOverride> => ({ [monthKey]: override });

const julyOverrides = overridesWith(JULY, {
  price: JULY_PRICE,
  dates: JULY_DATES,
});

/** The common case: July, four lessons, UAH. */
const julyMessage = (template: string): string =>
  generateMonthlyPaymentMessage(template, julyOverrides, JULY, "UAH");

/** The month name only, read out of a one-placeholder template. */
const monthNameFor = (monthKey: MonthKey): string =>
  generateMonthlyPaymentMessage(
    "{{month}}",
    overridesWith(monthKey, { price: JULY_PRICE, dates: ["2026-07-06"] }),
    monthKey,
    "UAH",
  );

/**
 * ISTQB technique: equivalence partitioning on what a `{{...}}` token in the
 * template is. Either it names a value the generator knows, or it does not, and
 * the second class covers a typo, a wrong case and stray spaces inside the
 * braces. One representative of each class.
 */
describe("Template placeholders — equivalence partitioning", () => {
  it("puts the month, the lesson count and the total into the message", () => {
    expect(julyMessage("{{month}}|{{lessons}}|{{total}}")).toBe(
      `July|4|${JULY_TOTAL}`,
    );
  });

  it("fills only the placeholder a one-placeholder template asks for", () => {
    expect(julyMessage("Only the total: {{total}}")).toBe(
      `Only the total: ${JULY_TOTAL}`,
    );
  });

  it("leaves an unknown placeholder and a wrong-case one in the text", () => {
    // `{{student}}` is not a value the generator knows, and `{{Month}}`,
    // `{{Lessons}}` and `{{Total}}` differ in case from the real ones. None is
    // filled and none is removed, so a typo in the template reaches the
    // recipient word for word. Nothing warns.
    //
    // All three wrong-case forms are listed, not one. Each token has its own
    // regex, so a test that checks the case of a single token leaves the other
    // two free to be made case-insensitive with nothing to say so.
    expect(
      julyMessage("{{student}} {{Month}} {{Lessons}} {{Total}} {{month}}"),
    ).toBe("{{student}} {{Month}} {{Lessons}} {{Total}} July");
  });

  it("fills every placeholder every time it appears, not only the first time", () => {
    // Each token twice, and all three tokens, for the same reason: the `g` flag
    // is written three times in the module and one of them can be lost on its
    // own. The second copy of `{{total}}` is the one that would go missing from
    // a message asking a parent for money.
    expect(
      julyMessage(
        "{{month}}/{{month}} {{lessons}}/{{lessons}} {{total}}/{{total}}",
      ),
    ).toBe(`July/July 4/4 ${JULY_TOTAL}/${JULY_TOTAL}`);
  });

  it("does not fill a placeholder that has spaces inside the braces", () => {
    // The match is exact. `{{ month }}` is text, not a placeholder. Checked for
    // all three, because making one regex forgiving about spaces is a change no
    // single-token test can see.
    expect(julyMessage("{{ month }} {{ lessons }} {{ total }}")).toBe(
      "{{ month }} {{ lessons }} {{ total }}",
    );
  });
});

/**
 * ISTQB technique: decision table. Two conditions decide the result — is the
 * month key in the overrides, and does that month hold any dates. Three of the
 * four combinations are reachable; the fourth (a missing key that has dates) is
 * not a state that can exist.
 */
describe("Months with and without lessons — decision table", () => {
  const template = "In {{month}} there are {{lessons}} lessons.";

  it("writes a message when the month is present and holds dates", () => {
    expect(julyMessage(template)).toBe("In July there are 4 lessons.");
  });

  it("returns an empty string when the month is present but holds no dates", () => {
    const empty = overridesWith(JULY, { price: JULY_PRICE, dates: [] });

    expect(generateMonthlyPaymentMessage(template, empty, JULY, "UAH")).toBe(
      "",
    );
  });

  it("returns an empty string when the month key is not in the overrides", () => {
    // August was never opened, so no override exists for it.
    expect(
      generateMonthlyPaymentMessage(template, julyOverrides, "2026-08", "UAH"),
    ).toBe("");
  });

  it("returns an empty string when there are no overrides at all", () => {
    expect(generateMonthlyPaymentMessage(template, {}, JULY, "UAH")).toBe("");
  });

  it("returns the same empty string for an empty template as for a month with no lessons", () => {
    // Worth knowing: two very different situations produce one result, and the
    // caller cannot tell them apart. "Nothing to say" and "nothing to say it
    // with" both arrive as "". Today nothing depends on the difference — the
    // copy control is disabled at zero lessons — but a caller that wanted to
    // show "no lessons this month" would have to check the dates itself.
    expect(julyMessage("")).toBe("");

    const noDates = overridesWith(JULY, { price: JULY_PRICE, dates: [] });
    expect(generateMonthlyPaymentMessage("x", noDates, JULY, "UAH")).toBe("");
  });
});

/**
 * ISTQB technique: boundary value analysis on the total. The boundaries that
 * matter are the smallest month that still produces a message (one lesson),
 * zero money, and money below zero — the app accepts a negative price.
 */
describe("The total — boundary value analysis", () => {
  it("keeps the non-breaking space between the currency code and the amount", () => {
    const message = julyMessage("Total: {{total}}");

    expect(message).toBe(`Total: UAH${NBSP}1,000.00`);
    // Said twice on purpose. The line above fails with two strings that look
    // identical in the report, so this one names the mistake a hand-rolled
    // formatter would make.
    expect(message).not.toContain("UAH 1,000.00");
  });

  it("multiplies the month price by the number of dates", () => {
    const twoLessons = overridesWith(JULY, {
      price: 150,
      dates: ["2026-07-06", "2026-07-13"],
    });

    expect(
      generateMonthlyPaymentMessage("{{total}}", twoLessons, JULY, "UAH"),
    ).toBe(`UAH${NBSP}300.00`);
  });

  it("still writes a message for a single lesson", () => {
    // One date is the smallest input that is not the empty-string case.
    const oneLesson = overridesWith(JULY, {
      price: JULY_PRICE,
      dates: ["2026-07-06"],
    });

    expect(
      generateMonthlyPaymentMessage(
        "{{lessons}} for {{total}}",
        oneLesson,
        JULY,
        "UAH",
      ),
    ).toBe(`1 for UAH${NBSP}250.00`);
  });

  it("writes a zero total rather than skipping the message", () => {
    const free = overridesWith(JULY, { price: 0, dates: JULY_DATES });

    expect(generateMonthlyPaymentMessage("{{total}}", free, JULY, "UAH")).toBe(
      `UAH${NBSP}0.00`,
    );
  });

  it("writes a negative total when the price is below zero", () => {
    // The price input accepts a negative number, and nothing between it and the
    // message rejects one, so a parent can be asked for minus 500. Not filed as
    // a defect; recorded here because the message is where it would be seen.
    const negative = overridesWith(JULY, {
      price: -500,
      dates: ["2026-07-06"],
    });

    expect(
      generateMonthlyPaymentMessage("{{total}}", negative, JULY, "UAH"),
    ).toBe(`-UAH${NBSP}500.00`);
  });
});

/**
 * ISTQB technique: boundary value analysis on the month part of the `YYYY-MM`
 * key. The valid range is 01 to 12, so the values that matter are 00, 01, 12
 * and 13, plus the pair either side of a year change.
 *
 * These results do not depend on the machine's timezone. The key is turned into
 * a date by appending `-02`, and the second of the month is far enough from
 * both edges that no offset between UTC-12 and UTC+14 can move the month. The
 * describe below proves that claim instead of only stating it.
 */
describe("The month name — boundary value analysis", () => {
  it("names January at the start of the year", () => {
    expect(monthNameFor("2026-01")).toBe("January");
  });

  it("names December at the end of the year", () => {
    expect(monthNameFor("2026-12")).toBe("December");
  });

  it("names February, the month with the fewest days", () => {
    // February is the boundary on the *day* the generator appends, not on the
    // month number. The key becomes `2026-02-02`, and 2026 is not a leap year,
    // so any appended day above 28 would leave February behind: `2026-02-31`
    // does not fail, it quietly becomes the third of March. This is the
    // assertion that would catch that.
    expect(monthNameFor("2026-02")).toBe("February");
  });

  it("tells December of one year from January of the next", () => {
    expect(monthNameFor("2025-12")).toBe("December");
    expect(monthNameFor("2026-01")).toBe("January");
  });

  it("writes 'Invalid Date' as the month name when the month number is out of range", () => {
    // Below the minimum and above the maximum. `Date` rejects both, and
    // `toLocaleString` on a rejected date returns the words "Invalid Date",
    // which then travel into the message as if they were a month name.
    expect(monthNameFor("2026-00")).toBe("Invalid Date");
    expect(monthNameFor("2026-13")).toBe("Invalid Date");
  });

  it("writes 'Invalid Date' when a whole ISO date is used as the month key", () => {
    // DEF-002, and this is the shape the app really produces: a one-digit year
    // in the calendar makes `monthKeyOf` store the whole date, `5-06-01`, where
    // a `YYYY-MM` key belongs (plan batch 1.9 measured it). The message then
    // says "In Invalid Date, we will have 4 lessons".
    //
    // Desired: no such key exists, because the year input is constrained. Fixed
    // in plan batch 3.2, which makes month keys always `YYYY-MM`. When 3.2
    // lands, this assertion is one of the ones to change.
    expect(monthNameFor("5-06-01")).toBe("Invalid Date");
  });

  it("names a plausible but wrong month for a key whose year is short", () => {
    // Not a DEF-002 shape, and not reachable today: `monthKeyOf` slices seven
    // characters, so a bad year gives `5-06-01` or `55-06-0`, and
    // `normalizeMonthKey` demands four digits on import. This key would have to
    // be hand-written into storage.
    //
    // It is pinned anyway, because it is the counter-example batch 3.2 needs.
    // `5-06` becomes the text `5-06-02`, which is not an ISO date, so the older
    // parsing rules read it as month 5, day 6, year 2002 — the message says
    // "May" for a key that means June, and nothing looks broken to the reader.
    // Those older rules are engine-specific, so another browser may read the
    // same key as some other month — which is the argument itself: a guard that
    // rejects keys producing "Invalid Date" is not enough. Batch 3.2 has to
    // match the key against `YYYY-MM` and never trust the parse.
    expect(monthNameFor("5-06")).toBe("May");
  });
});

/**
 * ISTQB technique: boundary value analysis on the machine's UTC offset. The
 * boundaries are the two ends of the inhabited range — Pacific/Midway at
 * UTC-11 and Pacific/Kiritimati at UTC+14.
 *
 * The offset is a boundary here because of how the month name is built. The
 * generator appends a day to the key and reads the month back in local time,
 * and a `YYYY-MM-DD` string is parsed as UTC. A machine behind UTC therefore
 * sees the day before. With the second of the month there is a full day of
 * slack at each end; with the first there is none, and a teacher in Samoa would
 * be sent a message naming the previous month while everything looked right in
 * Warsaw. The tests above cannot see that, because they run in one zone.
 */
/**
 * Read once, while this file is being imported, so it holds the machine's own
 * zone and not whatever a test that has already run left behind. Reading it
 * inside the test that checks the restore would make that test useless: a
 * restore broken for every test would corrupt the value being compared against.
 */
const MACHINE_TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

describe("The month name away from UTC — boundary value analysis", () => {
  /**
   * Reads one month name with the machine's time zone changed.
   *
   * The zone is a process-wide setting, so it is put back inside this call
   * rather than in an `afterEach`. Two reasons: the lookups within one test
   * then cannot depend on each other's order, and a failed `expect` throws, so
   * a `finally` is what guarantees the zone comes back at all.
   *
   * It is put back by deleting when nothing was set, not by assigning back.
   * Assigning `undefined` to an environment variable stores the text
   * "undefined", which is not a time zone, and everything after it would run in
   * the fallback zone instead of this machine's.
   */
  const monthNameIn = (timeZone: string, monthKey: MonthKey): string => {
    const original = process.env.TZ;
    process.env.TZ = timeZone;
    try {
      return monthNameFor(monthKey);
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  };

  it("names the month on a machine eleven hours behind UTC", () => {
    expect(monthNameIn("Pacific/Midway", "2026-07")).toBe("July");
    // Across a year change, where a wrong day would also name the wrong year.
    expect(monthNameIn("Pacific/Midway", "2026-01")).toBe("January");
  });

  it("names the month on a machine fourteen hours ahead of UTC", () => {
    expect(monthNameIn("Pacific/Kiritimati", "2026-07")).toBe("July");
    expect(monthNameIn("Pacific/Kiritimati", "2026-12")).toBe("December");
  });

  it("leaves the machine's own time zone as it found it", () => {
    // The two tests above pass whether or not the zone is put back, because
    // each one sets the zone it needs. This is the test that fails if it is not
    // put back, so a broken restore cannot travel silently into the tests that
    // follow this describe. Proved by breaking the restore and watching this
    // one, and only this one, fail.
    monthNameIn("Pacific/Midway", "2026-07");

    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(
      MACHINE_TIME_ZONE,
    );
  });
});

/**
 * ISTQB technique: checklist-based testing (an experience-based technique).
 * `DEFAULT_TEMPLATE` is one fixed string, so there is nothing to partition and
 * no boundary to walk. What it needs is a list of properties that must hold,
 * checked one by one.
 */
describe("The shipped default template — checklist-based testing", () => {
  const tokensIn = (template: string): Set<string> =>
    new Set(template.match(/\{\{[^{}]*\}\}/g) ?? []);

  it("uses exactly the three placeholders the generator can fill", () => {
    // A completeness check, not three presence checks. Asserting that each of
    // the three is there would catch a rename; it would not catch a fourth
    // placeholder added to the template with no matching substitution in
    // `generateMonthlyPaymentMessage`. That one would ship `{{whatever}}` to a
    // recipient, and this is the assertion that stops it.
    expect(tokensIn(DEFAULT_TEMPLATE)).toEqual(
      new Set(["{{month}}", "{{lessons}}", "{{total}}"]),
    );
  });

  it("carries no personal identifier", () => {
    // Checked by shape, because the rule in .claude/context/security-auth.md
    // forbids writing the real values anywhere — including into the test that
    // looks for them. A bank account number or a tax id cannot exist without a
    // run of digits, and an email address cannot exist without an "@".
    //
    // A personal *name* has no shape to match, so no assertion here can find
    // one. That is why DEF-015 is registered as a grep gate rather than a spec.
    expect(DEFAULT_TEMPLATE).not.toMatch(/\d{4}/);
    expect(DEFAULT_TEMPLATE).not.toMatch(/[A-Z]{2}\d{2}[A-Z0-9]{4}/);
    expect(DEFAULT_TEMPLATE).not.toContain("@");
  });

  it("leaves the payment block for the owner to fill in", () => {
    // The template ships with `<recipient>` and `<account>` instead of real
    // details, and the generator does not touch them — they are not `{{...}}`
    // placeholders. So a browser with no saved template produces a message with
    // those two words still in it, and the owner has to open the template
    // editor once. That is the cutover task recorded on plan batch 2a.4.
    const message = julyMessage(DEFAULT_TEMPLATE);

    expect(message).toContain("<recipient>");
    expect(message).toContain("<account>");
    expect(message).toContain("In July, we will have 4 lessons");
    expect(message).toContain(JULY_TOTAL);
  });

  it("is the exact text plan batch 3.5 specifies, byte for byte", () => {
    // The checks above describe the template's shape. This one pins its words.
    // A line removed from the middle — "Payment details:", say — keeps every
    // placeholder, both angle-bracket words, the greeting and the trailing
    // newline, so the shape checks alone would let it ship, and the message a
    // parent receives would list an account under nothing.
    //
    // A change here is meant to be deliberate. Whoever edits the template edits
    // this string in the same commit and reads the diff.
    expect(DEFAULT_TEMPLATE).toBe(
      `Dear Students,

In {{month}}, we will have {{lessons}} lessons, with a total fee of {{total}}.

Payment details:
<recipient>
<account>

Thank you!
`,
    );
  });

  it("ends with a newline, and the message keeps it", () => {
    // The generator copies the template's whitespace through untouched. Nothing
    // trims. The golden file pins this for the fixture template; this pins it
    // for the one that actually ships.
    expect(DEFAULT_TEMPLATE.endsWith("\n")).toBe(true);
    expect(julyMessage(DEFAULT_TEMPLATE).endsWith("\n")).toBe(true);
  });
});

/**
 * ISTQB technique: error guessing. These are the inputs a reader of the
 * signature would assume are handled, and are not.
 *
 * The first three are reachable through the app: the currency comes from
 * `localStorage` or a CSV import with no whitelist in front of it until plan
 * batch 3.2, and any month's date list is used exactly as the schedule wrote
 * it. The last one needs hand-edited storage today, and says so.
 */
describe("Inputs the generator does not guard — error guessing", () => {
  it("throws instead of writing a message when the currency is not a currency code", () => {
    // DEF-003 has two halves. The registry reads "missing **or not a currency
    // code**" and is marked closed, but `currencyOf` is
    // `group.currency ?? settings.defaultCurrency` — it covers the missing half
    // only, and `storage-contract.spec.ts` seeds a group with no currency, not
    // a group with a broken one. A currency that is present and wrong passes
    // straight through: `Intl` throws and no message is produced at all.
    //
    // Asserted as it behaves today. The whitelist in plan batch 3.2 closes the
    // second half, and this is the assertion that changes when it lands.
    expect(() =>
      generateMonthlyPaymentMessage("{{total}}", julyOverrides, JULY, "banana"),
    ).toThrow(RangeError);
  });

  it("keeps a total that starts with a dollar sign intact", () => {
    // `String.replace` reads `$1` in a replacement value as a capture group.
    // The regexes here have no capture groups, so a US dollar total survives
    // whole. This assertion exists to fail loudly if someone ever rewrites the
    // substitution as `/{{(total)}}/g`, which would turn "$1,000.00" into
    // "total,000.00" in a message asking a parent for money.
    expect(
      generateMonthlyPaymentMessage("{{total}}", julyOverrides, JULY, "USD"),
    ).toBe("$1,000.00");
  });

  it("counts a date that belongs to a different month", () => {
    // The month key selects the override; it does not filter that override's
    // dates. An August date stored under the July key is billed as a July
    // lesson. The generator trusts whatever the schedule wrote.
    const mixed = overridesWith(JULY, {
      price: 100,
      dates: ["2026-07-06", "2026-08-03"],
    });

    expect(
      generateMonthlyPaymentMessage(
        "{{month}}: {{lessons}} for {{total}}",
        mixed,
        JULY,
        "UAH",
      ),
    ).toBe(`July: 2 for UAH${NBSP}200.00`);
  });

  it("counts the same date twice when it appears twice", () => {
    // Nothing here removes duplicates, so a month holding one day twice is
    // billed for it twice. The calendar cannot produce this — `commitSelection`
    // builds from a `Set` and CSV import de-duplicates — so it takes edited
    // storage to reach. Written down because it is the contract the storage
    // guards in plan batch 3.1 have to hold up: the date list is trusted, and
    // a shape check that only looks for an array is not enough to protect the
    // amount printed in the message.
    const duplicated = overridesWith(JULY, {
      price: 100,
      dates: ["2026-07-06", "2026-07-06"],
    });

    expect(
      generateMonthlyPaymentMessage("{{lessons}}", duplicated, JULY, "UAH"),
    ).toBe("2");
  });
});
