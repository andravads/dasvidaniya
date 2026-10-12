#!/usr/bin/env bash
set -euo pipefail
cd /workspace/dasvidaniya
export npm_config_cache=/workspace/.npm-cache
export DENO_DIR=/workspace/.deno-cache
export DOTSLASH_CACHE=/workspace/.dotslash-cache
export EXPO_NO_TELEMETRY=1
export EXPO_OFFLINE=1
npm ci
npm run typecheck
npm test
npm run check:server
npm run build:web
