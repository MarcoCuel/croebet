#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
: "${CODESPACE_NAME:?Abra esta configuração no GitHub Codespaces}"
: "${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:?Domínio de prévia indisponível}"
umask 077
state_dir="$HOME/.local/state/croebet-preview"
mkdir -p "$state_dir"
export WEB_ORIGIN="https://${CODESPACE_NAME}-3000.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}"
export DEV_WEB_ORIGINS="$WEB_ORIGIN"
export APP_ENV=test DATABASE_URL='postgresql://croebet@localhost/croebet_preview_test?host=/var/run/postgresql'
export API_HOST=127.0.0.1 API_PORT=3001 API_INTERNAL_URL=http://127.0.0.1:3001
export AVATAR_STORAGE=local AVATAR_LOCAL_DIR="$state_dir/images" ENFORCE_HTTPS=false NEXT_TELEMETRY_DISABLED=1
unset DATABASE_MIGRATION_URL
if [[ ! -s "$state_dir/csrf" ]]; then
  node -e 'process.stdout.write(require("node:crypto").randomBytes(32).toString("hex"))' > "$state_dir/csrf"
fi
export CSRF_SECRET
CSRF_SECRET="$(cat "$state_dir/csrf")"

if [[ "${1:-}" == supervise ]]; then
  cd apps/api
  node dist/db/cli.js migrate
  node dist/db/cli.js seed
  node --input-type=module -e 'import pg from "pg"; import {readFileSync} from "node:fs";
    const client=new pg.Client({connectionString:process.env.DATABASE_URL});
    await client.connect();
    try { await client.query(readFileSync("../../.devcontainer/primeira-conta.sql","utf8")); }
    finally { await client.end(); }'
  node dist/main.js &
  api_pid=$!
  web_pid=""
  trap 'kill "$api_pid" ${web_pid:+"$web_pid"} 2>/dev/null || true' EXIT
  trap 'exit 0' TERM INT
  for ((n=0;n<60;n++)); do
    if curl --silent --fail "$API_INTERNAL_URL/api/v1/health/ready" >/dev/null; then break; fi
    kill -0 "$api_pid"
    sleep 1
  done
  curl --fail --silent "$API_INTERNAL_URL/api/v1/health/ready" >/dev/null
  cd ../web
  node node_modules/next/dist/bin/next dev --webpack --hostname 0.0.0.0 --port 3000 &
  web_pid=$!
  wait -n "$api_pid" "$web_pid"
  exit 1
fi

nohup flock --nonblock --conflict-exit-code 0 "$state_dir/process.lock" bash .devcontainer/start.sh supervise >>"$state_dir/site.log" 2>&1 </dev/null &
for ((n=0;n<180;n++)); do
  if curl --max-time 2 --fail --silent "http://127.0.0.1:3000/api/v1/health/ready" >/dev/null; then
    printf '\nAbra o catálogo: %s/jogos\n' "$WEB_ORIGIN"
    exit 0
  fi
  sleep 1
done
tail -30 "$state_dir/site.log" >&2
exit 1
