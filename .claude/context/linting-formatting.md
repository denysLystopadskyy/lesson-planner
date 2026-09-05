# Linting and formatting

Decisions about code style tools. Referenced from [CLAUDE.md](../../CLAUDE.md).

## Decided

- **Prettier** formats all code and markdown we author.
  - `index.html` is excluded until the legacy file is deleted (plan batch 2a.4).
    Reason: formatting it creates a huge diff and breaks line references used
    by the research reports.
  - `docs/research/` is excluded permanently. It is an archive.
- **ESLint** uses the flat config format with official presets only:
  - `typescript-eslint` `strictTypeChecked` (strict + type-checked rules).
  - `eslint-plugin-playwright` recommended config for `e2e/`.
  - `eslint-config-prettier` last, to disable style rules Prettier owns.
- **Presets over hand-written rules.** Add a custom rule only when a preset
  does not cover a stated need, and record the need here.
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
