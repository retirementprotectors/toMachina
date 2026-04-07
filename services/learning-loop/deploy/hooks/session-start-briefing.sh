#!/bin/bash
# SessionStart hook — cross-warrior briefing
# System Synergy — ZRD-SYN-014
#
# Outputs briefing text for injection into session context.
# Claude Code captures stdout and prepends to the session context window.
#
# Deploy to: /home/jdm/hooks/session-start-briefing.sh
# Register in Claude Code settings.json under hooks.PreToolUse or hooks.UserPromptSubmit

WARRIOR=$(tmux display-message -p "#S" 2>/dev/null || echo "")
if [ -z "$WARRIOR" ]; then exit 0; fi

case "$WARRIOR" in
  ronin*|RONIN*) WARRIOR_NAME="ronin" ;;
  raiden*|RAIDEN*) WARRIOR_NAME="raiden" ;;
  megazord*|MEGAZORD*) WARRIOR_NAME="megazord" ;;
  musashi*|MUSASHI*) WARRIOR_NAME="musashi" ;;
  voltron*|VOLTRON*) WARRIOR_NAME="voltron" ;;
  shinob1*|SHINOB1*) WARRIOR_NAME="shinob1" ;;
  *) exit 0 ;;
esac

GOOGLE_APPLICATION_CREDENTIALS=/home/jdm/mdj-agent/sa-key.json \
WARRIOR_NAME="$WARRIOR_NAME" \
  /usr/bin/node /home/jdm/Projects/toMachina/services/learning-loop/dist/wire-warrior-briefing.js "$WARRIOR_NAME" 2>/dev/null

exit 0
