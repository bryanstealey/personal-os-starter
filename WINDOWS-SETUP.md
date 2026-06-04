# Windows Setup Spec (PC Install Path)

This is the decision record and install spec for running the Personal OS on a Windows PC.
`SETUP.md` is written for macOS. Everything below is what changes when the client is on a PC.

The single most important question in the whole onboarding is **"Are you on a PC or a Mac?"** It
comes first, before anything else, because it dictates the entire install path. A PC answer forks
the terminal, the runtime, the file paths, and several setup sections.

---

## The Decision

**Default for Windows clients: Windows Terminal + WSL2 Ubuntu, hardened.**

This is the same architecture used for Liz Cook's install (April 2026), now turned into a deliberate
product spec instead of a battlefield improvisation — with the two real failure modes fixed up front.

**Fallback: native Windows + Git for Windows** — only when WSL2 is genuinely blocked (corporate machine
with virtualization disabled by IT policy).

### Why WSL2 and not native Windows

Claude Code now officially supports native Windows (`winget install Anthropic.ClaudeCode`, one command,
no WSL). Native is easier to *install* — and that is its only advantage. It loses on everything that
matters once the client is running:

- **One support playbook.** WSL2's Linux shell is nearly identical to Bryan's macOS shell. CLAUDE.md,
  hooks, skills, and support scripts port directly. Native Windows uses a different shell, different
  paths, and different env-var syntax, so every Windows support call becomes a new failure mode to learn.
- **Native Windows breaks in ways you can't diagnose remotely.** Git Bash detection regresses between
  Claude Code releases (recurring GitHub issues), PowerShell execution policy blocks scripts on managed
  machines, PATH not refreshing after install. None of these are one-time setup steps.
- **The install cost is yours, not the client's.** This is a done-for-you, full-day install. The client
  never runs the WSL2 setup themselves — Bryan (or Julian) does it once during the paid install day. So
  WSL2's only downside is absorbed into one afternoon, and the parity payoff lasts the life of the engagement.

### Terminal: Windows Terminal

Researched June 2026. Windows Terminal is the default for non-technical clients:

- Pre-installed on Windows 11, GUI settings panel (light theme is a dropdown — no config file), native
  first-party WSL2 integration. Zero third-party trust friction, no account, no upsell.
- **Ghostty is not available on Windows.** Only an early Win32-skeleton PR exists (April 2026) — no
  installer, no release. Realistically a 2027+ story. Community ports (Winghostty) are unsigned, trip
  SmartScreen, and require config-file editing. Not for this audience.
- **Warp is a trap, not a shortcut.** It ships its own AI agent and is actively positioning to replace
  Claude Code. Two competing AI agents in one pane plus a mandatory account = exactly the confusion we're
  avoiding.
- **Tabby** is the one upgrade worth knowing about — closest thing to Ghostty's polished feel on Windows,
  single `.exe` installer, GUI config. Offer it only if a client wants it to look nicer. Not the default.

---

## The Two Hardening Fixes (mandatory on every Windows install)

These turn the improvised Liz setup into a repeatable product.

### 1. Cap WSL2 memory with `.wslconfig`

WSL2's default 50% RAM allocation fights Windows for memory and OOM-kills Claude Code on smaller
machines. This is the crash that hit Liz on her 16 GB laptop. Ship this file as part of every install,
at `C:\Users\<user>\.wslconfig`:

```
[wsl2]
memory=6GB
processors=4
autoMemoryReclaim=gradual
```

Tune `memory` to the machine: ~6 GB on a 16 GB laptop, lower on 8 GB. After writing it, run
`wsl --shutdown` and reopen Ubuntu.

### 2. Put the Obsidian vault inside WSL

Do **not** leave the vault on the Windows side (`C:\Users\...`) with Claude Code reaching it via
`/mnt/c/...` — that path crosses the VM boundary on the slow 9P protocol and causes file-lock conflicts
with Obsidian's live sync.

Instead, keep the vault in WSL's home directory (`~/<systemName>/`) and point the Windows Obsidian app
at it via `\\wsl.localhost\Ubuntu\home\<user>\<systemName>`. One-time migration during setup; after that
Claude Code and Obsidian read the same files at native Linux speed.

### Username gotcha

Never hardcode the username in any walkthrough command — use `$HOME` or `$(whoami)`. Liz's Windows
username was `eliza`, not `liz`; a hardcoded `/home/liz` would have silently operated on nothing.

---

## WSL prerequisites (run once, right after creating the Ubuntu user)

Fresh Ubuntu doesn't ship everything the kit assumes. Install these **before** running `SETUP.md`, in this order:

```bash
# 1. System packages the hooks and scripts depend on
sudo apt update
sudo apt install -y jq build-essential python3 python-is-python3

# 2. Node.js via nvm — installs into your home dir, so 'npm install -g'
#    never hits the root-owned-folder permission (EACCES) error
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install --lts

# 3. Claude Code (now that Node exists)
npm install -g @anthropic-ai/claude-code

# 4. Put ~/.local/bin on PATH — the kit installs calendar-agenda,
#    nightly-backup, and system-health there
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

Why each one:
- **`jq`** — required by all six hooks (`npm-install-guard`, `read-before-claiming`, etc.); not preinstalled on Ubuntu. Without it the hooks error on every fire and Claude Code gets erratic.
- **`build-essential` / `python3`** — needed by setup scripts and native npm modules.
- **nvm for Node** — Ubuntu has no Node by default, and a system `npm install -g` fails with EACCES on a root-owned prefix. nvm avoids both. (This is exactly the wall Julian hit on his beta run.)
- **`~/.local/bin` on PATH** — WSL has no macOS `path_helper`, so without this line the calendar wrapper, nightly backup, and health check are "command not found."

---

## What Changes vs. the Mac Guide

The PC path replaces or rewrites these `SETUP.md` sections:

| Mac (SETUP.md) | PC equivalent |
|---|---|
| Preflight checks for **Ghostty** | Check for **Windows Terminal + WSL2 Ubuntu** instead |
| (no equivalent) | **New step:** WSL2 install via admin PowerShell (`wsl --install`), create Ubuntu user, then the WSL prerequisites above (jq, build tools, Node via nvm, `~/.local/bin` on PATH) |
| (no equivalent) | **New step:** write `.wslconfig` (RAM cap), `wsl --shutdown`, restart |
| **Section 8: Configure Ghostty** (`~/.config/ghostty/config`) | **Configure Windows Terminal** — set Ubuntu as default profile, light theme, font size. No Ghostty. |
| Pane shortcuts (Ghostty) | Windows Terminal pane shortcuts (Alt+Shift+± to split) |
| Vault at `~/<systemName>/`, Obsidian opens it directly | Vault in WSL home; Windows Obsidian opens `\\wsl.localhost\Ubuntu\home\<user>\<systemName>` |
| `.zshrc` aliases | `.bashrc` aliases (Ubuntu default shell) |
| **Section 12 — Google OAuth app:** create the app + place `client_secret.json` (`mv ~/Downloads/...`) | **Browser steps are identical** (create project → enable Gmail + Calendar APIs → consent screen + add every connecting account as a **test user** → Desktop OAuth client → download JSON). The difference is the file move: the JSON downloads on the **Windows** side, but `gws` runs in WSL and reads the Linux path. Copy it across: `mkdir -p ~/.config/gws && cp /mnt/c/Users/<WindowsUser>/Downloads/client_secret_*.json ~/.config/gws/client_secret.json`. Same `~/.config/gws/` troubleshooting and "add yourself as a test user" rules from SETUP.md apply. |
| Wispr Flow dictation | Win+H dictation |
| iMessage self-text capture skill | Not available on Windows — skip or substitute |

Everything else (skills, hooks, vault template, rituals, Google Workspace CLI, task system, claude-hud)
ports directly because it lives inside the Linux shell. The **one** exception is the Google OAuth
`client_secret.json`: the browser downloads it on the Windows side, so it must be copied into WSL
(see the Section 12 row above) — otherwise `gws auth login` won't find it.

---

## What Changes in the Web App (`app/page.tsx`) — IMPLEMENTED

The fork is built using conditional rendering — one wizard, branching only where it matters:

1. **Platform gateway** — a full-screen "Are you on a PC or a Mac?" choice sits between Welcome and
   Preflight (steps -2 → -1 → 0), so the numbered steps and progress bar are untouched. Continue is
   disabled until a choice is made. Stored as `platform: "mac" | "pc" | null`.
2. **Preflight step** — renders Windows Terminal + WSL2/Ubuntu + Obsidian + Claude Code on PC instead of
   the Mac/Homebrew tool list.
3. **Terminal step** — copy switches between "Ghostty" and "Windows Terminal"; the `ghosttyTheme` field
   was renamed to the platform-neutral `terminalTheme`.
4. **Review + Export** — Review shows a Platform row; the exported `user-config.json` carries `platform`
   (whole config is serialized), and the Export "open your terminal" step names Windows Terminal on PC.

`SETUP.md` reads `platform` up front and points the PC path at this doc; Section 8 (Configure Terminal)
branches to "Configure Windows Terminal" for PC.

**Still Mac-only / TODO before Julian's beta:** the PC Preflight currently links to generic install docs
but the actual WSL2-install walkthrough, the `.wslconfig` write step, and the vault-in-WSL migration live
in this doc, not yet as guided web-app steps. Decide during Julian's run whether those need their own
wizard steps or stay runbook-driven.

---

## Beta Test

**Julian is the first PC beta tester** — he'll stand this up on his own Windows machine. He's the proof
that the spec is repeatable by someone other than Bryan, and the first real test of whether the two
hardening fixes hold under a fresh install. Capture what breaks and fold it back into this doc.
