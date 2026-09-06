import { describe, expect, it } from "vitest";
import { formatCurrency, SUPPORTED_CURRENCIES } from "./format";

/**
 * ISTQB technique: equivalence partitioning over the amount, with boundary
 * value analysis where the partitions meet. The partitions are negative, zero
 * and positive. The boundaries are zero, negative zero, and a fraction that
 * sits exactly on the half-cent rounding point.
 *
 * The legacy output carries a real non-breaking space, and batch 1.11's golden
 * test compares the payment message byte for byte. Every new expectation below
 * writes that separator as the escape `\u00a0`, because a literal one is
 * invisible in an editor: a paste that replaced it with a plain space would
 * leave a test that still looks right.
 */
describe("Currency formatting — equivalence partitioning and boundary value analysis", () => {
  it("puts a non-breaking space between the code and the amount", () => {
    expect(formatCurrency(1000, "UAH")).toBe("UAH 1,000.00");
  });

  // The test above holds the separator as a literal character, which no reader
  // can see. This one states the byte, so a silent swap for a plain space
  // fails here with a readable message.
  it("uses U+00A0 as the separator, never a plain space", () => {
    const separator = formatCurrency(1000, "UAH").charCodeAt(3);

    expect(separator).toBe(0x00a0);
    expect(separator).not.toBe(0x20);
  });

  it("shows a zero total with both decimal places", () => {
    expect(formatCurrency(0, "UAH")).toBe("UAH\u00a00.00");
  });

  /**
   * A negative price is accepted end to end. There is no registry entry: plan
   * batch 1.8 files it as a question for the owner, not a defect, and pins the
   * current behaviour so that a decision has to change a test on purpose.
   *
   * Note where the minus lands. It goes before the currency code, not before
   * the digits, so the teacher reads "-UAH 250.00".
   */
  it("accepts a negative price and puts the minus before the currency code", () => {
    expect(formatCurrency(-250, "UAH")).toBe("-UAH\u00a0250.00");
  });

  /**
   * Boundary between the negative and zero partitions. `MonthlyOverrides.tsx`
   * formats `lessons * price`, so a month with no lessons and a negative price
   * multiplies to negative zero, and the row shows a minus sign on a total of
   * nothing. The same question for the owner as the test above.
   */
  it("prints a minus sign for a total of negative zero", () => {
    expect(formatCurrency(0 * -100, "UAH")).toBe("-UAH\u00a00.00");
  });

  /**
   * Boundary on the rounding rule. `Intl` rounds the decimal value half away
   * from zero, so 2.675 becomes 2.68. `(2.675).toFixed(2)` gives "2.67" for the
   * same number, because it rounds the binary value that is a shade below the
   * half point. Anything that reimplements this formatting with `toFixed` will
   * disagree by a cent.
   */
  it("rounds a half cent up rather than down", () => {
    expect(formatCurrency(2.675, "PLN")).toBe("PLN\u00a02.68");
  });

  /**
   * The second half of the rounding boundary, and the one that names the rule.
   * The test above passes under half-even rounding too, because half-even also
   * lifts 2.675 to 2.68: the cent below it is odd. This amount separates the
   * two rules. Half away from zero gives 2.67; half to even gives 2.66, because
   * the cent below it is even. Setting `roundingMode` here would change the
   * teacher's totals and only this line would notice.
   *
   * It rests on the same engine behaviour as the test above: `Intl` rounds the
   * short decimal form of the number, not the binary value underneath it.
   */
  it("rounds a half cent up even when the cent below it is even", () => {
    expect(formatCurrency(2.665, "PLN")).toBe("PLN\u00a02.67");
  });

  it("groups thousands with commas in a large total", () => {
    expect(formatCurrency(1234567.891, "UAH")).toBe("UAH\u00a01,234,567.89");
  });

  /**
   * Non-finite input is the fourth partition of the amount. No control reaches
   * it today — every price passes through `Number(value) || 0` or an explicit
   * `Number.isNaN` guard — but the signature accepts it, and the separator this
   * module exists to produce silently disappears. Recorded so that a future
   * caller that drops the guard is caught here.
   */
  it("drops the separator entirely when the amount is not a number", () => {
    expect(formatCurrency(Number.NaN, "UAH")).toBe("UAHNaN");
  });
});

/**
 * ISTQB technique: equivalence partitioning over the currency argument. Three
 * partitions: a supported code, and — because the parameter is a plain
 * `string` — a well-formed code the app does not offer, and a value that is not
 * a currency code at all.
 */
describe("The currency argument — equivalence partitioning", () => {
  /**
   * `GroupModal.tsx` maps this list straight into the `<option>` elements, so
   * the order here is the order of the dropdown. Adding a currency has to break
   * this line and ask for a decision, which is why the list is asserted whole
   * rather than one member at a time.
   */
  it("offers exactly two currencies, hryvnia first", () => {
    expect(SUPPORTED_CURRENCIES).toEqual(["UAH", "PLN"]);
  });

  it("prints each supported currency as its own three-letter code", () => {
    for (const code of SUPPORTED_CURRENCIES) {
      expect(formatCurrency(1000, code)).toBe(`${code}\u00a01,000.00`);
    }
  });

  /**
   * The middle partition: a real currency code the dropdown does not offer.
   * `storage.ts` and the CSV import both carry the currency as a plain string,
   * so a hand-edited backup can put "USD" here.
   *
   * The expectation pins two choices that the supported codes cannot show.
   * First the locale. `en-US` is hardcoded on purpose, as the module comment
   * says, and UAH and PLN look the same in `en-GB`, so nothing else in this
   * file would notice the swap; `en-GB` writes the dollar as "US$1,000.00".
   * Second the currency display. The default is the symbol, and for UAH and
   * PLN in this locale the symbol is the code itself; asking for
   * `currencyDisplay: "code"` would give "USD\u00a01,000.00" and again no other
   * line would fail. Keep this test even though the app does not sell in
   * dollars: deleting it reopens both holes at once.
   *
   * There is no `\u00a0` in this expectation. The symbol form has no separator
   * between the sign and the digits, so a plain string is right here.
   */
  it("formats a currency the app does not offer with the en-US symbol", () => {
    expect(formatCurrency(1000, "USD")).toBe("$1,000.00");
  });

  /**
   * The residual half of DEF-003, asserted as the behaviour of today, not as
   * correct. That defect is "currency missing **or not a currency code**". The
   * registry marks it closed, which is right for the missing half: `currencyOf`
   * in `storage.ts` falls back to the default when the field is absent. A
   * currency that is present but not three ASCII letters — "US Dollar" from a
   * hand-edited CSV, or the empty string, which `??` does not treat as missing
   * — still throws here. RP-09 asked for a union type that could not hold such
   * a value; the port took `string`, so neither the type nor the storage
   * fallback guards it.
   *
   * Right behaviour: an unknown code falls back to the default currency with a
   * warning, the way a missing one already does. Fixed in plan batch 3.2, which
   * still lists exactly that task even though the registry row reads closed.
   * When 3.2 lands, this expectation becomes a fallback assertion.
   *
   * Only the error class is pinned; the message text belongs to the engine.
   *
   * The four-letter code is the boundary just past a valid one. It is here
   * because a "normalise the code" edit — cutting the value to three
   * characters before formatting — would turn "UAHX" into a hryvnia price and
   * every other line in this file would still pass. Too long is wrong input,
   * not a hryvnia.
   */
  it("throws when the currency is not a three-letter code", () => {
    expect(() => formatCurrency(1000, "US Dollar")).toThrow(RangeError);
    expect(() => formatCurrency(1000, "")).toThrow(RangeError);
    expect(() => formatCurrency(1000, "UAHX")).toThrow(RangeError);
  });
});
