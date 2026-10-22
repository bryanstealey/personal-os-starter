#!/bin/bash
# Lead-agent status line. When Claude Code runs inside the vault, the status line
# opens with a loud badge ("⬢ {{SYSTEM_NAME}} · your assistant") so the main agent
# is easy to spot among many terminal panes. Every other project gets no badge.
# Then claude-hud draws the usual line (project, context bar, usage bar).
# Installed by SETUP.md Section 9 to ~/.claude/lead-statusline.sh.
INPUT=$(cat)
CWD=$(printf '%s' "$INPUT" | grep -o '"cwd" *: *"[^"]*"' | head -1 | sed 's/.*: *"\(.*\)"/\1/')

VAULT="$HOME/{{systemName}}"
NAME="{{SYSTEM_NAME}}"
ACCENT="204;0;0"   # red, reserved for the main agent

if [ -n "$CWD" ] && { [ "$CWD" = "$VAULT" ] || [ "${CWD#$VAULT/}" != "$CWD" ]; }; then
  # bold, filled red background, white text
  printf '\033[1;48;2;%s;38;2;255;255;255m ⬢ %s · your assistant \033[0m ' "$ACCENT" "$NAME"
fi

NODE=$(command -v node || ls /opt/homebrew/bin/node /usr/local/bin/node 2>/dev/null | head -1)
plugin_dir=$(ls -d "${CLAUDE_CONFIG_DIR:-$HOME/.claude}"/plugins/cache/claude-hud/claude-hud/*/ 2>/dev/null \
  | awk -F/ '{ print $(NF-1) "\t" $0 }' | sort -t. -k1,1n -k2,2n -k3,3n -k4,4n | tail -1 | cut -f2-)
if [ -n "$NODE" ] && [ -n "$plugin_dir" ] && [ -f "${plugin_dir}dist/index.js" ]; then
  printf '%s' "$INPUT" | "$NODE" "${plugin_dir}dist/index.js"
fi
