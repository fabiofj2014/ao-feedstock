# ao-feedstock (`pi-gate`)

**Trilho A**: the usable-today path to *"ask for a feature, get a reviewable PR"*.

It scaffolds three things into any project:

1. the **pi coding agent** wiring (extensions that run your quality gates),
2. your **gate scripts** (fast + full) and a **CI** hard backstop,
3. an append-only **evidence ledger** (`evidence/ledger.jsonl`) whose vocabulary
   matches **ao-by-codex** — so the trust engine can ingest it later. Same
   family, separate repos, no fork. `ao-feedstock` is the raw material that
   feeds ao.

## Quick start

```sh
# in the project you want the agent to work on:
npx pi-gate init
npm i -g @earendil-works/pi-coding-agent
pi
# then: "implement feature X"
```

## What `init` writes

```
.pi/
  settings.json
  extensions/gates.ts     tool_result(write|edit) -> fast-gate ; agent_end -> full-gate
  extensions/secrets.ts   block secret-leaking bash ; redact secrets from output
  lib/evidence.ts         ao-shaped JSONL emitter (helper, not an extension)
  prompts/pr.md           PR prompt (commit convention + checklist)
gates/
  fast-gates.sh           typecheck + lint (runs only what exists)
  full-gate.sh            full suite
.github/workflows/ci.yml  the gate that actually blocks the PR
AGENTS.md                 rules for the agent (auto-fix ladder, no secrets, no auto-merge)
evidence/SCHEMA.md        the JSONL <-> ao EDN contract
package.json              + scripts gate:fast / gate:full
```

## The loop

```
pi "implement X"
  -> edits files       -> fast-gate per edit  (red -> steer "fix it")
  -> tries to finish   -> full-gate           (red -> steer "don't finish")
  -> /pr               -> opens PR ; CI is the hard backstop
  -> you review + merge
```

## Status

v0, smoke-tested live against `@earendil-works/pi-coding-agent` v0.79.1 + DeepSeek.

**Verified live:**

- Agent implements a feature end-to-end via `pi -p`.
- `fast-gate` fires on each write/edit; `full-gate` fires at `agent_end`.
- Evidence written to `evidence/ledger.jsonl` in ao vocabulary (see
  `examples/ledger.example.jsonl`), all events sharing one `run/id`.
- **Red path**: a red suite at finish produces `gate/decision permitida?:false`
  and the steer message forces the agent to keep working until green
  (`permitida?:true`) — even in print mode.

**Known limitation — secrets are a speed-bump, not a wall:**

- `secrets.ts` blocks naive secret-leaking bash (literal token / env var), but a
  determined agent can route around it (e.g. base64-encode the value).
- `tool_result` redaction does not cover the agent's own assistant message, so a
  model that narrates a secret in its reply still leaks it.
- Real secret control = don't expose secrets to the agent + CI secret scanning.
  Treat `secrets.ts` as defense-in-depth, not a guarantee.

The CLI and the evidence emitter are plain Node and run as-is.

## Roadmap (not built yet)

- `pi-gate export --edn` — convert `ledger.jsonl` to EDN for ao ingestion.
- `pi-gate doctor` — check pi install + gate tooling.
