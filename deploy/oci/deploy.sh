#!/usr/bin/env bash
# Forced command for the CI deploy key (see deploy/README.md). Reads a gzipped
# `docker save` of mirage-server:arm64 on stdin, deploys it, health-checks, rolls back on failure.
# It only ever touches the `mirage` compose project in /srv/mirage.
set -euo pipefail
cd /srv/mirage
exec 9>/srv/mirage/.deploy.lock
flock -n 9 || { echo "another deploy is running"; exit 1; }

rev="${SSH_ORIGINAL_COMMAND:-manual}"
rev="${rev//[^0-9a-f]/}"; rev="${rev:0:40}"
log() { echo "[deploy ${rev:0:7}] $*"; }

if docker image inspect mirage-server:arm64 >/dev/null 2>&1; then
  docker tag mirage-server:arm64 mirage-server:previous
fi
log "loading image"
gunzip | docker load
docker tag mirage-server:arm64 "mirage-server:${rev:-manual}" || true

log "recreating mirage (zkool untouched)"
docker compose up -d --no-deps mirage

healthy() {
  docker compose exec -T mirage node -e \
    "fetch('http://127.0.0.1:8787/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
}
for i in $(seq 1 30); do
  if healthy; then log "healthy"; exit 0; fi
  sleep 2
done

log "health check failed: rolling back"
if docker image inspect mirage-server:previous >/dev/null 2>&1; then
  docker tag mirage-server:previous mirage-server:arm64
  docker compose up -d --no-deps mirage
fi
exit 1
