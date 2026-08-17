#!/bin/bash
# terminal-context-guard.sh — Stop hook for Claude Code.
#
# Blocks assistant messages that tell the user to look at GUI chat-client
# affordances that don't exist in a terminal: "side panel", "artifact pane",
# etc. These phrases leak from tool descriptions written for the desktop/web
# clients (SendUserFile, Artifact) and confuse terminal users — the July 14,
# 2026 "the render is in your side panel" incident.
#
# Occurrences inside backticks or double quotes are ALLOWED (discussing or
# documenting the phrases, like this file, is legitimate — telling the user
# to look there is not).
#
# On block: Claude sees the reason and rephrases (give a file path or `open`
# it). stop_hook_active prevents infinite retry loops.

set -eu

INPUT=$(cat)
TRANSCRIPT=$(echo "$INPUT" | jq -r '.transcript_path // empty')
STOP_ACTIVE=$(echo "$INPUT" | jq -r '.stop_hook_active // false')

[ "$STOP_ACTIVE" = "true" ] && exit 0
[ -z "$TRANSCRIPT" ] && exit 0
[ ! -f "$TRANSCRIPT" ] && exit 0

export TRANSCRIPT

RESULT=$(python3 <<'PYEOF'
import json, os, re, sys

transcript = os.environ.get("TRANSCRIPT", "")
if not transcript or not os.path.exists(transcript):
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
    sys.exit(0)

# Boundary of current assistant turn: since last REAL user message
# (tool results are encoded type=user but contain tool_result blocks).
last_user_idx = -1
for i, m in enumerate(messages):
    if m.get("type") != "user":
        continue
    content = m.get("message", {}).get("content", "")
    if isinstance(content, list):
        if any(isinstance(b, dict) and b.get("type") == "tool_result" for b in content):
            continue
    last_user_idx = i

text_parts = []
for m in (messages[last_user_idx + 1:] if last_user_idx >= 0 else messages):
    if m.get("type") != "assistant":
        continue
    content = m.get("message", {}).get("content", [])
    if isinstance(content, list):
        for block in content:
            if isinstance(block, dict) and block.get("type") == "text":
                text_parts.append(block.get("text", ""))

text = "\n".join(text_parts)
if not text:
    sys.exit(0)

# Strip code fences, inline code, and double-quoted strings — quoting the
# phrase is allowed; directing the user to it is not. (\x60 = backtick;
# literal backticks break macOS bash 3.2 heredoc-in-$() parsing.)
stripped = re.sub("\x60{3}.*?\x60{3}", " ", text, flags=re.DOTALL)
stripped = re.sub("\x60[^\x60]*\x60", " ", stripped)
stripped = re.sub(r'"[^"\n]*"', " ", stripped)
stripped = re.sub(r"“[^”\n]*”", " ", stripped)

PATTERNS = [
    r"\bside\s+panel\b",
    r"\bartifacts?\s+pane\b",
    r"\bartifacts?\s+panel\b",
    r"\bpreview\s+pane\b",
    r"\bopen(?:ed|s)?\s+(?:in|on)\s+the\s+canvas\b",
    r"\brendered\s+in\s+the\s+side\b",
]

hits = []
for p in PATTERNS:
    m = re.search(p, stripped, flags=re.IGNORECASE)
    if m:
        hits.append(m.group(0))

if hits:
    print(json.dumps({"hits": hits}))
PYEOF
)

if [ -n "$RESULT" ]; then
    HITS=$(echo "$RESULT" | jq -r '.hits | join(", ")')
    cat <<EOF
{"decision": "block", "reason": "TERMINAL CONTEXT: this response references a GUI affordance ('${HITS}') that does not exist in the terminal client the user is in (Claude Code in Ghostty). There is no side panel, artifact pane, or canvas. Rephrase: give the file's path, run 'open <path>', or say the file was attached — never direct the user to GUI chrome. (Quoting the phrase in backticks or double quotes is allowed when discussing it.)"}
EOF
fi
exit 0
