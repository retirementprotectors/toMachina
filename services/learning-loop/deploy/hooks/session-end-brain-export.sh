#!/bin/bash
# SessionEnd hook — auto brain-export
# System Synergy — ZRD-SYN-013
#
# Triggered by Claude Code on session close.
# Reads warrior name from tmux session, exports transcript to brain.txt
#
# Deploy to: /home/jdm/hooks/session-end-brain-export.sh
# Register in Claude Code settings.json under hooks.PostToolUse or hooks.Stop

WARRIOR=$(tmux display-message -p "#S" 2>/dev/null || echo "")
if [ -z "$WARRIOR" ]; then exit 0; fi

# Map tmux session names to warrior names
case "$WARRIOR" in
  ronin*|RONIN*) WARRIOR_NAME="ronin" ;;
  raiden*|RAIDEN*) WARRIOR_NAME="raiden" ;;
  megazord*|MEGAZORD*) WARRIOR_NAME="megazord" ;;
  musashi*|MUSASHI*) WARRIOR_NAME="musashi" ;;
  voltron*|VOLTRON*) WARRIOR_NAME="voltron" ;;
  shinob1*|SHINOB1*) WARRIOR_NAME="shinob1" ;;
  *) exit 0 ;;
esac

# Get transcript from stdin (Claude Code pipes it)
TRANSCRIPT=$(cat)
if [ -z "$TRANSCRIPT" ]; then exit 0; fi

echo "$TRANSCRIPT" | WARRIOR_NAME="$WARRIOR_NAME" \
  GOOGLE_APPLICATION_CREDENTIALS=/home/jdm/Projects/dojo-warriors/mdj-agent/sa-key.json \
  /usr/bin/node /home/jdm/Projects/toMachina/services/learning-loop/dist/brain-export.js "$WARRIOR_NAME"

exit 0
