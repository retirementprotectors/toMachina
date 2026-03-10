#!/bin/bash
# Symlink root .env.local to all Next.js app directories
# Runs automatically via postinstall hook

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
ROOT_ENV="$ROOT_DIR/.env.local"

if [ ! -f "$ROOT_ENV" ]; then
  echo "No root .env.local found — skipping env linking"
  exit 0
fi

for app in apps/prodash apps/riimo apps/sentinel; do
  TARGET="$ROOT_DIR/$app/.env.local"
  # Remove existing file or symlink
  if [ -L "$TARGET" ] || [ -f "$TARGET" ]; then
    rm "$TARGET"
  fi
  ln -sf "../../.env.local" "$TARGET"
  echo "Linked $app/.env.local → root .env.local"
done
