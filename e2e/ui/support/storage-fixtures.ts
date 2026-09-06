import { readFileSync } from "fs";
import path from "path";
import type { BrowserContextOptions } from "@playwright/test";

type StorageState = Exclude<BrowserContextOptions["storageState"], undefined>;

/**
 * The three keys, in one place. Everything that touches storage reads them from
 * here so a rename cannot be made in one file and missed in another — see
 * .claude/context/storage-data-contract.md.
 */
export const STORAGE_KEYS = {
  data: "groupLessonPlannerData",
  settings: "groupLessonPlannerSettings",
  template: "paymentTemplate",
} as const;

/** A fixture file's contents: one entry per key, `null` meaning "not present". */
export type StorageFixture = {
  groupLessonPlannerData: unknown;
  groupLessonPlannerSettings: unknown;
  paymentTemplate: string | null;
};

const FIXTURE_DIR = path.join(__dirname, "..", "..", "fixtures", "storage");

export const readStorageFixture = (name: string): StorageFixture =>
  JSON.parse(
    readFileSync(path.join(FIXTURE_DIR, `${name}.json`), "utf-8"),
  ) as StorageFixture;

/** A fixture whose value is not JSON at all, for the corrupt-storage case. */
export const readRawFixture = (name: string): string =>
  readFileSync(path.join(FIXTURE_DIR, name), "utf-8");

/**
 * Turns a fixture into Playwright storage state.
 *
 * `prefix` exists for plan batch 2a: the staging build served at `/next/`
 * writes prefixed keys so it can share an origin with the real app without
 * touching the teacher's data. Passing no prefix gives the production keys.
 */
export const storageStateFromFixture = (
  baseURL: string,
  fixture: StorageFixture,
  prefix = "",
): StorageState => {
  const entries: { name: string; value: string }[] = [];
  const putJson = (key: string, value: unknown) => {
    if (value === null || value === undefined) return;
    entries.push({ name: `${prefix}${key}`, value: JSON.stringify(value) });
  };
  /** The template is stored as a raw string, never JSON-encoded. */
  const putRaw = (key: string, value: string | null) => {
    if (value === null) return;
    entries.push({ name: `${prefix}${key}`, value });
  };

  putJson(STORAGE_KEYS.data, fixture.groupLessonPlannerData);
  putJson(STORAGE_KEYS.settings, fixture.groupLessonPlannerSettings);
  putRaw(STORAGE_KEYS.template, fixture.paymentTemplate);

  return { cookies: [], origins: [{ origin: baseURL, localStorage: entries }] };
};

/** Storage state holding one key set to a value that is not valid JSON. */
export const storageStateWithCorruptKey = (
  baseURL: string,
  key: keyof typeof STORAGE_KEYS,
  raw: string,
  prefix = "",
): StorageState => ({
  cookies: [],
  origins: [
    {
      origin: baseURL,
      localStorage: [{ name: `${prefix}${STORAGE_KEYS[key]}`, value: raw }],
    },
  ],
});
