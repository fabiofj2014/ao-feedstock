#!/usr/bin/env node
"use strict";

// pi-gate — Trilho A scaffolder.
// `pi-gate init [dir] [--force]` copies the pi extensions + gate scripts + CI
// + ao-compatible evidence schema into a target project.

const fs = require("fs");
const path = require("path");

const TEMPLATE_ROOT = path.join(__dirname, "..", "template");

function parseArgs(argv) {
  const args = argv.slice(2);
  const command = args[0];
  const force = args.includes("--force");
  const positional = args.slice(1).filter((a) => !a.startsWith("--"));
  return { command, dir: positional[0], force };
}

function usage() {
  console.log(`pi-gate — Trilho A scaffolder

Usage:
  npx pi-gate init [dir]        Scaffold gates + pi extensions into a project
  npx pi-gate init [dir] --force  Overwrite files that already exist

What it writes into the target project:
  .pi/                     pi extensions (gates.ts, secrets.ts, evidence.ts), prompt, settings
  gates/                   fast-gates.sh, full-gate.sh
  .github/workflows/ci.yml hard backstop
  AGENTS.md                project rules for the agent
  evidence/SCHEMA.md       ao-compatible JSONL evidence contract
  package.json             adds gate:fast / gate:full scripts
`);
}

function copyFile(src, dest, force) {
  if (fs.existsSync(dest) && !force) {
    console.log(`  skip (exists)  ${path.relative(process.cwd(), dest)}`);
    return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  if (dest.endsWith(".sh")) fs.chmodSync(dest, 0o755);
  console.log(`  write          ${path.relative(process.cwd(), dest)}`);
}

function copyTree(srcDir, destDir, force) {
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const src = path.join(srcDir, entry.name);
    const dest = path.join(destDir, entry.name);
    if (entry.isDirectory()) copyTree(src, dest, force);
    else copyFile(src, dest, force);
  }
}

function patchPackageJson(target) {
  const pkgPath = path.join(target, "package.json");
  let pkg = {};
  if (fs.existsSync(pkgPath)) {
    try {
      pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    } catch (e) {
      console.log(`  warn: could not parse ${pkgPath}, leaving it untouched`);
      return;
    }
  } else if (fs.existsSync(path.join(target, "pyproject.toml"))) {
    // Pure Python project: gates are invoked directly by the pi extension
    // (bash gates/*.sh), so don't force a package.json into the repo.
    console.log(`  package.json   skipped (Python project — gates run via bash directly)`);
    return;
  } else {
    pkg = { name: path.basename(target), version: "0.0.0", private: true };
  }
  pkg.scripts = pkg.scripts || {};
  const added = [];
  if (!pkg.scripts["gate:fast"]) {
    pkg.scripts["gate:fast"] = "bash gates/fast-gates.sh";
    added.push("gate:fast");
  }
  if (!pkg.scripts["gate:full"]) {
    pkg.scripts["gate:full"] = "bash gates/full-gate.sh";
    added.push("gate:full");
  }
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  console.log(
    added.length
      ? `  package.json   added scripts: ${added.join(", ")}`
      : `  package.json   gate scripts already present`
  );
}

function ensureGitignore(target) {
  const giPath = path.join(target, ".gitignore");
  const line = "evidence/ledger.jsonl";
  let body = fs.existsSync(giPath) ? fs.readFileSync(giPath, "utf8") : "";
  if (!body.split(/\r?\n/).includes(line)) {
    body = body.replace(/\s*$/, "") + `\n# pi-gate runtime evidence\n${line}\n`;
    fs.writeFileSync(giPath, body);
    console.log(`  .gitignore     added ${line}`);
  }
}

function init({ dir, force }) {
  const target = path.resolve(dir || process.cwd());
  if (!fs.existsSync(TEMPLATE_ROOT)) {
    console.error(`pi-gate: template not found at ${TEMPLATE_ROOT}`);
    process.exit(1);
  }
  console.log(`pi-gate init → ${target}\n`);

  // pi/ -> .pi/
  copyTree(path.join(TEMPLATE_ROOT, "pi"), path.join(target, ".pi"), force);
  // gates/
  copyTree(path.join(TEMPLATE_ROOT, "gates"), path.join(target, "gates"), force);
  // ci/ci.yml -> .github/workflows/ci.yml
  copyFile(
    path.join(TEMPLATE_ROOT, "ci", "ci.yml"),
    path.join(target, ".github", "workflows", "ci.yml"),
    force
  );
  // AGENTS.md
  copyFile(path.join(TEMPLATE_ROOT, "AGENTS.md"), path.join(target, "AGENTS.md"), force);
  // evidence/SCHEMA.md + dir
  copyFile(
    path.join(TEMPLATE_ROOT, "evidence", "SCHEMA.md"),
    path.join(target, "evidence", "SCHEMA.md"),
    force
  );
  fs.mkdirSync(path.join(target, "evidence"), { recursive: true });

  patchPackageJson(target);
  ensureGitignore(target);

  console.log(`
Done. Next steps:
  1. cd ${dir || "."}
  2. install the agent:  npm i -g @earendil-works/pi-coding-agent
  3. run:                pi
  4. ask it:             "implement feature X"
  Gates run on edit (fast) and at turn end (full). Evidence lands in evidence/ledger.jsonl.
`);
}

function main() {
  const { command, dir, force } = parseArgs(process.argv);
  if (command === "init") return init({ dir, force });
  usage();
  if (command && command !== "help" && command !== "--help") process.exit(1);
}

main();
