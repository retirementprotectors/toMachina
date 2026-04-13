#!/bin/bash
# Auto-log hook: Slack posts
# ZRD-SYN-020f | Warrior Event Log
#
# Hook event: PostToolUse (mcp__slack__slack_post_message)
# Logs every Slack post to warrior_events for audit trail.
# Non-blocking: exits 0 even on failure.

# Read the tool use result from stdin
TOOL_OUTPUT=$(cat)

# Only process slack_post_message results
if ! echo "$TOOL_OUTPUT" | grep -qE '"ok"\s*:\s*true'; then
  exit 0
fi

# Extract channel ID
CHANNEL_ID=$(echo "$TOOL_OUTPUT" | grep -oP '"channel"\s*:\s*"\K[^"]+' | head -1)

# Extract first 200 chars of text for summary
MSG_TEXT=$(echo "$TOOL_OUTPUT" | grep -oP '"text"\s*:\s*"\K[^"]{0,200}' | head -1)

if [ -z "$CHANNEL_ID" ]; then
  exit 0
fi

# Map known channel IDs to names for human-readable summary
CHANNEL_NAME="$CHANNEL_ID"
case "$CHANNEL_ID" in
  C0AP2QL9Z6X) CHANNEL_NAME="#dojo-war-room" ;;
  C0AS9N2416V) CHANNEL_NAME="#warriors" ;;
  C0ANMBVMSTV) CHANNEL_NAME="#the-dojo" ;;
  C0ARWR3SC7L) CHANNEL_NAME="#exec" ;;
  C0AS0LETSBW) CHANNEL_NAME="#shinob1" ;;
  C0ARWQMMUMQ) CHANNEL_NAME="#megazord" ;;
  C0ARFBHSKNK) CHANNEL_NAME="#musashi" ;;
  C0ARUP0HM1C) CHANNEL_NAME="#voltron" ;;
  C0ARQHMP0P5) CHANNEL_NAME="#raiden" ;;
  C0ARUSZFKB8) CHANNEL_NAME="#ronin" ;;
esac

SUMMARY="Slack post to ${CHANNEL_NAME}"

# Build JSON payload
JSON="{\"type\":\"slack_sent\",\"summary\":\"${SUMMARY}\",\"channel\":\"${CHANNEL_ID}\",\"details\":{\"channelId\":\"${CHANNEL_ID}\"}}"

# Fire and forget
echo "$JSON" | GOOGLE_APPLICATION_CREDENTIALS=/home/jdm/Projects/dojo-warriors/mdj-agent/sa-key.json \
  /usr/bin/node /home/jdm/Projects/toMachina/services/learning-loop/dist/log-event.js 2>/dev/null &

exit 0
