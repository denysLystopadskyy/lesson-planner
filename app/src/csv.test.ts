import { describe, expect, it } from "vitest";
import {
  deserializeCsv,
  escapeCsvValue,
  normalizeMonthKey,
  parseCsv,
  serializeCsv,
} from "./csv";
import {
  DEFAULT_CURRENCY,
  type Group,
  type MonthKey,
  type MonthOverride,
} from "./types";

/**
 * Unit tests for the CSV port.
 *
 * The module reproduces four defects on purpose, so these tests assert what the
 * code does **today**. Each such assertion carries a comment naming the DEF, the
 * behaviour that would be right, and the plan batch that will change the
 * assertion. The e2e suite holds the `test.fixme` pins for the desired
 * behaviour; they are not repeated here.
 */

/** The header line every export starts with. */
const HEADER_LINE =
  '"Name","Default Price","Currency","Month","Month Price","Dates"';

/** Builds one CSV line. Every cell is quoted, as the export does. */
const row = (...cells: string[]): string =>
  cells.map((cell) => `"${cell}"`).join(",");

/** Joins lines with CRLF, as the export does. */
const file = (...lines: string[]): string => lines.join("\r\n");

describe("escapeCsvValue — equivalence partitioning", () => {
  // The partitions are: plain text, text holding a quote, text holding a
  // separator, non-Latin text, a number, and no value at all.

  it("A plain value comes back wrapped in quotes", () => {
    expect(escapeCsvValue("Group A")).toBe('"Group A"');
  });

  it("A quote inside a value is doubled", () => {
    expect(escapeCsvValue('say "hi" twice')).toBe('"say ""hi"" twice"');
  });

  it("A comma and a newline stay inside the quotes", () => {
    expect(escapeCsvValue("a,b\nc")).toBe('"a,b\nc"');
  });

  it("Cyrillic text is passed through unchanged", () => {
    expect(escapeCsvValue("Група А")).toBe('"Група А"');
  });

  it("A number is written as text", () => {
    expect(escapeCsvValue(1200)).toBe('"1200"');
  });

  it("A missing value becomes an empty quoted field", () => {
    expect(escapeCsvValue(undefined)).toBe('""');
  });
});

describe("parseCsv — state transition testing", () => {
  // The parser is a two-state machine: inside quotes and outside them. Every
  // test below drives one transition or one guard on a transition.

  it("Quoted fields split on commas and rows split on CRLF", () => {
    expect(parseCsv('"a","b"\r\n"c","d"')).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("A doubled quote inside a field becomes one quote", () => {
    expect(parseCsv('"say ""hi"""')).toEqual([['say "hi"']]);
  });

  it("A field that ends with an escaped quote still ends at the next comma", () => {
    // The case above passes even if the parser forgets to step over the second
    // half of a doubled quote: it leaves the quoted state and enters it again,
    // and the field comes out the same. Here the escaped quote sits at the end
    // of the field, so a forgotten step would swallow the closing quote, keep
    // the state inverted and split the row in the wrong place.
    expect(parseCsv('"a""","b"')).toEqual([['a"', "b"]]);
  });

  it("A comma inside quotes does not start a new field", () => {
    expect(parseCsv('"a,b","c"')).toEqual([["a,b", "c"]]);
  });

  it("A newline inside quotes does not start a new row", () => {
    expect(parseCsv('"line one\nline two","c"')).toEqual([
      ["line one\nline two", "c"],
    ]);
  });

  it("Cyrillic text inside a field is read back unchanged", () => {
    expect(parseCsv('"Група А","Понеділок, вечір"')).toEqual([
      ["Група А", "Понеділок, вечір"],
    ]);
  });

  it("A carriage return is dropped outside quotes but kept inside them", () => {
    // Outside quotes `\r` is skipped, so a file with old Mac line endings is
    // read as one long row. Inside quotes the same character is stored.
    expect(parseCsv("a\rb")).toEqual([["ab"]]);
    expect(parseCsv('"a\r\nb"')).toEqual([["a\r\nb"]]);
  });

  it("A file that ends inside quotes is rejected", () => {
    expect(() => parseCsv('"a,b')).toThrow(
      "Malformed CSV: unmatched quote detected.",
    );
  });

  it("A stray quote in the middle of a field is accepted and swallowed", () => {
    // DEF-006. `"a"b"c"` should be rejected as malformed, because the closing
    // quote is not followed by a separator. The parser only checks that quotes
    // are balanced at end of file, so the three parts are glued into `abc` and
    // the import silently replaces every group with one named `abc`.
    // Plan batch 3.4b makes this throw; change this assertion there.
    expect(parseCsv('"a"b"c"')).toEqual([["abc"]]);
  });

  it("An empty file gives no rows", () => {
    expect(parseCsv("")).toEqual([]);
  });

  it("A trailing newline does not add an empty row", () => {
    expect(parseCsv('"a","b"\r\n')).toEqual([["a", "b"]]);
  });
});

describe("normalizeMonthKey — boundary value analysis", () => {
  // The month number is the only bounded value: 1 and 12 are the valid edges,
  // 0 and 13 are the first invalid values on each side.

  it("The first and last month of the year are accepted", () => {
    expect(normalizeMonthKey("2025-1")).toBe("2025-01");
    expect(normalizeMonthKey("2025-12")).toBe("2025-12");
  });

  it("A month below one is rejected", () => {
    expect(() => normalizeMonthKey("2025-0")).toThrow(
      'Invalid month value: "2025-0"',
    );
  });

  it("A month above twelve is rejected", () => {
    expect(() => normalizeMonthKey("2025-13")).toThrow(
      'Invalid month value: "2025-13"',
    );
  });
});

describe("normalizeMonthKey — equivalence partitioning", () => {
  it("A dash, a slash or no separator all give the same key", () => {
    expect(normalizeMonthKey("2025-06")).toBe("2025-06");
    expect(normalizeMonthKey("2025/06")).toBe("2025-06");
    expect(normalizeMonthKey("202506")).toBe("2025-06");
  });

  it("Surrounding spaces are ignored", () => {
    expect(normalizeMonthKey("  2025-06  ")).toBe("2025-06");
  });

  it("A blank value gives an empty key instead of an error", () => {
    expect(normalizeMonthKey("")).toBe("");
    expect(normalizeMonthKey("   ")).toBe("");
  });

  it("Text that is not a month is rejected", () => {
    expect(() => normalizeMonthKey("June")).toThrow(
      'Invalid month format: "June"',
    );
  });

  it("A whole date in place of a month is rejected", () => {
    // DEF-002. The year input can write a key like `5-06-01`, a whole date in
    // the slot that holds `YYYY-MM`. Exporting such a group and importing it
    // back fails here, which is how a user meets the defect. Right behaviour:
    // the year input never writes that key. Plan batch 3.2 sanitises the input;
    // whether this throw stays is that batch's call.
    expect(() => normalizeMonthKey("5-06-01")).toThrow(
      'Invalid month format: "5-06-01"',
    );
    expect(() => normalizeMonthKey("2025-06-01")).toThrow(
      'Invalid month format: "2025-06-01"',
    );
  });

  it("A year shorter than four digits is rejected", () => {
    expect(() => normalizeMonthKey("5-06")).toThrow(
      'Invalid month format: "5-06"',
    );
  });
});

describe("serializeCsv — decision table", () => {
  // The two inputs that decide the shape of the output are: does the list hold
  // any group, and does a group hold any month.

  const groupWithOneMonth: Group = {
    name: "Група А",
    price: 250,
    currency: "UAH",
    dates: ["2025-01-06", "2025-01-13"],
    monthlyOverrides: {
      "2025-01": { price: 250, dates: ["2025-01-06", "2025-01-13"] },
    },
  };

  it("An empty list exports the header alone", () => {
    expect(serializeCsv([])).toBe(HEADER_LINE);
  });

  it("A group with one month exports one row with the dates space separated", () => {
    expect(serializeCsv([groupWithOneMonth])).toBe(
      file(
        HEADER_LINE,
        '"Група А","250","UAH","2025-01","250","2025-01-06 2025-01-13"',
      ),
    );
  });

  it("A group with no months exports one bare row", () => {
    const group: Group = {
      name: "Group A",
      price: 100,
      currency: "UAH",
      dates: [],
      monthlyOverrides: {},
    };
    expect(serializeCsv([group])).toBe(
      file(HEADER_LINE, row("Group A", "100", "UAH", "", "", "")),
    );
  });

  it("Months are exported in date order, whatever order they are stored in", () => {
    const group: Group = {
      name: "Group A",
      price: 100,
      currency: "UAH",
      dates: [],
      monthlyOverrides: {
        "2025-03": { price: 300, dates: ["2025-03-03"] },
        "2025-01": { price: 100, dates: ["2025-01-06"] },
        "2025-02": { price: 200, dates: ["2025-02-03"] },
      },
    };
    expect(parseCsv(serializeCsv([group])).slice(1)).toEqual([
      ["Group A", "100", "UAH", "2025-01", "100", "2025-01-06"],
      ["Group A", "100", "UAH", "2025-02", "200", "2025-02-03"],
      ["Group A", "100", "UAH", "2025-03", "300", "2025-03-03"],
    ]);
  });

  it("A group with no currency exports an empty currency field", () => {
    const group: Group = {
      name: "Group A",
      price: 100,
      dates: ["2025-01-06"],
      monthlyOverrides: {
        "2025-01": { price: 100, dates: ["2025-01-06"] },
      },
    };
    expect(serializeCsv([group])).toBe(
      file(
        HEADER_LINE,
        row("Group A", "100", "", "2025-01", "100", "2025-01-06"),
      ),
    );
  });

  it("Dates that sit outside a month override are not exported at all", () => {
    // Not a registered defect, and it looks unintended. `group.dates` is the
    // flat list the group card counts through `lessonCountOf`. Data written by
    // an older version has dates but no `monthlyOverrides`, and such a group
    // exports as a bare row: the lessons are gone from the backup.
    const legacyGroup: Group = {
      name: "Group B",
      price: 200,
      dates: ["2025-03-03", "2025-03-10"],
    };
    expect(serializeCsv([legacyGroup])).toBe(
      file(HEADER_LINE, row("Group B", "200", "", "", "", "")),
    );
  });

  it("A month key with nothing behind it exports the group price and no dates", () => {
    // The `??` fallback in `serializeCsv` looks dead, because the key came from
    // `Object.keys` of the same object. It fires on stored data the types deny
    // — a month key present with no override behind it — which is the same
    // source as DEF-001 and DEF-003. The export keeps going instead of failing.
    const brokenOverrides: Record<MonthKey, MonthOverride | undefined> = {
      "2025-01": undefined,
    };
    const group: Group = {
      name: "Group A",
      price: 100,
      currency: "UAH",
      dates: [],
      // The cast models what storage can hold; the types cannot express it.
      monthlyOverrides: brokenOverrides as Record<MonthKey, MonthOverride>,
    };
    expect(serializeCsv([group])).toBe(
      file(HEADER_LINE, row("Group A", "100", "UAH", "2025-01", "100", "")),
    );
  });

  it("The export has six columns and none of them holds the payment template", () => {
    // DEF-005. The payment template is one of the three stored keys, so an
    // export that omits it is not the backup the button promises. Right
    // behaviour: a backup covers all three keys. Plan batch 3.3 replaces the
    // CSV with a versioned JSON backup; change this assertion there.
    expect(parseCsv(serializeCsv([groupWithOneMonth]))[0]).toEqual([
      "Name",
      "Default Price",
      "Currency",
      "Month",
      "Month Price",
      "Dates",
    ]);
  });

  it("The export carries no byte order mark", () => {
    // DEF-007. Without a leading "\uFEFF" Excel on Windows reads the Cyrillic
    // group names as mojibake. Right behaviour: the file starts with the BOM.
    // Plan batch 3.4b adds it; change this assertion there.
    const csvText = serializeCsv([groupWithOneMonth]);
    expect(csvText.startsWith("\uFEFF")).toBe(false);
    expect(csvText.startsWith('"Name"')).toBe(true);
  });
});

describe("deserializeCsv — equivalence partitioning", () => {
  // The partitions are the states a file can arrive in: empty, header only,
  // header broken, and rows that are complete, partial or repeated.

  it("An empty file is rejected", () => {
    expect(() => deserializeCsv("")).toThrow("CSV file is empty.");
  });

  it("A file of blank rows is rejected the same way", () => {
    expect(() => deserializeCsv(file(row("", "", ""), row("", "")))).toThrow(
      "CSV file is empty.",
    );
  });

  it("A missing column is named in the error", () => {
    const withoutCurrency = file(
      row("Name", "Default Price", "Month", "Month Price", "Dates"),
      row("Group A", "100", "2025-01", "100", "2025-01-06"),
    );
    expect(() => deserializeCsv(withoutCurrency)).toThrow(
      'Missing "currency" column in CSV.',
    );
  });

  it("The header is read whatever its case", () => {
    const shouty = file(
      row("NAME", "DEFAULT PRICE", "currency", "Month", "MONTH price", "DATES"),
      row("Group A", "100", "UAH", "2025-01", "100", "2025-01-06"),
    );
    expect(deserializeCsv(shouty).groups).toEqual([
      {
        name: "Group A",
        price: 100,
        currency: "UAH",
        dates: ["2025-01-06"],
        monthlyOverrides: {
          "2025-01": { price: 100, dates: ["2025-01-06"] },
        },
      },
    ]);
  });

  it("Spaces around a header name are ignored", () => {
    const padded = file(
      row(
        " Name ",
        "Default Price ",
        " Currency",
        "  Month  ",
        "Month Price",
        " Dates ",
      ),
      row("Group A", "100", "UAH", "2025-01", "100", "2025-01-06"),
    );
    expect(deserializeCsv(padded).groups).toEqual([
      {
        name: "Group A",
        price: 100,
        currency: "UAH",
        dates: ["2025-01-06"],
        monthlyOverrides: {
          "2025-01": { price: 100, dates: ["2025-01-06"] },
        },
      },
    ]);
  });

  it("A column name that appears twice is read from its first column", () => {
    // Not a registered defect. A hand-edited file can carry the same column
    // twice, and the importer reads the first one and drops the second without
    // a word. Right behaviour is arguably to refuse a header it cannot read in
    // one way. Pinned so that a change to the lookup has to be on purpose.
    const twoDateColumns = file(
      row(
        "Name",
        "Default Price",
        "Currency",
        "Month",
        "Month Price",
        "Dates",
        "Dates",
      ),
      row(
        "Group A",
        "100",
        "UAH",
        "2025-01",
        "100",
        "2025-01-06",
        "2025-01-20",
      ),
    );
    expect(deserializeCsv(twoDateColumns).groups[0]?.dates).toEqual([
      "2025-01-06",
    ]);
  });

  it("Columns may come in any order", () => {
    const shuffled = file(
      row("Dates", "Month", "Currency", "Month Price", "Default Price", "Name"),
      row("2025-01-06", "2025-01", "EUR", "120", "100", "Group A"),
    );
    expect(deserializeCsv(shuffled).groups).toEqual([
      {
        name: "Group A",
        price: 100,
        currency: "EUR",
        dates: ["2025-01-06"],
        monthlyOverrides: {
          "2025-01": { price: 120, dates: ["2025-01-06"] },
        },
      },
    ]);
  });

  it("A file with only a header gives no groups and the default currency", () => {
    const result = deserializeCsv(HEADER_LINE);
    expect(result.groups).toEqual([]);
    expect(result.defaultCurrency).toBe(DEFAULT_CURRENCY);
  });

  it("A row with no name is skipped, and so is a row named with spaces", () => {
    const text = file(
      HEADER_LINE,
      row("", "999", "EUR", "2025-01", "999", "2025-01-20"),
      row("   ", "888", "EUR", "2025-02", "888", "2025-02-20"),
      row("Group A", "100", "UAH", "2025-01", "100", "2025-01-06"),
    );
    expect(deserializeCsv(text).groups).toEqual([
      {
        name: "Group A",
        price: 100,
        currency: "UAH",
        dates: ["2025-01-06"],
        monthlyOverrides: {
          "2025-01": { price: 100, dates: ["2025-01-06"] },
        },
      },
    ]);
  });

  it("Several rows for one name become one group", () => {
    const text = file(
      HEADER_LINE,
      row("Group A", "100", "UAH", "2025-01", "100", "2025-01-06"),
      row("Group A", "100", "UAH", "2025-01", "", "2025-01-13"),
      row("Group A", "100", "UAH", "2025-02", "150", "2025-02-03"),
    );
    // The second row adds its date to the month and leaves the price alone,
    // because its Month Price cell is blank.
    expect(deserializeCsv(text).groups).toEqual([
      {
        name: "Group A",
        price: 100,
        currency: "UAH",
        dates: ["2025-01-06", "2025-01-13", "2025-02-03"],
        monthlyOverrides: {
          "2025-01": { price: 100, dates: ["2025-01-06", "2025-01-13"] },
          "2025-02": { price: 150, dates: ["2025-02-03"] },
        },
      },
    ]);
  });

  it("Spaces around a name are ignored, so padded rows join one group", () => {
    const text = file(
      HEADER_LINE,
      row(" Group A ", "100", "UAH", "2025-01", "100", "2025-01-06"),
      row("Group A", "100", "UAH", "2025-02", "100", "2025-02-03"),
    );
    expect(deserializeCsv(text).groups).toEqual([
      {
        name: "Group A",
        price: 100,
        currency: "UAH",
        dates: ["2025-01-06", "2025-02-03"],
        monthlyOverrides: {
          "2025-01": { price: 100, dates: ["2025-01-06"] },
          "2025-02": { price: 100, dates: ["2025-02-03"] },
        },
      },
    ]);
  });

  it("Any run of whitespace separates the dates in a cell", () => {
    // Not only spaces. A cell that Excel wrapped carries a newline, and a
    // hand-edited file can carry a tab. Both sit inside the quotes, so the
    // parser hands them to the splitter, and both must separate two dates
    // rather than glue them into one token no calendar can match.
    const text = file(
      HEADER_LINE,
      row(
        "Group A",
        "100",
        "UAH",
        "2025-01",
        "100",
        "2025-01-06\n2025-01-13\t2025-01-20",
      ),
    );
    expect(deserializeCsv(text).groups).toEqual([
      {
        name: "Group A",
        price: 100,
        currency: "UAH",
        dates: ["2025-01-06", "2025-01-13", "2025-01-20"],
        monthlyOverrides: {
          "2025-01": {
            price: 100,
            dates: ["2025-01-06", "2025-01-13", "2025-01-20"],
          },
        },
      },
    ]);
  });

  it("The last row wins for the default price and the currency", () => {
    const text = file(
      HEADER_LINE,
      row("Group A", "100", "UAH", "2025-01", "100", "2025-01-06"),
      row("Group A", "120", "EUR", "2025-02", "150", "2025-02-03"),
    );
    const [group] = deserializeCsv(text).groups;
    expect(group?.price).toBe(120);
    expect(group?.currency).toBe("EUR");
  });

  it("A month with no dates is dropped", () => {
    const text = file(
      HEADER_LINE,
      row("Group A", "100", "UAH", "2025-01", "150", ""),
    );
    expect(deserializeCsv(text).groups).toEqual([
      {
        name: "Group A",
        price: 100,
        currency: "UAH",
        dates: [],
        monthlyOverrides: {},
      },
    ]);
  });

  it("A later row with no dates wipes the dates the month already had", () => {
    // Not a registered defect, and it looks unintended. The month's dates are
    // replaced, not merged, when the Dates cell is blank. The empty month is
    // then dropped, so the group keeps its flat date list and its lesson count
    // while every month row disappears.
    const text = file(
      HEADER_LINE,
      row("Group A", "100", "UAH", "2025-01", "100", "2025-01-06 2025-01-13"),
      row("Group A", "100", "UAH", "2025-01", "100", ""),
    );
    expect(deserializeCsv(text).groups).toEqual([
      {
        name: "Group A",
        price: 100,
        currency: "UAH",
        dates: ["2025-01-06", "2025-01-13"],
        monthlyOverrides: {},
      },
    ]);
  });

  it("Repeated dates are removed and the rest are sorted", () => {
    const text = file(
      HEADER_LINE,
      row(
        "Group A",
        "100",
        "UAH",
        "2025-01",
        "100",
        "2025-01-13  2025-01-06 2025-01-13",
      ),
    );
    expect(deserializeCsv(text).groups).toEqual([
      {
        name: "Group A",
        price: 100,
        currency: "UAH",
        dates: ["2025-01-06", "2025-01-13"],
        monthlyOverrides: {
          "2025-01": { price: 100, dates: ["2025-01-06", "2025-01-13"] },
        },
      },
    ]);
  });

  it("A price that is not a number becomes zero, but a month price falls back to the group price", () => {
    const text = file(
      HEADER_LINE,
      row("Group A", "500", "UAH", "2025-01", "not a price", "2025-01-06"),
      row("Group B", "not a price", "UAH", "2025-02", "250", "2025-02-03"),
    );
    expect(deserializeCsv(text).groups).toEqual([
      {
        name: "Group A",
        price: 500,
        currency: "UAH",
        dates: ["2025-01-06"],
        // The unreadable month price is treated as "not given", so the group
        // default is used instead of zero.
        monthlyOverrides: {
          "2025-01": { price: 500, dates: ["2025-01-06"] },
        },
      },
      {
        name: "Group B",
        price: 0,
        currency: "UAH",
        dates: ["2025-02-03"],
        monthlyOverrides: {
          "2025-02": { price: 250, dates: ["2025-02-03"] },
        },
      },
    ]);
  });

  it("An empty currency cell falls back to the default currency", () => {
    const text = file(
      HEADER_LINE,
      row("Group A", "100", "", "2025-01", "100", "2025-01-06"),
    );
    const result = deserializeCsv(text);
    expect(result.groups).toEqual([
      {
        name: "Group A",
        price: 100,
        currency: DEFAULT_CURRENCY,
        dates: ["2025-01-06"],
        monthlyOverrides: {
          "2025-01": { price: 100, dates: ["2025-01-06"] },
        },
      },
    ]);
  });

  it("The file currency is taken from the first group alone", () => {
    const text = file(
      HEADER_LINE,
      row("Group A", "100", "PLN", "2025-01", "100", "2025-01-06"),
      row("Group B", "100", "EUR", "2025-01", "100", "2025-01-07"),
      row("Group C", "100", "EUR", "2025-01", "100", "2025-01-08"),
    );
    expect(deserializeCsv(text).defaultCurrency).toBe("PLN");
  });

  it("The import returns groups and a currency, and no payment template", () => {
    // DEF-005 again, on the way back in. There is nothing in the file to
    // restore the template from. Plan batch 3.3 replaces the CSV backup.
    const text = file(
      HEADER_LINE,
      row("Group A", "100", "UAH", "2025-01", "100", "2025-01-06"),
    );
    expect(Object.keys(deserializeCsv(text))).toEqual([
      "groups",
      "defaultCurrency",
    ]);
  });

  it("A whole date in the Month column stops the import", () => {
    // DEF-002 reaching the import. Plan batch 3.2 stops the year input from
    // writing such a key.
    const text = file(
      HEADER_LINE,
      row("Group A", "100", "UAH", "2025-01-06", "100", "2025-01-06"),
    );
    expect(() => deserializeCsv(text)).toThrow(
      'Invalid month format: "2025-01-06"',
    );
  });
});

describe("CSV round trip — serialize then deserialize", () => {
  it("A group whose dates all sit in months comes back unchanged", () => {
    const groups: Group[] = [
      {
        name: "Група А",
        price: 250,
        currency: "UAH",
        dates: ["2025-01-06", "2025-01-13", "2025-02-03"],
        monthlyOverrides: {
          "2025-01": { price: 250, dates: ["2025-01-06", "2025-01-13"] },
          "2025-02": { price: 300, dates: ["2025-02-03"] },
        },
      },
    ];
    expect(deserializeCsv(serializeCsv(groups)).groups).toEqual(groups);
  });

  it("A name with a comma and a quote survives the round trip", () => {
    const groups: Group[] = [
      {
        name: 'Group "A", evening',
        price: 100,
        currency: "UAH",
        dates: ["2025-01-06"],
        monthlyOverrides: {
          "2025-01": { price: 100, dates: ["2025-01-06"] },
        },
      },
    ];
    expect(deserializeCsv(serializeCsv(groups)).groups).toEqual(groups);
  });

  it("Dates with no month override are lost in the round trip", () => {
    // The export writes no flat date list, so a group written by an older
    // version comes back with no lessons at all. See the serialize test above.
    const legacyGroup: Group = {
      name: "Group B",
      price: 200,
      dates: ["2025-03-03", "2025-03-10"],
    };
    expect(deserializeCsv(serializeCsv([legacyGroup])).groups).toEqual([
      {
        name: "Group B",
        price: 200,
        currency: DEFAULT_CURRENCY,
        dates: [],
        monthlyOverrides: {},
      },
    ]);
  });

  it("A month key that is a whole date exports fine and then blocks the import", () => {
    // DEF-002 end to end, and the symptom the registry describes: the year
    // input can store a key like `5-06-01`, the export writes it without a
    // word, and importing the app's own file then fails. Right behaviour: such
    // a key is never stored. Plan batch 3.2 sanitises the input; change this
    // assertion there.
    const groups: Group[] = [
      {
        name: "Group A",
        price: 100,
        currency: "UAH",
        dates: ["2025-06-01"],
        monthlyOverrides: {
          "5-06-01": { price: 100, dates: ["2025-06-01"] },
        },
      },
    ];
    const csvText = serializeCsv(groups);
    expect(csvText).toBe(
      file(
        HEADER_LINE,
        row("Group A", "100", "UAH", "5-06-01", "100", "2025-06-01"),
      ),
    );
    expect(() => deserializeCsv(csvText)).toThrow(
      'Invalid month format: "5-06-01"',
    );
  });

  it("A month left with no dates does not survive the round trip", () => {
    const groups: Group[] = [
      {
        name: "Group A",
        price: 100,
        currency: "UAH",
        dates: [],
        monthlyOverrides: {
          "2025-01": { price: 150, dates: [] },
        },
      },
    ];
    expect(deserializeCsv(serializeCsv(groups)).groups).toEqual([
      {
        name: "Group A",
        price: 100,
        currency: "UAH",
        dates: [],
        monthlyOverrides: {},
      },
    ]);
  });
});
