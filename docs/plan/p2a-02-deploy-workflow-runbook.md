# Batch 2a.2 — Deploy workflow + owner runbook

Phase 2a · [Plan home](README.md) · Prev: [2a.1](p2a-01-vite-scaffold.md) · Next: [2a.3a](p2a-03a-port-shell-storage.md)

## Goal

Ship a Pages deploy workflow that is inert until the repository owner flips
the publishing source, plus the exact runbook for that flip.

## Tasks

- [x] Workflow: build `app/` with `--base=/lesson-planner/next/`, compose an
      artifact with the legacy `index.html` at `/` and the React build at
      `/next/`, deploy with the official Pages actions, gated on the repository
      variable `PAGES_ACTIONS`.
- [x] Gate the deploy job on the test job passing.
- [x] Write the owner runbook, below.

## What the workflow does

Three jobs, each depending on the last: **verify → build → deploy**.

`verify` runs the same four checks CI runs plus `typecheck:app`, so a red suite
cannot publish. `build` produces the artifact. `deploy` is gated on
`vars.PAGES_ACTIONS == 'true'` and does not run today, which is how this batch
merges without touching the live site.

The artifact holds exactly two things:

| Path     | Contents                                                                     |
| -------- | ---------------------------------------------------------------------------- |
| `/`      | The legacy `index.html`, **copied not rebuilt**, so it stays byte-identical  |
| `/next/` | The React build, `--base=/lesson-planner/next/`, `VITE_STORAGE_PREFIX=next:` |

**The switch narrows what is published, and that is deliberate.** Pages
currently copies the whole branch, so `docs/` and the raw `app/` sources are
served. After the flip only the two paths above exist.

The staging prefix is the only thing separating the React build from the
teacher's data while the two share an origin. Batch
[1.13](p1-13-storage-contract.md) proves that separation holds.

## Rehearsed locally before asking CI

The assemble step was run exactly as written, against a copy of this branch:

```
site/index.html
site/next/assets/index-CLdI5DzV.js
site/next/index.html
```

`diff -q index.html site/index.html` reports identical, and the built page
references `/lesson-planner/next/assets/index-CLdI5DzV.js` — the sub-path that a
missing `base` would have got wrong.

One expected absence: the staging bundle contains no prefixed storage key yet,
because nothing imports `storage-keys.ts` until batch
[2a.3a](p2a-03a-port-shell-storage.md). The env var is wired and proven in
[2a.1](p2a-01-vite-scaffold.md); it starts mattering when the adapter lands.

## Owner runbook (Settings actions only the owner can do)

Both steps are yours — a repository collaborator cannot do either.

1. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
2. **Settings → Secrets and variables → Actions → Variables** → New variable,
   name `PAGES_ACTIONS`, value `true`.
3. **Actions tab → Deploy → Run workflow** on `main`.
4. **Verify, and record the results in the table below:**
   - `curl -s https://denyslystopadskyy.github.io/lesson-planner/ | shasum -a 256`
     must print `0612db527a8b38395ecbffa126f71fdf2faf3c7e1d859c3329c2af7264822eb8`
     — the hash of the page as served today. Anything else means the root page
     changed, which this batch must not do.
   - `curl -sI https://denyslystopadskyy.github.io/lesson-planner/next/` must
     return `200`, and the page must show the placeholder title.
   - Open `/next/`, add nothing, and confirm in devtools that any key it writes
     begins `next:`.
5. Record the date of the flip in
   [deployment.md](../../.claude/context/deployment.md).

**If step 4 fails, the fix is one click:** set `PAGES_ACTIONS` to `false` and
switch Settings → Pages back to branch `main` / root. The workflow stops
deploying and Pages serves the branch again, exactly as now.

### Runbook results

| Step                                        | Date | Result |
| ------------------------------------------- | ---- | ------ |
| 1 — Source set to GitHub Actions            |      |        |
| 2 — `PAGES_ACTIONS` set to `true`           |      |        |
| 3 — Workflow run                            |      |        |
| 4 — Root hash matches, `/next/` returns 200 |      |        |

## Acceptance criteria

- [x] The PR merges with the workflow green and the live site untouched.
- [ ] **Open — needs the owner.** The batch closes on runbook evidence: the
      table above filled in. Everything a collaborator can do is done; steps 1
      and 2 are Settings changes only the repository owner can make.

## Merge order and dependencies

Depends on 2a.1. Blocks 2a.3a. Deployable: yes (inert until the flip; the
flip itself is verified by the runbook).
