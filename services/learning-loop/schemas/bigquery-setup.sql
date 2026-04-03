-- BigQuery Dataset + Table Setup for Session Intelligence
-- Sprint 003 Learning Loop 2.0 — TRK-14169
-- Dataset: rpi_session_intelligence (project: claude-mcp-484718, region: us-central1)
--
-- Usage: bq query --use_legacy_sql=false < bigquery-setup.sql
-- Or run each statement individually.

-- Create dataset
-- bq mk --dataset --location=us-central1 claude-mcp-484718:rpi_session_intelligence

-- Table 1: sessions — one row per Claude Code session
CREATE TABLE IF NOT EXISTS `claude-mcp-484718.rpi_session_intelligence.sessions` (
  session_id STRING NOT NULL,
  machine STRING NOT NULL,
  project_hash STRING,
  project_name STRING,
  timestamp_start TIMESTAMP,
  timestamp_end TIMESTAMP,
  duration_seconds INT64,
  message_count INT64,
  user_message_count INT64,
  assistant_message_count INT64,
  tool_call_count INT64,
  is_subagent BOOL DEFAULT FALSE,
  loaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY DATE(timestamp_start)
CLUSTER BY machine, project_name
OPTIONS (
  description = 'Claude Code session metadata — one row per session',
  partition_expiration_days = 365
);

-- Table 2: messages — individual messages within sessions
CREATE TABLE IF NOT EXISTS `claude-mcp-484718.rpi_session_intelligence.messages` (
  message_uuid STRING NOT NULL,
  session_id STRING NOT NULL,
  parent_uuid STRING,
  role STRING NOT NULL,
  content_text STRING,
  content_type STRING,
  tool_calls_count INT64,
  timestamp TIMESTAMP,
  machine STRING,
  loaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY DATE(timestamp)
CLUSTER BY session_id, role
OPTIONS (
  description = 'Individual messages within Claude Code sessions',
  partition_expiration_days = 90
);

-- Table 3: tool_calls — tool invocations within messages
CREATE TABLE IF NOT EXISTS `claude-mcp-484718.rpi_session_intelligence.tool_calls` (
  tool_call_id STRING NOT NULL,
  session_id STRING NOT NULL,
  message_uuid STRING NOT NULL,
  tool_name STRING NOT NULL,
  tool_input_json JSON,
  tool_result_text STRING,
  tool_result_error BOOL DEFAULT FALSE,
  timestamp TIMESTAMP,
  machine STRING,
  loaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY DATE(timestamp)
CLUSTER BY session_id, tool_name
OPTIONS (
  description = 'Tool calls made during Claude Code sessions',
  partition_expiration_days = 90
);

-- Table 4: subagent_sessions — sub-agent invocations
CREATE TABLE IF NOT EXISTS `claude-mcp-484718.rpi_session_intelligence.subagent_sessions` (
  agent_session_id STRING NOT NULL,
  parent_session_id STRING NOT NULL,
  agent_type STRING,
  model STRING,
  duration_seconds INT64,
  message_count INT64,
  tool_call_count INT64,
  timestamp_start TIMESTAMP,
  timestamp_end TIMESTAMP,
  machine STRING,
  loaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY DATE(timestamp_start)
CLUSTER BY parent_session_id, model
OPTIONS (
  description = 'Sub-agent sessions spawned during parent sessions',
  partition_expiration_days = 365
);

-- Grant SA access (run separately):
-- bq add-iam-policy-binding --member=serviceAccount:mdj-agent@claude-mcp-484718.iam.gserviceaccount.com --role=roles/bigquery.dataEditor claude-mcp-484718:rpi_session_intelligence
