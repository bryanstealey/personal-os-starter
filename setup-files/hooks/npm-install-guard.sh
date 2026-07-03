#!/bin/bash
# npm install guard — PreToolUse hook.
# Surfaces a supply-chain safety checklist when Claude tries to add a NEW
# npm package (npm install <name>, yarn add, pnpm add, bun add).
#
# Layer 1 defense: `npm config set ignore-scripts true` in ~/.npmrc blocks
# lifecycle-script execution globally.
#
# This hook is layer 2: friction on NEW packages, since the most dangerous
# moment is the first install of an unfamiliar package. Re-installs from a
# committed lockfile (`npm ci`, bare `npm install`) are not blocked.
#
# False-positive control: before matching, we strip heredoc bodies and
# quoted-string content from the command.

# jq is required for parsing the hook's JSON input. If it's missing, fail open
# (let the install proceed) rather than silently blocking or mangling it.
if ! command -v jq >/dev/null 2>&1; then
  echo "npm-install-guard hook: jq not found on PATH — skipping supply-chain checklist. Install jq (brew install jq) to enable this hook." >&2
  exit 0
fi

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')
[[ "$TOOL_NAME" != "Bash" ]] && exit 0

COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Pre-pass: strip heredoc bodies + quoted-string content so prose mentions
# of "npm install" don't trigger.
STRIPPED=$(CMD="$COMMAND" python3 - <<'PY' 2>/dev/null
import os, re, sys
cmd = os.environ.get('CMD', '')

def strip_heredocs(s):
    pat = re.compile(
        r"<<(?!<)-?\s*"
        r"(?:'([^']+)'"
        r"|\"([^\"]+)\""
        r"|([^\s|&<>;'\"]+))"
    )
    out, i = [], 0
    while True:
        m = pat.search(s[i:])
        if not m:
            out.append(s[i:]); break
        delim = m.group(1) or m.group(2) or m.group(3)
        out.append(s[i:i+m.end()])
        rest = s[i+m.end():]
        close = re.search(r"(?m)^\s*" + re.escape(delim) + r"\s*$", rest)
        if not close:
            out.append(rest); break
        out.append("\n" + delim + "\n")
        i = i + m.end() + close.end()
    return ''.join(out)

cmd = strip_heredocs(cmd)
cmd = re.sub(r"'[^']*'", "''", cmd)
cmd = re.sub(r'"(?:\\.|[^"\\])*"', '""', cmd)
sys.stdout.write(cmd)
PY
)
[[ $? -ne 0 || -z "$STRIPPED" ]] && STRIPPED="$COMMAND"

# Only care about install-a-new-package commands.
if ! echo "$STRIPPED" | grep -qE '(^|[[:space:]]|&&|;|\|)(npm[[:space:]]+(install|i|add)|yarn[[:space:]]+add|pnpm[[:space:]]+add|bun[[:space:]]+add)[[:space:]]+[^-]'; then
  exit 0
fi

# Skip if it's `npm install` followed only by flags (no package name)
ARGS=$(echo "$STRIPPED" | grep -oE '(npm[[:space:]]+(install|i|add)|yarn[[:space:]]+add|pnpm[[:space:]]+add|bun[[:space:]]+add)[[:space:]]+[^&;|]+' | head -1)
PKGS=$(echo "$ARGS" | sed -E 's/^(npm[[:space:]]+(install|i|add)|yarn[[:space:]]+add|pnpm[[:space:]]+add|bun[[:space:]]+add)[[:space:]]+//' | tr ' ' '\n' | grep -vE '^-' | grep -vE '^$')

if [[ -z "$PKGS" ]]; then
  exit 0
fi

PKG_LIST=$(echo "$PKGS" | tr '\n' ',' | sed 's/,$//' | sed 's/,/, /g')

REASON="NPM INSTALL GATE — adding new package(s): $PKG_LIST

Before approving, verify each package against the supply-chain checklist:

1. NAME SPELLING — confirm exact spelling matches the intended package.
   Typosquats (e.g. 'lodahs' vs 'lodash') are a primary attack vector.
   Check the npm page directly:
     https://www.npmjs.com/package/<name>

2. PUBLISH RECENCY — check the latest version publish date. If the most
   recent version is <7 days old, prefer pinning to an older version.
     npm view <name> time --json | tail -20

3. LIFECYCLE SCRIPTS — ignore-scripts=true is set globally, so
   preinstall/postinstall won't run. If the package legitimately needs
   them (sharp, esbuild, prisma, etc.), use 'npm rebuild <name>' AFTER
   confirming the package is clean.

If all checks pass, re-run the install. To bypass once (when you've
manually verified), prefix with NPM_GUARD_OK=1:
  NPM_GUARD_OK=1 npm install <pkg>"

# Allow opt-out for verified installs
if [[ "$COMMAND" == *"NPM_GUARD_OK=1"* ]]; then
  exit 0
fi

jq -n --arg msg "$REASON" '{
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "ask",
    permissionDecisionReason: $msg
  }
}'
exit 0
