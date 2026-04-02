#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTAINER_NAME="${BGC_DB_CONTAINER_NAME:-bgc-alpha-postgres}"
DB_NAME="${BGC_DB_NAME:-bgc_alpha_simulator}"
DB_USER="${BGC_DB_USER:-postgres}"

cd "$ROOT_DIR"

if pnpm --filter @bgc-alpha/db prisma:push; then
  exit 0
fi

echo "Prisma db push failed. Falling back to SQL diff application via Docker."

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker CLI is required for the schema-apply fallback."
  exit 1
fi

if ! docker container inspect "$CONTAINER_NAME" >/dev/null 2>&1; then
  echo "Container ${CONTAINER_NAME} does not exist. Run pnpm db:up first."
  exit 1
fi

TMP_SQL="$(mktemp /tmp/bgc-alpha-schema.XXXXXX.sql)"
trap 'rm -f "$TMP_SQL"' EXIT

pnpm --filter @bgc-alpha/db exec prisma migrate diff \
  --from-empty \
  --to-schema-datamodel ./prisma/schema.prisma \
  --script > "$TMP_SQL"

docker cp "$TMP_SQL" "${CONTAINER_NAME}:/tmp/bgc-alpha-schema.sql"
docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -f /tmp/bgc-alpha-schema.sql
docker exec "$CONTAINER_NAME" rm -f /tmp/bgc-alpha-schema.sql

echo "Schema applied through SQL diff fallback."
