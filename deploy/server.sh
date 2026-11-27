#!/usr/bin/env bash
# Runs ON the environment's server (as root, through AWS SSM).
#
#   server.sh deploy <release-id> <bundle-dir>    deploy a new release
#   server.sh rollback <release-id>               switch back to a kept release
#   server.sh store-results <run-id> <bundle-dir> keep CI test results
#   server.sh status                              show releases and containers
#
# Layout on the server (APP_DIR is the mounted EBS data volume):
#
#   $APP_DIR/releases/<release-id>/   docker-compose.yml + .env (image refs)
#   $APP_DIR/current -> releases/<release-id>
#   $APP_DIR/data/                    API data (orders.json)
#   $APP_DIR/test-results/<run-id>/   test.log, build-info.txt
#
# The Docker images of the last KEEP_RELEASES releases stay on the server, so
# a rollback doesn't need to download anything.
# Release and run ids are validated to [A-Za-z0-9._-], so listing them with
# `ls -t` (newest first) is safe.
# shellcheck disable=SC2012
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/devops-staging}"
PROJECT="${COMPOSE_PROJECT:-coffee-staging}"
KEEP_RELEASES="${KEEP_RELEASES:-5}"
KEEP_RESULTS="${KEEP_RESULTS:-50}"

RELEASES_DIR="$APP_DIR/releases"
RESULTS_DIR="$APP_DIR/test-results"
CURRENT_LINK="$APP_DIR/current"

log() { echo "[server.sh] $*"; }
die() {
  echo "[server.sh] ERROR: $*" >&2
  exit 1
}

valid_id() { [[ "$1" =~ ^[A-Za-z0-9._-]+$ ]] || die "invalid id: $1"; }

wait_for_server() {
  # On a fresh instance user_data may still be installing Docker.
  if command -v cloud-init >/dev/null; then
    cloud-init status --wait >/dev/null || true
  fi
  command -v docker >/dev/null || die "docker is not installed"
  mkdir -p "$RELEASES_DIR" "$RESULTS_DIR" "$APP_DIR/data"
  chown 1000:1000 "$APP_DIR/data"
}

compose() {
  local release_dir="$1"
  shift
  docker compose -p "$PROJECT" \
    --env-file "$release_dir/.env" \
    -f "$release_dir/docker-compose.yml" "$@"
}

env_value() { grep "^$2=" "$1" | cut -d= -f2- || true; }

ecr_login() {
  local env_file="$1" registry region
  registry=$(env_value "$env_file" REGISTRY)
  region=$(env_value "$env_file" AWS_REGION)
  region="${region:-${AWS_DEFAULT_REGION:-}}"
  [ -n "$registry" ] || die "REGISTRY missing in $env_file"
  [ -n "$region" ] || die "AWS_REGION missing in $env_file"
  aws ecr get-login-password --region "$region" |
    docker login --username AWS --password-stdin "$registry" >/dev/null
}

current_release() {
  if [ -L "$CURRENT_LINK" ]; then basename "$(readlink -f "$CURRENT_LINK")"; fi
}

remove_legacy_containers() {
  # Earlier deployments ran from /opt/devops-staging without a fixed project
  # name; their containers hold port 80 and the same container names.
  local ids
  ids=$(docker ps -aq --filter "label=com.docker.compose.project=devops-staging")
  if [ -n "$ids" ]; then
    log "removing containers from the old 'devops-staging' compose project"
    echo "$ids" | xargs docker rm -f >/dev/null
  fi
}

start_release() {
  local id="$1"
  local dir="$RELEASES_DIR/$id"
  ln -sfn "$dir" "$CURRENT_LINK"
  compose "$dir" up -d --remove-orphans --wait --wait-timeout 180
}

cleanup_old_releases() {
  local current old
  current=$(current_release)
  # Newest first; skip the ones we keep.
  mapfile -t old < <(ls -1t "$RELEASES_DIR" | tail -n +"$((KEEP_RELEASES + 1))")
  for id in "${old[@]}"; do
    [ "$id" = "$current" ] && continue
    log "removing old release $id"
    for image in $(env_value "$RELEASES_DIR/$id/.env" API_IMAGE) \
      $(env_value "$RELEASES_DIR/$id/.env" WEB_IMAGE); do
      docker image rm "$image" >/dev/null 2>&1 || true
    done
    rm -rf "${RELEASES_DIR:?}/$id"
  done
  docker image prune -f >/dev/null
}

cmd_deploy() {
  local id="$1" bundle="$2"
  valid_id "$id"
  wait_for_server

  local dir="$RELEASES_DIR/$id" previous
  previous=$(current_release)

  mkdir -p "$dir"
  cp "$bundle/docker-compose.yml" "$bundle/.env" "$dir/"
  date -u +%Y-%m-%dT%H:%M:%SZ >"$dir/deployed_at"

  # Keep a copy of this script on the server for manual rollbacks.
  install -m 0755 "$0" /usr/local/bin/coffee-server

  ecr_login "$dir/.env"
  log "pulling images for release $id"
  compose "$dir" pull

  remove_legacy_containers

  log "starting release $id"
  if ! start_release "$id"; then
    compose "$dir" ps || true
    compose "$dir" logs --tail 50 || true
    if [ -n "$previous" ] && [ "$previous" != "$id" ] && [ -d "$RELEASES_DIR/$previous" ]; then
      log "release $id is unhealthy; rolling back to $previous"
      start_release "$previous" || true
    fi
    die "release $id failed to become healthy"
  fi

  cleanup_old_releases
  log "release $id is live"
  cmd_status
}

cmd_rollback() {
  local id="$1"
  valid_id "$id"
  [ -d "$RELEASES_DIR/$id" ] || die "release $id is not on this server (see: status)"
  # Images are normally still local; log in anyway in case they were removed.
  ecr_login "$RELEASES_DIR/$id/.env" || log "ECR login failed; using local images"
  start_release "$id"
  log "rolled back to $id"
}

cmd_store_results() {
  local id="$1" bundle="$2"
  valid_id "$id"
  mkdir -p "$RESULTS_DIR/$id"
  cp -r "$bundle"/. "$RESULTS_DIR/$id/"
  rm -f "$RESULTS_DIR/$id/server.sh"
  log "test results stored in $RESULTS_DIR/$id"

  local old
  mapfile -t old < <(ls -1t "$RESULTS_DIR" | tail -n +"$((KEEP_RESULTS + 1))")
  for dir in "${old[@]}"; do rm -rf "${RESULTS_DIR:?}/$dir"; done
}

cmd_status() {
  echo "Current release: $(current_release)"
  echo "Kept releases (newest first):"
  ls -1t "$RELEASES_DIR" 2>/dev/null | sed 's/^/  /'
  if [ -L "$CURRENT_LINK" ]; then
    compose "$CURRENT_LINK" ps
  fi
}

case "${1:-}" in
  deploy) cmd_deploy "${2:?release id}" "${3:?bundle dir}" ;;
  rollback) cmd_rollback "${2:?release id}" ;;
  store-results) cmd_store_results "${2:?run id}" "${3:?bundle dir}" ;;
  status) cmd_status ;;
  *)
    sed -n '2,8p' "$0"
    exit 1
    ;;
esac
