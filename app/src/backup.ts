import type { Group, Settings } from "./types";

/**
 * The backup envelope — plan batch 3.3, shape from RP-07 §2.
 *
 * ## Why this exists when a CSV export already did
 *
 * The CSV carries the groups and nothing else. It omits the payment template
 * entirely (DEF-005), so the file the app called a backup could not restore the
 * app: the teacher got her groups back and retyped her payment details. It also
 * cannot represent an absent value — a CSV cell is either text or empty, and
 * "no template stored" and "an empty template" are different states here.
 *
 * So this is a second, additive format rather than a wider CSV. The CSV stays
 * exactly as it is, because its job is different: it opens in a spreadsheet.
 *
 * ## Two rules the shape follows
 *
 * **The member names inside `data` are the three storage key names, verbatim.**
 * The mapping between the file and the browser is then auditable by eye, and no
 * rename is introduced anywhere — see
 * .claude/context/storage-data-contract.md.
 *
 * **A file that is wrong is refused, never partly applied.** Import replaces
 * everything, so "read what we can" is data loss with extra steps. Every
 * failure below throws with a message written for the person holding the file.
 *
 * ## What is deliberately not here yet
 *
 * RP-07 §2 also specifies `source.device` and `source.label`, a per-device UUID
 * so a multi-device preview can name the device a file came from. There is one
 * device and no sync, so there is nothing to name; the field arrives with the
 * remote persistence in plan batch 6.3, along with the concept that gives it
 * meaning.
 */

export const BACKUP_FORMAT = "group-lesson-planner-backup";

/**
 * One monotonically increasing integer, no semver — RP-07 §2 rule 1.
 *
 * A file whose version is **higher** than this is refused rather than read.
 * That is rule 5, and it is mechanical rather than cautious: import replaces
 * every key, so a client that read a newer file and quietly dropped the fields
 * it did not recognise would write that loss straight back over the real data.
 */
export const BACKUP_SCHEMA_VERSION = 1;

/** The three stored keys, under their own names. */
export type BackupData = {
  groupLessonPlannerData: Group[];
  groupLessonPlannerSettings: Settings;
  /** Raw string, or `null` when the key was never written. */
  paymentTemplate: string | null;
};

/**
 * What the import preview shows on both sides before the user commits.
 *
 * `dates` and `overrideDates` are both here on purpose. The app stores the same
 * dates twice — once on the group, once inside the month rows — and a
 * divergence between the two is a real defect shape. Two numbers make it
 * visible in the file rather than copying it forward silently.
 */
export type BackupCounts = {
  groups: number;
  dates: number;
  overrideDates: number;
  monthKeys: number;
  templateChars: number;
};

export type Backup = {
  format: typeof BACKUP_FORMAT;
  schemaVersion: number;
  exportedAt: string;
  source: { origin: string };
  counts: BackupCounts;
  fingerprint: string;
  data: BackupData;
};

export const countsOf = (data: BackupData): BackupCounts => {
  const groups = data.groupLessonPlannerData;
  let dates = 0;
  let overrideDates = 0;
  let monthKeys = 0;

  for (const group of groups) {
    dates += group.dates.length;
    const overrides = group.monthlyOverrides ?? {};
    for (const month of Object.values(overrides)) {
      monthKeys += 1;
      overrideDates += month.dates.length;
    }
  }

  return {
    groups: groups.length,
    dates,
    overrideDates,
    monthKeys,
    templateChars: data.paymentTemplate?.length ?? 0,
  };
};

/**
 * FNV-1a, 32 bit, over the serialised data.
 *
 * A cheap integrity check and nothing more: it catches a truncated download or
 * a half-written file, which is how this file realistically goes wrong. It is
 * not a signature and defends against nobody. The algorithm is named in the
 * value so a later version can change it without a silent mismatch.
 */
export const fingerprintOf = (data: BackupData): string => {
  const text = JSON.stringify(data);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, "0")}`;
};

export const createBackup = (
  data: BackupData,
  exportedAt: Date,
  origin: string,
): Backup => ({
  format: BACKUP_FORMAT,
  schemaVersion: BACKUP_SCHEMA_VERSION,
  exportedAt: exportedAt.toISOString(),
  source: { origin },
  counts: countsOf(data),
  fingerprint: fingerprintOf(data),
  data,
});

/** Indented, because the file is meant to be readable if the app is gone. */
export const serializeBackup = (backup: Backup): string =>
  `${JSON.stringify(backup, null, 2)}\n`;

const NOT_A_BACKUP =
  "That file is not a Lesson Planner backup. Choose the .json file the planner saved.";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Reads a backup file, or refuses it.
 *
 * The order matters. Format first, so the commonest mistake — the wrong file
 * from the same folder — gets the message about choosing a different file.
 * Version next, so a newer file is refused for being newer rather than for
 * failing a shape check it was never going to pass. Shape, then fingerprint
 * last, because a fingerprint mismatch is only meaningful once the thing is
 * known to be a backup at all.
 */
export const parseBackup = (text: string): Backup => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(NOT_A_BACKUP);
  }
  if (!isRecord(parsed) || parsed["format"] !== BACKUP_FORMAT) {
    throw new Error(NOT_A_BACKUP);
  }

  const schemaVersion = parsed["schemaVersion"];
  if (typeof schemaVersion !== "number" || !Number.isInteger(schemaVersion)) {
    throw new Error(NOT_A_BACKUP);
  }
  if (schemaVersion > BACKUP_SCHEMA_VERSION) {
    throw new Error(
      `That backup was saved by a newer version of the planner ` +
        `(file version ${String(schemaVersion)}, this app reads ${String(BACKUP_SCHEMA_VERSION)}). ` +
        `Reload the page to update, then try again. Nothing has been changed.`,
    );
  }

  const data = parsed["data"];
  if (!isRecord(data)) throw new Error(NOT_A_BACKUP);

  const groups = data["groupLessonPlannerData"];
  const settings = data["groupLessonPlannerSettings"];
  const template = data["paymentTemplate"];
  if (
    !Array.isArray(groups) ||
    !isRecord(settings) ||
    typeof settings["defaultCurrency"] !== "string" ||
    !(typeof template === "string" || template === null)
  ) {
    throw new Error(NOT_A_BACKUP);
  }

  const restored: BackupData = {
    groupLessonPlannerData: groups as Group[],
    groupLessonPlannerSettings: {
      defaultCurrency: settings["defaultCurrency"],
    },
    paymentTemplate: template,
  };

  // Only checked when the file claims one. A backup written by hand, or by a
  // future exporter that drops the field, is still readable — the check is for
  // damage, not provenance.
  const fingerprint = parsed["fingerprint"];
  if (
    typeof fingerprint === "string" &&
    fingerprint !== fingerprintOf(restored)
  ) {
    throw new Error(
      "That backup file looks incomplete or edited: its contents do not match " +
        "the checksum saved inside it. Nothing has been changed.",
    );
  }

  return {
    format: BACKUP_FORMAT,
    schemaVersion,
    exportedAt:
      typeof parsed["exportedAt"] === "string" ? parsed["exportedAt"] : "",
    source: {
      origin:
        isRecord(parsed["source"]) &&
        typeof parsed["source"]["origin"] === "string"
          ? parsed["source"]["origin"]
          : "",
    },
    counts: countsOf(restored),
    fingerprint: fingerprintOf(restored),
    data: restored,
  };
};

/**
 * How long ago the last backup was, as the toolbar says it.
 *
 * `stale` drives a visible warning rather than a nag. The threshold is two
 * weeks because that is roughly a month's planning cycle: long enough that a
 * loss would cost real work, short enough that the warning still means
 * something when it appears. RP-07 §5 calls this the mitigation for the one
 * step that cannot be automated — the file still costs one click.
 */
export const BACKUP_STALE_AFTER_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

export const backupAge = (
  lastBackupAt: Date | null,
  now: Date,
): { text: string; stale: boolean; days: number | null } => {
  if (lastBackupAt === null) {
    return { text: "No backup saved yet", stale: true, days: null };
  }
  // Whole days between the two calendar instants, floored, and never negative:
  // a clock that moved backwards should read "today", not "-2 days ago".
  const days = Math.max(
    0,
    Math.floor((now.getTime() - lastBackupAt.getTime()) / DAY_MS),
  );
  const stale = days >= BACKUP_STALE_AFTER_DAYS;
  if (days === 0) return { text: "Last backup: today", stale, days };
  if (days === 1) return { text: "Last backup: yesterday", stale, days };
  return { text: `Last backup: ${String(days)} days ago`, stale, days };
};

/**
 * One line describing what a planner holds, for the import preview.
 *
 * Both sides of the preview use it, so the two lines are always comparable —
 * a preview whose halves counted different things would be worse than none.
 */
export const countsLine = (data: BackupData): string => {
  const counts = countsOf(data);
  const plural = (n: number, one: string, many: string) =>
    `${String(n)} ${n === 1 ? one : many}`;
  const template =
    data.paymentTemplate === null ? "no template" : "a payment template";
  return `${plural(counts.groups, "group", "groups")}, ${plural(counts.dates, "lesson", "lessons")}, ${template}`;
};
