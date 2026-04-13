#!/bin/bash
# Auto-log hook: directives from dispatcher
# ZRD-SYN-020d | Warrior Event Log
#
# Hook event: UserPromptSubmit
# Detects "# Incoming from U..." directive pattern and logs to warrior_events.
# Non-blocking: exits 0 even on failure.

# Read the user prompt from stdin
PROMPT=$(cat)

# Only log if this looks like a dispatcher directive
if ! echo "$PROMPT" | grep -qE '^# Incoming from U[A-Z0-9]+:'; then
  exit 0
fi

# Extract sender ID and directive text
SENDER_ID=$(echo "$PROMPT" | head -1 | grep -oP 'U[A-Z0-9]+')
DIRECTIVE_TEXT=$(echo "$PROMPT" | head -1 | sed 's/^# Incoming from U[A-Z0-9]*: \[DIRECTIVE\] //')

# Truncate summary to 200 chars
SUMMARY=$(echo "$DIRECTIVE_TEXT" | head -c 200)

# Build JSON payload
JSON=$(cat <<EOF
{"type":"directive","summary":"${SUMMARY//\"/\\\"}","details":{"senderId":"$SENDER_ID"}}
EOF
)

# Fire and forget — don't block session
echo "$JSON" | GOOGLE_APPLICATION_CREDENTIALS=/home/jdm/Projects/dojo-warriors/mdj-agent/sa-key.json \
  /usr/bin/node /home/jdm/Projects/toMachina/services/learning-loop/dist/log-event.js 2>/dev/null &

exit 0
