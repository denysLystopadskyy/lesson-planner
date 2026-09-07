/**
 * What the app says when it cannot read what it stored.
 *
 * The legacy page said nothing: `JSON.parse` threw inside `App.init()` and
 * everything after it was skipped, leaving a page that looked normal and did
 * nothing (DEF-001, closed by deleting that page). The two sentences below are
 * the whole difference, and `storage-contract.spec.ts` asserts them.
 *
 * `role="alert"` so a screen reader announces it without being asked. It says
 * plainly that nothing was deleted, because the honest fear on seeing this
 * message is that the data is gone.
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
