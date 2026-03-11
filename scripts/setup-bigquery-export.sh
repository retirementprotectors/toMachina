#!/bin/bash
# =============================================================================
# BigQuery Feed-Forward: Enable Firestore -> BigQuery Export
# =============================================================================
#
# This uses the Firebase Extensions CLI to install the Firestore BigQuery
# Export extension. It streams all Firestore document changes to BigQuery
# in near-real-time, replacing the `com.rpi.analytics-push` cron.
#
# Target dataset: claude-mcp-484718.toMachina
#
# Prerequisites:
#   - gcloud CLI authenticated
#   - firebase CLI installed (npm install -g firebase-tools)
#   - Project: claude-mcp-484718
#
# Usage: bash scripts/setup-bigquery-export.sh
# =============================================================================

set -e

PROJECT_ID="claude-mcp-484718"
DATASET_ID="toMachina"
LOCATION="us-central1"

echo "=== BigQuery Feed-Forward Setup ==="
echo "   Project: ${PROJECT_ID}"
echo "   Dataset: ${DATASET_ID}"
echo "   Location: ${LOCATION}"
echo ""

# Step 1: Create BigQuery dataset if it doesn't exist
echo "Step 1: Creating BigQuery dataset..."
bq --project_id="${PROJECT_ID}" mk \
  --dataset \
  --location="US" \
  --description="toMachina Firestore feed-forward — real-time document changes" \
  "${PROJECT_ID}:${DATASET_ID}" 2>/dev/null || echo "   Dataset already exists"

echo "   Dataset ${DATASET_ID} ready"

# Step 2: Enable required APIs
echo ""
echo "Step 2: Enabling required APIs..."
gcloud services enable \
  bigquery.googleapis.com \
  firestore.googleapis.com \
  firebaseextensions.googleapis.com \
  --project="${PROJECT_ID}" 2>/dev/null

echo "   APIs enabled"

# Step 3: Install Firestore BigQuery Export extension
echo ""
echo "Step 3: Installing Firestore BigQuery Export extension..."
echo ""
echo "   Run this command manually (requires interactive confirmation):"
echo ""
echo "   firebase ext:install firebase/firestore-bigquery-export \\"
echo "     --project=${PROJECT_ID} \\"
echo "     --params=BIGQUERY_PROJECT_ID=${PROJECT_ID},DATASET_ID=${DATASET_ID},TABLE_ID=firestore_changes,COLLECTION_PATH={document=**},DATASET_LOCATION=us"
echo ""
echo "   OR use the Firebase Console:"
echo "   https://console.firebase.google.com/project/${PROJECT_ID}/extensions"
echo "   -> Install 'Stream Firestore to BigQuery'"
echo ""
echo "   Configuration:"
echo "   - Collection path: {document=**}  (all collections)"
echo "   - Dataset: ${DATASET_ID}"
echo "   - Table: firestore_changes"
echo "   - Location: us"
echo ""

# Step 4: Verify dataset exists
echo "Step 4: Verifying dataset..."
bq --project_id="${PROJECT_ID}" show "${PROJECT_ID}:${DATASET_ID}" 2>/dev/null && echo "   Dataset verified" || echo "   WARNING: Dataset not found"

echo ""
echo "=== Setup Complete ==="
echo ""
echo "After extension install, Firestore changes will stream to:"
echo "   ${PROJECT_ID}.${DATASET_ID}.firestore_changes"
echo ""
echo "Query example:"
echo "   SELECT document_name, operation, timestamp"
echo "   FROM \`${PROJECT_ID}.${DATASET_ID}.firestore_changes\`"
echo "   ORDER BY timestamp DESC"
echo "   LIMIT 100"
