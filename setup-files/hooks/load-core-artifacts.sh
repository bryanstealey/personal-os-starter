#!/bin/bash
# load-core-artifacts.sh — SessionStart hook for Claude Code.
#
# Reads the project's CLAUDE.md for a "## Core Artifacts" section and injects
# it into the session as additional context. This prevents the "there is no
# X" failure mode where Claude denies the existence of core project artifacts
# simply because they weren't in its initial context window.
#
# For local file paths (in backticks), the hook verifies existence on disk
# and flags drift when a declared artifact is missing.
#
# Schema: Core Artifacts entries should be bulleted lines. Local paths in
# backticks are verified. External resources (Google Sheets, URLs, etc.)
# pass through as-is.

set -eu

INPUT=$(cat)
CWD=$(echo "$INPUT" | jq -r '.cwd // empty')

# Fall back to CLAUDE_PROJECT_DIR env var, then PWD
[ -z "$CWD" ] && CWD="${CLAUDE_PROJECT_DIR:-$PWD}"
[ -z "$CWD" ] && exit 0

# Find project CLAUDE.md — prefer .claude/ subdirectory, fall back to root
CLAUDE_MD=""
for candidate in "$CWD/.claude/CLAUDE.md" "$CWD/CLAUDE.md"; do
  if [ -f "$candidate" ]; then
    CLAUDE_MD="$candidate"
    break
  fi
done

[ -z "$CLAUDE_MD" ] && exit 0

# Extract the "## Core Artifacts" section (from the heading to the next ## heading)
ARTIFACTS=$(awk '
  /^## Core Artifacts[[:space:]]*$/ { in_section=1; next }
  /^## / && in_section { in_section=0 }
  in_section { print }
' "$CLAUDE_MD")

# No Core Artifacts section — exit silently
[ -z "$(echo "$ARTIFACTS" | tr -d '[:space:]')" ] && exit 0

# Verify each backticked path exists on disk. Build missing list.
# Only inspect lines that start with a bullet marker (- or *) — prose lines in
# the Core Artifacts section (e.g., "Access via `ssh server`") are commentary,
# not declarations, and should not be path-verified.
MISSING=""
while IFS= read -r line; do
  # Skip non-bullet lines (prose, headings, blank)
  case "$(echo "$line" | sed 's/^[[:space:]]*//')" in
    -\ *|\*\ *) ;;
    *) continue ;;
  esac

  # Extract first backticked token
  path=$(echo "$line" | grep -oE '`[^`]+`' | head -1 | tr -d '`')
  [ -z "$path" ] && continue

  # Skip non-file declarations: anything containing "://" (URLs) or starting
  # with a recognized prefix like "sheet:", "id:", or obviously non-path text.
  case "$path" in
    *://*) continue ;;
    sheet:*|id:*|gdrive:*|notion:*) continue ;;
  esac

  # Resolve relative paths against project dir; expand ~ to $HOME
  if [ "${path:0:2}" = "~/" ]; then
    full_path="${HOME}/${path:2}"
  elif [ "$path" = "~" ]; then
    full_path="$HOME"
  elif [ "${path:0:1}" = "/" ]; then
    full_path="$path"
  else
    full_path="$CWD/$path"
  fi

  if [ ! -e "$full_path" ]; then
    MISSING="${MISSING}- \`${path}\` — declared but NOT FOUND on disk"$'\n'
  fi
done <<< "$ARTIFACTS"

# Build the context block and emit as JSON for SessionStart
CONTEXT="## Core Artifacts Registered for This Project

These files and external resources are declared in this project's CLAUDE.md as authoritative artifacts. Treat their existence as verified — do NOT claim any of them doesn't exist. Use Read (for local files) or gws (for Google resources) to access them when needed.

${ARTIFACTS}"

if [ -n "$MISSING" ]; then
  CONTEXT="${CONTEXT}
**INTEGRITY DRIFT — declared artifacts missing from disk:**
${MISSING}
Either the files were moved/deleted, or the CLAUDE.md declaration is stale. Flag this before acting on any declared artifact."
fi

# Emit JSON for SessionStart hook output format.
export CONTEXT
python3 <<'PYEOF'
import json, os
context = os.environ.get("CONTEXT", "")
print(json.dumps({
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": context
  }
}))
PYEOF

exit 0
