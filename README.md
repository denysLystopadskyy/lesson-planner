# Lesson Planner

A small web app for one teacher. She plans lesson dates for her teaching
groups, sets prices per group and per month, and copies a payment message to
send to each group's parents.

It runs at
**<https://denyslystopadskyy.github.io/lesson-planner/>**.

## What it does

- **Groups.** A group has a name, a default price and a currency. It tracks the
  group, not the individual students.
- **A calendar per group.** Pick the dates the group meets. Arrow keys move
  between days, Space selects, and Arrow Up from the top row reaches the
  weekday headings, where Space selects every Monday — or every Friday — in the
  month at once.
- **A price per month.** A month can override the group's default price.
- **A payment message.** One editable template, with `{{month}}`,
  `{{lessons}}` and `{{total}}` filled in per month. Copy it and paste it
  wherever you talk to parents.
- **Backups.** _Save Backup_ writes one JSON file with everything in it.
  _Load Backup_ previews what would change, asks, and can be undone. The
  toolbar says how long ago the last one was.
- **CSV.** A separate export for opening the groups in a spreadsheet. It does
  **not** carry the payment message — use a backup to restore the app.

## Where the data lives

In your browser, in `localStorage`, on the device you are using. There is no
server and no account, so:

- Nobody else can read it, including the developer.
- **Clearing your browser data deletes it.** Save a backup file.
- It does not follow you to another device or another browser.

Moving the data to a database, behind a Google sign-in, is planned as Phases
4–6 of the [execution plan](docs/plan/README.md).

## Running it

```bash
npm ci          # install the pinned toolchain
npm run dev:app # a dev server with hot reload
npm run serve   # build, then preview on http://localhost:4173
```

## Testing it

```bash
npm run test:unit   # Vitest over the pure modules
npm run test:e2e    # the Playwright suite, against a fresh build
npm run lint
npm run typecheck   # the e2e tree
npm run typecheck:app
npm run check:pii   # no bank or tax identifier shapes in tracked source
npm run format:check
```

`npx playwright test --grep @a11y` runs the accessibility scans on their own.

Playwright starts and stops its own preview server, so a suite run always
rebuilds. A preview you started by hand is reused and serves a **stale build** —
stop it before running the suite after editing `app/`.

## How it is built

React 19 and TypeScript, built by Vite, deployed to GitHub Pages. `app/src/`
holds the components, a CSS Module beside each one that needs styling, and the
pure modules that hold all the logic worth reading on its own — `store.ts`,
`schedule.ts`, `csv.ts`, `backup.ts`, `message.ts`, `storage.ts`, `route.ts`,
`format.ts`, `contrast.ts`. Nothing in those touches React or the browser, so
they are unit-tested without either.

## The documents

- **[docs/plan/](docs/plan/README.md)** — the phased execution plan, one page
  per pull request, plus the [defect registry](docs/plan/def-registry.md) and
  [what executing it taught us](docs/plan/lessons-learned.md).
- **[docs/research/](docs/research/README.md)** — ten research reports the plan
  was built from.
- **[CLAUDE.md](CLAUDE.md)** — how to work in this repository, and where each
  kind of decision is recorded.

## Licence

Apache-2.0. See [LICENSE](LICENSE).
