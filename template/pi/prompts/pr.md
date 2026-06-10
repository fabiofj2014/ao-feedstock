---
name: pr
description: Open a pull request for the current branch with a reviewable summary.
---

Open a pull request for the work on the current branch. Before opening:

1. Confirm `gate:full` passes locally (the full-gate extension already enforces this).
2. Ensure the branch is pushed.

PR body must contain:

- **What & why** — one paragraph, plain language.
- **Changes** — bullet list of the meaningful edits (skip noise).
- **Evidence** — paste the last `gate/decision` line from `evidence/ledger.jsonl`
  (`permitida?` must be `true`).
- **Review focus** — what the human should look at first.

Commit convention (so the human can scan the review fast):

- `chore(autofix): <tool>` — mechanical formatter/lint fixes
- `fix(auto): satisfy <gate>` — change made only to pass a deterministic gate
- normal descriptive commits — judgment changes

Open the PR as a draft if any check is still pending. Never merge — the human reviews and merges.
