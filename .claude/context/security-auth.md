# Security and authentication

Referenced from [CLAUDE.md](../../CLAUDE.md). Background:
[RP-06 auth and data protection](../../docs/research/rp06-auth-gdpr/rp06-auth-gdpr.md).

## Personal data rule (applies to every document and commit)

`index.html` contains real personal payment details of the app's owner: full
name, bank account number (IBAN), and tax id at lines **387–392**, plus a
personal first name at line **400**. Refer to them **only by line number**.
Never copy the values into any file, commit message, ticket, or chat.

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
