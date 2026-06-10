# Evidence Schema — `evidence/ledger.jsonl`

Append-only. One JSON object per line. Keys deliberately mirror the
**ao-by-codex** ledger vocabulary so this file can later be ingested by ao
(via `pi-gate export --edn` or ao `scm-ingest`) with a mechanical
JSONL → EDN conversion: each JSON string key `"event/type"` maps to the EDN
keyword `:event/type`, status strings like `"pass"` map to `:pass`, etc.

## Event: command completed

Emitted after each gate script run.

```json
{
  "event/id": "uuid",
  "event/at": "ISO-8601",
  "event/type": "runner/command-completed",
  "source": "runner",
  "run/id": "uuid (one per agent run)",
  "check/id": "fast-gate | full-gate",
  "command": ["bash", "gates/full-gate.sh"],
  "exit-code": 0,
  "stdout-sha256": "hex",
  "stderr-sha256": "hex",
  "duration-ms": 1240
}
```

## Event: gate decision

Emitted at the end of a run (after `full-gate`).

```json
{
  "event/id": "uuid",
  "event/at": "ISO-8601",
  "event/type": "gate/decision",
  "source": "gate",
  "run/id": "uuid",
  "policy/id": "trilho-a-default",
  "permitida?": true,
  "checks": [{ "check/id": "full-gate", "status": "pass" }]
}
```

## Mapping to ao-by-codex

| JSONL key            | ao EDN keyword          | Note                          |
| -------------------- | ----------------------- | ----------------------------- |
| `"event/type"`       | `:event/type`           | value also keywordized        |
| `"source"`           | `:source`               | `"runner"` → `:runner`        |
| `"run/id"`           | `:run/id`               | string uuid                   |
| `"exit-code"`        | `:exit-code`            | integer                       |
| `"stdout-sha256"`    | `:stdout-sha256`        | hex string                    |
| `"permitida?"`       | `:permitida?`           | boolean                       |
| `"checks"[].status`  | `:status`               | `"pass"`/`"fail"` → keyword   |

The only intentional debt vs. ao is the JSON↔EDN format gap; the vocabulary is
already aligned, so no re-modeling is needed when ao ingests this.
