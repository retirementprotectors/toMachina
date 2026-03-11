#!/bin/bash
# Deploy BigQuery Streaming Cloud Functions
# Run from services/bigquery-stream/

set -e

PROJECT_ID="${GCP_PROJECT_ID:-claude-mcp-484718}"
REGION="us-central1"

echo "=== Building ==="
npm run build

echo "=== Creating BigQuery table (if not exists) ==="
bq mk --table \
  --project_id="$PROJECT_ID" \
  --schema='collection:STRING,document_id:STRING,operation:STRING,timestamp:TIMESTAMP,data_json:STRING,changed_fields:STRING' \
  --time_partitioning_field=timestamp \
  --time_partitioning_type=DAY \
  "${PROJECT_ID}:toMachina.firestore_changes" 2>/dev/null || echo "Table already exists"

echo "=== Deploying streamToBI ==="
gcloud functions deploy streamToBI \
  --project="$PROJECT_ID" \
  --region="$REGION" \
  --runtime=nodejs20 \
  --gen2 \
  --trigger-event-filters="type=google.cloud.firestore.document.v1.written" \
  --trigger-event-filters="database=(default)" \
  --trigger-event-filters-path-pattern="document={collectionId}/{documentId}" \
  --source=. \
  --entry-point=streamToBI \
  --memory=256Mi \
  --timeout=60s \
  --max-instances=50

echo "=== Deploying streamSubcollectionToBI ==="
gcloud functions deploy streamSubcollectionToBI \
  --project="$PROJECT_ID" \
  --region="$REGION" \
  --runtime=nodejs20 \
  --gen2 \
  --trigger-event-filters="type=google.cloud.firestore.document.v1.written" \
  --trigger-event-filters="database=(default)" \
  --trigger-event-filters-path-pattern="document={collectionId}/{parentId}/{subcollectionId}/{documentId}" \
  --source=. \
  --entry-point=streamSubcollectionToBI \
  --memory=256Mi \
  --timeout=60s \
  --max-instances=50

echo "=== Done ==="
echo "Functions deployed to $PROJECT_ID in $REGION"
echo "BigQuery table: ${PROJECT_ID}.toMachina.firestore_changes"
