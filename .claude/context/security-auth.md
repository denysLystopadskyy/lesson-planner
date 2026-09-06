# Security and authentication

Referenced from [CLAUDE.md](../../CLAUDE.md). Background:
[RP-06 auth and data protection](../../docs/research/rp06-auth-gdpr/rp06-auth-gdpr.md).

## Personal data rule (applies to every document and commit)

`index.html` contains real personal payment details of the app's owner: full
name, bank account number (IBAN), and tax id at lines **387–392**, plus a
personal first name at line **400**. Refer to them **only by line number**.
Never copy the values into any file, commit message, ticket, or chat.

### Tests must not render the real template

**Any spec that opens the payment template, or renders a message generated from
it, must seed its own template** through the `template` option of
`plannerState`. If a spec seeds nothing, the app falls back to
`App.config.defaultTemplate`, which carries the real identifiers.

Why this is separate from the cleanup below: `playwright.config.ts` keeps
`trace`, `video` and `screenshot` on failure, so an unseeded spec that fails
copies those values into CI artifacts. DEF-015 is about the values shipping in
the source; this is about them escaping into build output. Fixing one does not
fix the other, and this rule stops mattering only when batch 3.5 removes the
values from the app.

Known affected specs: `template-editing.spec.ts` (seeded in plan batch 1.4) and
`payment-messages.spec.ts` (arrives in batch 1.5).

### The React port ships neutral placeholders

`app/src/message.ts` defines its own `DEFAULT_TEMPLATE` with `<recipient>` and
`<account>` in place of the payment block. It is **not** a copy of
`App.config.defaultTemplate`: copying it would put the identifiers in a second
tracked file, which the rule above forbids, and batch 3.5 would then have two
places to clean instead of one (decision, plan batch 2a.3d).

The seeding rule above still applies unchanged. It protects against the legacy
page, which the suite keeps testing until cutover.

One consequence belongs to the cutover, not here: a browser with no
`paymentTemplate` key falls back to this neutral default, so the owner fills the
block in once in the template editor. Recorded as a task on plan batch 2a.4.

## Status of the cleanup

Status: the cleanup is scheduled as plan batch 3.5 and the user marked it
**low priority** (decision, 2026-08-20). The values are treated as already
public (they are in git history). The batch removes them from the shipped app;
history cleanup is a separate optional decision.

## Decided

- **A static site cannot hold a secret.** Anything shipped to the browser is
  public. Vite env variables prefixed for the client are embedded in the
  bundle — they are not hidden. Never put a secret in client code or config.
- Secrets, if ever needed locally, live in `.env.local` (gitignored).
- The XSS sink (group name into `innerHTML`, `index.html:1046-1051`) is mostly
  dissolved by React/JSX escaping during the port. Import sanitation (currency
  whitelist, month-key validation) lands in plan batch 3.2.
- **Phase 4 sign-in preference: Google account (OAuth) via Firebase
  `signInWithPopup`.** Never `signInWithRedirect` — it breaks on Safari,
  Firefox, and Chrome for apps served off the provider's domain (verified
  against Firebase docs, 2026-08-20). A popup needs a user gesture, so sign-in
  hangs off a visible button.
- Public API keys (for example a Firebase key) are not secrets **only if**
  security rules do the authorization work. The rules, not the key, protect
  the data. Details and the GDPR posture: RP-06.

## TBD

- Everything database-related is Phase 4 brainstorming first (plan batch 4.1):
  provider, rules, DPA, backup policy. No implementation before that document
  is agreed.
