#!/bin/bash
# read-before-claiming.sh — Stop hook for Claude Code.
#
# Blocks assistant messages that claim a file, directory, or artifact doesn't
# exist unless a sufficient search tool was called in the current turn.
#
# "Sufficient search" means: Glob, Grep, or Bash with find/rg/fd. A single
# `ls` or `Read` is NOT sufficient — those are shallow and are what caused
# the failures this hook exists to prevent.
#
# On block: Claude sees the reason, is prompted to continue, and must do a
# proper search before re-making the claim. Claude Code sets stop_hook_active
# on retries to prevent infinite loops.

set -eu

INPUT=$(cat)
TRANSCRIPT=$(echo "$INPUT" | jq -r '.transcript_path // empty')
STOP_ACTIVE=$(echo "$INPUT" | jq -r '.stop_hook_active // false')

# Prevent infinite loop — if already retrying after a block, let it through
[ "$STOP_ACTIVE" = "true" ] && exit 0

[ -z "$TRANSCRIPT" ] && exit 0
[ ! -f "$TRANSCRIPT" ] && exit 0

export TRANSCRIPT

# Extract the last assistant turn's text + tool uses from the transcript JSONL
ANALYSIS=$(python3 <<'PYEOF'
import json, sys, os

transcript = os.environ.get("TRANSCRIPT", "")
if not transcript or not os.path.exists(transcript):
    print(json.dumps({"text": "", "tools": [], "bash_commands": []}))
    sys.exit(0)

messages = []
try:
    with open(transcript) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                messages.append(json.loads(line))
            except Exception:
                continue
except Exception:
    print(json.dumps({"text": "", "tools": [], "bash_commands": []}))
    sys.exit(0)

# Find boundary of current assistant turn (since last REAL user message).
# Tool-result messages are transcript-encoded as type="user" but come from the
# tool, not the human. A real user message has content as a string, or as a
# list that contains no tool_result blocks.
last_user_idx = -1
for i, m in enumerate(messages):
    if m.get("type") != "user":
        continue
    content = m.get("message", {}).get("content", "")
    if isinstance(content, list):
        is_tool_result = any(
            isinstance(b, dict) and b.get("type") == "tool_result"
            for b in content
        )
        if is_tool_result:
            continue
    last_user_idx = i

turn_messages = messages[last_user_idx + 1:] if last_user_idx >= 0 else messages

text_parts = []
tool_names = []
bash_commands = []

for m in turn_messages:
    if m.get("type") != "assistant":
        continue
    content = m.get("message", {}).get("content", [])
    if not isinstance(content, list):
        continue
    for block in content:
        btype = block.get("type")
        if btype == "text":
            text_parts.append(block.get("text", ""))
        elif btype == "tool_use":
            name = block.get("name", "")
            tool_names.append(name)
            if name == "Bash":
                cmd = block.get("input", {}).get("command", "")
                bash_commands.append(cmd)

print(json.dumps({
    "text": "\n".join(text_parts),
    "tools": tool_names,
    "bash_commands": bash_commands,
}))
PYEOF
)

[ -z "$ANALYSIS" ] && exit 0

TEXT=$(echo "$ANALYSIS" | jq -r '.text // ""')
TOOLS=$(echo "$ANALYSIS" | jq -r '.tools[]? // empty')
BASH_CMDS=$(echo "$ANALYSIS" | jq -r '.bash_commands[]? // empty')

[ -z "$TEXT" ] && exit 0

# Negative-existence phrases. Case-insensitive. Tune over time based on
# observed false positives.
NEGATIVE_PATTERNS='no CLAUDE\.md|no handoffs?|no obvious [A-Za-z]+|doesn'"'"'t exist|does not exist|no such file|not found on disk|couldn'"'"'t find (an?|the) [A-Za-z._/-]+|can'"'"'t find (an?|the) [A-Za-z._/-]+|there is no [A-Za-z._/-]+(on disk| in (this|the))'

if ! echo "$TEXT" | grep -qiE "$NEGATIVE_PATTERNS"; then
    exit 0
fi

# Did the turn include a sufficient search tool?
SEARCHED=0

# Tool-based check: Glob or Grep
if echo "$TOOLS" | grep -qE '^(Glob|Grep)$'; then
    SEARCHED=1
fi

# Bash command check: find / rg / ripgrep / fd
if echo "$BASH_CMDS" | grep -qE '(^|[[:space:]]|;|&&|\|\|)(find|rg|ripgrep|fd)([[:space:]]|$)'; then
    SEARCHED=1
fi

[ "$SEARCHED" = "1" ] && exit 0

# Block with an educational reason
REASON="Your response contains a negative-existence claim (something like 'doesn't exist', 'no CLAUDE.md', 'not found') but no recursive search tool was called in this turn. A single \`ls\` or single \`Read\` is not sufficient evidence for absence — files hide in subdirectories, and surface listings miss them.

Before reclaiming absence, run at least ONE of:
  - Glob tool with a \`**\` pattern
  - Grep tool for the relevant content
  - Bash with \`find\` (recursive directory walk)
  - Bash with \`rg\` or \`ripgrep\` for recursive content search

Then respond with the verified state. If the thing genuinely doesn't exist after a proper search, the same claim is fine — you'll just have the search output to back it up.

This hook exists because this exact failure pattern has recurred: Claude denies existence of a file/tracker/config that is present one directory deeper, in a nested structure, or under a different name. Look before claiming."

# Emit block decision
jq -n --arg reason "$REASON" '{
  "decision": "block",
  "reason": $reason
}'

exit 0
