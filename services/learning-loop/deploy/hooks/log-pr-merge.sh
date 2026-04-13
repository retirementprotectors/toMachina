#!/bin/bash
# Auto-log hook: PR merge events
# ZRD-SYN-020e | Warrior Event Log
#
# Hook event: PostToolUse (Bash)
# Detects gh pr create / gh pr merge commands and logs to warrior_events.
# Non-blocking: exits 0 even on failure.

# Read the tool use result from stdin
TOOL_OUTPUT=$(cat)

# Check if this was a Bash tool call containing gh pr commands
# The hook input includes the command that was run
if ! echo "$TOOL_OUTPUT" | grep -qE 'gh pr (create|merge)'; then
  exit 0
fi

# Extract PR number if available
PR_NUMBER=$(echo "$TOOL_OUTPUT" | grep -oP '#\K[0-9]+' | head -1)
PR_URL=$(echo "$TOOL_OUTPUT" | grep -oP 'https://github\.com/[^\s"]+/pull/[0-9]+' | head -1)

# Determine if this is create or merge
if echo "$TOOL_OUTPUT" | grep -q 'gh pr create'; then
  EVENT_SUMMARY="PR created"
  if [ -n "$PR_NUMBER" ]; then
    EVENT_SUMMARY="PR #${PR_NUMBER} created"
  fi
elif echo "$TOOL_OUTPUT" | grep -q 'gh pr merge'; then
  EVENT_SUMMARY="PR merged"
  if [ -n "$PR_NUMBER" ]; then
    EVENT_SUMMARY="PR #${PR_NUMBER} merged"
  fi
else
  exit 0
fi

# Get current branch
BRANCH=$(git branch --show-current 2>/dev/null || echo "")

# Build JSON payload
DETAILS="{\"prNumber\":${PR_NUMBER:-0}"
if [ -n "$PR_URL" ]; then
  DETAILS="${DETAILS},\"prUrl\":\"$PR_URL\""
fi
if [ -n "$BRANCH" ]; then
  DETAILS="${DETAILS},\"branch\":\"$BRANCH\""
fi
DETAILS="${DETAILS}}"

JSON="{\"type\":\"pr_shipped\",\"summary\":\"${EVENT_SUMMARY}\",\"details\":${DETAILS}}"

# Fire and forget
echo "$JSON" | GOOGLE_APPLICATION_CREDENTIALS=/home/jdm/Projects/dojo-warriors/mdj-agent/sa-key.json \
  /usr/bin/node /home/jdm/Projects/toMachina/services/learning-loop/dist/log-event.js 2>/dev/null &

exit 0
