#!/usr/bin/env bash
set -euo pipefail

OWNER="${OWNER:-kkh95x}"
TAG="${TAG:-latest}"
PUSH=false
DASHBOARD_ONLY=false
WORKER_ONLY=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --push) PUSH=true ;;
    --dashboard-only) DASHBOARD_ONLY=true ;;
    --worker-only) WORKER_ONLY=true ;;
    --owner) OWNER="$2"; shift ;;
    --tag) TAG="$2"; shift ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
  shift
done

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

REGISTRY="ghcr.io"
DASHBOARD_IMAGE="${REGISTRY}/${OWNER}/ota-update-server-dashboard:${TAG}"
WORKER_IMAGE="${REGISTRY}/${OWNER}/ota-update-server-worker:${TAG}"

build_image() {
  echo "Building $2 ..."
  docker build -f "$1" -t "$2" .
}

if [[ "$WORKER_ONLY" != true ]]; then
  build_image infra/docker/Dockerfile.dashboard "$DASHBOARD_IMAGE"
fi

if [[ "$DASHBOARD_ONLY" != true ]]; then
  build_image infra/docker/Dockerfile.worker "$WORKER_IMAGE"
fi

if [[ "$PUSH" == true ]]; then
  echo "Logging in to ${REGISTRY} (GitHub PAT with write:packages) ..."
  docker login "$REGISTRY" -u "$OWNER"
  [[ "$WORKER_ONLY" != true ]] && docker push "$DASHBOARD_IMAGE"
  [[ "$DASHBOARD_ONLY" != true ]] && docker push "$WORKER_IMAGE"
  echo "Pushed:"
  [[ "$WORKER_ONLY" != true ]] && echo "  $DASHBOARD_IMAGE"
  [[ "$DASHBOARD_ONLY" != true ]] && echo "  $WORKER_IMAGE"
else
  echo "Built locally. Re-run with --push to upload to GHCR."
fi
