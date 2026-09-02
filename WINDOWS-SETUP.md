# Windows Setup Spec (PC Install Path)

> **Field-validated Aug 17, 2026** on a fresh Windows 11 machine (Rob's install — 14 findings,
> `morgantown-ai_HANDOFF_v0007`), corrected Sept 1, 2026 from that run: install line `| bash`,
> wizard PATH step, WSL install verification, Windows Terminal procedure, the vault-location
> ruling, and the agent-driven handoff process. Still capture everything on every install.

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
memory=5GB
processors=4

[experimental]
autoMemoryReclaim=gradual
```

**`autoMemoryReclaim` must live under `[experimental]`, not `[wsl2]`** — under the wrong
section the key is silently ignored (verified against Microsoft's `.wslconfig` docs, Aug 2026).

Tune `memory` to the machine: **5 GB on a 16 GB laptop is the field-proven value** (Liz's
Weaver OOM crisis, May 12 2026 — 6 GB was still not enough headroom next to Teams + Edge +
Adobe + OneDrive). Lower on 8 GB; a 32 GB machine can take 8 GB. `processors` should be at
most half the machine's cores. After writing it, run `wsl --shutdown` and reopen Ubuntu.

### 2. Put the Obsidian vault on the Windows filesystem, symlinked into WSL

**Ruled Sept 1, 2026 (Bryan): the vault lives on the Windows side.** This reverses the previous
guidance, which said to keep it inside WSL. The reversal is field-driven: Julian's machine has run
the Windows-side layout daily for months with no problems, while the WSL-side layout was never
validated on a real install — and Julian's June notes record Obsidian failing to watch WSL paths
(EISDIR) when he tried the kit's layout.

The layout:

1. Vault directory on Windows: `C:\Users\<user>\<systemName>` — directly under the profile,
   **not** under `Documents`. Windows Obsidian opens it as a plain local folder.
   **Why not Documents (Sept 2, 2026):** on corporate Microsoft 365 machines OneDrive's Known
   Folder Move redirects Documents (and Desktop) into cloud sync. A vault there means OneDrive
   syncing `.git` and `.obsidian`, lock churn against Obsidian, and Files-On-Demand placeholders
   that WSL reads as I/O errors. The profile root is never redirected.
2. Symlink it into the WSL home so every kit path works unchanged. **Order matters: do this
   BEFORE `SETUP.md` Section 6 runs `mkdir -p ~/<systemName>`**, otherwise the vault becomes a
   real WSL directory and the link nests inside it. Never guess the Windows username — ask:
   ```bash
   WINHOME="$(wslpath -u "$(cmd.exe /c 'echo %USERPROFILE%' 2>/dev/null | tr -d '\r')")"
   mkdir -p "$WINHOME/<systemName>"
   ln -s "$WINHOME/<systemName>" ~/<systemName>
   readlink -f ~/<systemName>     # must start with /mnt/c/
   ```
3. Claude Code and all scripts use `~/<systemName>/` exactly as the Mac guide does — **except
   where a path is baked into a file** (`VAULT_PATH` in `~/.claude/settings.json`, the
   `{{vaultPath}}` token in `ob`): there, use the resolved path from `readlink -f`. `find` on a
   bare symlink does not descend, so the symlink path would make `ob` and `obsidian-lint`
   silently see an empty vault.
4. **Git for Windows** — Obsidian on Windows runs the Obsidian Git plugin with *Windows* git;
   WSL's git is invisible to it. Install during the WSL reboot dead time, from PowerShell:
   `winget install --id Git.Git -e --source winget`, then `git config --global core.autocrlf false`
   in PowerShell (two gits on one repo otherwise churn line endings). If winget or the installer
   is blocked by policy, remove `"obsidian-git"` from the vault's `.obsidian/community-plugins.json`
   before Obsidian first opens and treat version history as a week-two item.

Known cost: `/mnt/c/...` crosses the VM boundary on the 9P protocol, which is slower than native
Linux disk. In months of daily field use this has not mattered. If a future install hits real
file-lock conflicts with Obsidian's live sync, capture the evidence before revisiting — do not
preemptively migrate a vault into WSL.

### Username gotcha

Never hardcode the username in any walkthrough command — use `$HOME` or `$(whoami)`. Liz's Windows
username was `eliza`, not `liz`; a hardcoded `/home/liz` would have silently operated on nothing.

---

## Installing WSL2 + Ubuntu (verify, don't trust)

`wsl --install` from an **admin** PowerShell installs the Windows features, the WSL2 kernel, AND
Ubuntu in one command. Elevation is its own step: right-click Windows Terminal → Run as
administrator. Then reboot — the reboot is required, not optional.

**`wsl --install` has a partial-failure mode where everything looks like success** (command runs,
download scrolls, reboot happens) but the distro never installed — a DNS hiccup during the fetch is
enough (this exact failure hit Rob's install, Aug 17 2026). So after the reboot, verify before
anything else:

```powershell
wsl -l -v    # must list Ubuntu. "no installed distributions" = the distro fetch failed.
```

Recovery if it failed: `wsl --list --online`, then `wsl --install -d <exact name>` (often
`Ubuntu-24.04`, not `Ubuntu`). Fallback: install Ubuntu from the Microsoft Store.

First launch of Ubuntu prompts for a UNIX username and password, independent of the Windows
account. **The password field shows nothing while you type** — that's normal, keep typing. This
password is also the `sudo` password; write it down for the client.

Two more Windows quirks, so nobody burns time on them:
- The Start-menu shortcut may register as `Ubuntu 24.04 LTS` or not appear at all. `wsl -l -v` is
  the success signal, not the Start menu.
- A newly installed distro won't show in Windows Terminal's dropdown until Terminal is fully
  closed and reopened — profiles generate at launch.

## Configure Windows Terminal (do this before handing the keyboard over)

The mental model, in client-facing language: on a Mac there's Ghostty (the window) and zsh (the
thing inside it that runs commands). The PC has the same stack plus one twist — Windows Terminal
is the window, PowerShell is a shell that talks to Windows, and Ubuntu is a whole second operating
system living inside the machine. The system gets installed entirely on the Ubuntu side.
PowerShell gets used exactly once, to install WSL, and then never again.

The factory default profile is PowerShell, so the + button drops the client into the wrong world.
Fix it (20 seconds): **Windows Terminal → Settings → Default profile → Ubuntu → Save.** While in
Settings: light theme if the client prefers it, and a comfortable font size. After this, every new
tab and window opens straight into Ubuntu and PowerShell disappears from the client's life.

## WSL prerequisites (run once, right after creating the Ubuntu user)

**Fastest path (Sept 2, 2026): the whole block below is one command**, served from the wizard's
domain, typed by hand inside Ubuntu:

```bash
curl -fsSL https://personal-os-starter.vercel.app/pc.sh | bash
```

It installs the packages, Node, and Claude Code; writes PATH to both rc files; writes
`.wslconfig` sized to the machine; clones the kit to `~/personal-os-installer`; copies
`user-config.json` in from Windows Downloads (OneDrive-aware); and tries Git for Windows via
winget. Then it tells you to reboot and run `cd ~/personal-os-installer && claude`. Re-running
it is safe. The manual block below is the fallback and the record of what it does.

Fresh Ubuntu doesn't ship everything the kit assumes. Install these **before** running `SETUP.md`, in this order:

```bash
# 1. System packages the hooks and scripts depend on
sudo apt update
sudo apt install -y jq build-essential python3 python-is-python3

# 2. Node.js via nvm — installs into your home dir, so 'npm install -g'
#    never hits the root-owned-folder permission (EACCES) error.
#    Check https://github.com/nvm-sh/nvm for the current release tag first —
#    v0.40.1 and earlier carry 2026 CVEs (command injection via mirror metadata).
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.6/install.sh | bash
source ~/.bashrc
nvm install --lts
# Expose node/npm to non-interactive shells (hooks, scheduled jobs): Ubuntu's
# .bashrc early-returns for non-interactive shells, so nvm alone is invisible there.
mkdir -p ~/.local/bin
for b in node npm npx; do ln -sf "$(command -v $b)" ~/.local/bin/$b; done

# 3. Claude Code — NATIVE installer, exactly like the Mac guide (Section 0).
#    NEVER npm-install it: the kit later sets `npm config set ignore-scripts true`
#    machine-wide, which breaks the npm package's post-install wiring (the known
#    failure loop SETUP.md Section 0 documents). The Linux native installer
#    works unchanged inside WSL2 Ubuntu:
curl -fsSL https://claude.ai/install.sh | bash

# 4. Put ~/.local/bin on PATH — the kit installs calendar-agenda,
#    nightly-backup, and system-health there (and claude lands there too).
#    Write it to BOTH rc files: .bashrc for interactive shells, .profile for
#    login/non-interactive shells (scheduled jobs).
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.profile
source ~/.bashrc
command -v claude && claude --version   # must resolve before continuing
```

Why each one:
- **`jq`** — required by all seven hooks (`npm-install-guard`, `read-before-claiming`, `terminal-context-guard`, etc.); not preinstalled on Ubuntu. Without it the hooks error on every fire and Claude Code gets erratic.
- **`build-essential` / `python3`** — needed by setup scripts and native npm modules.
- **nvm for Node** — Ubuntu has no Node by default, and a system `npm install -g` fails with EACCES on a root-owned prefix. nvm avoids both. (This is exactly the wall Julian hit on his beta run, June 1 2026.) The `~/.local/bin` symlinks matter because nvm's PATH lives in `.bashrc`, which non-interactive shells never read.
- **`~/.local/bin` on PATH** — WSL has no macOS `path_helper`, so without this line the calendar wrapper, nightly backup, and health check are "command not found."

---

## The Handoff Point: once `claude` is authenticated, stop typing commands

**This is the install process as of Sept 2026 (finding 13, Rob's install; ratified by Bryan
Sept 1, 2026).** The manual phase ends the moment Claude Code runs and is authenticated.
Everything after that is agent-driven:

1. **Manual (human at the keyboard):** WSL2 + Ubuntu, Windows Terminal config, `.wslconfig`,
   the prerequisites above, Git for Windows, Claude Code install, `claude` auth. Nothing exists to delegate to yet.
2. **Handoff.** `claude` runs and is signed in. Stop typing commands.
3. **Agent-driven (human approving):** start Claude Code and hand it this doc plus `SETUP.md` as
   its runbook — repo clone, `user-config.json` placement (it lives on the Windows side, in
   `Downloads` or `OneDrive\Downloads`; the agent copies it in), vault symlink **then** scaffold,
   skills and hooks, and — only when the client has a Google account — the OAuth file moves and
   scheduler wiring. The agent executes; the installer and client read and approve each step.

Why: the agent runs *inside* WSL, resolves Linux paths natively, probes both Windows Downloads
locations itself, and self-corrects when a path is wrong. Every manual cross-boundary file move
(`/mnt/c/...` vs `\\wsl.localhost\...`) is a chance to fumble — this class of error has bitten
both real PC installs. Delegating it removes the class. It also shows the client the product
doing real work on their machine inside the first hour, which is the sale.

**Reboot checkpoint before the handoff:** after WSL is installed, `.wslconfig` written, the
distro registered, and PATH changed, reboot Windows once more before starting the wiring phase.
Stale interop state in a session that had all of that changed underneath it produces impossible
symptoms (Rob's install: clipboard paste into Claude Code failing with an image confirmed on the
clipboard; a restart fixed it instantly). General rule: on Windows, when something clipboard- or
interop-related behaves impossibly, reboot before debugging.

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
| Vault at `~/<systemName>/`, Obsidian opens it directly | Vault at `C:\Users\<user>\<systemName>` (profile root, not Documents/OneDrive; Windows Obsidian opens it directly); `~/<systemName>` is a symlink to it inside WSL, created BEFORE Section 6 (hardening fix #2) |
| **Section 7: Obsidian Git** uses the Mac's git | Needs **Git for Windows** (`winget install --id Git.Git -e`), installed during reboot dead time; `core.autocrlf false`. If blocked, drop `obsidian-git` from `community-plugins.json` for week one (hardening fix #2, item 4) |
| `.zshrc` aliases | `.bashrc` aliases (Ubuntu default shell) |
| **Section 12 — Google OAuth app:** create the app + place `client_secret.json` (`mv ~/Downloads/...`) | **Browser steps are identical** (create project → enable Gmail + Calendar APIs → consent screen + add every connecting account as a **test user** → Desktop OAuth client → download JSON). The difference is the file move: the JSON downloads on the **Windows** side, but `gws` runs in WSL and reads the Linux path. **OneDrive gotcha:** on most personal laptops, Known Folder Move relocates Downloads to `C:\Users\<u>\OneDrive\Downloads` — never assume the bare path (this bit Liz's Desktop in April 2026). Probe both, quoted against spaces in usernames: `WU="<WindowsUser>"; mkdir -p ~/.config/gws && cp "/mnt/c/Users/$WU/OneDrive/Downloads/"client_secret_*.json ~/.config/gws/client_secret.json 2>/dev/null \|\| cp "/mnt/c/Users/$WU/Downloads/"client_secret_*.json ~/.config/gws/client_secret.json`. Then verify: `ls ~/.config/gws/client_secret.json`. Same troubleshooting and "add yourself as a test user" rules from SETUP.md apply — and **publish the OAuth app out of Testing mode** or tokens die every 7 days (Becky's silent weekly failure). |
| Wispr Flow dictation | **Handy** (handy.computer) — free, open-source, has a custom-word glossary; field-validated on Rob's install Aug 17 2026. Wispr Flow also runs on Windows now (paid) if the client already uses it. Win+H is the zero-install fallback but has no glossary. |
| iMessage self-text capture skill | Not available on Windows — skip or substitute |

Everything else (skills, hooks, vault template, rituals, Google Workspace CLI, task system, claude-hud)
ports directly because it lives inside the Linux shell — with **two** exceptions:

1. The Google OAuth `client_secret.json` downloads on the Windows side and must be copied into WSL
   (see the Section 12 row above) — otherwise `gws auth login` won't find it.
2. **Section 23's scheduling does NOT port.** launchd doesn't exist on Linux, and cron/systemd
   *inside* WSL never fire either — WSL isn't running overnight (it exits ~60s after the last
   shell closes). Use the Task Scheduler pattern below; without it the nightly backup silently
   never runs and system-health shows "not yet run" forever.

---

## Scheduling on PC: Windows Task Scheduler → wsl.exe (replaces Section 23's launchd)

Windows Task Scheduler is the only scheduler that's actually awake at 11:30 PM. It starts WSL
itself, so nothing depends on the VM already running. Create the task from an **admin PowerShell**
(substitute the Linux username and vault dir — never hardcode, ask the machine):

```powershell
schtasks /Create /TN "PersonalOS-NightlyBackup" /SC DAILY /ST 23:30 /F /TR "wsl.exe -d Ubuntu -u <linuxUser> -- /bin/bash -lc 'VAULT_DIR=\$HOME/<vaultDir>/ \$HOME/.local/bin/nightly-backup'"
```

Why each piece:
- **`-d Ubuntu`** — confirm the real distro name first with `wsl -l -v`; fresh installs are often
  `Ubuntu-24.04`, not `Ubuntu`.
- **`bash -lc`** — a login shell reads `~/.profile`, which is why the prerequisites above write
  PATH (and the env-var mirrors) there. Plain `bash -c` gets a bare PATH and dies "command not found."
- **`VAULT_DIR=` inline** — the script requires it and has no default. A missing `VAULT_DIR` is the
  #1 silent-scheduled-backup failure from the Mac kit (Darin's install); same rule here.
- **Git auth note:** run one manual `git push` from inside WSL first so the credential is stored
  Linux-side (`gh auth login` or a stored HTTPS credential). The macOS keychain failure mode doesn't
  exist here, but an unauthenticated repo fails the same way — and the script's honest heartbeat
  will correctly refuse to go green.

**Power settings are part of the install (Liz doctrine, July 2026):** plugged in → sleep Never,
lid close → Do nothing, and pause Windows Update during the install day. Do NOT use PowerToys
Awake or keep-awake apps — they release the wake-lock at the lock screen. A machine that sleeps
at 11 PM has no nightly anything.

**Verify next morning** (not on install day): `system-health` inside WSL must show a fresh
`nightly-backup` heartbeat. "The task ran" per Task Scheduler is not the check — the honest
heartbeat is.

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

## Beta History

**Julian ran the first PC beta (June 1–2, 2026, system `neurula`)** and hit seven blockers, all
fixed same-day in commit `7affde2`: Node missing from the PC preflight, npm EACCES (→ the nvm
step above), a literal `[repo-url]` placeholder in the wizard's clone step, the repo being
private, a zsh shebang in `system-health`, root-owned `/usr/local/bin` installs (→ `~/.local/bin`),
and `user-config.json` landing on the Windows side of the divide. His install has run daily since,
but was never formally confirmed complete against the checklist.

**Liz's Weaver (April 24, 2026, Windows 11 / 16 GB)** remains the only completed real-world PC
install. Her May 12 OOM crisis produced the 5 GB `.wslconfig` value above; her OneDrive Desktop
redirect produced the Downloads-probe rule in Section 12.

**This doc was audited and corrected August 17, 2026** (three-way review: Claude + Codex + Grok
against current Microsoft/Anthropic docs), then **corrected again September 1, 2026** from Rob's
Aug 17 field run (the audit missed the `| sh` failure because the line *reads* correct — the
failure only appears on real Ubuntu, where `/bin/sh` is dash). Still open: graduating the WSL2
steps into wizard steps, a native-Windows fallback runbook, and an iMessage-capture substitute.
Capture what breaks on the next install and fold it back in.
