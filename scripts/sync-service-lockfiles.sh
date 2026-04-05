#!/bin/bash
# sync-service-lockfiles.sh
# Regenerates package-lock.json for services with standalone Dockerfiles.
# Runs as postinstall hook — ensures lockfiles stay in sync after npm install.
#
# Why: Dependabot bumps deps in root package.json but services with their own
# Dockerfiles (webhooks, bigquery-stream) have standalone lockfiles that npm ci
# reads during Docker build. If they're out of sync, Docker build fails.

SERVICES_WITH_LOCKFILES=(
  "services/webhooks"
  "services/bigquery-stream"
)

for svc in "${SERVICES_WITH_LOCKFILES[@]}"; do
  if [ -f "$svc/package.json" ] && [ -f "$svc/Dockerfile" ]; then
    # Generate lockfile in a temp dir to avoid workspace interference
    tmpdir=$(mktemp -d)
    cp "$svc/package.json" "$tmpdir/"
    (cd "$tmpdir" && npm install --package-lock-only --ignore-scripts 2>/dev/null)
    if [ -f "$tmpdir/package-lock.json" ]; then
      cp "$tmpdir/package-lock.json" "$svc/package-lock.json"
    fi
    rm -rf "$tmpdir"
  fi
done
