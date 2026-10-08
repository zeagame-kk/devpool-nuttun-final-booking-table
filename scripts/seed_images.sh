#!/usr/bin/env bash
# Puts the sample restaurant pictures (api/seed/images/<id>-seed.jpg) into the API's upload volume, so the
# restaurants created by api/seed/seed.sql show their photos. Safe to run again (it overwrites the same files).
#
#   ./scripts/seed_images.sh          (the compose stack must be running: docker compose up -d)
#
# The API image has no shell, so the files are copied by a throw-away alpine container that mounts the same
# volume. They are given to user 65532, the non-root user the API runs as, so the API can also replace or
# delete them later (an owner changing a restaurant's picture).
set -euo pipefail
cd "$(dirname "$0")/.."

API_CONTAINER="${API_CONTAINER:-bookingtable-all-in-one-api}"
VOLUME="$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/app/uploads"}}{{.Name}}{{end}}{{end}}' "$API_CONTAINER" 2>/dev/null)" || {
  echo "Container $API_CONTAINER not found. Start the stack first: docker compose up -d" >&2
  exit 1
}
[ -n "$VOLUME" ] || { echo "$API_CONTAINER has no volume on /app/uploads" >&2; exit 1; }

docker run --rm -v "$VOLUME":/uploads -v "$PWD/api/seed/images":/src:ro alpine:3 sh -c '
  mkdir -p /uploads/restaurants &&
  cp /src/*-seed.jpg /uploads/restaurants/ &&
  chown -R 65532:65532 /uploads/restaurants &&
  chmod 644 /uploads/restaurants/*-seed.jpg &&
  ls /src/*-seed.jpg | wc -l | sed "s/ *\$//; s/\$/ pictures copied/"'
