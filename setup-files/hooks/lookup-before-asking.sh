#!/bin/bash
# lookup-before-asking.sh — Stop hook for Claude Code.
#
# Blocks Claude's response when it defers to the user for information Claude
# could have looked up with an available tool. The specific failure pattern:
# Claude's response contains a sheet/doc ID paired with "???", "unknown",
# "tell me", "can you paste", etc., without having called a lookup tool
# (gws, Read, Glob, Grep, find) in the current turn.
#
# Starts conservative — only triggers on unambiguous deferral patterns.
# Tune by adding patterns when real failures slip through.
#
# Legitimate questions (asking about intent, preferences, judgment,
# decisions not yet made) should never trigger this hook — the discriminator
# is "is the answer in a tool I could call?" not "am I asking the user
# something?"

set -eu

INPUT=$(cat)
TRANSCRIPT=$(echo "$INPUT" | jq -r '.transcript_path // empty')
STOP_ACTIVE=$(echo "$INPUT" | jq -r '.stop_hook_active // false')

# Prevent infinite loop on retries
[ "$STOP_ACTIVE" = "true" ] && exit 0
[ -z "$TRANSCRIPT" ] && exit 0
[ ! -f "$TRANSCRIPT" ] && exit 0

export TRANSCRIPT

# Extract the current assistant turn's text + tool uses
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

# Find last REAL user message (skip tool_result messages that are type=user)
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

# Build a "stripped" copy of the text for triggers that need to ignore
# backtick/quoted pattern-description false positives
TEXT_STRIPPED=$(printf '%s' "$TEXT" | python3 -c "
import re, sys
text = sys.stdin.read()
# Strip triple-backtick fenced blocks first (greedy, multi-line)
text = re.sub(r'\`\`\`[\s\S]*?\`\`\`', ' ', text)
# Then single-backtick spans (within a line)
text = re.sub(r'\`[^\`\n]*\`', ' ', text)
# Also strip short quoted fragments that likely contain pattern descriptions
text = re.sub(r'\"[^\"\n]{0,100}\"', ' ', text)
text = re.sub(r\"'[^'\n]{0,100}'\", ' ', text)
sys.stdout.write(text)
")

# ===== Trigger detection =====
TRIGGERED=0
TRIGGER_REASON=""

# Trigger 1: Sheet/Doc ID in response paired with deferral language.
if echo "$TEXT" | grep -qE '(^|[^A-Za-z0-9_-])1[A-Za-z0-9_-]{43}([^A-Za-z0-9_-]|$)'; then
  if echo "$TEXT" | grep -qiE '(\?\?\?|unknown|(what|which) (is|are).*(this|that|it|these)|tell me (what|which)|can you (paste|confirm|tell)|need (you )?to (know|tell|confirm|paste)|do you know|not sure what|verify purpose)'; then
    TRIGGERED=1
    TRIGGER_REASON="response contains a Google Sheet/Doc ID paired with deferral language ('???', 'unknown', 'tell me', etc.)"
  fi
fi

# Trigger 2: Literal "???" as a placeholder next to a backticked identifier.
if [ "$TRIGGERED" = "0" ] && echo "$TEXT" | grep -qE '`[^`]+`[[:space:]]*[—-][[:space:]]*\?\?\?'; then
  TRIGGERED=1
  TRIGGER_REASON="response contains a backticked identifier followed by '???' — look it up instead of marking unknown"
fi

# Trigger 3: Asking user to paste a URL/ID/link.
if [ "$TRIGGERED" = "0" ] && echo "$TEXT_STRIPPED" | grep -qiE '(paste (the|its|a) (url|id|link|sheet id)|can you paste|could you paste)'; then
  TRIGGERED=1
  TRIGGER_REASON="response asks user to paste a URL/ID/link — this is almost always lookable via the available CLI"
fi

[ "$TRIGGERED" = "0" ] && exit 0

# ===== Check whether a relevant lookup tool was called =====
LOOKED=0

# Tool-based: Glob, Grep, Read
if echo "$TOOLS" | grep -qE '^(Glob|Grep|Read)$'; then
  LOOKED=1
fi

# Bash-based lookups
if echo "$BASH_CMDS" | grep -qE '(^|[[:space:]]|;|&&|\|\|)(gws|gws-ss|gws-tb)[[:space:]]+(sheets|drive|gmail|calendar|docs)'; then
  LOOKED=1
fi
if echo "$BASH_CMDS" | grep -qE '(^|[[:space:]]|;|&&|\|\|)(find|rg|ripgrep|fd)([[:space:]]|$)'; then
  LOOKED=1
fi
if echo "$BASH_CMDS" | grep -qiE 'docs\.google\.com|sheets\.googleapis\.com'; then
  LOOKED=1
fi

[ "$LOOKED" = "1" ] && exit 0

# ===== Block with educational reason =====
REASON="Your response defers to the user for information you could look up yourself. Detected: ${TRIGGER_REASON}.

Before asking, try the relevant lookup tool:
  - Sheet ID: \`gws sheets spreadsheets get --params '{\"spreadsheetId\":\"X\",\"fields\":\"properties.title,sheets.properties.title\"}'\`
  - Google Doc ID: \`gws drive files get --params '{\"fileId\":\"X\",\"fields\":\"name,mimeType\"}'\`
  - File path: Read, Glob (with \`**\`), or Bash with find/rg
  - Code location: Grep or Glob

If the lookup genuinely fails (permission denied, file truly absent after recursive search), THEN you can ask — but include what you tried and why it failed, so the question is 'here is what I could not access' rather than 'can you tell me what this is?'.

Legitimate questions about intent, preferences, judgment, or decisions are NOT blocked by this hook."

# Emit block
jq -n --arg reason "$REASON" '{
  "decision": "block",
  "reason": $reason
}'

exit 0
