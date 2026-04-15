#!/bin/bash
# Deploy intake Cloud Functions to GCP
# Project: claude-mcp-484718

set -e

echo "Building intake functions..."
npm run build

echo "Deploying to GCP..."
gcloud functions deploy spc-intake \
  --gen2 \
  --runtime=nodejs20 \
  --region=us-central1 \
  --source=. \
  --entry-point=spcIntake \
  --trigger-resource=projects/_/buckets/intake-trigger \
  --trigger-event=google.storage.object.finalize \
  --project=claude-mcp-484718

gcloud functions deploy meet-intake \
  --gen2 \
  --runtime=nodejs20 \
  --region=us-central1 \
  --source=. \
  --entry-point=meetIntake \
  --trigger-http \
  --allow-unauthenticated=false \
  --project=claude-mcp-484718

gcloud functions deploy mail-intake \
  --gen2 \
  --runtime=nodejs20 \
  --region=us-central1 \
  --source=. \
  --entry-point=mailIntake \
  --trigger-http \
  --allow-unauthenticated=false \
  --project=claude-mcp-484718

gcloud functions deploy email-intake \
  --gen2 \
  --runtime=nodejs20 \
  --region=us-central1 \
  --source=. \
  --entry-point=emailIntake \
  --trigger-http \
  --allow-unauthenticated=false \
  --project=claude-mcp-484718

# ─────────────────────────────────────────────────────────────────────────────
# Firestore-triggered functions (were live-but-not-in-deploy-sh until now —
# ZRD-INTAKE-WIRE-TRIGGER-PROD-BROKEN landed the first of these; we're
# closing the rest of the gap while we're here).
# ─────────────────────────────────────────────────────────────────────────────

# Wire dispatcher — fires on intake_queue creation, routes to /api/atlas wires.
# THIS is the P0 fix. Was never in deploy.sh, so any earlier operator deploy
# has been frozen on stale source since 2026-03-20.
gcloud functions deploy onIntakeQueueCreated \
  --gen2 \
  --runtime=nodejs20 \
  --region=us-central1 \
  --source=. \
  --entry-point=onIntakeQueueCreated \
  --trigger-event-filters="type=google.cloud.firestore.document.v1.created" \
  --trigger-event-filters="database=(default)" \
  --trigger-event-filters-path-pattern="document=intake_queue/{queueId}" \
  --trigger-location=nam5 \
  --memory=256MiB \
  --timeout=180s \
  --project=claude-mcp-484718

# Notification triggers — fire on client + account writes to create notification docs.
gcloud functions deploy onClientWrite \
  --gen2 \
  --runtime=nodejs20 \
  --region=us-central1 \
  --source=. \
  --entry-point=onClientWrite \
  --trigger-event-filters="type=google.cloud.firestore.document.v1.written" \
  --trigger-event-filters="database=(default)" \
  --trigger-event-filters-path-pattern="document=clients/{clientId}" \
  --trigger-location=nam5 \
  --memory=256MiB \
  --timeout=60s \
  --project=claude-mcp-484718

gcloud functions deploy onAccountWrite \
  --gen2 \
  --runtime=nodejs20 \
  --region=us-central1 \
  --source=. \
  --entry-point=onAccountWrite \
  --trigger-event-filters="type=google.cloud.firestore.document.v1.written" \
  --trigger-event-filters="database=(default)" \
  --trigger-event-filters-path-pattern="document=clients/{clientId}/accounts/{accountId}" \
  --trigger-location=nam5 \
  --memory=256MiB \
  --timeout=60s \
  --project=claude-mcp-484718

# Firebase Auth blocking trigger — onPartnerUserCreate.
# NOTE: beforeUserCreated blocking functions are deployed via `firebase deploy
# --only functions:onPartnerUserCreate` (Firebase CLI), not gcloud. They use a
# different trigger mechanism (Identity Platform blocking) that gcloud's
# `functions deploy` subcommand doesn't surface cleanly.
# Tracked as follow-up: ZRD-INTAKE-AUTH-BLOCKING-DEPLOY-WIRE.

echo "Deploying Cloud Scheduler jobs..."
gcloud scheduler jobs create http intake-spc-scan \
  --schedule="*/5 * * * *" \
  --uri="https://us-central1-claude-mcp-484718.cloudfunctions.net/spc-intake" \
  --http-method=POST \
  --oidc-service-account-email=claude-mcp-484718@appspot.gserviceaccount.com \
  --location=us-central1 \
  --project=claude-mcp-484718 2>/dev/null || echo "SPC scheduler already exists"

gcloud scheduler jobs create http intake-meet-scan \
  --schedule="*/5 * * * *" \
  --uri="https://us-central1-claude-mcp-484718.cloudfunctions.net/meet-intake" \
  --http-method=POST \
  --oidc-service-account-email=claude-mcp-484718@appspot.gserviceaccount.com \
  --location=us-central1 \
  --project=claude-mcp-484718 2>/dev/null || echo "Meet scheduler already exists"

gcloud scheduler jobs create http intake-mail-scan \
  --schedule="*/5 * * * *" \
  --uri="https://us-central1-claude-mcp-484718.cloudfunctions.net/mail-intake" \
  --http-method=POST \
  --oidc-service-account-email=claude-mcp-484718@appspot.gserviceaccount.com \
  --location=us-central1 \
  --project=claude-mcp-484718 2>/dev/null || echo "Mail scheduler already exists"

gcloud scheduler jobs create http intake-email-scan \
  --schedule="*/5 * * * *" \
  --uri="https://us-central1-claude-mcp-484718.cloudfunctions.net/email-intake" \
  --http-method=POST \
  --oidc-service-account-email=claude-mcp-484718@appspot.gserviceaccount.com \
  --location=us-central1 \
  --project=claude-mcp-484718 2>/dev/null || echo "Email scheduler already exists"

echo "Deploy complete!"
