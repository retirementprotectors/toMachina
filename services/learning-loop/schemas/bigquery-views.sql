-- BigQuery Analytics Views for Session Intelligence
-- Sprint 003 Learning Loop 2.0 — TRK-14178
-- Requires: tables from bigquery-setup.sql + data from backfill (TRK-14171)
--
-- Usage: bq query --use_legacy_sql=false < bigquery-views.sql

-- View 1: time_per_session — session duration and message counts
CREATE OR REPLACE VIEW `claude-mcp-484718.rpi_session_intelligence.time_per_session` AS
SELECT
  session_id,
  machine,
  project_name,
  timestamp_start,
  timestamp_end,
  ROUND(duration_seconds / 3600.0, 2) AS duration_hours,
  message_count,
  user_message_count,
  assistant_message_count,
  tool_call_count,
  is_subagent
FROM `claude-mcp-484718.rpi_session_intelligence.sessions`
WHERE duration_seconds > 0;

-- View 2: agent_hours_total — aggregate hours by machine and model
CREATE OR REPLACE VIEW `claude-mcp-484718.rpi_session_intelligence.agent_hours_total` AS
SELECT
  s.machine,
  COALESCE(sub.model, 'primary') AS model,
  COUNT(*) AS session_count,
  ROUND(SUM(
    CASE
      WHEN sub.agent_session_id IS NOT NULL THEN sub.duration_seconds
      ELSE s.duration_seconds
    END
  ) / 3600.0, 2) AS total_hours
FROM `claude-mcp-484718.rpi_session_intelligence.sessions` s
LEFT JOIN `claude-mcp-484718.rpi_session_intelligence.subagent_sessions` sub
  ON s.session_id = sub.parent_session_id
GROUP BY s.machine, COALESCE(sub.model, 'primary');

-- View 3: value_quantification — ROI calculation
CREATE OR REPLACE VIEW `claude-mcp-484718.rpi_session_intelligence.value_quantification` AS
WITH session_stats AS (
  SELECT
    COUNT(DISTINCT session_id) AS total_sessions,
    ROUND(SUM(duration_seconds) / 3600.0, 2) AS total_session_hours,
    SUM(user_message_count) AS total_user_messages
  FROM `claude-mcp-484718.rpi_session_intelligence.sessions`
  WHERE is_subagent = FALSE
),
subagent_stats AS (
  SELECT
    COUNT(*) AS total_subagents,
    ROUND(SUM(duration_seconds) / 3600.0, 2) AS total_subagent_hours
  FROM `claude-mcp-484718.rpi_session_intelligence.subagent_sessions`
),
jdm_estimate AS (
  -- JDM time approximated as 2 min per user message (typing + reviewing)
  SELECT ROUND(total_user_messages * 2.0 / 60.0, 2) AS jdm_hours
  FROM session_stats
)
SELECT
  j.jdm_hours,
  s.total_session_hours + COALESCE(sub.total_subagent_hours, 0) AS agent_hours,
  s.total_sessions,
  COALESCE(sub.total_subagents, 0) AS total_subagents,
  ROUND(j.jdm_hours * 2000, 2) AS jdm_ceo_value_usd,
  ROUND((s.total_session_hours + COALESCE(sub.total_subagent_hours, 0)) * 150, 2) AS agent_engineering_value_usd,
  ROUND(
    (j.jdm_hours * 2000 + (s.total_session_hours + COALESCE(sub.total_subagent_hours, 0)) * 150) / 7000.0,
    2
  ) AS roi_multiplier,
  ROUND(
    (s.total_session_hours + COALESCE(sub.total_subagent_hours, 0)) / NULLIF(j.jdm_hours, 0),
    2
  ) AS amplification_factor
FROM session_stats s
CROSS JOIN subagent_stats sub
CROSS JOIN jdm_estimate j;
