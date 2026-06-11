#!/usr/bin/env bash
# full-gate.sh — mandatory suite when the agent tries to finish. Exit non-zero
# on failure. Runs only tools that exist. Project override: define "gate:full"
# in package.json (pi-gate adds a default that calls this script — replace its
# body with your own pipeline if you want full control).
set -uo pipefail

ROOT="${PROJECT_DIR:-$PWD}"
cd "$ROOT" 2>/dev/null || exit 0

FAILED=0
ok()   { printf '  \033[32m✓\033[0m %s\n' "$1" >&2; }
fail() { printf '  \033[31m✗\033[0m %s\n' "$1" >&2; FAILED=1; }
run()  {
  local label="$1"; shift
  if "$@" >/tmp/pi-fullgate.out 2>&1; then ok "$label"
  else fail "$label"; tail -n 40 /tmp/pi-fullgate.out | sed 's/^/      /' >&2; fi
}
# Resolve a Python tool: project venv first, then PATH. Empty if absent.
pybin() {
  if [ -x ".venv/bin/$1" ]; then printf '%s' ".venv/bin/$1"
  else command -v "$1" 2>/dev/null || true; fi
}

printf '\n▶ full-gate — suíte obrigatória\n' >&2

# [Secret scan] gitleaks when installed — local first line; CI is the wall
if command -v gitleaks >/dev/null 2>&1 && [ -d .git ]; then
  run "gitleaks" gitleaks detect -q --no-banner
fi

# [Python] detected via pyproject.toml (runs alongside other stacks)
if [ -f pyproject.toml ]; then
  RUFF="$(pybin ruff)";  MYPY="$(pybin mypy)";  PYTEST="$(pybin pytest)"
  [ -n "$RUFF" ] && run "ruff" "$RUFF" check .
  HAS_PY="$(find . -path ./.venv -prune -o -name '*.py' -print -quit 2>/dev/null)"
  [ -n "$MYPY" ] && [ -n "$HAS_PY" ] && run "mypy" "$MYPY" .
  # bandit (SAST) — runs when installed; honors [tool.bandit] when present
  BANDIT="$(pybin bandit)"
  if [ -n "$BANDIT" ] && [ -n "$HAS_PY" ]; then
    if grep -q '\[tool\.bandit\]' pyproject.toml 2>/dev/null; then
      run "bandit" "$BANDIT" -q -r . -c pyproject.toml -x ./tests,./.venv
    else
      run "bandit" "$BANDIT" -q -r . -x ./tests,./.venv
    fi
  fi
  if [ -n "$PYTEST" ]; then
    # coverage floor when pytest-cov is installed (GATE_COV_MIN, default 65)
    COV_ARGS=""
    if [ -x .venv/bin/python ] && .venv/bin/python -c 'import pytest_cov' 2>/dev/null; then
      COV_ARGS="--cov --cov-fail-under=${GATE_COV_MIN:-65}"
    fi
    # exit 5 = no tests collected — not a failure for a fresh project
    "$PYTEST" -q $COV_ARGS >/tmp/pi-fullgate.out 2>&1; rc=$?
    if [ "$rc" -eq 0 ] || [ "$rc" -eq 5 ]; then ok "pytest${COV_ARGS:+ +cov>=${GATE_COV_MIN:-65}%}"
    else fail "pytest"; tail -n 40 /tmp/pi-fullgate.out | sed 's/^/      /' >&2; fi
  fi
fi

if [ -f package.json ]; then
  [ -x node_modules/.bin/tsc ] && [ -f tsconfig.json ] && run "typecheck" node_modules/.bin/tsc --noEmit
  npm run 2>/dev/null | grep -qE '(^|[[:space:]])lint([[:space:]]|$)'  && run "lint"  npm run --silent lint
  npm run 2>/dev/null | grep -qE '(^|[[:space:]])test([[:space:]]|$)'  && run "test"  npm run --silent test
  npm run 2>/dev/null | grep -q 'coverage:check'                       && run "coverage" npm run --silent coverage:check
# [PHP] Laravel default
elif [ -f composer.json ]; then
  [ -x vendor/bin/pint ]    && run "pint"  vendor/bin/pint --test
  [ -x vendor/bin/phpstan ] && run "phpstan" vendor/bin/phpstan analyse
  [ -x vendor/bin/pest ]    && run "pest"  vendor/bin/pest
fi

exit "$FAILED"
