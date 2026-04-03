#!/bin/bash
# cleanup.sh — Session Extract Before Delete
# Sprint 003 Learning Loop 2.0 — TRK-14165
#
# Deploy to: ~/.claude/scripts/cleanup.sh on AIR, PRO, MDJ1
# Requires: MACHINE_NAME env var (air|pro|mdj1), gcloud CLI authenticated
#
set -euo pipefail

MACHINE_NAME="${MACHINE_NAME:-$(hostname -s)}"
CLAUDE_DIR="${CLAUDE_DIR:-$HOME/.claude}"
GCS_BUCKET="gs://rpi-session-intelligence"

echo "[cleanup] Machine: ${MACHINE_NAME}"
echo "[cleanup] Claude dir: ${CLAUDE_DIR}"

# Step 1: Sync sessions to GCS BEFORE any deletion
echo "[cleanup] Syncing sessions to GCS before cleanup..."
if ! gcloud storage rsync "${CLAUDE_DIR}/projects/" \
  "${GCS_BUCKET}/${MACHINE_NAME}/" \
  --recursive --quiet 2>&1; then
  echo "[cleanup] ERROR: GCS sync failed. Aborting cleanup to preserve data."
  exit 1
fi

echo "[cleanup] GCS sync complete. Proceeding with cleanup..."

# Step 2: Clean up old session files (older than 7 days)
find "${CLAUDE_DIR}/projects" -name "*.jsonl" -mtime +7 -print0 | xargs -0 rm -f 2>/dev/null || true

# Step 3: Clean up old task files
find "${CLAUDE_DIR}/projects" -name "*.tasks.json" -mtime +14 -print0 | xargs -0 rm -f 2>/dev/null || true

echo "[cleanup] Done. Sessions preserved in ${GCS_BUCKET}/${MACHINE_NAME}/"
