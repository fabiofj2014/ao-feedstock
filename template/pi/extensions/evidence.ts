// evidence.ts — append-only JSONL evidence emitter.
//
// The bridge to ao-by-codex: every event mirrors the ao ledger vocabulary
// (`event/type`, `source`, `run/id`, `exit-code`, `permitida?`, `checks`...),
// so a later `pi-gate export --edn` (or ao `scm-ingest`) can ingest this file
// with a mechanical JSONL -> EDN conversion. See evidence/SCHEMA.md.
//
// Pure Node (fs/path/crypto). Erasable TS syntax only (Node strip-only safe).

import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { randomUUID, createHash } from "node:crypto";

export interface CheckResult {
  "check/id": string;
  status: "pass" | "fail";
  reason?: string;
}

export interface LedgerEvent {
  "event/id": string;
  "event/at": string;
  "event/type": string;
  source: string;
  "run/id": string;
  [key: string]: unknown;
}

const LEDGER_RELATIVE = join("evidence", "ledger.jsonl");

export function newRunId(): string {
  return randomUUID();
}

export function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function appendEvent(cwd: string, event: LedgerEvent): LedgerEvent {
  const dir = join(cwd, "evidence");
  mkdirSync(dir, { recursive: true });
  appendFileSync(join(cwd, LEDGER_RELATIVE), JSON.stringify(event) + "\n", "utf8");
  return event;
}

function nowIso(): string {
  return new Date().toISOString();
}

export function commandCompleted(input: {
  runId: string;
  checkId: string;
  command: string[];
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}): LedgerEvent {
  return {
    "event/id": randomUUID(),
    "event/at": nowIso(),
    "event/type": "runner/command-completed",
    source: "runner",
    "run/id": input.runId,
    "check/id": input.checkId,
    command: input.command,
    "exit-code": input.exitCode,
    "stdout-sha256": sha256(input.stdout || ""),
    "stderr-sha256": sha256(input.stderr || ""),
    "duration-ms": input.durationMs,
  };
}

export function gateDecision(input: {
  runId: string;
  policyId: string;
  checks: CheckResult[];
}): LedgerEvent {
  const permitida = input.checks.every((c) => c.status === "pass");
  return {
    "event/id": randomUUID(),
    "event/at": nowIso(),
    "event/type": "gate/decision",
    source: "gate",
    "run/id": input.runId,
    "policy/id": input.policyId,
    "permitida?": permitida,
    checks: input.checks,
  };
}
