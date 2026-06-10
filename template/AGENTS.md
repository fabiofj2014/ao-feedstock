# Agent Rules (Trilho A)

Rules the pi coding agent must follow in this project. Gates enforce the
objective parts; you own the judgment parts.

## Non-negotiable

- Never finish with the suite red. `full-gate` runs when you try to end — if it
  fails, keep working until it passes.
- Never print or hardcode secrets. Use env/stdin/file references. The
  `secrets` extension will block leaking commands and redact output.
- One feature per branch. Never merge — open a PR (`/pr`) and let the human review.

## Auto-fix ladder (how far you may act alone)

You may fix autonomously only as far as a deterministic, machine-verifiable
oracle exists — not one step beyond.

- **Level 1 — silent**: formatter/lint mechanical fixes. Commit `chore(autofix): <tool>`.
- **Level 2 — fix + gate confirms**: build/type/test failures with a reliable
  red/green. Iterate against the gate. Commit `fix(auto): satisfy <gate>`.
- **Level 3 — propose + human decides**: anything about intent, product
  judgment, API shape, risky migrations. Do not decide — propose in the PR.

## Evidence

Every gate run appends to `evidence/ledger.jsonl` in the ao-by-codex vocabulary.
Do not edit that file by hand. The last `gate/decision` with `permitida?: true`
is your proof the work is mergeable.

## Quality

- Read files in full before wide changes.
- Match existing style. Touch only what the task needs.
- Tests prove behavior — write the test, make it pass.
