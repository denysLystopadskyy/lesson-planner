# Batch 1.0 — Docs and memory bootstrap

Phase 1 · [Plan home](README.md) · Next: [1.1 Toolchain bootstrap](p1-01-toolchain-bootstrap.md)

## Goal

Create the project memory (CLAUDE.md, context files) and this plan wiki, so
every later batch has one place for decisions and one page to link from its PR.

## Tasks

- [x] Rename `AGENTS.md` to `CLAUDE.md`. Rewrite it: what the app is, the
      decision rule, an index of the context files. Only true statements.
- [x] Create the seven context files under `.claude/context/` and seed them
      with the known decisions. Mark open points `TBD`.
- [x] Create `docs/plan/`: this hub, one page per batch, and the
      [DEF registry](def-registry.md).

## Acceptance criteria

- `CLAUDE.md` exists; `AGENTS.md` does not.
- Every link in `CLAUDE.md` and in the plan hub resolves to a real file.
- A search for the personal payment values over all new files returns nothing.

## Merge order and dependencies

First batch. No dependencies. Delivered on the research branch together with
the research reports; every later batch is its own PR into `main`.
