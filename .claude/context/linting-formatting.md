# Linting and formatting

Decisions about code style tools. Referenced from [CLAUDE.md](../../CLAUDE.md).

## Decided

- **Prettier** formats all code and markdown we author.
  - `app/src/styles.css` is excluded while it is a verbatim copy of the deleted
    page's `<style>` block (plan batches 2a.3e and 2b.7). Reason: formatting it
    makes it impossible to diff against its source. `index.html` carried the
    same exclusion, for the same reason plus the research reports' line
    references, until batch 2a.4 deleted it.
  - `docs/research/` is excluded permanently. It is an archive.
- **ESLint** uses the flat config format with official presets only:
  - `typescript-eslint` `strictTypeChecked` (strict + type-checked rules).
  - `eslint-plugin-playwright` recommended config for `e2e/`.
  - `eslint-config-prettier` last, to disable style rules Prettier owns.
- **Presets over hand-written rules.** Add a custom rule only when a preset
  does not cover a stated need, and record the need here.
- **Two plugin options are configured, and no rule is switched off.** Both exist
  because the Screenplay layer hides things the plugin looks for by name, not
  because a rule is wrong (plan batch 1.6):
  - `settings.playwright.globalAliases.test` lists every spec-local test object.
    Each spec builds its own with `configureTest(...)`, so the plugin cannot
    recognise a test block and reported all 63 `expect` calls inside them as
    standalone. Naming them keeps `no-standalone-expect` able to do its real
    job — catching an `expect` at module scope, which would never run. **A new
    test object must be added to that list**; the lint fails loudly if it is
    not. If the list becomes a burden, the durable fix is one `test` per spec
    file with `test.use()` per describe, which removes the need entirely.
  - `playwright/expect-expect` is given `assertFunctionPatterns: ["verifies"]`
    and `assertFunctionNames: ["expectAriaSnapshot"]`, because a Screenplay test
    asserts through `actor.verifies(...)` rather than a bare `expect`.
- **`noUncheckedIndexedAccess` is on.** Turned on in plan batch 1.6 because
  `no-unnecessary-condition` flagged a correct `?? "UAH"` fallback as dead code:
  without it, `groups[0]` is typed as always present, so the type system was
  lying about an array that can be empty. The lint was right and the types were
  wrong.
- ESLint lands after the spec corpus exists (plan batch 1.6). Type-checked
  linting needs TypeScript files to check.
- Style basics: 2-space indentation, kebab-case filenames, no `any`.
- **Dependencies are raised to the latest stable version** when installed
  (user decision, 2026-08-20). Record the chosen versions in the lockfile and
  in the batch page; never invent version numbers in documents.
- **Versions are pinned exactly, not as ranges.** Reason: "raise to latest
  stable _when installed_" means an upgrade is a deliberate act. Caret ranges
  would let versions drift between installs, which contradicts recording the
  chosen version. The pins themselves live in `package.json` and
  `package-lock.json`, so they are already machine-independent; a project
  `.npmrc` with `save-exact=true` only makes a future `npm install <pkg>` keep
  the policy on a machine whose global npm config does not. Never write a
  registry auth token into that file — it is tracked.
- **No `.prettierrc`. Prettier defaults are the preset.** Checked in batch 1.1:
  setting `singleQuote: true` to match the scaffold's authored style would not
  avoid the one-time reformat (24 of 38 e2e files still change, against 37 with
  defaults), so it buys nothing and costs a hand-written rule.

- **Check the peer ranges of dependencies that later batches will add**, not
  only the ones being installed now. Taking the latest TypeScript would have
  made plan batch 1.6 impossible to install; the conflict would have surfaced
  five batches away from its cause. The exception below is the worked example.
- **After a formatter runs, prove content equality by formatting both sides.**
  Prettier rewrites most adopted files, so `cmp` against the source stops
  meaning anything. Format a copy of the source and `diff -r` the two trees;
  that distinguishes "reformatted" from "changed".

## Exception: TypeScript is held at 6.0.3

Recorded 2026-09-05 in plan batch
[1.1](../../docs/plan/p1-01-toolchain-bootstrap.md). This is the one place we
knowingly do not take the latest stable version.

- **What:** `typescript` is pinned to 6.0.3. npm `latest` is 7.0.2.
- **Why:** `typescript-eslint@8.69.0` declares
  `typescript: ">=4.8.4 <6.1.0"`. With TypeScript 7 installed,
  `npm install typescript-eslint` fails outright with `ERESOLVE` — so the
  ESLint batch (1.6) could not land without `--legacy-peer-deps` or an
  `overrides` block, both of which paper over a real incompatibility.
- **Cost:** none measured. TypeScript 6.0.3 typechecks the whole scaffold at
  exit 0, and `moduleResolution: "node"` is removed in 6 just as in 7, so the
  migration this project had to make is unchanged.
- **Expiry condition:** revisit when `typescript-eslint` supports TypeScript 7
  (widened peer range). At that point raise both together and delete this
  section. The exact pin is what stops an accidental jump to 6.1, which would
  leave the supported range again.

## TypeScript configuration

- **`module` and `moduleResolution` are both `nodenext`.** They are one
  decision, not two fields — a mismatched pair does not compile. Chosen in plan
  batch 1.1 over `"bundler"`, which is invalid with `module: "commonjs"` and
  wrong in kind: the e2e suite is Node-hosted test code that Playwright runs,
  not bundler input. When Vite arrives (batch 2a.1), `app/` gets its own
  tsconfig; this one keeps covering the tests.
- **`moduleResolution: "node"` is removed in TypeScript 6 and later**
  (`error TS5108`). Any config copied from older material has to be migrated.
- **`@types/node` is a required dependency**, because `tsconfig` sets
  `"types": ["node", "@playwright/test"]` and the config and specs read
  `process.env`. Without it every such reference fails with `TS2591`.

## TBD

- Whether any custom ESLint rule is ever needed (none expected).
