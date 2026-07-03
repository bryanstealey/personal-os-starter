#!/bin/bash
# Obsidian vault linter — PostToolUse hook for Claude Code
# Checks frontmatter and wiki-link targets after editing .md files in the vault
#
# Requires VAULT_PATH environment variable to be set (e.g., ~/my-system)
# Falls back to detecting .obsidian/ directory in parent paths
#
# Skip list is configurable: set OBSIDIAN_LINT_SKIP to a colon-separated list
# of glob patterns to exclude additional files from linting (e.g.
# "*/inbox/*:*NOTES_v*"). The patterns below are sensible defaults; your value
# is appended to them, not a replacement.

# jq is required for parsing the hook's JSON input. If it's missing, fail open
# (skip linting) rather than erroring out after an edit.
if ! command -v jq >/dev/null 2>&1; then
  echo "obsidian-lint hook: jq not found on PATH — skipping vault lint. Install jq (brew install jq) to enable this hook." >&2
  exit 0
fi

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

# Skip system/processing files that don't need vault formatting.
#
# Two tiers:
#   1. Always-skip (universal, never lintable as Obsidian notes):
#      - CLAUDE.md files are Claude Code config, not Obsidian content
#      - .claude/ holds slash commands, sub-agent defs, skill files
#      - .obsidian/ holds Obsidian's own config
#   2. Default skip patterns (common loose-note / log / draft conventions),
#      extendable via the OBSIDIAN_LINT_SKIP env var (colon-separated globs).
ALWAYS_SKIP=(
  "*/CLAUDE.md"
  "*/.claude/*"
  "*/.obsidian/*"
)

# Default loose-file patterns. These are conventions, not requirements — a new
# user with different naming can override/extend via OBSIDIAN_LINT_SKIP.
DEFAULT_SKIP=(
  "*/processing-logs/*"
  "*/logs/*"
  "*/processed-inbox.md"
  "*/brain-dump.md"
  "*/daily/*.md"
  "*HANDOFF_v*"
  "*WORKLOG_v*"
  "*/README.md"
  "*/readme.md"
)

# User-supplied additional skip patterns (colon-separated).
USER_SKIP=()
if [[ -n "${OBSIDIAN_LINT_SKIP:-}" ]]; then
  IFS=':' read -ra USER_SKIP <<< "$OBSIDIAN_LINT_SKIP"
fi

for pattern in "${ALWAYS_SKIP[@]}" "${DEFAULT_SKIP[@]}" "${USER_SKIP[@]}"; do
  [[ -z "$pattern" ]] && continue
  # shellcheck disable=SC2053
  if [[ "$FILE_PATH" == $pattern ]]; then
    exit 0
  fi
done

# Build a single cached list of all .md files in the vault ONCE, then test
# wiki-link targets via in-memory membership instead of a `find` per link.
# This replaces the old O(links × files) `find $VAULT` storm with a single walk.
declare -a VAULT_MD
while IFS= read -r f; do
  VAULT_MD+=("$f")
done < <(find "$VAULT" -iname '*.md' -not -path "*/.obsidian/*" -not -path "*/.trash/*" 2>/dev/null)

# Lowercased basenames-without-extension, for case-insensitive membership tests.
declare -a VAULT_BASENAMES
for f in "${VAULT_MD[@]}"; do
  b=$(basename "$f")
  b="${b%.md}"
  VAULT_BASENAMES+=("$(echo "$b" | tr '[:upper:]' '[:lower:]')")
done

# Membership test: does a target (case-insensitive, .md optional) resolve to a
# real vault file? Matches against basename, with or without the .md suffix.
link_resolves() {
  local target="$1"
  local want
  want="${target%.md}"
  want="$(echo "$want" | tr '[:upper:]' '[:lower:]')"
  local base
  for base in "${VAULT_BASENAMES[@]}"; do
    [[ "$base" == "$want" ]] && return 0
  done
  return 1
}

ERRORS=()   # blocking-ish: malformed frontmatter
NUDGES=()   # informational: unresolved wiki-links (normal Obsidian state)

# --- Check 1: Frontmatter exists ---
FIRST_LINE=$(head -1 "$FILE_PATH" 2>/dev/null)
if [[ "$FIRST_LINE" != "---" ]]; then
  ERRORS+=("MISSING FRONTMATTER: File does not start with --- (YAML frontmatter recommended for vault .md files: add a description: and topics: block)")
else
  # Check frontmatter closes
  CLOSE=$(awk 'NR>1 && /^---$/{print NR; exit}' "$FILE_PATH")
  if [[ -z "$CLOSE" ]]; then
    ERRORS+=("BROKEN FRONTMATTER: Opening --- found but no closing --- delimiter")
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

  if ! link_resolves "$target"; then
    NUDGES+=("[[${link}]] — no matching file in vault yet. Create it as a stub if it should exist?")
  fi
done <<< "$LINKS"

# --- Report results ---
if [[ ${#ERRORS[@]} -eq 0 && ${#NUDGES[@]} -eq 0 ]]; then
  exit 0
fi

REPORT=""

if [[ ${#ERRORS[@]} -gt 0 ]]; then
  REPORT="${REPORT}Frontmatter issues (worth fixing):\n"
  for issue in "${ERRORS[@]}"; do
    REPORT="${REPORT}• ${issue}\n"
  done
fi

if [[ ${#NUDGES[@]} -gt 0 ]]; then
  [[ -n "$REPORT" ]] && REPORT="${REPORT}\n"
  REPORT="${REPORT}Unresolved wiki-links (informational — normal while building the graph):\n"
  for nudge in "${NUDGES[@]}"; do
    REPORT="${REPORT}• ${nudge}\n"
  done
fi

jq -n --arg report "$(echo -e "$REPORT")" '{
  hookSpecificOutput: {
    hookEventName: "PostToolUse",
    additionalContext: ("OBSIDIAN LINT (this file):\n" + $report + "\nFix frontmatter if flagged. Unresolved links are normal — only create stubs for ones that should exist.")
  }
}'

exit 0
