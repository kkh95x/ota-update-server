#!/bin/sh
# Creates MinIO buckets on first stack start (idempotent).
set -eu

MINIO_HOST="${MINIO_HOST:-minio:9000}"
MINIO_ROOT_USER="${MINIO_ROOT_USER:-minioadmin}"
MINIO_ROOT_PASSWORD="${MINIO_ROOT_PASSWORD:?set MINIO_ROOT_PASSWORD}"

echo "Waiting for MinIO at ${MINIO_HOST}..."
until mc alias set local "http://${MINIO_HOST}" "${MINIO_ROOT_USER}" "${MINIO_ROOT_PASSWORD}" 2>/dev/null; do
  sleep 2
done

for bucket in ota-quarantine ota-published; do
  if mc ls "local/${bucket}" >/dev/null 2>&1; then
    echo "Bucket ${bucket} already exists"
  else
    echo "Creating bucket ${bucket}"
    mc mb "local/${bucket}"
  fi
done

# Published bucket: public read for OTA objects served via nginx (bucket policy).
# Quarantine stays private (default — no public policy).
mc anonymous set download "local/ota-published"

echo "MinIO buckets ready."
