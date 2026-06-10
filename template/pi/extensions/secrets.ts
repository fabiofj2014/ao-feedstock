// secrets.ts — secret hygiene for the agent loop.
//
//   tool_call(bash)   -> BLOCK commands that print or hardcode secrets
//   tool_result(bash) -> REDACT secret patterns from output before the model sees it
//
// Ported from block-secret-cmds.sh + redact-secrets.sh, in TS (no jq/perl dep).
//
// v0: confirm the mutable output field on `tool_result` against your installed
// @earendil-works/pi-coding-agent types (see REDACT_FIELDS below), then promote.

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { isToolCallEventType } from "@earendil-works/pi-coding-agent";

// --- redaction: secret material in command output ---------------------------
const REDACTIONS: Array<[RegExp, string]> = [
  [/\bsk-[A-Za-z0-9]{20,}/g, "sk-***REDACTED***"],
  [/\bghp_[A-Za-z0-9]{36,}/g, "ghp_***REDACTED***"],
  [/\bgithub_pat_[A-Za-z0-9_]{20,}/g, "github_pat_***REDACTED***"],
  [/\bgh[osru]_[A-Za-z0-9]{20,}/g, "***REDACTED***"],
  [/\bAKIA[0-9A-Z]{16}\b/g, "AKIA***REDACTED***"],
  [/\bxox[baprs]-[A-Za-z0-9-]{10,}/g, "xox-***REDACTED***"],
  [/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "***REDACTED-JWT***"],
  [/(\bbearer)\s+[A-Za-z0-9._-]+/gi, "$1 ***REDACTED***"],
  [
    /\b(token|secret|api[_-]?key|password|passwd|access[_-]?key)([\s:="']+)[A-Za-z0-9/+=._-]{12,}/gi,
    "$1$2***REDACTED***",
  ],
];

export function redact(text: string): string {
  let out = text;
  for (const [pattern, replacement] of REDACTIONS) out = out.replace(pattern, replacement);
  return out;
}

// --- blocking: commands that expose secrets ---------------------------------
const PRINTS_SECRET = [
  /\b(env|printenv)\b(?!.*\|)/, // bare env / printenv dumps
  /\becho\s+["']?\$[A-Z_]*(TOKEN|SECRET|KEY|PASS|PASSWORD)/i,
  /\bcat\b[^|]*\.env\b/,
];
const HARDCODED_SECRET = [
  /\bsk-[A-Za-z0-9]{20,}/,
  /\bghp_[A-Za-z0-9]{36,}/,
  /\bgithub_pat_[A-Za-z0-9_]{20,}/,
  /[A-Za-z0-9_.-]+:[^@\s/]{6,}@/, // user:pass@host
  /(--password|-p)[=\s]\S{6,}/,
];

function blockReason(command: string): string | null {
  if (PRINTS_SECRET.some((r) => r.test(command)))
    return "Command would print a secret. Use a reference (env/stdin/file), not the raw value.";
  if (HARDCODED_SECRET.some((r) => r.test(command)))
    return "Command hardcodes a secret in argv. Pass it via env var or a file reference.";
  return null;
}

// Fields on a tool_result that may carry textual output. Adjust to your types.
const REDACT_FIELDS = ["output", "result", "content", "stdout"];

export default function (pi: ExtensionAPI) {
  pi.on("tool_call", (event) => {
    if (!isToolCallEventType("bash", event)) return;
    const reason = blockReason(event.input.command || "");
    if (reason) return { block: true, reason };
  });

  pi.on("tool_result", (event) => {
    const toolName = (event as { toolName?: string }).toolName;
    if (toolName !== "bash") return;
    const e = event as Record<string, unknown>;
    for (const field of REDACT_FIELDS) {
      if (typeof e[field] === "string") e[field] = redact(e[field] as string);
    }
  });
}
