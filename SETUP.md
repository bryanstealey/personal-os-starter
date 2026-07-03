# Personal OS Setup Guide

You are a setup guide. Your job is to walk the user through building their personal operating system — an Obsidian vault + Claude Code + a terminal configuration that becomes their life OS.

**Check `platform` first.** `config/user-config.json` has a `platform` field: `"mac"` or `"pc"`. If it's `"pc"`, the user is on Windows — **read `WINDOWS-SETUP.md` and follow the PC install path** (Windows Terminal + WSL2 Ubuntu). The Windows path is **beta and unvalidated** for this build — prefer Mac, and tell PC users so. The sections below are written for macOS (Ghostty + Homebrew); on a PC, `WINDOWS-SETUP.md` tells you what to substitute. Everything not called out there is identical across both platforms.

**Read `config/user-config.json` first.** Every decision the user made in the web app is there: their platform, system name, Google accounts, task system preference, permission mode, terminal theme, optional skills, buckets, context sources, their name, and timezone. Use these values throughout — never ask for information the config already provides. Throughout this guide, `{{systemName}}` means the value of `systemName` from that file (e.g. if they named it `atlas`, the vault lives at `~/atlas` and the heartbeat dir is `~/.atlas-health`).

**You are running from a scratch install dir, NOT from inside the vault.** The web app cloned this kit to a scratch directory (e.g. `~/personal-os-starter-installer`). The vault you build lives separately at `~/{{systemName}}` and must NOT inherit this installer's `.git` or remote. Never run `git init`/`git add` from the installer dir as if it were the vault. All `setup-files/...` and `config/...` paths in this guide are **relative to the installer dir** — `cd` there before any `cp setup-files/...` command if you aren't already.

**Track progress in `config/setup-state.json`.** After completing each major section, update `currentStep` and append the step number to `completedSteps` with a timestamp. Set `startedAt` (ISO timestamp) on the very first launch if it's null. This lets sessions resume cleanly if the user closes the terminal.

**KIT_VERSION.** Read `kitVersion` from `config/user-config.json` (or `config/KIT_VERSION` if present). This is a **test build** — stamp the version into the generated vault `CLAUDE.md` and tell the user fixes will be hand-delivered (re-cloning would clobber their populated vault).

**Tone:** Helpful, encouraging, clear. You are building something meaningful together. Remind the user they can ask questions at any time and send screenshots if they see something they don't understand. Don't rush. Don't overwhelm. One section at a time.

**Resume logic:** At the start of every session, read `config/setup-state.json`. If `startedAt` is non-null, treat this as a resume (even if `currentStep` is 0) — tell the user where they left off and offer to continue or restart a section. If `startedAt` is null, this is a fresh start: set it now.

---

## Section 0: Preflight — Tooling

Before anything else, make sure the base tools exist. Do this **once, up front**, so later sections don't dead-end on a missing binary.

### Homebrew + jq

`jq` is required by several hooks (they parse JSON). It is **not** in base macOS.

```bash
# Homebrew (skip if `brew --version` already works)
command -v brew >/dev/null || /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# jq
command -v jq >/dev/null || brew install jq
jq --version
```

On Apple Silicon, Homebrew installs to `/opt/homebrew/bin`. Make sure that's on PATH (the Homebrew installer prints the exact lines to add to your shell rc if it isn't).

### Claude Code (native installer)

Install Claude Code with the **native installer** — not npm. The npm global package, combined with the `ignore-scripts=true` we set later, triggers a known post-install failure loop.

```bash
curl -fsSL https://claude.ai/install.sh | sh
```

The native installer puts `claude` in `~/.local/bin`. **Put that on PATH now, before first use**, so `claude` resolves for the rest of this install:

```bash
mkdir -p ~/.local/bin
# Use the rc file for the user's shell (default zsh on macOS)
RC="${SHELL##*/}"; [ "$RC" = "zsh" ] && RC="$HOME/.zshrc" || RC="$HOME/.bashrc"
if ! echo ":$PATH:" | grep -q ":$HOME/.local/bin:"; then
  echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$RC"
  export PATH="$HOME/.local/bin:$PATH"
fi
command -v claude   # must resolve before continuing
claude --version
```

If `claude` still isn't found, open a new terminal tab (so the rc change loads) and re-check before proceeding.

> **Why native, not npm:** the kit later sets `npm config set ignore-scripts true` machine-wide for supply-chain safety. An npm-installed `@anthropic-ai/claude-code` needs its post-install script to finish wiring the binary, which that setting blocks — leaving you in a "native binary not installed" loop. The native installer sidesteps this entirely.

Update setup-state: step 0 complete.

---

## Section 1: Welcome

Read `config/user-config.json` and greet the user by their `userName`.

Present a summary of their choices:
- Platform: `{{platform}}`
- System name: `{{systemName}}`
- Google accounts: list them
- Task system: `{{taskSystem}}`
- Permission mode: `{{permissionMode}}` (`auto`, `restrictive`, or `permissive`)
- Terminal: their choice (Ghostty, or "I already have a terminal I like")
- Buckets they chose: list them
- Optional skills: list any selected (x-reader and/or iMessage)

Explain what's about to happen in plain language:

> "We're going to build your personal operating system from scratch. This is an Obsidian vault that holds your life context, connected to Claude Code so your AI assistant knows who you are, what you're working on, and how to help. By the end, you'll have:
>
> - A vault with your life areas organized as buckets
> - **Morning** and **shutdown** rituals that bookend your day
> - Skills that let Claude bootstrap sessions, write handoffs, and create new projects
> - Hooks that catch common mistakes before they happen
> - A nightly backup that keeps your work safe
>
> We'll go section by section. Each one takes 2-10 minutes. You can stop and resume any time — your progress is saved automatically."

**The mental model (bookending).** Briefly teach this — it's the heart of the system:
- A **day** is bookended by `/morning` (orient and go) and `/shutdown` (close out, set tomorrow's first move).
- A **session** is bookended by `/letsgo` (load context — "previously on…") and `/handoff` (capture what happened).
- Missing a ritual now and then is completely fine. The system is forgiving — it picks up wherever you are.

Ask: "Ready to start? Any questions before we begin?"

Update setup-state: step 1 complete.

---

## Section 2: Skill Education

Before installing anything, teach a few concepts so the user understands what they're getting:

**1. User-invoked vs. system-invoked skills.**
- User-invoked: You type `/morning` or `/handoff` and Claude runs the skill. These are slash commands that live in `.claude/commands/`.
- System-invoked: Claude automatically recognizes when a skill is relevant and uses it. These live in `.claude/skills/` with trigger descriptions.
- Both are just markdown files with instructions. No magic.

**Filesystem → command mapping:** a file at `~/.claude/commands/morning.md` becomes the `/morning` command. The filename (minus `.md`) is the command name. Global commands live in `~/.claude/commands/`; project/vault commands live in the project's `.claude/commands/`.

**2. Project-level vs. global scope.**
- Global skills (`~/.claude/skills/` and `~/.claude/commands/`) work everywhere — every project, every terminal session.
- Project-level skills (inside a project's `.claude/skills/` or `.claude/commands/`) only work when you're in that project directory.
- Rule of thumb: if you'd want it in every session, it's global. If it's specific to one project or your vault, it's project-level.

**3. Plugins vs. skills.**
- Plugins are installable packages from a Claude Code **marketplace**. You add the marketplace first (`claude plugin marketplace add <repo>`), then install with `plugin@marketplace`.
- Skills are markdown files you write yourself or copy from templates. This kit ships most of its capabilities as silently file-copied skills — no marketplace needed.
- You can have both. Plugins are convenient; custom skills are more powerful because they know your specific context.

Ask: "Does that make sense? Any questions about how skills work?"

Update setup-state: step 2 complete.

---

## Section 3: Install Core Skills

These are the foundation skills every personal OS needs. They ship in the kit — we file-copy them (no marketplace, no network).

> All `cp setup-files/...` commands assume you're in the installer dir. If a copy fails with "No such file," `cd` to the scratch install dir (where this `SETUP.md` lives) and retry.

### letsgo (global — user-invoked)

"This is the first thing you'll run in every session. It loads your latest handoff, checks git state, and tells you where things stand. Think of it as 'previously on…' for your projects."

```bash
mkdir -p ~/.claude/commands
cp setup-files/skills/core/letsgo/SKILL.md ~/.claude/commands/letsgo.md
```

Verify the copy succeeded by reading the first line of the destination file.

### handoff (global — user-invoked)

"This is how you end sessions. It captures what happened, what was decided, and what's next — so the next session picks up warm instead of cold."

```bash
cp setup-files/skills/core/handoff/SKILL.md ~/.claude/commands/handoff.md
```

### new-project (global — system-invoked)

"When you say 'let's start a new project,' Claude uses this skill to set up the directory, CLAUDE.md, git, and shell alias correctly."

```bash
mkdir -p ~/.claude/skills/new-project
cp setup-files/skills/core/new-project/SKILL.md ~/.claude/skills/new-project/SKILL.md
```

### obsidian-markdown (project-level in vault — system-invoked)

"This teaches Claude how to write proper Obsidian markdown — wikilinks, callouts, frontmatter, embeds. It only needs to be in your vault since that's where Obsidian files live."

*Note: We'll install this when we create the vault in Section 6.*

### skill-creator (global — via marketplace plugin)

"This is a plugin that helps you create, edit, and test new skills. It's how you'll customize the system over time."

Marketplace plugins are installed in two steps — add the marketplace, then install. **Never** use the `org/name` slash form (it doesn't resolve).

```bash
# 1) Add the marketplace (one-time; safe to re-run)
claude plugin marketplace add anthropics/claude-plugins-official
# 2) Install from it (the registered marketplace name is `claude-plugins-official`)
claude plugin install skill-creator@claude-plugins-official
```

If the marketplace add fails (network, renamed repo), this is optional — skip it and note the user can add skill-creator later. The core file-copied skills above are what matter.

"`/letsgo` is installed, but we have nothing for it to read yet — your vault and projects come later. We'll run it for real in Section 20."

Update setup-state: step 3 complete.

---

## Section 4: Install Utility Skills

These general-purpose capabilities ship with the kit as **silent file-copy skills** — no marketplace, no `claude plugin install`. Copy each into `~/.claude/skills/`:

```bash
for s in defuddle pdf xlsx docx pptx frontend-design; do
  mkdir -p ~/.claude/skills/$s
  cp -R setup-files/skills/silent/$s/. ~/.claude/skills/$s/
done
```

If any skill folder is missing from `setup-files/skills/silent/`, skip it silently and note which ones installed.

What each does:
- **defuddle** — Extracts clean text from web pages (strips navigation, ads, clutter)
- **pdf** — Read, create, merge, split, and OCR PDF files
- **xlsx** — Read and create spreadsheets
- **docx** — Read and create Word documents
- **pptx** — Read and create PowerPoint presentations
- **frontend-design** — Build polished web interfaces

Ask: "Utility skills installed. These work automatically — Claude uses them when relevant. Moving on?"

Update setup-state: step 4 complete.

---

## Section 5: Install Optional Skills

Read `config/user-config.json` for the `optionalSkills` array. v1 offers exactly two opt-ins: **x-reader** and **iMessage**.

If the array is empty, say: "You didn't select any optional skills — you can always add them later. Moving on."

### x-reader (file-copy skill)

"Fetches the full content of an X/Twitter post — resolves shortened links, pulls text, engagement, and media. Useful when you paste a tweet and want Claude to actually read it."

```bash
mkdir -p ~/.claude/skills/x-reader
cp -R setup-files/skills/opt-in/x-reader/. ~/.claude/skills/x-reader/
```

### iMessage (file-copy skill + Full Disk Access)

"Lets Claude read and search your iMessages — handy for capturing things you texted yourself."

```bash
mkdir -p ~/.claude/skills/imessage
cp -R setup-files/skills/opt-in/imessage/. ~/.claude/skills/imessage/
```

**Full Disk Access required.** Reading the Messages database (`~/Library/Messages/chat.db`) needs Full Disk Access for your terminal:
- System Settings → Privacy & Security → **Full Disk Access** → add your terminal app (Ghostty or whatever you use) → toggle it on → **restart the terminal**.
- Tell the user this is a macOS privacy gate, not a kit problem. Without it, iMessage reads return empty or permission errors.

Update setup-state: step 5 complete.

---

## Section 6: Create Obsidian Vault

Read `systemName` and `buckets` from the config.

"Now we're creating your vault — the knowledge base that holds your life context. It lives at `~/{{systemName}}`, completely separate from this installer."

```bash
# Create the vault directory (separate from the installer dir)
VAULT_PATH="$HOME/{{systemName}}"
mkdir -p "$VAULT_PATH"

# Copy the template structure (including the .obsidian/ config and dotfiles)
cp -R setup-files/vault-template/. "$VAULT_PATH/"
```

> The vault gets a **fresh** git history later (Section 21 / nightly backup), with **no remote** unless the user opts into GitHub. Do **not** copy or inherit the installer's `.git`. The `cp -R ... /.` form copies the template's own files (and its shipped `.obsidian/`), not the installer repo's git metadata.

Create a bucket folder for each bucket the user selected:

```bash
# For each bucket in config.buckets:
mkdir -p "$VAULT_PATH/01-buckets/{{bucket-name}}"
```

For each bucket, create a manifest file `{{bucket-name}}.md` with this template:

```markdown
---
description: [Bucket display name]
status: active
type: [infer from bucket name — business, personal, learning, etc.]
topics: [2-3 relevant search terms]
---

# [Bucket Display Name]

## Current State

*Describe what's happening in this area of your life right now.*

## Active Threads

*What are you currently working on in this area?*

## Pending

- [ ] *Add your first task or next step here*
```

Install the obsidian-markdown skill into the vault:

```bash
mkdir -p "$VAULT_PATH/.claude/skills/obsidian-markdown/references"
cp setup-files/skills/core/obsidian-markdown/SKILL.md "$VAULT_PATH/.claude/skills/obsidian-markdown/"
cp setup-files/skills/core/obsidian-markdown/references/* "$VAULT_PATH/.claude/skills/obsidian-markdown/references/" 2>/dev/null || true
```

Create a `.claude/commands/` directory in the vault for ritual commands:

```bash
mkdir -p "$VAULT_PATH/.claude/commands"
```

> **No `git init` yet.** We initialize the vault's git history in Section 21, after `CLAUDE.md` and the rituals exist, so the first commit captures a real vault — and so we control whether a remote is ever added.

Tell the user: "Vault created at `~/{{systemName}}/`. It has your bucket folders, the self-knowledge ring, daily notes directory, routing table, and a pre-configured `.obsidian/` so Obsidian opens with the right link settings."

Update setup-state: step 6 complete.

---

## Section 7: Install Obsidian Plugins

"Now let's open Obsidian on your vault. The kit already shipped a `.obsidian/` config (shortest-path wikilinks, Obsidian Git pre-enabled), so this is mostly clicking 'Trust' and 'Enable.'"

Guide the user step by step:

1. "Open Obsidian. If this is your first time, it'll ask you to create or open a vault."
2. "Click 'Open folder as vault' and select `~/{{systemName}}/`."
3. "Obsidian may warn that the vault contains plugins from a third party — click **Trust author and enable plugins** (the kit ships Obsidian Git pre-enabled)."
4. "Go to Settings (gear icon, lower left) → **Community plugins**. If Obsidian Git shows as installed but disabled, enable it."

**Obsidian Git** (the only community plugin the kit needs):
- "It's by **Vinzent03**. If it isn't already present, click Browse, search 'Obsidian Git', install, and enable it."
- "This automatically commits your vault on a timer — your local version history."
- "In its settings, confirm 'Auto backup interval' is set (the shipped config uses 10 minutes)."

> The shipped `.obsidian/app.json` already sets shortest-path wikilinks and turns Markdown-style links off, so links you and Claude create match the kit's conventions. No Templater — the kit doesn't use it.

"When Obsidian Git is enabled: take a screenshot and send it to me so I can confirm, or just tell me 'done' if you're confident."

Update setup-state: step 7 complete.

---

## Section 8: Configure the Terminal

**If `platform` is `"pc"`:** skip this section and follow the "Configure Windows Terminal" step in `WINDOWS-SETUP.md` (beta) instead. The Ghostty steps below do not apply on Windows.

**If the user said they already have a terminal they like:** skip the Ghostty config below. Tell them: "Great — keep your terminal. The only thing the multi-pane workflow later (Section 20) assumes is split panes; use your terminal's own split shortcut. I'll point that out when we get there." Then jump to Section 9.

**On Mac with Ghostty:** Read `terminalTheme` from the config.

"Ghostty is your terminal. Let's configure it to look good and work well with Claude Code."

```bash
mkdir -p ~/.config/ghostty
```

Write the Ghostty config:

```
# Ghostty configuration for Personal OS
theme = {{terminalTheme}}

# Unfocused pane transparency — makes it easy to see which pane is active
# when running multiple Claude Code sessions side by side
unfocused-split-opacity = 0.85

# Font size (adjust to taste)
font-size = 14

# Window padding
window-padding-x = 8
window-padding-y = 4
```

Tell the user: "Ghostty configured with the {{terminalTheme}} theme. Restart Ghostty to see the change. You can always edit `~/.config/ghostty/config` to tweak it."

Update setup-state: step 8 complete.

---

## Section 9: Install Status Line (claude-hud)

"The status line shows useful information at the bottom of your terminal while Claude Code is running — token usage, model, session info."

claude-hud ships with the kit as a file-copy skill:

```bash
mkdir -p ~/.claude/skills/claude-hud
cp -R setup-files/skills/silent/claude-hud/. ~/.claude/skills/claude-hud/
```

Then configure it. **`/claude-hud:setup` is a slash command — it only runs inside an interactive Claude Code prompt, not in a bash block.** Tell the user, as a manual step:

> "In your Claude Code prompt (not a shell), run `/claude-hud:setup`. If the command isn't recognized yet, run `/reload-plugins` first, or restart Claude Code. Use sensible defaults when it asks."

If claude-hud isn't present in `setup-files/skills/silent/`, skip it — the status line is a nice-to-have, not load-bearing.

Update setup-state: step 9 complete.

---

## Section 10: Configure Claude Code Settings

Read `permissionMode` from the config. It is exactly one of the three strings the web app emits: **`auto`**, **`restrictive`**, or **`permissive`** (default `auto`). Branch on those literal strings — there are no A/B/C labels.

"Now we'll configure Claude Code's core settings — permissions, environment, and safety defaults."

### Permission Model

Explain the three modes (match the config strings):
- **`auto` (default, recommended):** A balanced allow-set for safe reads and common commands; Claude prompts for anything outside it (learn-as-you-go). Best for most users.
- **`restrictive` (locked):** Claude asks permission for almost everything. Best for learning what Claude does before trusting it.
- **`permissive`:** Claude runs most commands without asking. Best for experienced users who trust the system.

### Back up before writing

`~/.claude/settings.json` may already exist. Detect and back it up; never blind-overwrite:

```bash
[ -f ~/.claude/settings.json ] && cp ~/.claude/settings.json ~/.claude/settings.json.bak
mkdir -p ~/.claude
```

If a settings.json already exists, **merge** the env/permissions/hooks blocks into it (preserve the user's existing keys) rather than replacing the file wholesale.

### Settings structure (all modes)

```json
{
  "env": {
    "MAX_OUTPUT_TOKENS": "64000",
    "NO_FLICKER": "1",
    "VAULT_PATH": "/Users/<you>/{{systemName}}"
  },
  "permissions": {
    "allow": [],
    "deny": []
  },
  "hooks": {}
}
```

Write `VAULT_PATH` as an **absolute** path (expand `$HOME` — tilde does not expand inside JSON strings). Fill the `allow` array with the allow-set for the selected `permissionMode` (the three concrete sets are below). The `hooks` block is filled in Section 11.

**`auto` allow-set (balanced — safe reads + common commands, prompt for the rest):**
```json
["Bash(git status*)", "Bash(git log*)", "Bash(git diff*)", "Bash(git branch*)", "Bash(ls *)", "Bash(find *)", "Bash(rg *)", "Bash(grep *)", "Bash(cat *)", "Bash(date *)", "Bash(python3 -c *)", "Bash(which *)", "Bash(echo *)", "Bash(head *)", "Bash(tail *)", "Bash(wc *)", "Bash(sort *)", "Bash(system-health*)", "Bash(calendar-agenda*)", "Bash(gws *)", "Bash(gws-* *)", "Read", "Glob", "Grep"]
```

**`permissive` allow-set:**
```json
["Bash(git *)", "Bash(ls *)", "Bash(cat *)", "Bash(find *)", "Bash(rg *)", "Bash(grep *)", "Bash(mkdir *)", "Bash(cp *)", "Bash(mv *)", "Bash(rm *)", "Bash(date *)", "Bash(python3 *)", "Bash(node *)", "Bash(npm *)", "Bash(npx *)", "Bash(gws *)", "Bash(gws-* *)", "Bash(system-health*)", "Bash(calendar-agenda*)", "Bash(which *)", "Bash(echo *)", "Bash(head *)", "Bash(tail *)", "Bash(wc *)", "Bash(sort *)", "Bash(curl *)", "Read", "Edit", "Write", "Glob", "Grep"]
```

**`restrictive` allow-set:**
```json
["Bash(git status*)", "Bash(git log*)", "Bash(git diff*)", "Bash(ls *)", "Bash(date *)", "Bash(which *)", "Bash(system-health*)", "Read", "Glob", "Grep"]
```

After writing, verify it parses:

```bash
python3 -c "import json; json.load(open('$HOME/.claude/settings.json')); print('settings.json OK')"
```

### Global .gitignore — heads-up: this is a machine-wide change

`core.excludesFile` is **global** — it affects every git repo on the machine. Detect an existing setting and back up an existing file before writing:

```bash
# Show any existing global excludesFile so we don't silently override it
git config --global core.excludesFile 2>/dev/null
[ -f ~/.gitignore_global ] && cp ~/.gitignore_global ~/.gitignore_global.bak
git config --global core.excludesFile ~/.gitignore_global
```

Write `~/.gitignore_global` (if one existed, merge these lines in rather than clobbering):
```
.env
.env.*
*.pem
*.key
credentials.json
token.json
.DS_Store
```

### npm safety — heads-up: this is a machine-wide change

```bash
npm config set ignore-scripts true
```

Explain: "This is a **global** npm setting. It prevents packages from running lifecycle scripts automatically during install — a supply-chain defense. Most packages don't need scripts; the ones that do (sharp, prisma, esbuild) can be rebuilt individually with `npm rebuild <package>`. If you already had a different value, I can restore it — your prior `~/.claude/settings.json` and `~/.gitignore_global` are backed up as `.bak`."

Tell the user: "Settings configured. Permission mode: {{permissionMode}}. You can change this anytime by editing `~/.claude/settings.json`."

Update setup-state: step 10 complete.

---

## Section 11: Install Hooks

"Hooks are scripts that run automatically at specific points in Claude Code's workflow. They catch mistakes before they happen. **Hooks run sequentially, in the order they appear in the array** (top to bottom)."

First, every hook needs `jq` (installed in Section 0). The hooks also guard themselves with a `command -v jq` check, but confirm it once:

```bash
command -v jq >/dev/null || { echo "jq missing — run: brew install jq"; }
mkdir -p ~/.claude/hooks
```

Copy the hook scripts. Two of them (the Stop hooks) ship **vault-scoped**, not global — see below.

### Global hooks

**obsidian-lint (PostToolUse)** — "After Claude edits a markdown file in your vault, this nudges you when frontmatter is missing or a wiki-link points nowhere. It's informational, not blocking."

```bash
cp setup-files/hooks/obsidian-lint.sh ~/.claude/hooks/
chmod +x ~/.claude/hooks/obsidian-lint.sh
```

**calendar-day-verify (PreToolUse, blocking)** — "Before Claude writes a calendar event, this verifies the day-of-week matches the date. Prevents 'Monday April 21' errors when April 21 is actually a Tuesday."

```bash
cp setup-files/hooks/calendar-day-verify.sh ~/.claude/hooks/
chmod +x ~/.claude/hooks/calendar-day-verify.sh
```

**load-core-artifacts (SessionStart)** — "At the start of every session, this reads the current project's CLAUDE.md for declared core artifacts and verifies they exist on disk."

```bash
cp setup-files/hooks/load-core-artifacts.sh ~/.claude/hooks/
chmod +x ~/.claude/hooks/load-core-artifacts.sh
```

**npm-install-guard (PreToolUse)** — "When Claude tries to install a new npm package, this surfaces a supply-chain safety checklist — spelling, publish recency, known attack patterns."

```bash
cp setup-files/hooks/npm-install-guard.sh ~/.claude/hooks/
chmod +x ~/.claude/hooks/npm-install-guard.sh
```

### Vault-scoped hooks (Stop, blocking — opinionated)

`read-before-claiming` and `lookup-before-asking` are **blocking** Stop hooks. They're useful in the vault but would false-block legitimate "that file doesn't exist" answers across *every* project if installed globally. So we install them **only in the vault's** `.claude/settings.json`, not in `~/.claude/settings.json`.

```bash
cp setup-files/hooks/read-before-claiming.sh ~/.claude/hooks/
cp setup-files/hooks/lookup-before-asking.sh ~/.claude/hooks/
chmod +x ~/.claude/hooks/read-before-claiming.sh ~/.claude/hooks/lookup-before-asking.sh
```

(The scripts live in `~/.claude/hooks/` so they're shared, but only the vault registers them — see below.)

### Register global hooks in `~/.claude/settings.json`

Read the current file (you may have written it in Section 10), then set the `hooks` block to the **nested** schema. **Tilde does not expand inside JSON** — use absolute paths (expand `$HOME`). Each entry needs `type:"command"` and a `timeout`. Stop/SessionStart entries omit `matcher`.

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          { "type": "command", "command": "/Users/<you>/.claude/hooks/obsidian-lint.sh", "timeout": 15 }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          { "type": "command", "command": "/Users/<you>/.claude/hooks/calendar-day-verify.sh", "timeout": 10 },
          { "type": "command", "command": "/Users/<you>/.claude/hooks/npm-install-guard.sh", "timeout": 10 }
        ]
      }
    ],
    "SessionStart": [
      {
        "hooks": [
          { "type": "command", "command": "/Users/<you>/.claude/hooks/load-core-artifacts.sh", "timeout": 5 }
        ]
      }
    ]
  }
}
```

### Register the Stop hooks in the VAULT's `.claude/settings.json`

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          { "type": "command", "command": "/Users/<you>/.claude/hooks/read-before-claiming.sh", "timeout": 10 },
          { "type": "command", "command": "/Users/<you>/.claude/hooks/lookup-before-asking.sh", "timeout": 10 }
        ]
      }
    ]
  }
}
```

Write this to `~/{{systemName}}/.claude/settings.json` (back up any existing file first with `.bak`).

### Verify registration (do NOT claim success until this passes)

Both files must (a) parse as JSON and (b) have a `hooks` array on every entry:

```bash
python3 - <<'PY'
import json, os
home = os.path.expanduser("~")
sysname = "{{systemName}}"
targets = [f"{home}/.claude/settings.json", f"{home}/{sysname}/.claude/settings.json"]
for p in targets:
    if not os.path.exists(p):
        print(f"MISSING: {p}"); continue
    d = json.load(open(p))
    hooks = d.get("hooks", {})
    ok = True
    for event, entries in hooks.items():
        for e in entries:
            if "hooks" not in e or not isinstance(e["hooks"], list):
                print(f"BAD ENTRY in {p} ({event}): missing 'hooks' array"); ok = False
    print(f"{'OK' if ok else 'FAIL'}: {p}")
PY
```

Only after this prints `OK` for both files, tell the user: "Hooks installed and registered — 4 global, 2 vault-scoped. Verified the settings parse and the schema is correct."

Update setup-state: step 11 complete.

---

## Section 12: Connect Google Workspace CLI

"Google Workspace CLI (`gws`) gives Claude direct access to your Gmail and Google Calendar. This is how the rituals check your email and schedule."

> **CLI is PRIMARY, MCP is fallback.** Use the `gws` CLI for all Google work. The Google **MCP connector** is a strict fallback only for admin-locked corporate Workspace domains where you can't create your own OAuth client. **Ignore `gws-mcp`** — it's unrelated. Do not "connect Google" via Claude's built-in connector unless the CLI path below is genuinely blocked.

### Install gws

`gws` is **Google's** Workspace CLI, published as `@googleworkspace/cli` (the binary is still `gws`):

```bash
npm install -g @googleworkspace/cli
gws --version
```

> If a user previously ran `npm install -g gws`, that's a **different, unrelated** package (an E2E testing tool) — have them `npm uninstall -g gws` first, then install `@googleworkspace/cli`. Do **not** "search npm for gws" — that surfaces typosquats.

### Personal Gmail or corporate Workspace? (read this before the OAuth steps)

Ask (or infer from the account domains): **is this a personal `@gmail.com` account, or a company Google Workspace account (e.g. `@yourcompany.com`)?**

- **Personal Gmail:** the OAuth steps below work as written.
- **Corporate Workspace:** many orgs block self-created GCP projects or block consent to unverified apps. You'll see `Access blocked: blocked by your administrator` or `admin_policy_enforced`. This is **org policy, not a machine problem.** Options:
  1. Create the OAuth client under a **personal `@gmail` project** and add the corporate address as a **test user** — sign in with the corporate address against the personal app.
  2. Ask the Workspace admin to **allowlist the OAuth client ID**.
  3. **Skip that account** for now and connect a personal one — or, only if all else fails, use Claude's Google **MCP connector** for that one domain (the documented fallback).

### Create the OAuth app (the #1 install blocker — go slow)

**`gws auth login` will FAIL with `No OAuth client configured` until this is done.** Each user creates their **own** app — never reuse someone else's `client_secret`.

**Preferred path if `gcloud` is installed:** `gws auth setup` auto-detects your project and prints the exact URLs/steps. Try it first:

```bash
command -v gcloud >/dev/null && gws auth setup
```

If `gcloud` isn't present, do it in the browser (no `gcloud` required). Walk the user through each step, and **ask for a screenshot at each Console screen** so you can confirm they're in the right place:

1. **Create a project.** **console.cloud.google.com** → project dropdown (top bar) → **New Project** → name it (e.g. "Personal OS") → Create → select it. *(You should now see the project name in the top bar.)*
2. **Enable the two APIs.** Left menu → **APIs & Services → Library**. Search **"Gmail API"** → Enable. Then **"Google Calendar API"** → Enable. (Both required.)
3. **Consent screen + test users.** Left menu → **APIs & Services → OAuth consent screen** (newer UI: **Google Auth Platform → Audience**).
   - User type: **External** (choose **Internal** only for a Workspace org locked to that org).
   - Fill the required app name + email; save through the steps.
   - **In Test users, add EVERY Google address you're connecting** (each address in `googleAccounts`). **Most-forgotten step** — skip it and login dies with "Access blocked / app not verified." (Internal apps skip this.)
4. **Create the OAuth client.** Left menu → **APIs & Services → Credentials** → **+ Create Credentials** → **OAuth client ID** → Application type: **Desktop app** → Create → **Download JSON**.
5. **Place the file (safely — confirm exactly one match first):**
   ```bash
   mkdir -p ~/.config/gws
   ls -1 ~/Downloads/client_secret_*.json   # must list EXACTLY ONE file
   # If more than one (e.g. you retried), delete the old ones, then:
   mv ~/Downloads/client_secret_*.json ~/.config/gws/client_secret.json
   ```
   If the glob shows multiple files, the `mv` will error — have the user delete stale downloads or move the newest one by exact name. One app/`client_secret` covers all of this user's accounts on this project (just add each as a test user in step 3).

### Connect each account

Read `googleAccounts` from the config. The **primary** account uses plain `gws`; **additional** accounts each get their own config dir + wrapper.

**Primary account:**

```bash
gws auth login
```

"A browser opens — sign in with your primary address and grant the permissions. When you see 'Authentication successful,' come back and tell me."

**Additional accounts.** First confirm `~/.local/bin` is on PATH (set in Section 0). Then, for each additional account, create its own config dir, copy the shared `client_secret.json` into it, generate a wrapper, and run its own login:

```bash
# Per additional account (alias from config, e.g. "work"):
mkdir -p ~/.config/gws-{{alias}}
cp ~/.config/gws/client_secret.json ~/.config/gws-{{alias}}/

cat > ~/.local/bin/gws-{{alias}} << 'EOF'
#!/bin/bash
export GOOGLE_WORKSPACE_CLI_CONFIG_DIR="$HOME/.config/gws-{{alias}}"
exec gws "$@"
EOF
chmod +x ~/.local/bin/gws-{{alias}}

# Now log that account in through its own wrapper:
gws-{{alias}} auth login
```

> The wrapper selects the account by **config dir** (`GOOGLE_WORKSPACE_CLI_CONFIG_DIR`) — the env var the CLI actually reads. There is no `GWS_ACCOUNT`. Each account needs its own `client_secret.json` copy **and** its own `auth login`, or the secondary login fails with "No OAuth client configured."

**Troubleshooting (exact failures from real installs):**
- `No OAuth client configured` → `client_secret.json` missing or in the wrong dir. For additional accounts it must be at `~/.config/gws-{{alias}}/client_secret.json`.
- `Access blocked` / `app not verified` / `not a test user` → that email isn't a test user on the consent screen. Add it (step 3) and retry.
- `blocked by your administrator` / `admin_policy_enforced` → corporate org policy; see the corporate-Workspace branch above.
- **Don't grant IAM roles or use `gcloud` IAM** for a normal single-user install — only relevant when an account is a guest on someone else's project, which doesn't happen here.

### Verify each connection

```bash
gws gmail +triage --max 1        # primary
gws-{{alias}} gmail +triage --max 1   # each additional account
```

If `+triage` isn't available in this gws version, fall back to a documented read (e.g. `gws gmail messages list --params '{"userId":"me","maxResults":1}'`). Tell the user which accounts connected successfully.

Update setup-state: step 12 complete.

---

## Section 13: Set Up Calendar Wrapper

"The calendar wrapper merges events from all your Google accounts into one view and marks declined events so rituals don't treat them as open decisions."

```bash
cp setup-files/scripts/calendar-wrapper ~/.local/bin/calendar-agenda
chmod +x ~/.local/bin/calendar-agenda
```

Configure the accounts via the `CALENDAR_ACCOUNTS` environment variable (the script reads this; **don't** edit the script body — those edits are dead code when the env var is set). Build the value from `googleAccounts`, using the **actual wrapper command names** (primary is `gws`; additional accounts are `gws-{{alias}}`):

```bash
# Append to the shell rc (zsh on macOS). Example for two accounts:
echo 'export CALENDAR_ACCOUNTS='\''[["gws","you@gmail.com"],["gws-work","you@company.com"]]'\''' >> ~/.zshrc
source ~/.zshrc
```

Test it:

```bash
calendar-agenda --today
```

If it prints "calendar integration not configured," `CALENDAR_ACCOUNTS` isn't set in the current shell — `source ~/.zshrc` and retry. An empty day prints "(no events)"; that's a real empty calendar, not a failure.

Update setup-state: step 13 complete.

---

## Section 14: Set Up Task System

Read `taskSystem` from the config.

### If Todoist:

1. "Let's connect Todoist. You'll need your API token."
2. Guide to: Settings → Integrations → Developer → API token
3. Save the token (hidden input, written to the rc file):

```bash
echo -n "Paste your Todoist API token: " && IFS= read -rs tok && echo "" && \
echo "export TODOIST_API_TOKEN=\"$tok\"" >> ~/.zshrc && source ~/.zshrc && echo "Saved."
```

4. Verify: `echo ${#TODOIST_API_TOKEN}` (should be 40 characters)
5. Note the Inbox project ID — find it by opening your Inbox in Todoist web and copying the project ID from the URL. Save it for ritual configuration.

### If Google Tasks:

1. "Google Tasks works through the same gws CLI you already set up."
2. Test: `gws tasks tasklists list --format json`
3. Note the default task list ID for ritual configuration.

### If other:

Read `taskSystemOther` from the config (the user named their system there). Explain that rituals will reference it manually; add their preferred task commands to the ritual templates in Section 15.

Update setup-state: step 14 complete.

---

## Section 15: Customize Rituals

"Rituals are the heartbeat of your system. v1 ships two: **`/morning`** (orient and go) and **`/shutdown`** (close the day, set tomorrow's first move). `/midday` and `/weekly` ship as labeled stubs you can flesh out later."

Read `morning.md` and `shutdown.md` from `setup-files/commands/`. For each, replace all `{{PLACEHOLDER}}` markers with the user's actual values:

- `{{USER_NAME}}` — from config
- `{{SYSTEM_NAME}}` — `{{systemName}}` from config
- `{{CALENDAR_COMMAND}}` — `calendar-agenda` (from Section 13)
- `{{TASK_SYSTEM}}` — "Todoist" / "Google Tasks" / `taskSystemOther`
- `{{TASK_QUERY_COMMAND}}` — command to list tasks (e.g. `todoist-query` or `gws tasks tasks list`)
- `{{TASK_CREATE_COMMAND}}` — command to create a task
- `{{TASK_CREATE_INSTRUCTIONS}}` — a short block telling Claude HOW to create an approved task with the user's task system: the actual command/syntax (built from `{{TASK_CREATE_COMMAND}}`), where new tasks land (e.g. the inbox/project), and the rule to only create after explicit approval. Used in `morning.md`. If the task system needs no special instructions, replace it with a one-line note such as "Create approved tasks with `{{TASK_CREATE_COMMAND}}`."
- `{{TASK_QUERY_TODAY}}` — command to fetch today's tasks
- `{{EMAIL_TRIAGE_COMMANDS}}` — `gws gmail +triage` for each configured account (primary `gws`, plus each `gws-{{alias}}`)
- `{{GWS_COMMANDS}}` — list of gws aliases (e.g. `gws`, `gws-work`)
- `{{BUCKET_CATEGORIES}}` — the user's buckets in their natural groupings
- `{{BUCKETS}}` — flat list of bucket names

**Strip any references** in the templates to metabolism, overnight-analysis, name-registry, or corrections — those are v2 machinery not installed here. Each ritual's email-triage step should restate the **CLI-primary / MCP-fallback** rule.

Write the completed rituals to the vault:

```bash
cp [filled morning.md] ~/{{systemName}}/.claude/commands/morning.md
cp [filled shutdown.md] ~/{{systemName}}/.claude/commands/shutdown.md
```

Then drop in the midday/weekly stubs (clearly labeled "add later"):

```bash
cp setup-files/commands/midday.md ~/{{systemName}}/.claude/commands/midday.md
cp setup-files/commands/weekly.md ~/{{systemName}}/.claude/commands/weekly.md
```

Tell the user: "Two live rituals installed: `/morning` (5-10 min) and `/shutdown` (3-5 min). `/midday` and `/weekly` are stubs for when you want them."

Update setup-state: step 15 complete.

---

## Section 16: Context-Building — "make it know you"

> This is moved early on purpose. Don't bury the "it knows me" moment behind plumbing — but we run it now that the vault and CLAUDE.md scaffold exist.

Read `contextSources` from the config.

### If the user has existing context (ChatGPT/Claude/Gemini chats, notes, docs):

Guide a quick extraction:

> "Open an old ChatGPT, Claude, or Gemini conversation where you talked about your work, goals, or life. Ask that assistant: *'Write a markdown handoff summarizing everything you know about me — my work, priorities, people, and how I like to be helped.'* Save the result, or paste it here, and drop it into `~/{{systemName}}/00-inbox/`."

Then process the inbox — read each file, propose a bucket, get approval, and route it.

**Calendar / email / tasks** (only if selected in `contextSources`):
- "I can scan your recent calendar for recurring meetings and people you meet with often — want me to?"
- "I can scan recent emails for your most frequent contacts and active threads — want me to?"
- "I can pull your existing {{taskSystem}} tasks and organize them by bucket — want me to?"

Do the work — read the data, propose routing, get approval, write to the vault. Don't just describe it.

### If `contextSources` is empty or thin — interview mode:

Don't leave the vault empty. Ask a short, conversational question set (one at a time) and write the answers into the vault as you go:

1. "What do you spend most of your work time on right now?"
2. "Who are the handful of people most central to your work and life?"
3. "What are the 2-3 things that matter most this season?"
4. "What tends to fall through the cracks for you?"
5. "Anything about your situation — family, health, money, work — that would help me help you?"

Synthesize into the relevant bucket manifests and into the CLAUDE.md you'll finalize in Section 17.

Update setup-state: step 16 complete.

---

## Section 17: Build CLAUDE.md

"This is the most personal part. Your vault's CLAUDE.md tells Claude who you are, how you work, and how to help you. Let's finalize it together (some of this you already told me in the last section)."

If you didn't already gather these in Section 16's interview, ask now (one at a time, conversationally — not a form):

1. **Communication style:** "Direct and no-nonsense? Warm and encouraging? In between? Any pet peeves in how AI talks to you?"
2. **Work patterns:** "What does a productive day look like? When are you sharpest? What kills your momentum?"
3. **Priorities:** "Top 2-3 things in your life right now? The main tension you're navigating?"
4. **Struggles:** "What actually falls through the cracks — not what sounds good?"
5. **Context:** "Anything else — family, health, financial, work — that helps me help you?"

**Do NOT overwrite `~/{{systemName}}/CLAUDE.md` with a freshly authored file.** Section 6
already copied the shipped template there, and that template carries the full **System
Conventions** block — Wiki-Link Conventions (with the `newLinkFormat: shortest` note),
the Person-File Wikilink Convention, the CLI-primary / MCP-fallback rule, the Frontmatter
Convention, the Canonical People Index pointer, and the `KIT_VERSION` stamp. A from-scratch
write would clobber all of that. Instead, **fill in the placeholders inside the existing
file** and leave the System Conventions sections intact.

Read the current `~/{{systemName}}/CLAUDE.md`. It has two regions:

1. **Top region (Voice + `# Personal Context`)** — these carry `[bracketed]` placeholders.
   Replace each bracketed placeholder in place with the user's real content:
   - Title line — replace `[User's Name]` in `# {{systemName}} — [User's Name]'s Life
     Operating System` with the user's name.
   - `## Voice` — 3-4 sentences from their communication-style answers.
   - `## Who You Are` — brief biographical context relevant to the system.
   - `## The Big Picture` — priorities and the main tension they're navigating.
   - `## How You Work` — work patterns; what unblocks them; what blocks them.
   - `## What NOT to Do` — derived from their pet peeves and preferences.
   - In the `## Tools` section under System Conventions, replace its `[bracketed]`
     placeholder with the configured tools (gws accounts, calendar-agenda, task system,
     installed skills). Leave the surrounding CLI-primary/MCP-fallback prose unchanged.

2. **`# System Conventions` region** — leave the prose as shipped. Only substitute the
   remaining template tokens (`{{systemName}}`, `{{kitVersion}}`) the same way they're
   substituted everywhere else. Do not delete or rewrite the Wiki-Link, Person-File,
   Frontmatter, Rituals, or Canonical People Index sections.

Use targeted edits (replace the bracketed placeholders), not a full rewrite, so the
shipped conventions survive.

Tell the user: "Your CLAUDE.md is personalized and stamped with the kit version, and it
keeps the built-in graph/linking conventions. It's a living document — edit it anytime."

Update setup-state: step 17 complete.

---

## Section 18: Business/Personal Separation

Read `businessPersonalSplit` from the config.

If true:

"You wanted business and personal contexts kept separate. Here's how that works:
- Your vault stays one unified system (you want cross-references between life areas).
- Individual **projects** can carry their own CLAUDE.md that scopes Claude's behavior.
- Business projects reference the business bucket; personal projects reference personal buckets.
- The vault-level CLAUDE.md sees everything.

Want me to set up any project-level separations now, or handle that as projects come up?"

If false, skip this section.

Update setup-state: step 18 complete.

---

## Section 19: First Project

"Let's create your first project to make sure everything works together."

Ask: "What's something you're working on right now that you'd like Claude's help with? Side project, work task, learning something new — anything."

Use the `/new-project` skill to create it. Walk through each step so the user sees how it works:
- Directory creation
- CLAUDE.md with real context (wire its `## {{systemName}}` section to the matching vault bucket)
- Git init
- Shell alias
- Vault bucket reference

Update setup-state: step 19 complete.

---

## Section 20: Multi-Pane Workflow + First Ritual

"The real power of this setup is running multiple Claude Code sessions side by side — and now that a vault and a project both exist, `/letsgo` finally has something to read."

Guide the user (Ghostty shortcuts shown; if they kept their own terminal, use its split-pane shortcut):

1. "In Ghostty, press `Cmd+D` to split the terminal."
2. "In the new pane, `cd` to your new project and run `claude`."
3. "Type `/letsgo` — it should load context from the project we just created."
4. "Switch back to your other pane (`Cmd+[` / `Cmd+]`) — it's still in your vault."

"This is the workflow: vault in one pane for rituals and life management, project in another for focused work. As many panes as you want."

Then run one real **bookend** so they feel the loop:

5. "In your vault pane, run `/morning`. It'll check your calendar and email and help you set today's priorities."
6. "Later — or now, to see it — run `/shutdown` to close the day and set tomorrow's first move."

Update setup-state: step 20 complete.

---

## Section 21: Vault Git + Nightly Backup

Now that the vault has CLAUDE.md and rituals, initialize its git history. **GitHub backup is opt-in** — the default is local-only (Obsidian Git, already running from Section 7) plus a Time Machine nudge.

### Initialize the vault's git (fresh, no remote)

```bash
cd ~/{{systemName}} && git init && git add -A && git commit -m "Initial vault: structure, CLAUDE.md, rituals"
```

This is a **fresh** history with **no remote** — it does not inherit anything from the installer.

### Default backup: local

- **Obsidian Git** (Section 7) already auto-commits the vault on a timer — that's your version history.
- **Time Machine nudge:** "For real off-machine backup, turn on Time Machine (System Settings → General → Time Machine) with an external drive. Local git history protects against edits; Time Machine protects against a dead disk."

> **Don't run two pushers against one repo.** If you later add GitHub, let only one thing push the vault (either Obsidian Git **or** the nightly script — not both). Two committers on a timer caused a documented multi-day silent divergence.

### Optional: GitHub backup (only if the user opts in)

If the user wants off-machine git backup to GitHub:

```bash
# Confirm gh is authenticated first:
gh auth status

cd ~/{{systemName}}
gh repo create {{github-username}}/{{systemName}} --private --source . --remote origin
git push -u origin main
```

Then, if they also want **projects** backed up nightly, install the nightly script (scoped to projects to avoid colliding with Obsidian Git on the vault):

```bash
mkdir -p ~/.local/bin
cp setup-files/scripts/nightly-backup ~/.local/bin/nightly-backup
chmod +x ~/.local/bin/nightly-backup

# Substitute the system name into the copied script. The script ships with a
# literal `{{systemName}}` placeholder in its HEARTBEAT_DIR line; replace it
# with the real system name so the heartbeat dir matches the `~/.<name>-health`
# path the morning/shutdown rituals write to. macOS needs `sed -i ''`.
# REPLACE only the right-hand side below with the system name; the left-hand
# side must stay the literal token the script contains.
sed -i '' "s/{{systemName}}/<system-name>/g" ~/.local/bin/nightly-backup
```

> **Important:** in the `sed` above, the match pattern is the literal token
> `{{systemName}}` (exactly what the script file contains) and the replacement
> is the user's actual system name. For a system named `atlas` the command is:
> `sed -i '' "s/{{systemName}}/atlas/g" ~/.local/bin/nightly-backup`. This is
> the one place the script is intentionally edited at install — the env vars
> below still configure paths; this only resolves the heartbeat-dir name so it
> matches `~/.atlas-health`.

Set `VAULT_DIR`/`PROJECT_DIRS` via the env vars the script supports (don't otherwise hand-edit the script). Schedule with **launchd** (more reliable than cron on macOS — cron lacks the login env and Full Disk Access):

```bash
mkdir -p ~/Library/LaunchAgents
cat > ~/Library/LaunchAgents/com.{{systemName}}.nightly-backup.plist << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.{{systemName}}.nightly-backup</string>
  <key>ProgramArguments</key>
  <array><string>$HOME/.local/bin/nightly-backup</string></array>
  <key>EnvironmentVariables</key>
  <dict><key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string></dict>
  <key>StartCalendarInterval</key>
  <dict><key>Hour</key><integer>23</integer><key>Minute</key><integer>30</integer></dict>
  <key>StandardErrorPath</key><string>$HOME/.{{systemName}}-health/nightly-backup.err</string>
</dict></plist>
EOF

launchctl unload ~/Library/LaunchAgents/com.{{systemName}}.nightly-backup.plist 2>/dev/null
launchctl load ~/Library/LaunchAgents/com.{{systemName}}.nightly-backup.plist
```

The script pre-checks for a remote and writes an error to the heartbeat dir if none exists, so `system-health` surfaces a misconfigured backup the next morning. Tell the user to check the log the morning after the first run.

Update setup-state: step 21 complete.

---

## Section 22: System Health

"The system-health script checks that your automations are running. The morning ritual calls it automatically."

```bash
cp setup-files/scripts/system-health ~/.local/bin/system-health
chmod +x ~/.local/bin/system-health

# Substitute the system name into the copied script. system-health ships with a
# literal `{{systemName}}` placeholder in its HEARTBEAT_DIR line; replace it with
# the real system name so it reads the SAME `~/.<name>-health` dir the rituals
# and nightly-backup write to. Without this, system-health reads a literal
# `~/.{{systemName}}-health` path and reports morning/shutdown as NO HEARTBEAT
# forever. REPLACE only the right-hand side; the left must stay the literal token.
sed -i '' "s/{{systemName}}/<system-name>/g" ~/.local/bin/system-health

# Create the heartbeat directory (named after your system)
mkdir -p ~/.{{systemName}}-health
```

> Same rule as the nightly-backup `sed`: the match pattern is the literal
> `{{systemName}}` token the script contains, the replacement is the user's
> actual system name. For `atlas`:
> `sed -i '' "s/{{systemName}}/atlas/g" ~/.local/bin/system-health`. After this,
> the heartbeat dir the script reads (`~/.atlas-health`) exactly matches what
> `morning.md` and `shutdown.md` write to (`date +%s > "$HOME/.atlas-health/…"`).

Test it:

```bash
system-health
```

For the starter kit it tracks the components that actually write heartbeats (e.g. nightly-backup if you enabled it). It should report "not yet run" for anything that hasn't fired — that's expected; heartbeats appear as you use the system.

Update setup-state: step 22 complete.

---

## Section 23: Security Note

"One important note about security. As you use this system, you'll encounter skills and plugins from the community. Before installing a public skill or plugin:

1. **Read the source.** Skills are just markdown — easy to read. Plugins include shell scripts that run on your machine.
2. **Check the author.** Known, active GitHub account? Stars and usage?
3. **Be cautious with hooks.** Hooks run automatically and can block operations — a malicious hook could intercept your commands.
4. **The npm-install-guard hook** protects you from npm supply-chain attacks, but not from malicious Claude Code plugins.

Your global `ignore-scripts=true` (npm) is the first line of defense, the hooks are the second, common sense is the third. Remember Section 10 made two **machine-wide** changes (npm ignore-scripts, git core.excludesFile) — your prior configs are backed up as `.bak` if you ever want to revert."

Update setup-state: step 23 complete.

---

## Section 24: Done + What's Next

"Your personal operating system is built."

Present a summary of everything installed:

**Vault:** `~/{{systemName}}/`
- {{count}} buckets configured
- Self-knowledge ring (self-model, decisions, energy)
- Routing table
- 2 live ritual commands (`/morning`, `/shutdown`) + `/midday`, `/weekly` stubs

**Skills:** letsgo, handoff, new-project, obsidian-markdown + utility skills (defuddle, pdf, xlsx, docx, pptx, frontend-design) + any optional (x-reader, iMessage)
**Hooks:** 4 global (obsidian-lint, calendar-day-verify, load-core-artifacts, npm-install-guard) + 2 vault-scoped (read-before-claiming, lookup-before-asking)
**Automations:** Obsidian Git (vault) + optional nightly backup (projects)
**Tools:** Google Workspace CLI, calendar wrapper, task system, system-health
**Build:** KIT_VERSION {{kitVersion}} (test build — fixes hand-delivered, not via re-clone)

---

### Tomorrow's first move

1. Open your terminal
2. `cd ~/{{systemName}}`
3. `claude`
4. Type `/morning`

That single command checks your calendar and email, looks at your priorities, and helps you pick what to work on. End the day with `/shutdown`. That's the loop.

---

### FAQ

**Q: What if I miss a ritual?** Totally fine. Run whichever one you're near — the system picks up wherever you are. There's no streak to break.

**Q: morning/shutdown vs. letsgo/handoff — what's the difference?** A *day* is bookended by `/morning` and `/shutdown`. A *work session* is bookended by `/letsgo` (load context) and `/handoff` (save context). Days are about life; sessions are about a specific project.

**Q: Where do I put random thoughts, notes, files?** Drop them in `~/{{systemName}}/00-inbox/`. During a ritual, Claude helps route them to the right bucket.

**Q: How do I start a new project?** Just say "let's start a new project" — the `new-project` skill sets up the directory, CLAUDE.md, git, and an alias.

**Q: Why is my Obsidian graph mostly empty?** It fills as you (and Claude) add notes with `[[wikilinks]]`. Your CLAUDE.md tells Claude to link people/projects bidirectionally, so the graph grows as you use it. Day one is supposed to look sparse.

**Q: Should I connect Google through Claude's MCP connector?** No — use the `gws` CLI (already set up). The MCP connector is only a fallback for corporate domains that block self-created OAuth apps.

**Q: I see "BROKEN WIKI-LINK" warnings — is something wrong?** No. Unresolved links are normal Obsidian state; the lint hook is just nudging you to create the note when you're ready.

**Q: My midday/weekly rituals don't do much.** They're stubs in v1. Add steps to `~/{{systemName}}/.claude/commands/{midday,weekly}.md` when you want them.

**Q: How do I get updates to the kit?** This is a test build (KIT_VERSION {{kitVersion}}). Re-cloning would clobber your populated vault, so fixes are hand-delivered for now. Mention the version if you report an issue.

"Welcome to your personal OS."

Update setup-state: step 24 complete.
