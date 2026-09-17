import { cx } from "./cx";
import styles from "./AccountView.module.css";

/**
 * Which account is signed in, and the way out.
 *
 * A route (`#/account`) rather than a dialog. The dialogs in this app interrupt
 * a task — editing a group, writing the template — and this interrupts nothing:
 * she is not halfway through anything when she checks who she is signed in as.
 * Being a route also means the Back button closes it and a link to it works,
 * which is why 2b.9 made the dialogs routes in the first place.
 *
 * Signed out, the app never renders this. The planner is exactly what it was
 * before sign-in existed.
 */
type Props = {
  email: string;
  onSignOut: () => void;
  onClose: () => void;
};

export const AccountView = ({ email, onSignOut, onClose }: Props) => (
  <section className={cx(styles.account)} aria-labelledby="account-heading">
    <h2 id="account-heading">Account</h2>

    <p>
      <span className={cx(styles.label)}>Signed in as</span>
      <span className={cx(styles.email)} data-testid="account-email">
        {email}
      </span>
    </p>

    <p>
      Your lesson data is still stored in this browser. Signing out does not
      delete it.
    </p>

    <div className={cx(styles.actions)}>
      <button type="button" onClick={onClose}>
        Back to the planner
      </button>
      {/* Sign-out asks first. RP-07 §4: an explicit sign-out needs a
          confirmation, because on a shared or borrowed machine the cost of the
          accidental version is being locked out of her own planner until she
          can reach her Google account again. The confirm lives in `App`, with
          the other confirms, so every destructive answer in this app is worded
          in one place. */}
      <button type="button" onClick={onSignOut}>
        Sign out
      </button>
    </div>
  </section>
);
