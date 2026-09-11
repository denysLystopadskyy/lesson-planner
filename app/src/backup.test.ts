import { describe, expect, it } from "vitest";
import {
  BACKUP_FORMAT,
  BACKUP_STALE_AFTER_DAYS,
  backupAge,
  BACKUP_SCHEMA_VERSION,
  countsOf,
  createBackup,
  fingerprintOf,
  parseBackup,
  serializeBackup,
  type BackupData,
} from "./backup";
import type { Group } from "./types";

/**
 * The backup envelope — plan batch 3.3, shape from RP-07 §2.
 *
 * This is the file the teacher keeps, and it is the only copy of her data that
 * is not inside one browser profile. Two things follow from that and shape
 * every test below.
 *
 * **It must carry all three keys.** The CSV export never did — it omits the
 * payment template entirely (DEF-005), so what the app called a backup could
 * not restore the app.
 *
 * **A file that is wrong must be refused, never partially applied.** Import
 * replaces everything, so "read what we can" is data loss with extra steps.
 */

const anna: Group = {
  name: "Anna",
  price: 400,
  currency: "UAH",
  dates: ["2026-09-01", "2026-09-08", "2026-10-06"],
  monthlyOverrides: {
    "2026-09": { price: 400, dates: ["2026-09-01", "2026-09-08"] },
    "2026-10": { price: 450, dates: ["2026-10-06"] },
  },
};

const dataOf = (overrides: Partial<BackupData> = {}): BackupData => ({
  groupLessonPlannerData: [anna],
  groupLessonPlannerSettings: { defaultCurrency: "UAH" },
  paymentTemplate: "Pay {{total}} for {{lessons}} lessons in {{month}}.",
  ...overrides,
});

const EXPORTED_AT = new Date("2026-06-15T12:00:00.000Z");
const ORIGIN = "https://denyslystopadskyy.github.io";

const backupOf = (data: BackupData = dataOf()) =>
  createBackup(data, EXPORTED_AT, ORIGIN);

/**
 * The counts exist so the import preview can show both sides before the user
 * commits. Technique: equivalence partitioning on the shape of the data —
 * full, empty, and the partitions in between that the app can actually store.
 */
describe("Counting what is in a backup — equivalence partitioning", () => {
  it("Counts groups, dates, override dates, months and template length", () => {
    expect(countsOf(dataOf())).toEqual({
      groups: 1,
      dates: 3,
      overrideDates: 3,
      monthKeys: 2,
      templateChars: 51,
    });
  });

  it("Counts nothing for an empty planner", () => {
    expect(
      countsOf(dataOf({ groupLessonPlannerData: [], paymentTemplate: null })),
    ).toEqual({
      groups: 0,
      dates: 0,
      overrideDates: 0,
      monthKeys: 0,
      templateChars: 0,
    });
  });

  it("Counts the top-level dates and the override dates separately", () => {
    // RP-07 §2 asks for both on purpose. The app stores the same dates twice —
    // once on the group, once inside the month rows — and a divergence between
    // them is a real defect shape. Two numbers make it visible in the file
    // instead of copying it forward silently.
    const diverged = dataOf({
      groupLessonPlannerData: [
        {
          ...anna,
          dates: ["2026-09-01"],
          monthlyOverrides: anna.monthlyOverrides,
        },
      ],
    });

    const counts = countsOf(diverged);

    expect(counts.dates).toBe(1);
    expect(counts.overrideDates).toBe(3);
  });

  it("Counts a group with no overrides at all", () => {
    const bare = dataOf({
      groupLessonPlannerData: [
        { name: "Bare", price: 100, dates: ["2026-09-01"] },
      ],
    });

    expect(countsOf(bare)).toMatchObject({
      groups: 1,
      dates: 1,
      overrideDates: 0,
      monthKeys: 0,
    });
  });
});

describe("The envelope a backup is written into", () => {
  it("Names its format and its schema version", () => {
    // Both are how a later reader — a newer app, or a person — knows what the
    // file is without guessing from its contents.
    const backup = backupOf();

    expect(backup.format).toBe(BACKUP_FORMAT);
    expect(backup.schemaVersion).toBe(BACKUP_SCHEMA_VERSION);
  });

  it("Records when and where it was made", () => {
    const backup = backupOf();

    expect(backup.exportedAt).toBe("2026-06-15T12:00:00.000Z");
    expect(backup.source.origin).toBe(ORIGIN);
  });

  it("Carries all three stored keys, the template included", () => {
    // DEF-005 in one assertion. The CSV export carries the groups and nothing
    // else, so restoring from it left the teacher retyping her payment details.
    const backup = backupOf();

    expect(backup.data.groupLessonPlannerData).toEqual([anna]);
    expect(backup.data.groupLessonPlannerSettings).toEqual({
      defaultCurrency: "UAH",
    });
    expect(backup.data.paymentTemplate).toContain("{{total}}");
  });

  it("Keeps an absent template distinct from an empty one", () => {
    // `null` means the key was never written and the app should use its
    // default; `""` means the user saved an empty template. Collapsing the two
    // would silently change what a restore produces.
    expect(
      backupOf(dataOf({ paymentTemplate: null })).data.paymentTemplate,
    ).toBeNull();
    expect(backupOf(dataOf({ paymentTemplate: "" })).data.paymentTemplate).toBe(
      "",
    );
  });

  it("Is written as readable JSON, not one long line", () => {
    // The file is the teacher's escape hatch. If the app is gone, she should be
    // able to open it and see her groups.
    const text = serializeBackup(backupOf());

    expect(text).toContain("\n");
    expect(text).toContain('"groupLessonPlannerData"');
  });
});

/**
 * The fingerprint is a cheap integrity check, not a security measure: it
 * catches a truncated download or a half-saved file, which is the realistic
 * way this file goes wrong.
 */
describe("The fingerprint", () => {
  it("Is stable for the same data", () => {
    expect(fingerprintOf(dataOf())).toBe(fingerprintOf(dataOf()));
  });

  it("Changes when any of the three keys changes", () => {
    const base = fingerprintOf(dataOf());

    expect(fingerprintOf(dataOf({ paymentTemplate: "different" }))).not.toBe(
      base,
    );
    expect(
      fingerprintOf(
        dataOf({ groupLessonPlannerSettings: { defaultCurrency: "PLN" } }),
      ),
    ).not.toBe(base);
    expect(fingerprintOf(dataOf({ groupLessonPlannerData: [] }))).not.toBe(
      base,
    );
  });

  it("Names the algorithm it used", () => {
    // So a future version can change algorithm without a silent mismatch.
    expect(fingerprintOf(dataOf())).toMatch(/^fnv1a32:[0-9a-f]{8}$/);
  });
});

/**
 * Reading a file back. Technique: equivalence partitioning on what the file
 * can be — this app's own file, another app's file, a file from a newer
 * version, and a damaged file.
 */
describe("Reading a backup file — equivalence partitioning", () => {
  it("Reads back exactly what was written", () => {
    // The round trip that makes the file worth keeping.
    const original = dataOf();

    expect(
      parseBackup(serializeBackup(createBackup(original, EXPORTED_AT, ORIGIN)))
        .data,
    ).toEqual(original);
  });

  it("Refuses a file that is not JSON", () => {
    expect(() => parseBackup("not json at all {{{")).toThrow(/not a .*backup/i);
  });

  it("Refuses another application's JSON", () => {
    // A plausible mis-click: some other export from the same Downloads folder.
    expect(() => parseBackup('{"hello":"world"}')).toThrow(/not a .*backup/i);
  });

  it("Refuses the app's own CSV export", () => {
    // The likeliest wrong file of all, since it is the only other thing this
    // app writes.
    expect(() =>
      parseBackup("Name,Default Price,Currency,Month,Month Price,Dates"),
    ).toThrow(/not a .*backup/i);
  });

  it("Refuses a file written by a newer version, rather than truncating it", () => {
    // RP-07 §2 rule 5. A v1 client that "reads what it understands" from a v2
    // file drops every field it does not know, and the import then writes that
    // loss back over the real data. The message has to name both versions or
    // the user cannot tell what to do about it.
    const future = { ...backupOf(), schemaVersion: BACKUP_SCHEMA_VERSION + 1 };

    expect(() => parseBackup(JSON.stringify(future))).toThrow(/newer version/i);
    expect(() => parseBackup(JSON.stringify(future))).toThrow(
      new RegExp(String(BACKUP_SCHEMA_VERSION + 1)),
    );
  });

  it("Refuses a file whose contents do not match its fingerprint", () => {
    // The truncated-download case, and the hand-edited-file case.
    const tampered = backupOf();
    tampered.data.groupLessonPlannerData = [];

    expect(() => parseBackup(JSON.stringify(tampered))).toThrow(
      /incomplete|edited/i,
    );
  });

  it("Refuses a file with no data section", () => {
    const withoutData: Record<string, unknown> = { ...backupOf() };
    delete withoutData["data"];

    expect(() => parseBackup(JSON.stringify(withoutData))).toThrow(
      /not a .*backup/i,
    );
  });

  it("Refuses a file whose groups are not a list", () => {
    const wrong = backupOf();
    const broken = {
      ...wrong,
      data: { ...wrong.data, groupLessonPlannerData: { name: "Anna" } },
    };

    expect(() => parseBackup(JSON.stringify(broken))).toThrow(
      /not a .*backup/i,
    );
  });

  it("Accepts an empty planner, which is a legitimate thing to back up", () => {
    // The boundary the refusals must not swallow: a teacher who has just
    // cleared her data and wants that state saved.
    const empty = dataOf({
      groupLessonPlannerData: [],
      paymentTemplate: null,
    });

    expect(
      parseBackup(serializeBackup(createBackup(empty, EXPORTED_AT, ORIGIN)))
        .data,
    ).toEqual(empty);
  });
});

/**
 * The toolbar indicator. Technique: boundary value analysis on the age, since
 * the interesting values are all at the edges — never, today, and either side
 * of the staleness threshold.
 */
describe("How long ago the last backup was — boundary value analysis", () => {
  const now = new Date("2026-06-15T12:00:00.000Z");
  const daysAgo = (days: number) =>
    new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  it("Says so when there has never been a backup, and counts that as stale", () => {
    // The state every new user is in, and the one the warning exists for.
    expect(backupAge(null, now)).toEqual({
      text: "No backup saved yet",
      stale: true,
      days: null,
    });
  });

  it("Says today for a backup made minutes ago", () => {
    expect(backupAge(daysAgo(0), now).text).toBe("Last backup: today");
  });

  it("Says yesterday rather than 1 days ago", () => {
    expect(backupAge(daysAgo(1), now).text).toBe("Last backup: yesterday");
  });

  it("Counts plain days beyond that", () => {
    expect(backupAge(daysAgo(5), now).text).toBe("Last backup: 5 days ago");
  });

  it("Is not stale the day before the threshold", () => {
    expect(backupAge(daysAgo(BACKUP_STALE_AFTER_DAYS - 1), now).stale).toBe(
      false,
    );
  });

  it("Is stale on the threshold itself", () => {
    expect(backupAge(daysAgo(BACKUP_STALE_AFTER_DAYS), now).stale).toBe(true);
  });

  it("Reads today rather than a negative age when the clock moved back", () => {
    // A timestamp in the future is not hypothetical: a laptop that syncs its
    // clock after waking can produce one. "-2 days ago" would look like a bug
    // in the app rather than a bug in the clock.
    const future = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

    expect(backupAge(future, now)).toMatchObject({ days: 0, stale: false });
  });
});
