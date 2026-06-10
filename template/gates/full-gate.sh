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

printf '\n▶ full-gate — suíte obrigatória\n' >&2

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
