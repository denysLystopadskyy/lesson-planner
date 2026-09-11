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
  /**
   * When the teacher last saved a backup file — plan batch 3.3.
   *
   * A fourth key, and the first addition since the contract was written. It is
   * not planner data: nothing in the three keys changes, nothing reads it but
   * the toolbar indicator, and losing it costs a reminder rather than a lesson.
   * A raw ISO timestamp, not JSON, following the `paymentTemplate` precedent so
   * a parse failure is impossible.
   */
  lastBackup: `${prefix}groupLessonPlannerLastBackup`,
} as const;
