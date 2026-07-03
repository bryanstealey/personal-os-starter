#!/bin/bash
# Calendar day-of-week verifier — PreToolUse hook for Claude Code.
# On gws calendar events insert|patch|update, extracts dateTime values, computes
# day-of-week, and BLOCKS the command unless a matching `# day:DayName` comment
# is appended. Forces Claude to acknowledge the day of week before every calendar
# write — prevents the "Monday April 21 (actually Tuesday)" class of error.

# jq is required for parsing the hook's JSON input. If it's missing, fail open
# (let the tool call proceed) rather than silently mangling the command.
if ! command -v jq >/dev/null 2>&1; then
  echo "calendar-day-verify hook: jq not found on PATH — skipping calendar verification. Install jq (brew install jq) to enable this hook." >&2
  exit 0
fi

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')

# Only intercept Bash tool calls
[[ "$TOOL_NAME" != "Bash" ]] && exit 0

COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Only intercept gws calendar writes (supports gws, gws-ss, gws-tb variants)
if ! echo "$COMMAND" | grep -qE 'gws(-[a-z]+)?[[:space:]]+calendar[[:space:]]+events[[:space:]]+(insert|patch|update)'; then
  exit 0
fi

# Extract unique YYYY-MM-DD values from dateTime fields
DATES=$(echo "$COMMAND" | python3 -c "
import sys, re
cmd = sys.stdin.read()
dates = re.findall(r'\"dateTime\"\s*:\s*\"([0-9]{4}-[0-9]{2}-[0-9]{2})T', cmd)
for d in sorted(set(dates)):
    print(d)
")

# No dates = not a date-changing write (e.g., attendee-only patch). Let it pass.
[[ -z "$DATES" ]] && exit 0

# Build human-readable date->day info block
INFO=$(python3 <<EOF
import datetime
for d in """$DATES""".strip().split("\n"):
    try:
        print(f"  {d} is {datetime.date.fromisoformat(d).strftime('%A')}")
    except Exception:
        pass
EOF
)

# Compute unique set of expected days (comma-separated)
EXPECTED_DAYS=$(python3 <<EOF
import datetime
days = set()
for d in """$DATES""".strip().split("\n"):
    try:
        days.add(datetime.date.fromisoformat(d).strftime("%A"))
    except Exception:
        pass
print(",".join(sorted(days)))
EOF
)

[[ -z "$EXPECTED_DAYS" ]] && exit 0

# Extract day-of-week acknowledgments from command: `# day:Monday` or `# day: Monday`
ACK=$(echo "$COMMAND" | grep -oiE '#[[:space:]]*day[[:space:]]*:[[:space:]]*[a-zA-Z]+' \
      | sed -E 's/.*:[[:space:]]*//' \
      | tr '[:upper:]' '[:lower:]' \
      | sort -u \
      | paste -sd, -)

EXPECTED_LOWER=$(echo "$EXPECTED_DAYS" | tr '[:upper:]' '[:lower:]')

# Check every expected day has an ack
MISSING=""
IFS=',' read -ra DAYS <<< "$EXPECTED_LOWER"
for day in "${DAYS[@]}"; do
  [[ -z "$day" ]] && continue
  if [[ ",$ACK," != *",$day,"* ]]; then
    MISSING+=" $day"
  fi
done

if [[ -n "$MISSING" ]]; then
  REASON=$(cat <<EOF
CALENDAR WRITE BLOCKED — day-of-week verification required.

Dates in this command:
$INFO

Append '# day:DayName' for each unique day before retrying.
Missing:${MISSING}

Example: gws calendar events insert ... --json '{...}' # day:Monday
EOF
)
  jq -n --arg msg "$REASON" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: $msg
    }
  }'
  exit 0
fi

# All expected days acknowledged — pass with informational context
jq -n --arg msg "Calendar write verified — dates:\n$INFO" '{
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    additionalContext: $msg
  }
}'

exit 0
