/**
 * What the app says about the data it could not read, mend, or save.
 *
 * Three notices, one per way storage can let the user down. They are together
 * in one file because they are one idea — *say what happened to the data* — and
 * because the difference between them is mostly which of the three the app is
 * allowed to keep working through.
 *
 * | notice           | defect  | app still usable? | announced |
 * | ---------------- | ------- | ----------------- | --------- |
 * | `StorageError`   | DEF-001 | no — replaces it  | `alert`   |
 * | `StorageRepairs` | DEF-021 | yes               | `status`  |
 * | `WriteError`     | DEF-022 | yes, unsaved      | `alert`   |
 *
 * `role="alert"` is for the two the user must act on; the repair notice is a
 * `role="status"`, which a screen reader reads without interrupting, because
 * nothing is broken and nothing is waiting on them.
 */

/**
 * The stored data could not be read at all.
 *
 * The legacy page said nothing: `JSON.parse` threw inside `App.init()` and
 * everything after it was skipped, leaving a page that looked normal and did
 * nothing (DEF-001, closed by deleting that page). The two sentences below are
 * the whole difference, and `storage-contract.spec.ts` asserts them.
 *
 * It says plainly that nothing was deleted, because the honest fear on seeing
 * this message is that the data is gone. Since batch 3.1 that sentence is also
 * literally true in a way it was not before: the unreadable value is copied to
 * a `.corrupt.backup` key before the app carries on, so the bytes survive.
 */
export const StorageError = ({ message }: { message: string }) => (
  <div role="alert" className="storage-error">
    <p>Your saved data could not be read.</p>
    <p>
      Nothing has been changed or deleted. The details were:{" "}
      <code>{message}</code>
    </p>
  </div>
);

/**
 * The stored data loaded, but its shape had to be mended — DEF-021.
 *
 * Changing what someone stored without telling them is the same sin as failing
 * to store it, so every mend is listed. The list is the repairs verbatim from
 * `storage.ts`, because a summary ("2 problems fixed") tells the teacher
 * nothing she can act on, and the thing she can act on is usually a price that
 * now reads zero.
 */
export const StorageRepairs = ({ repairs }: { repairs: string[] }) => {
  if (repairs.length === 0) return null;
  return (
    <div role="status" className="storage-notice">
      <p>
        Some of your saved data had to be repaired before it could be shown.
      </p>
      <ul>
        {repairs.map((repair) => (
          <li key={repair}>{repair}</li>
        ))}
      </ul>
      <p>Check anything listed above, then save the group again.</p>
    </div>
  );
};

/**
 * The browser refused to save — DEF-022.
 *
 * The danger here is specific and worth naming on screen: what is on the
 * screen is not what is in storage, so closing the tab loses it. A full quota
 * or a private window does not fix itself, which is why this asks the user to
 * do something rather than offering a retry that would fail the same way.
 */
export const WriteError = ({ message }: { message: string }) => (
  <div role="alert" className="storage-error">
    <p>Your last change could not be saved.</p>
    <p>
      It is still on screen, but it is <strong>not stored</strong> — closing
      this tab would lose it. This usually means the browser is out of space or
      is a private window. The details were: <code>{message}</code>
    </p>
  </div>
);
