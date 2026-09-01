# Batch 3.3 — Versioned JSON backup (fixes DEF-005 for real)

Phase 3 · [Plan home](README.md) · Prev: [3.2](p3-02-input-import-sanitation.md) · Next: [3.4a](p3-04a-interaction-defects.md)

## Goal

The teacher gets a real backup: one file with everything, easy to save and
easy to restore.

## Tasks (TDD)

- [ ] Export: one JSON file with a `schemaVersion` field and all three keys
      (design from RP-07 §5).
- [ ] Import: dry-run preview first (counts on both sides), explicit confirm,
      automatic pre-import snapshot with an undo.
- [ ] "Last backup: N days ago" indicator in the toolbar; gentle reminder
      when N is large.
- [ ] Round-trip spec: export → clear → import → deep-equal.

## Acceptance criteria

- Round-trip spec green. Indicator spec green.
- The exported file contains the template key (the CSV never did).

## Merge order and dependencies

Depends on 3.1 (guarded storage first). Deployable: yes.
