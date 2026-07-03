# Uninstall

You are reversing what `SETUP.md` did. This guide is for the same Claude Code
session model as the setup itself: your user's own Claude, working directly with
your user, running these steps together — not a generic operator script.

**Read this before doing anything.** `SETUP.md` made two kinds of changes:
machine-wide changes (global config that affects every project on this machine)
and your user's own data (the vault, and any projects created along the way).
This guide reverses every machine-wide change. It does **not** touch your user's
data — the vault and any repos it created are theirs, and deleting them is
entirely their call, covered at the end.

**Go in order, and confirm with your user before each destructive step.**
Several of the changes below have `.bak` backups from before the kit touched
them — restore those instead of deleting outright wherever a backup exists.

---

## 1. Claude Code global settings (`~/.claude/settings.json`)

SETUP.md Section 10 wrote `env` (`MAX_OUTPUT_TOKENS`, `NO_FLICKER`, `VAULT_PATH`),
a `permissions.allow` array for the chosen permission mode, and Section 11 added a
`hooks` block (`PostToolUse` → obsidian-lint, `PreToolUse` → calendar-day-verify +
npm-install-guard, `SessionStart` → load-core-artifacts). If your user ran
`/claude-hud:setup` in Section 9, it may also have added a `statusLine` block.

```bash
ls ~/.claude/settings.json.bak 2>/dev/null
```

**If a `.bak` exists** and your user never customized `~/.claude/settings.json`
themselves after setup ran: restore it.

```bash
cp ~/.claude/settings.json ~/.claude/settings.json.removed-by-kit
cp ~/.claude/settings.json.bak ~/.claude/settings.json
```

**If no `.bak` exists, or your user added their own settings since**: don't blind
overwrite. Read the current file, remove only the kit's additions (the `env` keys
above, the four hook entries listed above, and the `statusLine` block if present),
and keep everything else your user configured independently.

```bash
python3 -c "import json; json.load(open('$HOME/.claude/settings.json')); print('settings.json OK')"
```

## 2. The vault's own settings (`~/{{systemName}}/.claude/settings.json`)

Section 11 also registered two **vault-scoped** Stop hooks (read-before-claiming,
lookup-before-asking) here. This file lives inside the vault, so it's covered by
the "vault is your user's data" rule below — but if your user is uninstalling the
*kit's tooling* while keeping the *vault*, remove the `Stop` hooks block from this
file specifically (leave everything else in the vault's settings alone).

## 3. Copied commands and skills (`~/.claude/commands/`, `~/.claude/skills/`)

```bash
rm -f ~/.claude/commands/letsgo.md ~/.claude/commands/handoff.md

rm -rf ~/.claude/skills/new-project \
       ~/.claude/skills/defuddle ~/.claude/skills/pdf ~/.claude/skills/xlsx \
       ~/.claude/skills/docx ~/.claude/skills/pptx ~/.claude/skills/frontend-design \
       ~/.claude/skills/claude-hud ~/.claude/skills/check-anthropic \
       ~/.claude/skills/x-reader ~/.claude/skills/imessage
```

Only remove what's actually there — `x-reader` and `imessage` were opt-in and may
not exist. Don't remove any skill your user installed themselves outside this kit
(check the directory listing first if you're unsure which came from where).

## 4. Hook scripts (`~/.claude/hooks/`)

```bash
rm -f ~/.claude/hooks/obsidian-lint.sh \
      ~/.claude/hooks/calendar-day-verify.sh \
      ~/.claude/hooks/load-core-artifacts.sh \
      ~/.claude/hooks/npm-install-guard.sh \
      ~/.claude/hooks/read-before-claiming.sh \
      ~/.claude/hooks/lookup-before-asking.sh
```

(Do this **after** step 1/2, so the settings files no longer point at these
scripts before they're removed.)

## 5. skill-creator plugin (if installed)

```bash
claude plugin uninstall skill-creator@claude-plugins-official
```

Leave the marketplace itself added (`claude plugin marketplace add
anthropics/claude-plugins-official`) unless your user is sure they won't use any
other plugin from it — it's just a registered source, not something running on
its own.

## 6. npm global setting: `ignore-scripts`

```bash
npm config get ignore-scripts
```

This was set to `true` machine-wide in Section 10 as a supply-chain defense. If
your user wants it reverted:

```bash
npm config delete ignore-scripts
```

Tell your user plainly what they're giving up: without this, npm packages can run
arbitrary lifecycle scripts on install again. Most people should leave this one
alone even if they uninstall everything else.

## 7. Global git config: `core.excludesFile`

```bash
git config --global core.excludesFile
ls ~/.gitignore_global.bak 2>/dev/null
```

**If a `.bak` exists:**

```bash
cp ~/.gitignore_global ~/.gitignore_global.removed-by-kit
cp ~/.gitignore_global.bak ~/.gitignore_global
```

**If your user wants the global excludesFile setting itself removed** (not just
the file contents reverted):

```bash
git config --global --unset core.excludesFile
```

## 8. Google Workspace CLI

```bash
npm uninstall -g @googleworkspace/cli
rm -rf ~/.config/gws
# Remove each additional-account config dir your user set up, e.g.:
rm -rf ~/.config/gws-{{alias}}
```

This deletes the OAuth `client_secret.json` and any cached tokens. Your user's
Google account itself is untouched — this only removes the local CLI and its
credentials. If they created a dedicated GCP project for this (Section 12), that's
a cloud resource, not a local file — see step 12 below.

## 9. Local scripts (`~/.local/bin/`)

```bash
rm -f ~/.local/bin/calendar-agenda \
      ~/.local/bin/system-health \
      ~/.local/bin/nightly-backup \
      ~/.local/bin/ob
# Remove each additional-account gws wrapper your user set up, e.g.:
rm -f ~/.local/bin/gws-{{alias}}
```

Leave `~/.local/bin/claude` alone — that's the Claude Code binary itself, not
something this kit installed as its own content.

## 10. launchd job (nightly backup, if GitHub backup was enabled)

```bash
launchctl unload ~/Library/LaunchAgents/com.{{systemName}}.nightly-backup.plist 2>/dev/null
rm -f ~/Library/LaunchAgents/com.{{systemName}}.nightly-backup.plist
```

## 11. Shell rc-file appends (`~/.zshrc` or `~/.bashrc`)

The kit appended a handful of lines across setup — the `~/.local/bin` PATH export
(Section 0), `CALENDAR_ACCOUNTS` (Section 13), and `TODOIST_API_TOKEN` if Todoist
was chosen (Section 14). These are plain `export` lines, not a block with clean
markers, so **don't blind-delete the whole rc file** — open it and remove these
specific lines by hand (or with your user watching), leaving anything else in the
file untouched:

```
export PATH="$HOME/.local/bin:$PATH"
export CALENDAR_ACCOUNTS='[[...]]'
export TODOIST_API_TOKEN="..."
```

After editing, `source` the rc file (or open a new terminal tab) so the running
shell matches the file.

## 12. Heartbeat directory

```bash
rm -rf ~/.{{systemName}}-health
```

## 13. Ghostty config (only if the kit created it)

Only remove this if Section 8 actually wrote `~/.config/ghostty/config` — skip
entirely if your user brought their own terminal and config.

```bash
rm -rf ~/.config/ghostty
```

## 14. GCP project (cloud resource — manual, not scriptable)

If your user created a dedicated Google Cloud project for the OAuth app in
Section 12, deleting the local `client_secret.json` (step 8) doesn't delete the
cloud project itself. To remove it: **console.cloud.google.com** → project
dropdown → select the project created for this kit → **IAM & Admin → Settings**
→ **Shut down**. This is optional — an unused GCP project with no billing enabled
costs nothing sitting idle, so there's no urgency here.

## 15. Your vault and any projects — your data, your call

Nothing above touches `~/{{systemName}}/` or any project directories created
during setup. That's your user's actual content — their buckets, their daily
notes, their CLAUDE.md, their conversations with Claude captured in handoffs.
This kit doesn't get to decide whether that goes away.

If your user wants it gone too:

```bash
rm -rf ~/{{systemName}}
```

If it has a GitHub remote (Section 23, opt-in), the remote repo isn't deleted by
this — that's a separate, deliberate step on GitHub's side
(`gh repo delete <owner>/<repo>` **only if your user explicitly confirms**; this
is unrecoverable).

---

## Verify

```bash
python3 -c "import json; json.load(open('$HOME/.claude/settings.json')); print('settings.json still parses OK')" 2>/dev/null || echo "settings.json missing or invalid — check step 1"
ls ~/.claude/commands/ ~/.claude/skills/ ~/.claude/hooks/ 2>/dev/null
npm config get ignore-scripts
git config --global core.excludesFile
```

Tell your user what's left standing versus what's gone, plainly. If they only
wanted the kit's automation removed and kept the vault, say so clearly: "Your
vault is untouched at `~/{{systemName}}/` — everything else is reverted."
