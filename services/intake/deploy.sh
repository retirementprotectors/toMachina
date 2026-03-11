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
