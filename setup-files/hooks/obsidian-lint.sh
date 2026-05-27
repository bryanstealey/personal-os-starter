#!/bin/bash
# Obsidian vault linter — PostToolUse hook for Claude Code
# Checks frontmatter and wiki-link targets after editing .md files in the vault
#
# Requires VAULT_PATH environment variable to be set (e.g., ~/my-system)
# Falls back to detecting .obsidian/ directory in parent paths

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# Determine vault path: env var > detection
VAULT="${VAULT_PATH:-}"
if [[ -z "$VAULT" ]]; then
  # Try to detect vault by walking up from the file path
  check="$FILE_PATH"
  while [[ "$check" != "/" && "$check" != "$HOME" ]]; do
    check=$(dirname "$check")
    if [[ -d "$check/.obsidian" ]]; then
      VAULT="$check"
      break
    fi
  done
fi

# If we still don't have a vault path, can't lint
[[ -z "$VAULT" ]] && exit 0

# Only lint .md files in the vault
case "$FILE_PATH" in
  "$VAULT"/*.md|"$VAULT"/**/*.md) ;;
  *) exit 0 ;;
esac

# Skip system/processing files that don't need vault formatting
# .claude/ holds slash commands, sub-agent definitions, and skill files — not vault notes
# CLAUDE.md files are Claude Code config, not Obsidian content — never require frontmatter
case "$FILE_PATH" in
  */CLAUDE.md|*/.claude/*|*/processing-logs/*|*/processed-inbox.md|*/.obsidian/*|*/brain-dump.md|*/daily/*.md|*HANDOFF_v*|*WORKLOG_v*)
    exit 0
    ;;
esac

ISSUES=()

# --- Check 1: Frontmatter exists ---
FIRST_LINE=$(head -1 "$FILE_PATH" 2>/dev/null)
if [[ "$FIRST_LINE" != "---" ]]; then
  ISSUES+=("MISSING FRONTMATTER: File does not start with --- (YAML frontmatter required for all vault .md files)")
else
  # Check frontmatter closes
  CLOSE=$(awk 'NR>1 && /^---$/{print NR; exit}' "$FILE_PATH")
  if [[ -z "$CLOSE" ]]; then
    ISSUES+=("BROKEN FRONTMATTER: Opening --- found but no closing --- delimiter")
  fi
fi

# --- Check 2: Wiki-links point to real files ---
# Extract all [[target]] and [[target|display]] patterns
LINKS=$(grep -oE '\[\[[^]]+\]\]' "$FILE_PATH" 2>/dev/null | sed 's/\[\[//;s/\]\]//;s/|.*//' | sort -u)

while IFS= read -r link; do
  [[ -z "$link" ]] && continue

  # Skip links that are just anchors (#heading)
  [[ "$link" == \#* ]] && continue

  # Strip any anchor from the link (filename#heading -> filename)
  target="${link%%#*}"
  [[ -z "$target" ]] && continue

  # Search for the target file in the vault (case-insensitive, .md extension optional)
  FOUND=$(find "$VAULT" -iname "${target}.md" -not -path "*/.obsidian/*" -not -path "*/.trash/*" 2>/dev/null | head -1)
  if [[ -z "$FOUND" ]]; then
    # Try without .md extension (might be linking to exact filename)
    FOUND=$(find "$VAULT" -iname "$target" -not -path "*/.obsidian/*" -not -path "*/.trash/*" 2>/dev/null | head -1)
  fi

  if [[ -z "$FOUND" ]]; then
    ISSUES+=("BROKEN WIKI-LINK: [[${link}]] — no matching file found in vault")
  fi
done <<< "$LINKS"

# --- Report results ---
if [[ ${#ISSUES[@]} -eq 0 ]]; then
  exit 0
fi

# Build issue report
REPORT=""
for issue in "${ISSUES[@]}"; do
  REPORT="${REPORT}• ${issue}\n"
done

jq -n --arg report "$(echo -e "$REPORT")" '{
  hookSpecificOutput: {
    hookEventName: "PostToolUse",
    additionalContext: ("OBSIDIAN LINT ISSUES in this file:\n" + $report + "\nPlease fix these issues before moving on.")
  }
}'

exit 0
