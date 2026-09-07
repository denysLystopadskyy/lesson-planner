/**
 * Joins class names, dropping the ones that are not there.
 *
 * A CSS Module's class is typed `string | undefined` here, because
 * `noUncheckedIndexedAccess` is on and a module is an index signature — the
 * compiler cannot know that `styles.card` exists. Interpolating that into a
 * template literal would put the word "undefined" in the DOM if a class were
 * ever renamed, which is exactly the mistake the flag exists to catch.
 *
 * So: filter, then join. A missing class disappears instead of becoming
 * `undefined`, and the caller keeps the conditional form that reads well.
 */
export const cx = (...parts: (string | false | undefined)[]): string =>
  parts.filter((part): part is string => typeof part === "string").join(" ");
