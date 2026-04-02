#!/usr/bin/env bash
set -euo pipefail

CONTAINER_NAME="${BGC_DB_CONTAINER_NAME:-bgc-alpha-postgres}"
IMAGE_NAME="${BGC_DB_IMAGE:-postgres:16-alpine}"
DB_NAME="${BGC_DB_NAME:-bgc_alpha_simulator}"
DB_USER="${BGC_DB_USER:-postgres}"
DB_PASSWORD="${BGC_DB_PASSWORD:-postgres}"
DB_PORT="${BGC_DB_PORT:-5433}"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker CLI is required but was not found in PATH."
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "Docker daemon is not running. Start Docker Desktop or another Docker daemon, then retry."
  exit 1
fi

if docker container inspect "$CONTAINER_NAME" >/dev/null 2>&1; then
  HOST_PORT="$(docker inspect -f '{{with (index .NetworkSettings.Ports "5432/tcp")}}{{(index . 0).HostPort}}{{end}}' "$CONTAINER_NAME")"

  if [ "$HOST_PORT" != "$DB_PORT" ]; then
    echo "Container ${CONTAINER_NAME} is mapped to port ${HOST_PORT}, but this workspace expects ${DB_PORT}."
    echo "Run pnpm db:down to recreate the container with the new port, then rerun pnpm dev:setup."
    exit 1
  fi

  RUNNING_STATE="$(docker inspect -f '{{.State.Running}}' "$CONTAINER_NAME")"
  if [ "$RUNNING_STATE" != "true" ]; then
    docker start "$CONTAINER_NAME" >/dev/null
  fi
else
  docker run -d \
    --name "$CONTAINER_NAME" \
    -e POSTGRES_DB="$DB_NAME" \
    -e POSTGRES_USER="$DB_USER" \
    -e POSTGRES_PASSWORD="$DB_PASSWORD" \
    -e POSTGRES_HOST_AUTH_METHOD="trust" \
    -p "${DB_PORT}:5432" \
    "$IMAGE_NAME" >/dev/null
fi

for _attempt in $(seq 1 30); do
  if docker exec "$CONTAINER_NAME" pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; then
    echo "Postgres is ready at postgresql://${DB_USER}:***@localhost:${DB_PORT}/${DB_NAME}"
    exit 0
  fi

  sleep 1
done

echo "Postgres container started, but readiness check timed out."
exit 1
