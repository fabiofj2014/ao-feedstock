#!/usr/bin/env bash
# fast-gates.sh — quick gates after a file edit. Exit non-zero on failure.
# Runs only tools that exist. Project override: define "gate:fast:project"
# in package.json and it takes over.
set -uo pipefail

ROOT="${PROJECT_DIR:-$PWD}"
cd "$ROOT" 2>/dev/null || exit 0

FAILED=0
ok()   { printf '  \033[32m✓\033[0m %s\n' "$1" >&2; }
fail() { printf '  \033[31m✗\033[0m %s\n' "$1" >&2; FAILED=1; }
run()  {
  local label="$1"; shift
  if "$@" >/tmp/pi-fastgate.out 2>&1; then ok "$label"
  else fail "$label"; tail -n 30 /tmp/pi-fastgate.out | sed 's/^/      /' >&2; fi
}
# Resolve a Python tool: project venv first, then PATH. Empty if absent.
pybin() {
  if [ -x ".venv/bin/$1" ]; then printf '%s' ".venv/bin/$1"
  else command -v "$1" 2>/dev/null || true; fi
}

printf '\n▶ fast-gate\n' >&2

# [Python] detected via pyproject.toml (runs alongside other stacks)
if [ -f pyproject.toml ]; then
  RUFF="$(pybin ruff)"
  [ -n "$RUFF" ] && run "ruff" "$RUFF" check .
fi

if [ -f package.json ]; then
  if npm run 2>/dev/null | grep -q 'gate:fast:project'; then
    run "project gate:fast" npm run --silent gate:fast:project
  else
    [ -x node_modules/.bin/tsc ] && [ -f tsconfig.json ] && run "typecheck" node_modules/.bin/tsc --noEmit
    npm run 2>/dev/null | grep -qE '(^|[[:space:]])lint([[:space:]]|$)' && run "lint" npm run --silent lint
  fi
# [PHP] Laravel default
elif [ -f composer.json ]; then
  [ -x vendor/bin/pint ] && run "pint" vendor/bin/pint --test
fi

exit "$FAILED"
