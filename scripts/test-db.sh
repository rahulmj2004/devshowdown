#!/usr/bin/env bash
# Applies the Supabase migrations to a throwaway local Postgres cluster and
# runs supabase/tests/*.test.sql against it. Nothing touches a real database.
# Requires initdb/pg_ctl/psql on PATH (e.g. `brew install postgresql@16`).
set -euo pipefail

cd "$(dirname "$0")/.."
for tool in initdb pg_ctl psql; do
  command -v "$tool" >/dev/null || { echo "$tool not found on PATH" >&2; exit 1; }
done

WORK="$(mktemp -d)"
PORT="${PGTEST_PORT:-54329}"
cleanup() {
  pg_ctl -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

initdb -D "$WORK/data" -U postgres --auth=trust >/dev/null
pg_ctl -D "$WORK/data" -o "-p $PORT -k $WORK -c listen_addresses=''" -l "$WORK/log" -w start >/dev/null

run() { psql -h "$WORK" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q "$@"; }

quiet() { PGOPTIONS="-c client_min_messages=warning" run "$@"; }

quiet -f supabase/tests/supabase_stubs.sql
for migration in supabase/migrations/*.sql; do
  echo "applying $migration"
  quiet -f "$migration"
  # Each migration must also be safe to run a second time.
  quiet -f "$migration"
done
echo "every migration applied twice without error"

for test in supabase/tests/*.test.sql; do
  echo "running $test"
  run -f "$test" 2>&1 | sed -e 's/^psql:[^ ]* NOTICE:  //'
done
