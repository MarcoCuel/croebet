#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
tools_dir="$HOME/.local/share/croebet-preview/tools"
npm install --prefix "$tools_dir" --no-audit --no-fund "$(node -p 'require("./package.json").packageManager')"
export PATH="$tools_dir/node_modules/.bin:$PATH"
pnpm install --frozen-lockfile
pnpm --filter @croebet/shared build
pnpm --filter @croebet/api build
