#!/usr/bin/env bash
set -euo pipefail

CONTAINER_NAME="${BGC_DB_CONTAINER_NAME:-bgc-alpha-postgres}"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker CLI is required but was not found in PATH."
  exit 1
fi

if ! docker container inspect "$CONTAINER_NAME" >/dev/null 2>&1; then
  echo "Container ${CONTAINER_NAME} does not exist."
  exit 0
fi

RUNNING_STATE="$(docker inspect -f '{{.State.Running}}' "$CONTAINER_NAME")"

if [ "$RUNNING_STATE" = "true" ]; then
  docker stop "$CONTAINER_NAME" >/dev/null
  echo "Stopped ${CONTAINER_NAME}."
else
  echo "${CONTAINER_NAME} is already stopped."
fi

docker rm "$CONTAINER_NAME" >/dev/null
echo "Removed ${CONTAINER_NAME}."
