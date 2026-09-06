/**
 * The three storage keys, with the build-time prefix applied.
 *
 * `VITE_STORAGE_PREFIX` is empty for a production build and set for the staging
 * build served at `/next/`, so staging shares an origin with the real app and
 * still cannot read or overwrite the teacher's data. Batch 1.13's
 * `storage-contract.spec.ts` proves that separation against the legacy app.
 *
 * The names themselves must never change — see
 * .claude/context/storage-data-contract.md.
 */
const prefix: string = import.meta.env.VITE_STORAGE_PREFIX ?? "";

export const STORAGE_KEYS = {
  data: `${prefix}groupLessonPlannerData`,
  settings: `${prefix}groupLessonPlannerSettings`,
  template: `${prefix}paymentTemplate`,
} as const;
