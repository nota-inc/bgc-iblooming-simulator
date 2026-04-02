#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT_DIR"

bash ./scripts/db-up.sh
pnpm db:generate
pnpm db:push
pnpm seed:users
pnpm seed:model

echo
echo "Local development setup is ready."
echo "Next step: pnpm dev"
