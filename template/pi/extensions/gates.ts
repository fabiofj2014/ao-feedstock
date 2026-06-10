// gates.ts — wires pi lifecycle events to the project's quality gates.
//
//   tool_result(write|edit) -> gates/fast-gates.sh  (typecheck + lint)
//   agent_end               -> gates/full-gate.sh   (full suite)
//
// On failure it (a) records ao-shaped evidence in evidence/ledger.jsonl and
// (b) steers the agent to keep working instead of finishing red. The CI in
// .github/workflows/ci.yml is the hard backstop outside this process.
//
// v0: verify event field names and pi.sendMessage options against your
// installed @earendil-works/pi-coding-agent types, then promote.

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import {
  appendEvent,
  commandCompleted,
  gateDecision,
  newRunId,
  type CheckResult,
} from "../lib/evidence.ts";

const POLICY_ID = "trilho-a-default";
const WRITE_TOOLS = new Set(["write", "edit", "apply_patch", "multi_edit"]);

interface GateRun {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

function runGate(cwd: string, script: string): GateRun {
  const start = Date.now();
  const res = spawnSync("bash", [join("gates", script)], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, PROJECT_DIR: cwd },
  });
  return {
    exitCode: typeof res.status === "number" ? res.status : 1,
    stdout: res.stdout || "",
    stderr: res.stderr || "",
    durationMs: Date.now() - start,
  };
}

export default function (pi: ExtensionAPI) {
  let runId = newRunId();

  pi.on("agent_start", () => {
    runId = newRunId();
  });

  // Fast gate after the model writes/edits a file.
  pi.on("tool_result", (event, ctx) => {
    const toolName = (event as { toolName?: string }).toolName;
    if (!toolName || !WRITE_TOOLS.has(toolName)) return;

    const run = runGate(ctx.cwd, "fast-gates.sh");
    appendEvent(
      ctx.cwd,
      commandCompleted({
        runId,
        checkId: "fast-gate",
        command: ["bash", "gates/fast-gates.sh"],
        exitCode: run.exitCode,
        stdout: run.stdout,
        stderr: run.stderr,
        durationMs: run.durationMs,
      })
    );

    if (run.exitCode !== 0) {
      pi.sendMessage(
        {
          customType: "pi-gate",
          content: `fast-gate failed (typecheck/lint). Fix before continuing.\n\n${run.stderr || run.stdout}`,
          display: true,
        },
        { deliverAs: "steer", triggerTurn: false }
      );
    }
  });

  // Full gate when the agent tries to finish the run.
  pi.on("agent_end", (_event, ctx) => {
    const run = runGate(ctx.cwd, "full-gate.sh");
    appendEvent(
      ctx.cwd,
      commandCompleted({
        runId,
        checkId: "full-gate",
        command: ["bash", "gates/full-gate.sh"],
        exitCode: run.exitCode,
        stdout: run.stdout,
        stderr: run.stderr,
        durationMs: run.durationMs,
      })
    );

    const checks: CheckResult[] = [
      run.exitCode === 0
        ? { "check/id": "full-gate", status: "pass" }
        : { "check/id": "full-gate", status: "fail", reason: "non-zero-exit" },
    ];
    appendEvent(ctx.cwd, gateDecision({ runId, policyId: POLICY_ID, checks }));

    if (run.exitCode !== 0) {
      pi.sendMessage(
        {
          customType: "pi-gate",
          content: `full-gate is red — do not finish. Make the suite pass.\n\n${run.stderr || run.stdout}`,
          display: true,
        },
        { deliverAs: "followUp", triggerTurn: true }
      );
    }
  });
}
