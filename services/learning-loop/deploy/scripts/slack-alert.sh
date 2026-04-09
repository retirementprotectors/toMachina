#!/bin/bash
# slack-alert.sh — Posts a Slack DM to JDM when a Learning Loop wire fails.
# Called by systemd OnFailure= directives on each wire .service file.
#
# Usage: slack-alert.sh <wire-name>
# Example: slack-alert.sh entity-extractor.service
#
# Reads SLACK_BOT_TOKEN from .env. Posts to JDM DM (U09BBHTN8F2).

set -uo pipefail

WIRE_NAME="${1:-unknown}"
# Add .service suffix if not already present
case "$WIRE_NAME" in
  *.service|*.timer) WIRE="$WIRE_NAME" ;;
  *)                 WIRE="${WIRE_NAME}.service" ;;
esac
ENV_FILE="/home/jdm/Projects/dojo-warriors/mdj-agent/.env"
JDM_DM="U09BBHTN8F2"

# Source the env file for SLACK_BOT_TOKEN
if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

if [ -z "${SLACK_BOT_TOKEN:-}" ]; then
  echo "[slack-alert] No SLACK_BOT_TOKEN — cannot post" >&2
  exit 0
fi

# Get last 10 lines of the wire's journal for context
LOG_TAIL=$(journalctl -u "$WIRE" -n 10 --no-pager 2>/dev/null | tail -10 | sed 's/"/\\"/g' | tr '\n' ' ')

# Build the Slack message
TEXT="*:rotating_light: Learning Loop Failure — \`${WIRE}\`*\\n\\nThe wire failed on $(date '+%Y-%m-%d %H:%M:%S %Z'). Recent journal:\\n\\n\`\`\`${LOG_TAIL}\`\`\`\\n\\nRun \`sudo journalctl -u ${WIRE} -n 50\` for full context.\\n\\n:japanese_castle: — MEGAZORD watchdog"

# Post to Slack
curl -s -X POST "https://slack.com/api/chat.postMessage" \
  -H "Authorization: Bearer ${SLACK_BOT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"channel\":\"${JDM_DM}\",\"text\":\"${TEXT}\"}" \
  > /dev/null 2>&1

exit 0
